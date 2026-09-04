import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OfflineAssetDownloadComponent from '@/components/OfflineAssetDownload.vue'
import ToolOfflineStatus from '@/components/ToolOfflineStatus.vue'
import type { PublishedToolDefinition, ToolOfflineAsset } from '@/features/tools/catalog'

const engine: ToolOfflineAsset = {
  id: 'demo-engine',
  version: '2026-09-01',
  url: '/assets/offline/demo-engine-2026-09-01.wasm',
  bytes: 2_000_000,
  label: { 'zh-tw': '去背模型', en: 'Background removal model' },
}

const heavyTool = {
  offlineMode: 'requires-first-download',
  offlineAssets: [engine],
} as Pick<PublishedToolDefinition, 'offlineMode' | 'offlineAssets'>

const readyTool = { offlineMode: 'ready' } as Pick<PublishedToolDefinition, 'offlineMode' | 'offlineAssets'>

/** Minimal Cache API double: the component only ever reads and writes by URL. */
function installCacheStorage(seeded: string[] = []) {
  const store = new Set(seeded)
  const cache = {
    match: vi.fn(async (url: string) => store.has(url) ? new Response('cached') : undefined),
    put: vi.fn(async (url: string) => { store.add(url) }),
  }
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) })
  return { cache, store }
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
  window.dispatchEvent(new Event(online ? 'online' : 'offline'))
}

/** A body that yields one chunk, then waits for the test to release the rest. */
function streamingResponse(chunks: Uint8Array[], totalBytes: number) {
  let index = 0
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) return controller.close()
      controller.enqueue(chunks[index]!)
      index += 1
    },
  }), { headers: { 'content-length': String(totalBytes), 'content-type': 'application/wasm' } })
}

function mountStatus(tool = heavyTool) {
  return mount(ToolOfflineStatus, {
    props: { tool, locale: 'zh-tw' as const },
    global: { components: { OfflineAssetDownload: OfflineAssetDownloadComponent } },
  })
}

// Globals are replaced rather than unstubbed: the shared Nuxt stubs are
// installed once for the whole file and must survive every test in it.
beforeEach(() => setOnline(true))

describe('tool offline status', () => {
  it('states that a lightweight tool needs no download at all', () => {
    installCacheStorage()
    const wrapper = mountStatus(readyTool)

    expect(wrapper.attributes('data-tool-offline')).toBe('ready')
    expect(wrapper.text()).toContain('離線可用')
    expect(wrapper.find('[data-offline-asset]').exists()).toBe(false)
  })

  it('explains the download a heavy tool needs before any work starts', async () => {
    installCacheStorage()
    const wrapper = mountStatus()
    await vi.waitFor(() => expect(wrapper.find('[data-offline-asset-phase="idle"]').exists()).toBe(true))

    expect(wrapper.attributes('data-tool-offline')).toBe('needs-download')
    expect(wrapper.text()).toContain('首次使用需下載所需資源')
    expect(wrapper.text()).toContain('去背模型')
    expect(wrapper.text()).toContain('2 MB')
    expect(wrapper.text()).toContain('2026-09-01')
  })

  it('reports a tool as prepared when the declared version is already cached', async () => {
    installCacheStorage([engine.url])
    const wrapper = mountStatus()

    await vi.waitFor(() => expect(wrapper.attributes('data-tool-offline')).toBe('prepared'))
    expect(wrapper.text()).toContain('已下載，可離線使用')
  })

  it('explains that a missing asset cannot be downloaded while offline', async () => {
    installCacheStorage()
    setOnline(false)
    const wrapper = mountStatus()

    await vi.waitFor(() => expect(wrapper.attributes('data-tool-offline')).toBe('blocked-offline'))
    expect(wrapper.text()).toContain('目前離線')

    await wrapper.find('[data-offline-asset] button').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-offline-asset-phase="blocked-offline"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('還無法下載這個資源')
  })

  it('announces the phase without repeating every progress tick', async () => {
    installCacheStorage()
    let release = () => {}
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(500_000))
        release = () => controller.close()
      },
    }), { headers: { 'content-length': '2000000' } })))

    const wrapper = mountStatus()
    await vi.waitFor(() => expect(wrapper.find('[data-offline-asset-phase="idle"]').exists()).toBe(true))
    await wrapper.find('[data-offline-asset] button').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-offline-asset-phase="downloading"]').exists()).toBe(true))

    const live = wrapper.find('.offline-asset__status')
    expect(live.attributes('role')).toBe('status')
    expect(live.text()).toBe('下載中…')
    expect(live.text()).not.toContain('%')

    const progressbar = wrapper.find('[role="progressbar"]')
    expect(progressbar.attributes('aria-valuenow')).toBe('25')
    expect(wrapper.find('.offline-asset__percent').text()).toBe('25%')

    release()
  })

  it('shows progress and stores the version once the download completes', async () => {
    const { store } = installCacheStorage()
    vi.stubGlobal('fetch', vi.fn(async () => streamingResponse([new Uint8Array(1_000_000), new Uint8Array(1_000_000)], 2_000_000)))

    const wrapper = mountStatus()
    await vi.waitFor(() => expect(wrapper.find('[data-offline-asset-phase="idle"]').exists()).toBe(true))
    await wrapper.find('[data-offline-asset] button').trigger('click')

    await vi.waitFor(() => expect(wrapper.find('[data-offline-asset-phase="cached"]').exists()).toBe(true))
    expect(store.has(engine.url)).toBe(true)
    expect(wrapper.attributes('data-tool-offline')).toBe('prepared')
  })

  it('keeps a failed download retryable and stores nothing', async () => {
    const { store } = installCacheStorage()
    const failing = vi.fn(async () => { throw new Error('network unavailable') })
    vi.stubGlobal('fetch', failing)

    const wrapper = mountStatus()
    await vi.waitFor(() => expect(wrapper.find('[data-offline-asset-phase="idle"]').exists()).toBe(true))
    await wrapper.find('[data-offline-asset] button').trigger('click')

    await vi.waitFor(() => expect(wrapper.find('[data-offline-asset-phase="failed"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('下載未完成')
    expect(wrapper.text()).toContain('重新下載')
    expect(store.size).toBe(0)

    vi.stubGlobal('fetch', vi.fn(async () => streamingResponse([new Uint8Array(2_000_000)], 2_000_000)))
    await wrapper.find('[data-offline-asset] button').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-offline-asset-phase="cached"]').exists()).toBe(true))
    expect(store.has(engine.url)).toBe(true)
  })

  it('never sends anything but the versioned asset URL', async () => {
    installCacheStorage()
    const request = vi.fn(async () => streamingResponse([new Uint8Array(2_000_000)], 2_000_000))
    vi.stubGlobal('fetch', request)

    const wrapper = mountStatus()
    await vi.waitFor(() => expect(wrapper.find('[data-offline-asset-phase="idle"]').exists()).toBe(true))
    await wrapper.find('[data-offline-asset] button').trigger('click')
    await vi.waitFor(() => expect(request).toHaveBeenCalled())

    expect(request.mock.calls[0]?.[0]).toBe(engine.url)
    expect(JSON.stringify(request.mock.calls)).not.toContain('demo-engine@')
  })
})
