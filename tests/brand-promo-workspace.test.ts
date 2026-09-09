import { mount, flushPromises } from '@vue/test-utils'
import { expect, it, vi, afterEach } from 'vitest'
import Workspace from '@/components/BrandPromoImageWorkspace.vue'
afterEach(() => vi.unstubAllGlobals())
it('工作區提供有名稱的圖片入口、圖層類型與本機資產管理連結', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  const wrapper = mount(Workspace, { global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
  await flushPromises()
  expect(wrapper.get('label[for="promo-file"]').text()).toBe('匯入圖片')
  expect(wrapper.get('#promo-kind').findAll('option').map(item => item.text())).toEqual(['背景', '商品圖', '框版', 'Logo'])
  expect(wrapper.get('a[href="/zh-tw/storage/"]').text()).toContain('本機資產')
  expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  wrapper.unmount()
})
