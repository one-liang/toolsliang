import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLocalAssetRepository,
  type LocalAssetStore,
} from '@/features/shell/local-assets/repository'
import { MemoryAssetStore } from './support/memory-asset-store'
import { createLocalAssetRecord } from '@/features/shell/local-assets/schema'
import { serializeLocalAssets } from '@/features/shell/local-assets/transfer'

const now = new Date('2026-09-07T02:00:00Z')

function signatureDraft(name = '主要簽名', size = 4) {
  return { kind: 'signature', name, payload: { format: 'binary', mediaType: 'image/png', bytes: new Uint8Array(size) } } as const
}

let store: MemoryAssetStore
let ids = 0

function repository(open: () => Promise<LocalAssetStore> = async () => store) {
  return createLocalAssetRepository(open, { createId: () => `asset-${++ids}`, now: () => now })
}

beforeEach(() => {
  store = new MemoryAssetStore()
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

describe('the single asset a tool owns', () => {
  const calendarDraft = {
    kind: 'calendar',
    name: '自訂行事曆',
    payload: { format: 'text', mediaType: 'application/json', text: '{"entries":[]}' },
  } as const

  it('writes under the id the tool chose, so the tool can find its own document again', async () => {
    const written = await repository().put('custom-calendar', calendarDraft)

    expect(written.ok && written.value.records).toMatchObject([{ id: 'custom-calendar', kind: 'calendar' }])
  })

  it('replaces the document in place, keeping when it was first saved', async () => {
    const owner = repository()
    await owner.put('custom-calendar', calendarDraft)

    const updated = await owner.put('custom-calendar', {
      ...calendarDraft,
      payload: { format: 'text', mediaType: 'application/json', text: '{"entries":[1,2]}' },
    })
    const record = updated.ok ? updated.value.records[0]! : null

    expect(updated.ok && updated.value.records).toHaveLength(1)
    expect(record).toMatchObject({ id: 'custom-calendar', createdAt: now.toISOString(), bytes: 17 })
  })

  it('charges only what a rewrite adds, so editing a document is not refused for space it already holds', async () => {
    const owner = repository()
    await owner.put('custom-calendar', {
      ...calendarDraft,
      payload: { format: 'text', mediaType: 'application/json', text: 'x'.repeat(100_000) },
    })
    store.estimateValue = { usage: 900_000, quota: 1_000_000 }

    const rewritten = await owner.put('custom-calendar', {
      ...calendarDraft,
      payload: { format: 'text', mediaType: 'application/json', text: 'y'.repeat(100_000) },
    })

    expect(rewritten.ok, '覆寫同一份文件不得被當成新增容量').toBe(true)
  })

  it('refuses a rewrite that no longer fits, leaving the saved document alone', async () => {
    const owner = repository()
    await owner.put('custom-calendar', calendarDraft)
    store.estimateValue = { usage: 990_000, quota: 1_000_000 }

    const refused = await owner.put('custom-calendar', {
      ...calendarDraft,
      payload: { format: 'text', mediaType: 'application/json', text: 'y'.repeat(200_000) },
    })

    expect(refused).toEqual({ ok: false, code: 'quota-exceeded' })
    const listing = await owner.list()
    expect(listing.ok && listing.value.records[0]!.bytes, '被拒絕的寫入不得改動既有文件').toBe(14)
  })

  it('refuses to overwrite a document this build cannot read, so nothing is lost silently', async () => {
    const owner = repository()
    store.rows.set('custom-calendar', { id: 'custom-calendar', version: 99, kind: 'calendar', name: '自訂行事曆' })

    expect(await owner.put('custom-calendar', calendarDraft)).toEqual({ ok: false, code: 'unsupported-version' })
    expect(store.rows.get('custom-calendar'), '較新版本的紀錄必須原封不動').toMatchObject({ version: 99 })
  })
})

describe('device boundary', () => {
  async function exerciseEveryOperation() {
    const owner = repository()
    await owner.save(signatureDraft())
    await owner.list()
    await owner.rename('asset-1', '改名後')
    await owner.put('owned-document', { kind: 'calendar', name: '自訂行事曆', payload: { format: 'text', mediaType: 'application/json', text: '{}' } })
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
