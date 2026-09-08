import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import ImageBackgroundRemoverWorkspace from '@/components/ImageBackgroundRemoverWorkspace.vue'
import { backgroundRemovalAssets } from '@/features/tools/image-background-remover/domain/model'

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function stubCache(cached: boolean) {
  const entries = new Map<string, Response>()
  if (cached) for (const asset of backgroundRemovalAssets) entries.set(asset.url, new Response(new Blob([new Uint8Array([1])])))
  vi.stubGlobal('caches', {
    open: async () => ({
      match: async (url: string) => entries.get(url),
      put: async (url: string, response: Response) => { entries.set(url, response) },
    }),
  })
}

function stubWorker(behaviour: (message: { type: string }, worker: { onmessage?: (event: { data: unknown }) => void }) => void) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('/* public worker code */')))
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void
    terminate = vi.fn()
    postMessage(message: { type: string }) { queueMicrotask(() => behaviour(message, this)) }
  })
}

const png = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'portrait.png', { type: 'image/png' })

async function selectFile(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.find('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

it('能力不足時說明原因、不讓裝置下載用不到的模型，也不寫入任何本機儲存', async () => {
  stubCache(false)
  vi.stubGlobal('Worker', undefined)
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  const wrapper = mount(ImageBackgroundRemoverWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  expect(wrapper.text()).toContain('這個瀏覽器無法在本機執行去背模型')
  expect(wrapper.find('input[type=file]').attributes('disabled')).toBeUndefined()
  expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
  // §12.8: an unsupported device must fail before it pays for the model.
  const download = wrapper.findAll('button').find(button => button.text().includes('下載模型'))!
  expect(download.attributes('disabled')).toBeDefined()
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(0)
})

it('可用儲存空間不足時說明原因，且不開始下載模型', async () => {
  stubCache(false)
  const requests: string[] = []
  stubWorker((message, worker) => {
    if (message.type === 'prepare') worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/png'] } })
  })
  const worker = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
  vi.stubGlobal('fetch', vi.fn(async (url: string) => { requests.push(url); return worker(url) }))
  vi.stubGlobal('navigator', new Proxy(navigator, {
    get: (target, key) => key === 'storage'
      ? { estimate: async () => ({ quota: 5_000_000, usage: 0 }) }
      : Reflect.get(target, key),
  }))
  const wrapper = mount(ImageBackgroundRemoverWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  const download = wrapper.findAll('button').find(button => button.text().includes('下載模型'))!
  await download.trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('可用儲存空間不足')
  expect(requests.some(url => url.includes('/assets/offline/'))).toBe(false)
})

it('模型尚未下載時說明首次下載，並且不允許開始去背', async () => {
  stubCache(false)
  stubWorker((message, worker) => {
    if (message.type === 'prepare') worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/png'] } })
  })
  const wrapper = mount(ImageBackgroundRemoverWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  await selectFile(wrapper, png())
  expect(wrapper.find('[data-model-preparation]').attributes('data-model-ready')).toBe('false')
  expect(wrapper.text()).toContain('首次使用需下載')
  expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
})

it('先說明只處理人像，並在解碼前拒絕 HEIC／HEIF', async () => {
  stubCache(true)
  stubWorker((message, worker) => {
    if (message.type === 'prepare') worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/png'] } })
  })
  const wrapper = mount(ImageBackgroundRemoverWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  expect(wrapper.text()).toContain('人像')
  await selectFile(wrapper, new File([new Uint8Array([255, 216, 255])], 'selfie.heic', { type: '' }))
  expect(wrapper.text()).toContain('第一版不支援 iPhone HEIC／HEIF')
  expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
})

it('完成後同時呈現原圖與透明結果，並提供 PNG 下載與品質提醒', async () => {
  stubCache(true)
  stubWorker((message, worker) => {
    if (message.type === 'prepare') worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/png'] } })
    else worker.onmessage?.({ data: { type: 'result', output: { bytes: new Uint8Array([1, 2, 3]).buffer, preview: new Uint8Array([4]).buffer, width: 900, height: 1200, coverage: 0.38 } } })
  })
  const wrapper = mount(ImageBackgroundRemoverWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  await selectFile(wrapper, png())
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  expect(wrapper.find('[data-image-original]').exists()).toBe(true)
  expect(wrapper.find('[data-image-result]').exists()).toBe(true)
  expect(wrapper.find('[data-image-result]').text()).toContain('900 × 1200')
  const download = wrapper.find('a[download]')
  expect(download.attributes('download')).toMatch(/\.png$/)
  expect(wrapper.text()).toContain('請確認邊緣')
})

it('取消後不交付部分結果，狀態說明原圖未變更且可重試', async () => {
  stubCache(true)
  stubWorker((message, worker) => {
    if (message.type === 'prepare') worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/png'] } })
  })
  const wrapper = mount(ImageBackgroundRemoverWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  await selectFile(wrapper, png())
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  const cancel = wrapper.findAll('button').find(button => button.text().includes('取消'))!
  await cancel.trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('已取消')
  expect(wrapper.find('[data-image-result]').exists()).toBe(false)
  expect(wrapper.find('a[download]').exists()).toBe(false)
})
