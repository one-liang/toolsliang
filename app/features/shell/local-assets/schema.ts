/**
 * The shape of one local asset and the rules for reading a record back off the
 * device. A local asset is tool content the visitor explicitly chose to keep —
 * a signature, a Logo, a frame, a background or a custom calendar — so every
 * rule here is about keeping that record readable on the device it was written
 * on, never about moving it anywhere else.
 */
export const localAssetKinds = ['calendar', 'background', 'frame', 'logo', 'signature'] as const

export type LocalAssetKind = typeof localAssetKinds[number]

export const LOCAL_ASSET_DB_NAME = 'toolsliang-local-assets'
export const LOCAL_ASSET_STORE = 'assets'
export const LOCAL_ASSET_KIND_INDEX = 'by-kind'
/** Bumped when the object stores or indexes change; drives `planDatabaseUpgrade`. */
export const LOCAL_ASSET_DB_VERSION = 1
/**
 * Bumped when the shape of one record changes. It travels with the record, so a
 * device that moves between releases can tell an upgradable record from one
 * this build must not rewrite.
 */
export const LOCAL_ASSET_RECORD_VERSION = 1

export type LocalAssetPayload =
  | { format: 'text', mediaType: string, text: string }
  | { format: 'binary', mediaType: string, bytes: Uint8Array }

export interface LocalAssetRecord {
  id: string
  version: number
  kind: LocalAssetKind
  name: string
  /** Derived from the payload on every read, so quota accounting cannot drift. */
  bytes: number
  payload: LocalAssetPayload
  createdAt: string
  updatedAt: string
}

export interface LocalAssetDraft {
  kind: LocalAssetKind
  name: string
  payload: LocalAssetPayload
}

export function payloadBytes(payload: LocalAssetPayload): number {
  return payload.format === 'text'
    ? new TextEncoder().encode(payload.text).byteLength
    : payload.bytes.byteLength
}

export function createLocalAssetRecord(
  draft: LocalAssetDraft,
  options: { id: string, now: Date },
): LocalAssetRecord {
  const timestamp = options.now.toISOString()

  return {
    id: options.id,
    version: LOCAL_ASSET_RECORD_VERSION,
    kind: draft.kind,
    name: draft.name.trim(),
    bytes: payloadBytes(draft.payload),
    payload: draft.payload,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function renameLocalAssetRecord(record: LocalAssetRecord, name: string, now: Date): LocalAssetRecord {
  return { ...record, name: name.trim(), updatedAt: now.toISOString() }
}

export type StoredAssetReading =
  | { status: 'ready', record: LocalAssetRecord }
  /** Read from an older record shape and rewritten in the current one. */
  | { status: 'upgraded', record: LocalAssetRecord }
  /** Written by a newer release: readable enough to name and delete, not to rewrite. */
  | { status: 'unsupported-version', id: string, name: string | null }
  | { status: 'corrupt', id: string | null }

/**
 * Reads one row out of the device store. Anything unexpected is reported rather
 * than thrown, because a single damaged record must never take the asset
 * manager — the one place the visitor can delete it — down with it.
 */
export function readStoredAsset(value: unknown): StoredAssetReading {
  if (!isRecordObject(value)) return { status: 'corrupt', id: null }

  const id = typeof value.id === 'string' && value.id.length > 0 ? value.id : null
  if (!id) return { status: 'corrupt', id: null }

  const version = typeof value.version === 'number' ? value.version : 0
  if (version > LOCAL_ASSET_RECORD_VERSION) {
    return { status: 'unsupported-version', id, name: typeof value.name === 'string' ? value.name : null }
  }

  const { kind, name, payload, createdAt, updatedAt } = value
  if (!isLocalAssetKind(kind)) return { status: 'corrupt', id }
  if (typeof name !== 'string') return { status: 'corrupt', id }
  if (!isPayload(payload)) return { status: 'corrupt', id }
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') return { status: 'corrupt', id }

  const record: LocalAssetRecord = {
    id,
    version: LOCAL_ASSET_RECORD_VERSION,
    kind,
    name,
    bytes: payloadBytes(payload),
    payload,
    createdAt,
    updatedAt,
  }

  return version === LOCAL_ASSET_RECORD_VERSION ? { status: 'ready', record } : { status: 'upgraded', record }
}

export interface DatabaseMigrationStep {
  version: number
  store: string
  keyPath: string
  indexes: Array<{ name: string, keyPath: string }>
}

const migrationSteps: DatabaseMigrationStep[] = [
  {
    version: 1,
    store: LOCAL_ASSET_STORE,
    keyPath: 'id',
    indexes: [{ name: LOCAL_ASSET_KIND_INDEX, keyPath: 'kind' }],
  },
]

/**
 * The steps a device on `fromVersion` still has to run. Keeping the plan as
 * data means the browser upgrade handler stays a loop, and the migration itself
 * can be verified without opening a database.
 */
export function planDatabaseUpgrade(fromVersion: number, toVersion: number = LOCAL_ASSET_DB_VERSION): DatabaseMigrationStep[] {
  return migrationSteps.filter(step => step.version > fromVersion && step.version <= toVersion)
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isLocalAssetKind(value: unknown): value is LocalAssetKind {
  return typeof value === 'string' && (localAssetKinds as readonly string[]).includes(value)
}

function isPayload(value: unknown): value is LocalAssetPayload {
  if (!isRecordObject(value)) return false
  if (typeof value.mediaType !== 'string') return false
  if (value.format === 'text') return typeof value.text === 'string'
  if (value.format === 'binary') return value.bytes instanceof Uint8Array

  return false
}
