import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import ImageBatchStrip from '@/components/ImageBatchStrip.vue'
import type { ImageBatchItem } from '@/composables/useImageBatch'
import type { ImageBatchStatus } from '@/features/images/batch'
import { imageInputErrors } from '@/features/images/messages'
import { setTestRoute } from './support/nuxt-stubs'

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()) })

function item(id: string, status: ImageBatchStatus, extra: Partial<ImageBatchItem> = {}): ImageBatchItem {
  return { id, file: new File([new Uint8Array(4)], `${id}.png`, { type: 'image/png' }), url: `blob:${id}`, status, retryable: true, ...extra }
}

const batch = () => [
  item('a', 'done'),
  item('b', 'running'),
  item('c', 'failed', { error: 'engine_failed' }),
  item('d', 'pending'),
  item('e', 'failed', { error: 'too_large', retryable: false }),
]

/** The strip is controlled: this host keeps the selection and the list, as a tool would. */
function mountHost(items = batch(), options: { disabled?: boolean, selected?: string } = {}) {
  const list = ref(items)
  const selected = ref(options.selected ?? items[0]?.id)
  const Host = defineComponent(() => () => h(ImageBatchStrip, {
    'items': list.value,
    'selectedId': selected.value,
    'disabled': options.disabled,
    'messages': { engine_failed: { 'zh-tw': '這張沒有處理完成，可以再試一次。', en: 'This one did not finish. Try again.' } },
    'onSelect': (id: string) => { selected.value = id },
    'onRemove': (id: string) => {
      const index = list.value.findIndex(entry => entry.id === id)
      list.value = list.value.filter(entry => entry.id !== id)
      if (selected.value === id) selected.value = (list.value[index] ?? list.value[index - 1])?.id
    },
  }))
  const wrapper = mount(Host, { attachTo: document.body })
  mounted.push(wrapper)
  return { wrapper, strip: wrapper.findComponent(ImageBatchStrip), list, selected }
}

const options = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[role="option"]')

describe('縮圖列', () => {
  it('每張都有縮圖與狀態，狀態同時以圖示、邊框標記與文字表達', () => {
    const { wrapper } = mountHost()

    expect(options(wrapper).map(option => option.attributes('data-batch-status'))).toEqual(['done', 'running', 'failed', 'pending', 'failed'])
    expect(options(wrapper).map(option => option.find('img').attributes('src'))).toEqual(['blob:a', 'blob:b', 'blob:c', 'blob:d', 'blob:e'])
    expect(options(wrapper).every(option => option.find('.image-batch-strip__badge svg').exists())).toBe(true)
    expect(options(wrapper).map(option => option.find('.sr-only').text())).toEqual([
      '第 1／5 張：a.png，完成',
      '第 2／5 張：b.png，處理中',
      '第 3／5 張：c.png，失敗',
      '第 4／5 張：d.png，等待處理',
      '第 5／5 張：e.png，失敗',
    ])
    expect(wrapper.find('[role="status"]').text()).toBe('共 5 張：1 張完成、1 張處理中、2 張失敗、1 張等待處理。')
  })

  it('整列是一個 Tab 停留點：只有目前預覽的那張可以 Tab 到', () => {
    const { wrapper } = mountHost(batch(), { selected: 'c' })

    expect(options(wrapper).map(option => option.attributes('tabindex'))).toEqual(['-1', '-1', '0', '-1', '-1'])
    expect(options(wrapper).map(option => option.attributes('aria-selected'))).toEqual(['false', 'false', 'true', 'false', 'false'])
  })

  it('點一下縮圖就切換目前預覽的圖片', async () => {
    const { wrapper, strip } = mountHost()
    await options(wrapper)[3]!.trigger('click')

    expect(strip.emitted('select')).toEqual([['d']])
    expect(wrapper.find('[data-batch-current]').attributes('data-batch-current')).toBe('d')
    expect(wrapper.find('.image-batch-strip__caption').text()).toContain('d.png')
  })

  it('方向鍵、Home、End 移動並切換預覽，焦點跟著移動', async () => {
    const { wrapper, selected } = mountHost()
    const list = wrapper.find('[role="listbox"]')

    await list.trigger('keydown', { key: 'ArrowRight' })
    expect(selected.value).toBe('b')
    expect(document.activeElement).toBe(options(wrapper)[1]!.element)

    await list.trigger('keydown', { key: 'End' })
    expect(selected.value).toBe('e')
    await list.trigger('keydown', { key: 'ArrowRight' })
    expect(selected.value).toBe('e')
    await list.trigger('keydown', { key: 'Home' })
    expect(selected.value).toBe('a')
    await list.trigger('keydown', { key: 'ArrowLeft' })
    expect(selected.value).toBe('a')
  })

  it('Delete 鍵移除焦點所在的圖片，焦點落在接手的那張', async () => {
    const { wrapper, list } = mountHost(batch(), { selected: 'b' })
    options(wrapper)[1]!.element.focus()
    await wrapper.find('[role="listbox"]').trigger('keydown', { key: 'Delete' })
    await flushPromises()

    expect(list.value.map(entry => entry.id)).toEqual(['a', 'c', 'd', 'e'])
    expect(document.activeElement).toBe(options(wrapper)[1]!.element)
    expect(options(wrapper)[1]!.attributes('data-batch-item')).toBe('c')
  })

  it('目前那張旁邊有「移除」；失敗且可以重來的才有「重試」', async () => {
    const { wrapper, strip } = mountHost(batch(), { selected: 'a' })
    expect(wrapper.find('[data-batch-retry]').exists()).toBe(false)

    await options(wrapper)[2]!.trigger('click')
    await wrapper.find('[data-batch-retry]').trigger('click')
    expect(strip.emitted('retry')).toEqual([['c']])
    expect(wrapper.find('.image-batch-strip__error').text()).toBe('這張沒有處理完成，可以再試一次。')

    await options(wrapper)[4]!.trigger('click')
    expect(wrapper.find('[data-batch-retry]').exists()).toBe(false)
    expect(wrapper.find('.image-batch-strip__error').text()).toBe(imageInputErrors.too_large!['zh-tw'])

    await wrapper.find('[data-batch-remove]').trigger('click')
    expect(strip.emitted('remove')).toEqual([['e']])
  })

  it('停用時還能切換預覽，但不能移除或重試', async () => {
    const { wrapper, strip } = mountHost(batch(), { disabled: true, selected: 'c' })

    await wrapper.find('[role="listbox"]').trigger('keydown', { key: 'Delete' })
    expect(strip.emitted('remove')).toBeUndefined()
    expect(wrapper.find('[data-batch-remove]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-batch-retry]').attributes('disabled')).toBeDefined()

    await wrapper.find('[role="listbox"]').trigger('keydown', { key: 'ArrowRight' })
    expect(strip.emitted('select')).toEqual([['d']])
  })

  it('沒有圖片時整列不顯示', () => {
    const { wrapper } = mountHost([])

    expect(wrapper.find('.image-batch-strip').exists()).toBe(false)
  })

  it('英文介面也完整', () => {
    setTestRoute({ params: { locale: 'en' } })
    const { wrapper } = mountHost(batch(), { selected: 'c' })

    expect(options(wrapper)[2]!.find('.sr-only').text()).toBe('3 of 5: c.png, Failed')
    expect(wrapper.find('[role="listbox"]').attributes('aria-label')).toBe('Images in this batch')
    expect(wrapper.find('[data-batch-retry]').text()).toBe('Try again')
  })
})
