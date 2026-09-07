import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import ImageCompressorWorkspace from '@/components/ImageCompressorWorkspace.vue'

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); vi.unstubAllGlobals() })

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
