import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ImageBatchPicker from '@/components/ImageBatchPicker.vue'
import { imageBatchLimits } from '@/features/images/batch'
import { imageInputLimits } from '@/features/images/limits'
import { heicMessage, imageInputErrors } from '@/features/images/messages'
import { setTestRoute } from './support/nuxt-stubs'

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()) })

const png = (name: string, size = 64) => {
  const bytes = new Uint8Array(size)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  return new File([bytes], name, { type: 'image/png' })
}
const renamedText = (name: string) => new File(['not an image at all'], name, { type: 'image/png' })
const heic = (name: string) => new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99])], name, { type: 'image/heic' })
/** Only `size` is read past the signature, so a huge file need not be allocated. */
const oversized = (name: string) => Object.defineProperty(png(name), 'size', { value: imageInputLimits.maxBytes + 1 })

function mountPicker(props: Partial<{ count: number, bytes: number, disabled: boolean, limits: typeof imageBatchLimits }> = {}) {
  const wrapper = mount(ImageBatchPicker, {
    props: { count: 0, bytes: 0, limits: imageBatchLimits, ...props },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return wrapper
}

async function choose(wrapper: ReturnType<typeof mount>, files: File[]) {
  const input = wrapper.find('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  await flushPromises()
}

const added = (wrapper: ReturnType<typeof mount>) => (wrapper.emitted('add') ?? []).map(([files]) => (files as File[]).map(file => file.name))

describe('空的選圖區', () => {
  it('是一個拖放區：說明格式、批次與單張上限，並可一次選多張', () => {
    const wrapper = mountPicker()

    expect(wrapper.text()).toContain('選擇或拖放圖片')
    expect(wrapper.text()).toContain('一次最多 20 張、合計 200 MB')
    expect(wrapper.text()).toContain('每張最多 25 MB、2,400 萬像素')
    expect(wrapper.text()).toContain(heicMessage['zh-tw'])
    expect(wrapper.find('input[type=file]').attributes('multiple')).toBeDefined()
    expect(wrapper.find('button').text()).toBe('選擇圖片')
  })

  it('一次選多張：合格的交給工具，不合格的照 imageInputErrors 的說法逐檔說明', async () => {
    const wrapper = mountPicker()
    await choose(wrapper, [png('a.png'), heic('IMG_0001.HEIC'), renamedText('fake.png'), png('b.png'), oversized('huge.png')])

    expect(added(wrapper)).toEqual([['a.png', 'b.png']])
    const issues = wrapper.findAll('[data-batch-issue]')
    expect(issues.map(issue => issue.attributes('data-batch-issue'))).toEqual(['unsupported_heic', 'unsupported_format', 'too_large'])
    expect(issues[0]!.text()).toBe(`IMG_0001.HEIC：${imageInputErrors.unsupported_heic!['zh-tw']}`)
    expect(issues[1]!.text()).toContain('fake.png')
    expect(issues[2]!.text()).toContain(imageInputErrors.too_large!['zh-tw'])
  })

  it('拖放多張圖片與選檔走同一套檢查；拖曳經過時整區改為「放開就會加入圖片」', async () => {
    const wrapper = mountPicker()
    const zone = wrapper.find('.image-batch-picker__zone')

    await zone.trigger('dragenter', { dataTransfer: { types: ['Files'] } })
    expect(zone.attributes('data-dragging')).toBe('true')
    expect(wrapper.text()).toContain('放開就會加入圖片')

    await zone.trigger('drop', { dataTransfer: { types: ['Files'], files: [png('a.png'), png('b.png'), heic('c.heic')] } })
    await flushPromises()
    expect(zone.attributes('data-dragging')).toBeUndefined()
    expect(added(wrapper)).toEqual([['a.png', 'b.png']])
    expect(wrapper.find('[data-batch-issue="unsupported_heic"]').exists()).toBe(true)
  })

  it('拖曳的不是檔案（例如一段文字）時不亮起', async () => {
    const wrapper = mountPicker()
    await wrapper.find('.image-batch-picker__zone').trigger('dragenter', { dataTransfer: { types: ['text/plain'] } })

    expect(wrapper.find('.image-batch-picker__zone').attributes('data-dragging')).toBeUndefined()
  })

  it('停用時不收任何檔案', async () => {
    const wrapper = mountPicker({ disabled: true })
    await choose(wrapper, [png('a.png')])

    expect(wrapper.emitted('add')).toBeUndefined()
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})

describe('批次上限', () => {
  it('超過張數的檔案不加入，列出被退回的檔名並說明上限', async () => {
    const wrapper = mountPicker({ count: 19 })
    await choose(wrapper, [png('a.png'), png('b.png'), png('c.png')])

    expect(added(wrapper)).toEqual([['a.png']])
    const issue = wrapper.find('[data-batch-issue="too_many_items"]')
    expect(issue.text()).toContain('b.png、c.png')
    expect(issue.text()).toContain('一次最多 20 張')
  })

  it('超過合計容量的檔案不加入，較小、放得下的照樣加入', async () => {
    const wrapper = mountPicker({ count: 1, bytes: 900, limits: { maxItems: 20, maxBytes: 1000 } })
    await choose(wrapper, [png('big.png', 200), png('small.png', 64)])

    expect(added(wrapper)).toEqual([['small.png']])
    expect(wrapper.find('[data-batch-issue="batch_too_large"]').text()).toContain('big.png')
  })

  it('退回很多檔案時只列前三個檔名並寫出總數', async () => {
    const wrapper = mountPicker({ count: 20 })
    await choose(wrapper, ['1', '2', '3', '4', '5'].map(name => png(`${name}.png`)))

    expect(wrapper.find('[data-batch-issue="too_many_items"]').text()).toContain('1.png、2.png、3.png 等 5 張')
  })

  it('下一次選圖會換掉上一次的錯誤', async () => {
    const wrapper = mountPicker()
    await choose(wrapper, [heic('a.heic')])
    await choose(wrapper, [png('b.png')])

    expect(wrapper.findAll('[data-batch-issue]')).toHaveLength(0)
  })
})

describe('有圖片之後', () => {
  it('縮成一列小按鈕與用量，畫面留給預覽', () => {
    const wrapper = mountPicker({ count: 3, bytes: 3 * 1024 * 1024 })

    expect(wrapper.find('.image-batch-picker__icon').exists()).toBe(false)
    expect(wrapper.findAll('button').map(button => button.text())).toEqual(['加入圖片', '全部清除'])
    expect(wrapper.find('.image-batch-picker__meter').text()).toBe('3／20 張 · 3 MB／200 MB')
  })

  it('全部清除要先確認：Escape 或取消會回到原本的按鈕，確定才清除', async () => {
    const wrapper = mountPicker({ count: 2 })
    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('清除全部 2 張圖片？')
    expect(document.activeElement?.textContent).toBe('取消')

    await wrapper.find('.image-batch-picker__confirm').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.emitted('clear')).toBeUndefined()
    expect(document.activeElement?.textContent).toContain('全部清除')

    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === '確定清除')!.trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('英文介面也完整', async () => {
    setTestRoute({ params: { locale: 'en' } })
    const wrapper = mountPicker({ count: 19 })
    await choose(wrapper, [png('a.png'), png('b.png')])

    expect(wrapper.findAll('button').map(button => button.text())).toEqual(['Add images', 'Clear all'])
    expect(wrapper.find('[data-batch-issue="too_many_items"]').text()).toBe('b.png: More images than one batch holds, so these were not added. This device takes 20 at a time; remove a few and add them again.')
  })
})
