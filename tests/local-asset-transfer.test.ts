import { describe, expect, it } from 'vitest'
import { createLocalAssetRecord, type LocalAssetRecord } from '@/features/shell/local-assets/schema'
import {
  LOCAL_ASSET_BUNDLE_FORMAT,
  LOCAL_ASSET_BUNDLE_VERSION,
  localAssetBundleFileName,
  mergeImportedAssets,
  parseLocalAssetBundle,
  serializeLocalAssets,
} from '@/features/shell/local-assets/transfer'

const exportedAt = new Date('2026-09-07T02:00:00Z')

const signature = createLocalAssetRecord(
  { kind: 'signature', name: '主要簽名', payload: { format: 'binary', mediaType: 'image/png', bytes: new Uint8Array([1, 2, 250, 255]) } },
  { id: 'asset-1', now: exportedAt },
)
const calendar = createLocalAssetRecord(
  { kind: 'calendar', name: '排班', payload: { format: 'text', mediaType: 'application/json', text: '{"days":["2026-01-01"]}' } },
  { id: 'asset-2', now: exportedAt },
)

function bundleOf(records: LocalAssetRecord[]) {
  return JSON.parse(serializeLocalAssets(records, exportedAt))
}

describe('exporting local assets', () => {
  it('writes a self-describing bundle the visitor downloads themselves', () => {
    const bundle = bundleOf([signature])

    expect(bundle).toMatchObject({
      format: LOCAL_ASSET_BUNDLE_FORMAT,
      version: LOCAL_ASSET_BUNDLE_VERSION,
      exportedAt: '2026-09-07T02:00:00.000Z',
    })
    expect(bundle.assets).toHaveLength(1)
    expect(bundle.assets[0]).toMatchObject({ id: 'asset-1', kind: 'signature', name: '主要簽名' })
    expect(bundle.assets[0].payload).toEqual({ format: 'binary', mediaType: 'image/png', base64: 'AQL6/w==' })
  })

  it('names the file by date only, never by what the assets contain', () => {
    expect(localAssetBundleFileName(exportedAt)).toBe('toolsliang-local-assets-2026-09-07.json')
  })

  it('reads back exactly what it wrote, including binary payloads', () => {
    const reading = parseLocalAssetBundle(serializeLocalAssets([signature, calendar], exportedAt))

    expect(reading).toEqual({ ok: true, records: [signature, calendar] })
  })
})

describe('importing a bundle', () => {
  it('rejects the whole bundle when one asset cannot be read, so nothing is half imported', () => {
    const bundle = bundleOf([signature, calendar])
    bundle.assets[1].kind = 'spreadsheet'

    expect(parseLocalAssetBundle(JSON.stringify(bundle))).toEqual({ ok: false, code: 'invalid-bundle' })
  })

  it('rejects a bundle written by a newer release', () => {
    const bundle = bundleOf([signature])
    bundle.version = LOCAL_ASSET_BUNDLE_VERSION + 1

    expect(parseLocalAssetBundle(JSON.stringify(bundle))).toEqual({ ok: false, code: 'unsupported-version' })
  })

  it('rejects a file that is not a local asset bundle at all', () => {
    expect(parseLocalAssetBundle('not json')).toEqual({ ok: false, code: 'invalid-bundle' })
    expect(parseLocalAssetBundle('{}')).toEqual({ ok: false, code: 'invalid-bundle' })
    expect(parseLocalAssetBundle(JSON.stringify({ format: 'other.tool', version: 1, assets: [] }))).toEqual({ ok: false, code: 'invalid-bundle' })
    expect(parseLocalAssetBundle(JSON.stringify({ format: LOCAL_ASSET_BUNDLE_FORMAT, version: 1, assets: [] }))).toEqual({ ok: false, code: 'empty-bundle' })
  })

  it('rejects a payload whose base64 is damaged', () => {
    const bundle = bundleOf([signature])
    bundle.assets[0].payload.base64 = 'not base64!!'

    expect(parseLocalAssetBundle(JSON.stringify(bundle))).toEqual({ ok: false, code: 'invalid-bundle' })
  })
})

describe('merging an imported bundle into the device', () => {
  it('adds assets the device does not have and keeps the existing order', () => {
    const merged = mergeImportedAssets([signature], [calendar])

    expect(merged.records.map(record => record.id)).toEqual(['asset-1', 'asset-2'])
    expect(merged).toMatchObject({ added: 1, replaced: 0 })
  })

  it('replaces an asset with the same identity in place', () => {
    const updated = { ...signature, name: '新的簽名' }
    const merged = mergeImportedAssets([signature, calendar], [updated])

    expect(merged.records.map(record => record.name)).toEqual(['新的簽名', '排班'])
    expect(merged).toMatchObject({ added: 0, replaced: 1 })
  })
})
