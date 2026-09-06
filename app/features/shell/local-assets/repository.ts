import {
  createLocalAssetRecord,
  readStoredAsset,
  renameLocalAssetRecord,
  type LocalAssetDraft,
  type LocalAssetRecord,
} from './schema'
import {
  localAssetBundleFileName,
  mergeImportedAssets,
  parseLocalAssetBundle,
  serializeLocalAssets,
} from './transfer'
import {
  fitsInQuota,
  summarizeLocalAssets,
  type LocalAssetUsage,
  type StorageEstimateLike,
} from './usage'

/**
 * Every way the asset layer can fail while still leaving the visitor something
 * to do about it. Nothing here is thrown at the interface: a device without
 * storage, a full one, or one holding a record from a newer release all have to
 * end in a sentence a person can act on.
 */
export type LocalAssetErrorCode =
  | 'unsupported'
  | 'blocked'
  | 'quota-exceeded'
  | 'unsupported-version'
  | 'invalid-bundle'
  | 'empty-bundle'
  | 'unknown'

export type LocalAssetResult<T> = { ok: true, value: T } | { ok: false, code: LocalAssetErrorCode }

/**
 * The device store this repository is written against. `putAll` is one
 * transaction on purpose: an import either lands completely or not at all.
 */
export interface LocalAssetStore {
  list: () => Promise<unknown[]>
  putAll: (records: LocalAssetRecord[]) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: () => Promise<void>
  estimate: () => Promise<StorageEstimateLike | null>
}

export interface UnreadableAsset {
  id: string
  name: string | null
  reason: 'corrupt' | 'unsupported-version'
}

export interface LocalAssetListing {
  records: LocalAssetRecord[]
  usage: LocalAssetUsage
  /** Rows this build will not rewrite; the visitor can still see and delete them. */
  unreadable: UnreadableAsset[]
}

export interface ImportOutcome {
  listing: LocalAssetListing
  added: number
  replaced: number
}

export interface ExportedBundle {
  fileName: string
  contents: string
}

export interface LocalAssetRepositoryOptions {
  createId?: () => string
  now?: () => Date
}

export function createLocalAssetRepository(
  openStore: () => Promise<LocalAssetStore>,
  options: LocalAssetRepositoryOptions = {},
) {
  const createId = options.createId ?? defaultId
  const now = options.now ?? (() => new Date())

  async function withStore<T>(operation: (store: LocalAssetStore) => Promise<T>): Promise<LocalAssetResult<T>> {
    try {
      return { ok: true, value: await operation(await openStore()) }
    }
    catch (error) {
      return { ok: false, code: classifyStorageError(error) }
    }
  }

  async function readListing(store: LocalAssetStore): Promise<LocalAssetListing> {
    const rows = await store.list()
    const records: LocalAssetRecord[] = []
    const unreadable: UnreadableAsset[] = []
    const upgraded: LocalAssetRecord[] = []

    for (const row of rows) {
      const reading = readStoredAsset(row)
      if (reading.status === 'corrupt') {
        if (reading.id) unreadable.push({ id: reading.id, name: null, reason: 'corrupt' })
        continue
      }
      if (reading.status === 'unsupported-version') {
        unreadable.push({ id: reading.id, name: reading.name, reason: 'unsupported-version' })
        continue
      }

      records.push(reading.record)
      if (reading.status === 'upgraded') upgraded.push(reading.record)
    }

    // An upgraded record is written back once, so the next read costs nothing.
    if (upgraded.length) await store.putAll(upgraded)

    return { records, usage: summarizeLocalAssets(records, await store.estimate()), unreadable }
  }

  /** Writes only after the browser's own estimate says the bytes still fit. */
  async function commit(
    store: LocalAssetStore,
    listing: LocalAssetListing,
    incoming: LocalAssetRecord[],
    incomingBytes: number,
  ): Promise<LocalAssetListing> {
    if (!fitsInQuota(listing.usage, incomingBytes)) throw new QuotaError()

    await store.putAll(incoming)
    return readListing(store)
  }

  return {
    list(): Promise<LocalAssetResult<LocalAssetListing>> {
      return withStore(readListing)
    },

    save(draft: LocalAssetDraft): Promise<LocalAssetResult<LocalAssetListing>> {
      return withStore(async (store) => {
        const record = createLocalAssetRecord(draft, { id: createId(), now: now() })
        return commit(store, await readListing(store), [record], record.bytes)
      })
    },

    rename(id: string, name: string): Promise<LocalAssetResult<LocalAssetListing>> {
      return withStore(async (store) => {
        const listing = await readListing(store)
        const record = listing.records.find(item => item.id === id)
        if (!record) return listing

        await store.putAll([renameLocalAssetRecord(record, name, now())])
        return readListing(store)
      })
    },

    remove(id: string): Promise<LocalAssetResult<LocalAssetListing>> {
      return withStore(async (store) => {
        await store.remove(id)
        return readListing(store)
      })
    },

    clear(): Promise<LocalAssetResult<LocalAssetListing>> {
      return withStore(async (store) => {
        await store.clear()
        return readListing(store)
      })
    },

    exportBundle(): Promise<LocalAssetResult<ExportedBundle>> {
      return withStore(async (store) => {
        const listing = await readListing(store)
        if (!listing.records.length) throw new EmptyBundleError()

        const stamp = now()
        return { fileName: localAssetBundleFileName(stamp), contents: serializeLocalAssets(listing.records, stamp) }
      })
    },

    importBundle(raw: string): Promise<LocalAssetResult<ImportOutcome>> {
      return withStore(async (store) => {
        const reading = parseLocalAssetBundle(raw)
        if (!reading.ok) throw new BundleError(reading.code)

        const listing = await readListing(store)
        const merge = mergeImportedAssets(listing.records, reading.records)
        const incomingBytes = reading.records.reduce((total, record) => total + record.bytes, 0)

        return {
          listing: await commit(store, listing, reading.records, incomingBytes),
          added: merge.added,
          replaced: merge.replaced,
        }
      })
    },
  }
}

export type LocalAssetRepository = ReturnType<typeof createLocalAssetRepository>

class QuotaError extends Error {
  readonly code: LocalAssetErrorCode = 'quota-exceeded'
}

class EmptyBundleError extends Error {
  readonly code: LocalAssetErrorCode = 'empty-bundle'
}

class BundleError extends Error {
  constructor(readonly code: LocalAssetErrorCode) {
    super(code)
  }
}

/**
 * Turns whatever the browser threw into one of the outcomes the interface knows
 * how to explain. An unrecognised failure stays `unknown` rather than being
 * dressed up as a cause the product has not verified.
 */
export function classifyStorageError(error: unknown): LocalAssetErrorCode {
  if (error instanceof QuotaError || error instanceof EmptyBundleError || error instanceof BundleError) return error.code

  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : ''

  switch (name) {
    case 'QuotaExceededError':
      return 'quota-exceeded'
    case 'VersionError':
      return 'unsupported-version'
    case 'NotSupportedError':
      return 'unsupported'
    case 'SecurityError':
    case 'InvalidStateError':
    case 'InvalidAccessError':
      return 'blocked'
    default:
      return 'unknown'
  }
}

function defaultId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()

  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
