import {
  isLocalAssetKind,
  LOCAL_ASSET_RECORD_VERSION,
  payloadBytes,
  type LocalAssetPayload,
  type LocalAssetRecord,
} from './schema'

/**
 * The one file format the visitor can carry their own assets in. Export and
 * import are the only ways an asset leaves or enters the device store, and both
 * are started by the visitor: the product never sends this file anywhere.
 */
export const LOCAL_ASSET_BUNDLE_FORMAT = 'toolsliang.local-assets'
export const LOCAL_ASSET_BUNDLE_VERSION = 1

type SerializedPayload =
  | { format: 'text', mediaType: string, text: string }
  | { format: 'binary', mediaType: string, base64: string }

interface SerializedAsset {
  id: string
  kind: string
  name: string
  createdAt: string
  updatedAt: string
  payload: SerializedPayload
}

export interface LocalAssetBundle {
  format: string
  version: number
  exportedAt: string
  assets: SerializedAsset[]
}

export type BundleReading =
  | { ok: true, records: LocalAssetRecord[] }
  | { ok: false, code: 'invalid-bundle' | 'unsupported-version' | 'empty-bundle' }

export function serializeLocalAssets(records: LocalAssetRecord[], now: Date): string {
  const bundle: LocalAssetBundle = {
    format: LOCAL_ASSET_BUNDLE_FORMAT,
    version: LOCAL_ASSET_BUNDLE_VERSION,
    exportedAt: now.toISOString(),
    assets: records.map(record => ({
      id: record.id,
      kind: record.kind,
      name: record.name,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      payload: serializePayload(record.payload),
    })),
  }

  return JSON.stringify(bundle, null, 2)
}

/** Dated only: a file name is visible in the download shelf, so it never carries asset names. */
export function localAssetBundleFileName(now: Date): string {
  return `toolsliang-local-assets-${now.toISOString().slice(0, 10)}.json`
}

/**
 * All or nothing. One unreadable asset rejects the whole file, so an import can
 * never leave the device holding half of a backup the visitor believed in.
 */
export function parseLocalAssetBundle(raw: string): BundleReading {
  let value: unknown
  try {
    value = JSON.parse(raw)
  }
  catch {
    return { ok: false, code: 'invalid-bundle' }
  }

  if (typeof value !== 'object' || value === null) return { ok: false, code: 'invalid-bundle' }

  const bundle = value as Partial<LocalAssetBundle>
  if (bundle.format !== LOCAL_ASSET_BUNDLE_FORMAT) return { ok: false, code: 'invalid-bundle' }
  if (typeof bundle.version !== 'number') return { ok: false, code: 'invalid-bundle' }
  if (bundle.version > LOCAL_ASSET_BUNDLE_VERSION) return { ok: false, code: 'unsupported-version' }
  if (!Array.isArray(bundle.assets)) return { ok: false, code: 'invalid-bundle' }
  if (bundle.assets.length === 0) return { ok: false, code: 'empty-bundle' }

  const records: LocalAssetRecord[] = []
  for (const asset of bundle.assets) {
    const record = readSerializedAsset(asset)
    if (!record) return { ok: false, code: 'invalid-bundle' }
    records.push(record)
  }

  return { ok: true, records }
}

export interface ImportMerge {
  records: LocalAssetRecord[]
  added: number
  replaced: number
}

/** An imported asset replaces the one it shares an identity with, in place. */
export function mergeImportedAssets(existing: LocalAssetRecord[], incoming: LocalAssetRecord[]): ImportMerge {
  const merged = [...existing]
  let added = 0
  let replaced = 0

  for (const record of incoming) {
    const index = merged.findIndex(item => item.id === record.id)
    if (index === -1) {
      merged.push(record)
      added += 1
      continue
    }

    merged[index] = record
    replaced += 1
  }

  return { records: merged, added, replaced }
}

function serializePayload(payload: LocalAssetPayload): SerializedPayload {
  return payload.format === 'text'
    ? { format: 'text', mediaType: payload.mediaType, text: payload.text }
    : { format: 'binary', mediaType: payload.mediaType, base64: encodeBase64(payload.bytes) }
}

function readSerializedAsset(value: unknown): LocalAssetRecord | null {
  if (typeof value !== 'object' || value === null) return null

  const asset = value as Partial<SerializedAsset>
  if (typeof asset.id !== 'string' || asset.id.length === 0) return null
  if (!isLocalAssetKind(asset.kind)) return null
  if (typeof asset.name !== 'string') return null
  if (typeof asset.createdAt !== 'string' || typeof asset.updatedAt !== 'string') return null

  const payload = readSerializedPayload(asset.payload)
  if (!payload) return null

  return {
    id: asset.id,
    version: LOCAL_ASSET_RECORD_VERSION,
    kind: asset.kind,
    name: asset.name,
    bytes: payloadBytes(payload),
    payload,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }
}

function readSerializedPayload(value: unknown): LocalAssetPayload | null {
  if (typeof value !== 'object' || value === null) return null

  const payload = value as Partial<SerializedPayload>
  if (typeof payload.mediaType !== 'string') return null
  if (payload.format === 'text') return typeof payload.text === 'string' ? { format: 'text', mediaType: payload.mediaType, text: payload.text } : null
  if (payload.format !== 'binary' || typeof payload.base64 !== 'string') return null

  const bytes = decodeBase64(payload.base64)
  return bytes ? { format: 'binary', mediaType: payload.mediaType, bytes } : null
}

/** Chunked so a multi-megabyte asset cannot exhaust the argument list. */
function encodeBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)

    return bytes
  }
  catch {
    return null
  }
}
