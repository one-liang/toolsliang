import type { LocalAssetStore } from './repository'
import {
  LOCAL_ASSET_DB_NAME,
  LOCAL_ASSET_DB_VERSION,
  LOCAL_ASSET_STORE,
  planDatabaseUpgrade,
  type LocalAssetRecord,
} from './schema'
import type { StorageEstimateLike } from './usage'

/**
 * The only place this feature touches the browser database. It stays thin — open,
 * migrate, read, write, delete — so the rules about versions, quota and damaged
 * records live in modules that can be verified without a browser, and the
 * browser suite only has to prove that this adapter reaches real storage.
 */
export async function openLocalAssetStore(): Promise<LocalAssetStore> {
  const database = await openDatabase()

  return {
    list: () => request<unknown[]>(readTransaction(database).getAll()),

    /** One transaction for the whole batch, so an import cannot land halfway. */
    putAll: records => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(LOCAL_ASSET_STORE, 'readwrite')
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new DOMException('write aborted', 'UnknownError'))
      transaction.onerror = () => reject(transaction.error ?? new DOMException('write failed', 'UnknownError'))

      const store = transaction.objectStore(LOCAL_ASSET_STORE)
      for (const record of records) store.put(toStoredRecord(record))
    }),

    remove: id => request(writeStore(database).delete(id)).then(() => undefined),
    clear: () => request(writeStore(database).clear()).then(() => undefined),
    estimate: () => estimateStorage(),
  }
}

/**
 * Structured clone keeps a `Uint8Array` intact, but not a view onto a larger
 * buffer, so the payload is copied to exactly its own bytes before it is
 * stored.
 */
function toStoredRecord(record: LocalAssetRecord): LocalAssetRecord {
  if (record.payload.format !== 'binary') return record

  return { ...record, payload: { ...record.payload, bytes: new Uint8Array(record.payload.bytes) } }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new DOMException('IndexedDB is unavailable', 'NotSupportedError'))
  }

  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(LOCAL_ASSET_DB_NAME, LOCAL_ASSET_DB_VERSION)

    opening.onupgradeneeded = (event) => {
      const database = opening.result
      for (const step of planDatabaseUpgrade(event.oldVersion, event.newVersion ?? LOCAL_ASSET_DB_VERSION)) {
        const store = database.objectStoreNames.contains(step.store)
          ? opening.transaction!.objectStore(step.store)
          : database.createObjectStore(step.store, { keyPath: step.keyPath })

        for (const index of step.indexes) {
          if (!store.indexNames.contains(index.name)) store.createIndex(index.name, index.keyPath)
        }
      }
    }

    // Another tab still holds an older version open; the visitor can close it and retry.
    opening.onblocked = () => reject(new DOMException('another tab is holding the database', 'InvalidStateError'))
    opening.onerror = () => reject(opening.error ?? new DOMException('cannot open the database', 'UnknownError'))
    opening.onsuccess = () => {
      // A newer release upgrading in another tab must not be blocked by this connection.
      opening.result.onversionchange = () => opening.result.close()
      resolve(opening.result)
    }
  })
}

async function estimateStorage(): Promise<StorageEstimateLike | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null

  try {
    const { usage, quota } = await navigator.storage.estimate()
    return { usage, quota }
  }
  catch {
    // An estimate the browser refuses is not an error the visitor can act on.
    return null
  }
}

function readTransaction(database: IDBDatabase): IDBObjectStore {
  return database.transaction(LOCAL_ASSET_STORE, 'readonly').objectStore(LOCAL_ASSET_STORE)
}

function writeStore(database: IDBDatabase): IDBObjectStore {
  return database.transaction(LOCAL_ASSET_STORE, 'readwrite').objectStore(LOCAL_ASSET_STORE)
}

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result)
    operation.onerror = () => reject(operation.error ?? new DOMException('storage request failed', 'UnknownError'))
  })
}
