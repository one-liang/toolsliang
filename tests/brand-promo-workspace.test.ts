import { mount, flushPromises } from '@vue/test-utils'
import { expect, it, vi, afterEach } from 'vitest'
import Workspace from '@/components/BrandPromoImageWorkspace.vue'
afterEach(() => vi.unstubAllGlobals())
it('工作區以四個按鈕加入圖層，不提供保存到裝置的入口，也不開啟裝置資料庫', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  const open = vi.fn(() => { throw new Error('the promo editor must not open a device database') })
  vi.stubGlobal('indexedDB', { open })
  const wrapper = mount(Workspace)
  await flushPromises()
  expect(wrapper.findAll('[data-promo-add]').map(item => item.text())).toEqual(['加入商品圖', '加入背景', '加入框版', '加入 Logo'])
  expect(wrapper.get('#promo-file').attributes('accept')).toContain('image/png')
  expect(wrapper.text()).not.toContain('保存')
  expect(wrapper.find('a[href*="/storage/"]').exists()).toBe(false)
  expect(wrapper.get('#promo-produce').attributes('disabled')).toBeDefined()
  expect(open).not.toHaveBeenCalled()
  wrapper.unmount()
})
