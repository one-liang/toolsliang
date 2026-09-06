import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLocalAssetRepository,
  type LocalAssetStore,
} from '@/features/shell/local-assets/repository'
import { createLocalAssetRecord, type LocalAssetRecord } from '@/features/shell/local-assets/schema'
import { serializeLocalAssets } from '@/features/shell/local-assets/transfer'

const now = new Date('2026-09-07T02:00:00Z')

function signatureDraft(name = '主要簽名', size = 4) {
  return { kind: 'signature', name, payload: { format: 'binary', mediaType: 'image/png', bytes: new Uint8Array(size) } } as const
}

class MemoryStore implements LocalAssetStore {
  rows = new Map<string, unknown>()
  estimateValue: { usage: number, quota: number } | null = null
  putError: unknown = null

  async list() {
    return [...this.rows.values()]
  }

  async putAll(records: LocalAssetRecord[]) {
    if (this.putError) throw this.putError
    // One transaction: either every record lands or none of them do.
    for (const record of records) this.rows.set(record.id, record)
  }

  async remove(id: string) {
    this.rows.delete(id)
  }

  async clear() {
    this.rows.clear()
  }

  async estimate() {
    return this.estimateValue
  }
}

let store: MemoryStore
let ids = 0

function repository(open: () => Promise<LocalAssetStore> = async () => store) {
  return createLocalAssetRepository(open, { createId: () => `asset-${++ids}`, now: () => now })
}

beforeEach(() => {
  store = new MemoryStore()
  ids = 0
})

describe('saving and reading local assets', () => {
  it('keeps a saved asset available to the next read', async () => {
    const saved = await repository().save(signatureDraft())
    expect(saved.ok).toBe(true)

    const listing = await repository().list()
    expect(listing.ok && listing.value.records).toMatchObject([{ id: 'asset-1', kind: 'signature', name: '主要簽名', bytes: 4 }])
    expect(listing.ok && listing.value.usage.totalBytes).toBe(4)
  })

  it('reports a rename of an asset this device no longer holds', async () => {
    expect(await repository().rename('asset-404', '新名稱')).toEqual({ ok: false, code: 'missing-asset' })
  })

  it('renames and deletes one asset without touching the others', async () => {
    const owner = repository()
    await owner.save(signatureDraft('簽名一'))
    await owner.save(signatureDraft('簽名二'))

    await owner.rename('asset-1', '正式簽名')
    const renamed = await owner.list()
    expect(renamed.ok && renamed.value.records.map(record => record.name)).toEqual(['正式簽名', '簽名二'])

    await owner.remove('asset-2')
    const removed = await owner.list()
    expect(removed.ok && removed.value.records.map(record => record.id)).toEqual(['asset-1'])
  })

  it('clears everything only when the visitor asks for it', async () => {
    const owner = repository()
    await owner.save(signatureDraft('簽名一'))
    await owner.save({ ...signatureDraft('排班'), kind: 'calendar' })

    const cleared = await owner.clear()
    expect(cleared.ok && cleared.value.records).toEqual([])
    expect(cleared.ok && cleared.value.usage.totalBytes).toBe(0)
    expect(store.rows.size).toBe(0)
  })
})

describe('recoverable failures', () => {
  it('reports a device without IndexedDB instead of breaking the interface', async () => {
    const unsupported = repository(async () => { throw new DOMException('no storage', 'NotSupportedError') })

    expect(await unsupported.list()).toEqual({ ok: false, code: 'unsupported' })
    expect(await unsupported.save(signatureDraft())).toEqual({ ok: false, code: 'unsupported' })
  })

  it('reports a database created by a newer release as a version conflict', async () => {
    const conflicted = repository(async () => { throw new DOMException('newer', 'VersionError') })

    expect(await conflicted.list()).toEqual({ ok: false, code: 'unsupported-version' })
  })

  it('reports private or blocked storage separately from a missing capability', async () => {
    const blocked = repository(async () => { throw new DOMException('blocked', 'SecurityError') })

    expect(await blocked.list()).toEqual({ ok: false, code: 'blocked' })
  })

  it('refuses a save that would not fit before writing anything', async () => {
    store.estimateValue = { usage: 990_000, quota: 1_000_000 }

    expect(await repository().save(signatureDraft('大簽名', 200_000))).toEqual({ ok: false, code: 'quota-exceeded' })
    expect(store.rows.size, '配額不足時不得寫入半筆資料').toBe(0)
  })

  it('reports a quota the browser only refuses at write time', async () => {
    store.putError = new DOMException('full', 'QuotaExceededError')

    expect(await repository().save(signatureDraft())).toEqual({ ok: false, code: 'quota-exceeded' })
  })

  it('lists damaged and newer records so the visitor can delete them', async () => {
    store.rows.set('broken', { id: 'broken', kind: 'signature', name: 42 })
    store.rows.set('newer', { ...createLocalAssetRecord(signatureDraft('未來簽名'), { id: 'newer', now }), version: 99 })
    await repository().save(signatureDraft('可讀簽名'))

    const listing = await repository().list()
    expect(listing.ok && listing.value.records.map(record => record.id)).toEqual(['asset-1'])
    expect(listing.ok && listing.value.unreadable).toEqual([
      { id: 'broken', reason: 'corrupt', name: null },
      { id: 'newer', reason: 'unsupported-version', name: '未來簽名' },
    ])
  })

  it('still lists and deletes assets when the device is too full to rewrite an upgraded record', async () => {
    const { version: _version, ...unversioned } = createLocalAssetRecord(signatureDraft('舊簽名'), { id: 'legacy', now })
    store.rows.set('legacy', unversioned)
    store.putError = new DOMException('full', 'QuotaExceededError')

    const listing = await repository().list()
    expect(listing.ok && listing.value.records.map(record => record.name), '寫回失敗不得讓整份清單讀不到').toEqual(['舊簽名'])

    const removed = await repository().remove('legacy')
    expect(removed.ok, '空間不足時仍要能刪除').toBe(true)
  })

  it('upgrades a record stored before the version field and keeps it', async () => {
    const { version: _version, ...unversioned } = createLocalAssetRecord(signatureDraft('舊簽名'), { id: 'legacy', now })
    store.rows.set('legacy', unversioned)

    const listing = await repository().list()
    expect(listing.ok && listing.value.records.map(record => record.name)).toEqual(['舊簽名'])
    expect(store.rows.get('legacy'), '升級後的記錄要寫回裝置，不必每次重讀都再升級一次').toMatchObject({ version: 1 })
  })
})

describe('export and import', () => {
  it('exports every asset into one file the visitor triggers', async () => {
    const owner = repository()
    await owner.save(signatureDraft('簽名一'))

    const exported = await owner.exportBundle()
    expect(exported.ok && exported.value.fileName).toBe('toolsliang-local-assets-2026-09-07.json')
    expect(exported.ok && JSON.parse(exported.value.contents).assets).toHaveLength(1)
  })

  it('refuses to export when there is nothing saved', async () => {
    expect(await repository().exportBundle()).toEqual({ ok: false, code: 'empty-bundle' })
  })

  it('imports a bundle and reports what it added and replaced', async () => {
    const owner = repository()
    await owner.save(signatureDraft('簽名一'))
    const existing = (await owner.list())
    const record = existing.ok ? existing.value.records[0]! : null
    const bundle = serializeLocalAssets([{ ...record!, name: '改名後' }, createLocalAssetRecord({ ...signatureDraft('排班'), kind: 'calendar' }, { id: 'imported', now })], now)

    const imported = await owner.importBundle(bundle)
    expect(imported.ok && imported.value).toMatchObject({ added: 1, replaced: 1 })
    expect(imported.ok && imported.value.listing.records.map(item => item.name)).toEqual(['改名後', '排班'])
  })

  it('leaves the device untouched when the imported file cannot be read', async () => {
    const owner = repository()
    await owner.save(signatureDraft('簽名一'))

    expect(await owner.importBundle('not a bundle')).toEqual({ ok: false, code: 'invalid-bundle' })
    const listing = await owner.list()
    expect(listing.ok && listing.value.records.map(item => item.name)).toEqual(['簽名一'])
  })

  it('rolls back to what the device had when the import transaction fails', async () => {
    const owner = repository()
    await owner.save(signatureDraft('簽名一'))
    const bundle = serializeLocalAssets([createLocalAssetRecord({ ...signatureDraft('排班'), kind: 'calendar' }, { id: 'imported', now })], now)
    store.putError = new DOMException('full', 'QuotaExceededError')

    expect(await owner.importBundle(bundle)).toEqual({ ok: false, code: 'quota-exceeded' })
    const listing = await owner.list()
    expect(listing.ok && listing.value.records.map(item => item.id)).toEqual(['asset-1'])
  })

  it('counts only what an import adds, so re-importing your own backup is not refused', async () => {
    const owner = repository()
    await owner.save(signatureDraft('大簽名', 100_000))
    const exported = await owner.exportBundle()
    store.estimateValue = { usage: 900_000, quota: 1_000_000 }

    const reimported = await owner.importBundle(exported.ok ? exported.value.contents : '')
    expect(reimported.ok && reimported.value, '覆蓋既有資產不佔用額外空間').toMatchObject({ added: 0, replaced: 1 })
  })

  it('refuses an import that does not fit in the remaining quota', async () => {
    store.estimateValue = { usage: 900_000, quota: 1_000_000 }
    const bundle = serializeLocalAssets([createLocalAssetRecord(signatureDraft('大簽名', 100_000), { id: 'imported', now })], now)

    expect(await repository().importBundle(bundle)).toEqual({ ok: false, code: 'quota-exceeded' })
    expect(store.rows.size).toBe(0)
  })
})

describe('device boundary', () => {
  async function exerciseEveryOperation() {
    const owner = repository()
    await owner.save(signatureDraft())
    await owner.list()
    await owner.rename('asset-1', '改名後')
    const exported = await owner.exportBundle()
    await owner.importBundle(exported.ok ? exported.value.contents : '')
    await owner.remove('asset-1')
    await owner.clear()
  }

  it('never reaches the network while saving, reading or clearing assets', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await exerciseEveryOperation()

    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  /**
   * Cloud preferences live in the `localStorage` namespace this module never
   * touches. Keeping the two apart in code is what makes the promise in the
   * interface true: a preference that syncs can never carry an asset with it.
   */
  it('never writes to the preference namespace', async () => {
    const localWrite = vi.spyOn(Storage.prototype, 'setItem')

    await exerciseEveryOperation()

    expect(localWrite, '本機資產不得寫入偏好命名空間').not.toHaveBeenCalled()
    localWrite.mockRestore()
  })
})
