import { describe, expect, it } from 'vitest'
import {
  createLocalAssetRecord,
  LOCAL_ASSET_DB_VERSION,
  LOCAL_ASSET_KIND_INDEX,
  LOCAL_ASSET_RECORD_VERSION,
  LOCAL_ASSET_STORE,
  localAssetKinds,
  payloadBytes,
  planDatabaseUpgrade,
  readStoredAsset,
  renameLocalAssetRecord,
  type LocalAssetRecord,
} from '@/features/shell/local-assets/schema'

const signaturePayload = { format: 'binary', mediaType: 'image/png', bytes: new Uint8Array([1, 2, 3, 4]) } as const
const calendarPayload = { format: 'text', mediaType: 'application/json', text: '{"days":[]}' } as const

function record(overrides: Partial<LocalAssetRecord> = {}): LocalAssetRecord {
  return {
    ...createLocalAssetRecord(
      { kind: 'signature', name: '主要簽名', payload: signaturePayload },
      { id: 'asset-1', now: new Date('2026-09-07T02:00:00Z') },
    ),
    ...overrides,
  }
}

describe('local asset kinds', () => {
  it('covers every kind the tools reuse', () => {
    expect([...localAssetKinds]).toEqual(['calendar', 'background', 'frame', 'logo', 'signature'])
  })
})

describe('local asset record', () => {
  it('stamps the current record version, identity and timestamps', () => {
    const created = record()

    expect(created).toMatchObject({
      id: 'asset-1',
      version: LOCAL_ASSET_RECORD_VERSION,
      kind: 'signature',
      name: '主要簽名',
      createdAt: '2026-09-07T02:00:00.000Z',
      updatedAt: '2026-09-07T02:00:00.000Z',
    })
  })

  it('measures binary and text payloads in bytes', () => {
    expect(payloadBytes(signaturePayload)).toBe(4)
    expect(payloadBytes(calendarPayload)).toBe(11)
    // Non-ASCII text costs more than one byte per character.
    expect(payloadBytes({ format: 'text', mediaType: 'text/plain', text: '春節' })).toBe(6)
    expect(record().bytes).toBe(4)
  })

  it('renames without touching the stored payload or creation time', () => {
    const renamed = renameLocalAssetRecord(record(), ' 舊簽名 ', new Date('2026-09-08T00:00:00Z'))

    expect(renamed.name).toBe('舊簽名')
    expect(renamed.createdAt).toBe('2026-09-07T02:00:00.000Z')
    expect(renamed.updatedAt).toBe('2026-09-08T00:00:00.000Z')
    expect(renamed.payload).toEqual(signaturePayload)
  })
})

describe('reading a stored asset', () => {
  it('accepts a record written by this version', () => {
    expect(readStoredAsset(record())).toEqual({ status: 'ready', record: record() })
  })

  it('recomputes the stored size so quota accounting cannot drift', () => {
    const reading = readStoredAsset(record({ bytes: 9_999 }))

    expect(reading).toMatchObject({ status: 'ready' })
    expect(reading.status === 'ready' && reading.record.bytes).toBe(4)
  })

  it('upgrades a record saved before the version field existed', () => {
    const { version: _version, ...unversioned } = record()
    const reading = readStoredAsset({ ...unversioned, bytes: undefined })

    expect(reading).toMatchObject({ status: 'upgraded' })
    expect(reading.status === 'upgraded' && reading.record).toMatchObject({
      id: 'asset-1',
      version: LOCAL_ASSET_RECORD_VERSION,
      bytes: 4,
    })
  })

  it('keeps a record from a newer release readable enough to delete', () => {
    const reading = readStoredAsset(record({ version: LOCAL_ASSET_RECORD_VERSION + 1 }))

    expect(reading).toEqual({ status: 'unsupported-version', id: 'asset-1', name: '主要簽名' })
  })

  it('reports damaged records instead of throwing', () => {
    expect(readStoredAsset(null)).toEqual({ status: 'corrupt', id: null })
    expect(readStoredAsset('not a record')).toEqual({ status: 'corrupt', id: null })
    expect(readStoredAsset(record({ id: '' }))).toEqual({ status: 'corrupt', id: null })
    expect(readStoredAsset(record({ kind: 'unknown-kind' as LocalAssetRecord['kind'] }))).toEqual({ status: 'corrupt', id: 'asset-1' })
    expect(readStoredAsset(record({ name: 42 as unknown as string }))).toEqual({ status: 'corrupt', id: 'asset-1' })
    expect(readStoredAsset(record({ payload: { format: 'binary', mediaType: 'image/png' } as never }))).toEqual({ status: 'corrupt', id: 'asset-1' })
    expect(readStoredAsset(record({ payload: { format: 'audio', mediaType: 'audio/wav', text: 'x' } as never }))).toEqual({ status: 'corrupt', id: 'asset-1' })
  })
})

describe('database migration plan', () => {
  it('creates the store and the kind index on a device that has no database yet', () => {
    expect(planDatabaseUpgrade(0)).toEqual([
      {
        version: 1,
        store: LOCAL_ASSET_STORE,
        keyPath: 'id',
        indexes: [{ name: LOCAL_ASSET_KIND_INDEX, keyPath: 'kind' }],
      },
    ])
  })

  it('runs nothing when the device is already on the current schema', () => {
    expect(planDatabaseUpgrade(LOCAL_ASSET_DB_VERSION)).toEqual([])
    expect(planDatabaseUpgrade(LOCAL_ASSET_DB_VERSION + 1)).toEqual([])
  })
})
