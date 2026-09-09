import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import Workspace from '@/components/ProductImageWorkbenchWorkspace.vue'
import { shellStubs } from './support/nuxt-stubs'

/** No worker script can be fetched here, so every engine reports itself unsupported. */
function mountWorkspace() {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  return mount(Workspace, { global: { stubs: shellStubs } })
}

function steps(wrapper: ReturnType<typeof mountWorkspace>) {
  return Object.fromEntries(wrapper.findAll('[data-workbench-step]')
    .map(item => [item.attributes('data-workbench-step'), item.attributes('data-workbench-state')]))
}

afterEach(() => vi.unstubAllGlobals())

it('以有名稱的步驟列開場，合規主圖分支不提供品牌素材步驟', async () => {
  const wrapper = mountWorkspace()
  await flushPromises()

  expect(wrapper.findAll('[data-workbench-step] button > span:first-of-type').map(item => item.text())).toEqual([
    '1. 匯入商品圖',
    '去背（選用）',
    '版型與尺寸',
    '品牌素材（選用）',
    '2. 輸出與下載',
  ])
  expect(wrapper.findAll('.workbench__state').map(item => item.text()))
    .toEqual(['可以開始', '不適用', '不適用', '不適用', '尚未開放'])
  expect(wrapper.get('[data-workbench-panel="import"]').text()).toContain('選擇商品圖')
  wrapper.unmount()
})

it('每個引擎各自回答能力，不能執行的步驟只停用自己，匯入仍可操作', async () => {
  const wrapper = mountWorkspace()
  await flushPromises()

  expect(steps(wrapper)).toMatchObject({ import: 'ready', cutout: 'unavailable', layout: 'unavailable' })
  expect(wrapper.get('[data-workbench-step="cutout"] button').attributes('disabled')).toBeDefined()
  expect(wrapper.get('[data-workbench-step="import"] button').attributes('disabled')).toBeUndefined()
  wrapper.unmount()
})

it('版型是必要步驟，無法執行時流程到此為止，不出現產不出來的輸出', async () => {
  const wrapper = mountWorkspace()
  await flushPromises()

  expect(steps(wrapper).output).toBe('locked')
  expect(wrapper.find('a[download]').exists()).toBe(false)
  expect(wrapper.get('.workbench__steps').text()).toContain('不適用')
  wrapper.unmount()
})

it('尚未開放的步驟不能被點開，工作台不會顯示可下載的輸出', async () => {
  const wrapper = mountWorkspace()
  await flushPromises()

  await wrapper.get('[data-workbench-step="output"] button').trigger('click')
  expect(wrapper.get('[data-workbench-panel]').attributes('data-workbench-panel')).toBe('import')
  expect(wrapper.find('a[download]').exists()).toBe(false)
  wrapper.unmount()
})

it('無法在本機處理時說明原因並提供重新檢查', async () => {
  const wrapper = mountWorkspace()
  await flushPromises()

  expect(wrapper.get('.capability-warning').text()).toContain('這個瀏覽器無法在背景處理圖片')
  expect(wrapper.findAll('button').some(item => item.text() === '重新檢查')).toBe(true)
  wrapper.unmount()
})
