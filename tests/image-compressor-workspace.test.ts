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
  expect(wrapper.text()).toContain('這個瀏覽器無法在背景處理圖片')
  expect(wrapper.find('input[type=file]').attributes('disabled')).toBeUndefined()
  expect(wrapper.text()).toContain('重新檢查')
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(0)
})

/** A PNG signature padded to a known size, so the KB figures are predictable. */
const png = (name: string, size: number) => {
  const bytes = new Uint8Array(size)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  return new File([bytes], name, { type: 'image/png' })
}

function stubEngine() {
  const urls = new Map<string, Blob | MediaSource>()
  const revoked: string[] = []
  const formats: string[] = []
  vi.stubGlobal('fetch', vi.fn(async () => new Response('/* public worker code */')))
  vi.spyOn(URL, 'createObjectURL').mockImplementation((object) => { const url = `blob:test-${urls.size}`; urls.set(url, object); return url })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => { revoked.push(url) })
  // The batch measures every picture before it is compressed.
  vi.stubGlobal('Image', class {
    naturalWidth = 80
    naturalHeight = 40
    onload?: () => void
    set src(_: string) { queueMicrotask(() => this.onload?.()) }
  })
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void
    terminate = vi.fn()
    postMessage(message: { type: string, input?: { format: string } }) {
      queueMicrotask(() => {
        if (message.type === 'prepare') this.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/png', 'image/jpeg'] } })
        else {
          const format = message.input?.format ?? 'image/png'
          formats.push(format)
          this.onmessage?.({ data: { type: 'result', output: { bytes: new Uint8Array(1536).buffer, preview: new Uint8Array(1).buffer, format, width: 80, height: 40, sourceWidth: 80, sourceHeight: 40, keptOriginal: false } } })
        }
      })
    }
  })
  /** The object URL that currently stands for this exact file, if any. */
  const urlOf = (file: File) => [...urls].find(([, object]) => object === file)?.[0]
  return { urlOf, revoked, formats }
}

async function selectFiles(wrapper: ReturnType<typeof mount>, files: File[]) {
  const input = wrapper.find('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  for (let round = 0; round < 6; round += 1) await flushPromises()
}

it('選圖後立即顯示原圖並自動壓縮，以 KB 與縮小比例比較，不出現 bytes', async () => {
  const { urlOf } = stubEngine()
  const wrapper = mount(ImageCompressorWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  const file = png('product shot.final.png', 3072)
  await selectFiles(wrapper, [file])
  const original = wrapper.find('[data-image-original]')
  expect(original.find('img').attributes('src')).toBe(urlOf(file))
  expect(original.text()).toContain('3 KB')
  expect(original.text()).toContain('80 × 40')

  const output = wrapper.find('[data-image-result]')
  expect(output.text()).toContain('80 × 40')
  expect(output.text()).toContain('1.5 KB')
  expect(output.text()).toContain('縮小 50%')
  expect(wrapper.find('a[download]').attributes('download')).toBe('product shot.final-compressed.png')
  expect(wrapper.find('[data-compressor-summary]').exists()).toBe(false)
  expect(wrapper.text()).not.toMatch(/\bbytes\b/)
})

it('一次壓縮多張，顯示合計並提供 ZIP 下載', async () => {
  const { formats } = stubEngine()
  const wrapper = mount(ImageCompressorWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  await selectFiles(wrapper, [png('a.png', 3072), png('b.png', 3072), png('a.png', 3072)])
  expect(formats).toHaveLength(3)
  expect(wrapper.find('[data-compressor-summary]').text()).toContain('3／3 張')
  expect(wrapper.find('[data-compressor-summary]').text()).toContain('縮小 50%')
  expect(wrapper.find('[data-batch-download-all]').exists()).toBe(true)
  const names = wrapper.findAll('details a[download]').map(link => link.attributes('download'))
  expect(names).toEqual(['a-compressed.png', 'b-compressed.png', 'a-compressed-2.png'])
})

it('改輸出格式會用新格式重新壓縮整批', async () => {
  const { formats } = stubEngine()
  const wrapper = mount(ImageCompressorWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  await selectFiles(wrapper, [png('a.png', 3072), png('b.png', 3072)])
  // Automatic keeps each PNG a PNG; choosing JPEG compresses the batch again.
  expect(formats).toEqual(['image/png', 'image/png'])
  expect(wrapper.text()).toContain('每張都維持原格式；PNG 以減少顏色來縮小，保留透明背景。')
  await wrapper.find('#compressor-format').setValue('image/jpeg')
  for (let round = 0; round < 6; round += 1) await flushPromises()
  expect(formats).toEqual(['image/png', 'image/png', 'image/jpeg', 'image/jpeg'])
  expect(wrapper.find('[data-image-result]').text()).toContain('JPEG')
  expect(wrapper.text()).toContain('透明處會補成白色。')
})

it('清除全部時釋放縮圖與輸出的 object URL', async () => {
  const { urlOf, revoked } = stubEngine()
  const wrapper = mount(ImageCompressorWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  const first = png('first.png', 2048)
  await selectFiles(wrapper, [first])
  const output = wrapper.find('[data-image-result] img').attributes('src')

  await wrapper.findAll('button').find(button => button.text() === '全部清除')!.trigger('click')
  await wrapper.findAll('button').find(button => button.text() === '確定清除')!.trigger('click')
  await flushPromises()
  expect(revoked).toContain(urlOf(first))
  expect(revoked).toContain(output)
  expect(wrapper.find('[data-image-original]').exists()).toBe(false)
})
