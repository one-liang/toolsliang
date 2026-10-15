import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import ImageCompressorWorkspace from '@/components/ImageCompressorWorkspace.vue'

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('可恢復能力不足，原圖仍可選擇且不保存工具內容', async () => {
  vi.stubGlobal('Worker', undefined)
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  const wrapper = mount(ImageCompressorWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  expect(wrapper.text()).toContain('此瀏覽器無法提供背景圖片處理')
  expect(wrapper.find('input[type=file]').attributes('disabled')).toBeUndefined()
  expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
  expect(wrapper.text()).toContain('重新檢查')
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(0)
})

/** A PNG signature padded to a known size, so the card's KB figure is predictable. */
const png = (name: string, size: number) => {
  const bytes = new Uint8Array(size)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  return new File([bytes], name, { type: 'image/png' })
}

function stubEngine() {
  const urls = new Map<string, Blob | MediaSource>()
  const revoked: string[] = []
  vi.stubGlobal('fetch', vi.fn(async () => new Response('/* public worker code */')))
  vi.spyOn(URL, 'createObjectURL').mockImplementation((object) => { const url = `blob:test-${urls.size}`; urls.set(url, object); return url })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => { revoked.push(url) })
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void
    terminate = vi.fn()
    postMessage(message: { type: string }) {
      queueMicrotask(() => {
        if (message.type === 'prepare') this.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/png', 'image/jpeg'] } })
        else this.onmessage?.({ data: { type: 'result', output: { bytes: new Uint8Array(1536).buffer, preview: new Uint8Array(1).buffer, format: 'image/png', width: 80, height: 40, sourceWidth: 80, sourceHeight: 40, keptOriginal: false } } })
      })
    }
  })
  /** The object URL that currently stands for this exact file, if any. */
  const urlOf = (file: File) => [...urls].find(([, object]) => object === file)?.[0]
  return { urlOf, revoked }
}

async function selectFile(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.find('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

it('選圖後立即顯示原圖縮圖卡，壓縮後以 KB／MB 與縮小比例比較，畫面不出現 bytes 或內部檔名', async () => {
  const { urlOf } = stubEngine()
  const wrapper = mount(ImageCompressorWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  const file = png('product shot.final.png', 3072)
  await selectFile(wrapper, file)
  const original = wrapper.find('[data-image-original]')
  expect(original.find('img').attributes('src')).toBe(urlOf(file))
  expect(original.text()).toContain('3 KB')
  expect(wrapper.find('[data-image-result]').exists()).toBe(false)

  await wrapper.find('form').trigger('submit')
  await flushPromises()
  const output = wrapper.find('[data-image-result]')
  expect(output.text()).toContain('80 × 40')
  expect(output.text()).toContain('1.5 KB')
  expect(output.text()).toContain('縮小 50%')
  expect(wrapper.find('[data-image-original]').text()).toContain('80 × 40')
  expect(wrapper.find('a[download]').attributes('download')).toBe('product shot.final-compressed.png')
  expect(wrapper.text()).not.toMatch(/bytes|compressed-image|product shot/)
})

it('換圖與清除時釋放縮圖的 object URL', async () => {
  const { urlOf, revoked } = stubEngine()
  const wrapper = mount(ImageCompressorWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  const first = png('first.png', 2048), second = png('second.png', 2048)
  await selectFile(wrapper, first)
  await selectFile(wrapper, second)
  expect(revoked).toContain(urlOf(first))
  expect(wrapper.find('[data-image-original] img').attributes('src')).toBe(urlOf(second))

  await wrapper.findAll('button').find(button => button.text() === '清除圖片')!.trigger('click')
  await flushPromises()
  expect(revoked).toContain(urlOf(second))
  expect(wrapper.find('[data-image-original]').exists()).toBe(false)
})
