import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ToolOfflineStatus from '@/components/ToolOfflineStatus.vue'
import type { PublishedToolDefinition, ToolOfflineAsset } from '@/features/tools/catalog'

const engine: ToolOfflineAsset = {
  id: 'demo-engine',
  version: '2026-09-01',
  url: '/assets/offline/demo-engine-2026-09-01.wasm',
  bytes: 2_000_000,
  sha256: '13aea96040f2133033d103008d5d96cfe98b3361f7202d77bea97b2424a7a6cd',
  label: { 'zh-tw': '去背模型', en: 'Background removal model' },
}

const heavyTool = {
  offlineMode: 'requires-first-download',
  offlineAssets: [engine],
} as Pick<PublishedToolDefinition, 'offlineMode' | 'offlineAssets'>

const readyTool = { offlineMode: 'ready' } as Pick<PublishedToolDefinition, 'offlineMode' | 'offlineAssets'>

/** Minimal Cache API double: the component only ever reads by URL. */
function installCacheStorage(seeded: string[] = []) {
  const store = new Set(seeded)
  vi.stubGlobal('caches', { open: vi.fn(async () => ({ match: vi.fn(async (url: string) => store.has(url) ? new Response('cached') : undefined) })) })
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
  window.dispatchEvent(new Event(online ? 'online' : 'offline'))
}

function mountStatus(tool = heavyTool, locale: 'zh-tw' | 'en' = 'zh-tw') {
  return mount(ToolOfflineStatus, { props: { tool, locale } })
}

// Globals are replaced rather than unstubbed: the shared Nuxt stubs are
// installed once for the whole file and must survive every test in it.
beforeEach(() => setOnline(true))

describe('tool offline status', () => {
  it('states that a lightweight tool needs no first use at all', () => {
    installCacheStorage()
    const wrapper = mountStatus(readyTool)

    expect(wrapper.attributes('data-tool-offline')).toBe('ready')
    expect(wrapper.text()).toContain('離線可用')
  })

  it('tells a new visitor the tool works offline after one use, with nothing to download or press', async () => {
    installCacheStorage()
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    const wrapper = mountStatus()
    await vi.waitFor(() => expect(wrapper.attributes('data-tool-offline')).toBe('needs-download'))

    expect(wrapper.text()).toBe('用過一次後，離線也能使用。')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
    // The note only reads what is on the device; getting the files ready is the workspace's job.
    expect(request).not.toHaveBeenCalled()
  })

  it('says so in English as well', async () => {
    installCacheStorage()
    const wrapper = mountStatus(heavyTool, 'en')
    await vi.waitFor(() => expect(wrapper.attributes('data-tool-offline')).toBe('needs-download'))
    expect(wrapper.text()).toBe('After you use it once, it works offline too.')
  })

  it('reports a tool as ready offline when the declared version is already on the device, without any download wording', async () => {
    installCacheStorage([engine.url])
    const wrapper = mountStatus()

    await vi.waitFor(() => expect(wrapper.attributes('data-tool-offline')).toBe('prepared'))
    expect(wrapper.text()).toContain('離線也能使用')
    expect(wrapper.text()).not.toContain('下載')
  })

  it('explains that the first use needs a connection while offline, and recovers when the device is back online', async () => {
    installCacheStorage()
    setOnline(false)
    const wrapper = mountStatus()

    await vi.waitFor(() => expect(wrapper.attributes('data-tool-offline')).toBe('blocked-offline'))
    expect(wrapper.text()).toContain('目前離線')
    expect(wrapper.text()).toContain('第一次使用需要連上網路')

    setOnline(true)
    await vi.waitFor(() => expect(wrapper.attributes('data-tool-offline')).toBe('needs-download'))
  })

  it('treats a superseded version on the device as not ready', async () => {
    installCacheStorage(['/assets/offline/demo-engine-2026-01-01.wasm'])
    const wrapper = mountStatus()
    await vi.waitFor(() => expect(wrapper.attributes('data-tool-offline')).toBe('needs-download'))
  })
})
