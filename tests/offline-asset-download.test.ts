import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetOfflineAssetDownloads, useOfflineAsset } from '@/composables/useOfflineAsset'
import { OFFLINE_ASSET_CACHE } from '@/features/pwa/cache-policy'
import type { ToolOfflineAsset } from '@/features/tools/catalog'

/** SHA-256 of the three bytes the stubbed response serves. */
const engine: ToolOfflineAsset = {
  id: 'demo-engine',
  version: '2026-09-01',
  url: '/assets/offline/demo-engine-2026-09-01.wasm',
  bytes: 3,
  sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
  label: { 'zh-tw': '去背模型', en: 'Background removal model' },
}

function stubCache() {
  const stored = new Map<string, Response>()
  const opened: string[] = []
  vi.stubGlobal('caches', {
    open: async (name: string) => {
      opened.push(name)
      return {
        match: async (url: string) => stored.get(url),
        put: async (url: string, response: Response) => { stored.set(url, response) },
      }
    },
  })
  return { opened, stored }
}

function stubDownload(bytes: number[]) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url)
    return new Response(new Uint8Array(bytes), { headers: { 'content-length': String(bytes.length), 'content-type': 'application/wasm' } })
  }))
  return calls
}

afterEach(() => { resetOfflineAssetDownloads(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('離線資產下載', () => {
  it('比對 SHA-256 後才寫入快取，且只寫入版本化的離線資產快取', async () => {
    const cache = stubCache()
    stubDownload([1, 2, 3])
    const asset = useOfflineAsset(engine)
    await asset.download()
    await flushPromises()
    expect(asset.state.value.phase).toBe('cached')
    expect(cache.stored.has(engine.url)).toBe(true)
    expect(new Set(cache.opened)).toEqual(new Set([OFFLINE_ASSET_CACHE]))
  })

  it('位元不符時不寫入快取，並且說明是驗證失敗而非網路失敗', async () => {
    const cache = stubCache()
    stubDownload([1, 2, 4])
    const asset = useOfflineAsset(engine)
    await asset.download()
    await flushPromises()
    expect(asset.state.value.phase).toBe('failed')
    expect(asset.state.value.failureReason).toBe('digest-mismatch')
    expect(cache.stored.has(engine.url)).toBe(false)
  })

  it('同一份資產的多個使用者共用狀態，不會重複下載同樣的位元組', async () => {
    stubCache()
    const calls = stubDownload([1, 2, 3])
    const first = useOfflineAsset(engine)
    const second = useOfflineAsset(engine)
    await Promise.all([first.download(), second.download()])
    await flushPromises()
    expect(calls).toEqual([engine.url])
    expect(first.state.value).toBe(second.state.value)
    expect(second.cachedKey.value).toBe('demo-engine@2026-09-01')
  })

  it('取消會丟棄已收到的位元組，且維持可重試', async () => {
    stubCache()
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const asset = useOfflineAsset(engine)
    void asset.download()
    await flushPromises()
    expect(asset.state.value.phase).toBe('downloading')
    asset.cancel()
    expect(asset.state.value).toMatchObject({ phase: 'idle', receivedBytes: 0 })
  })
})
