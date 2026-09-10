import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import Workspace from '@/components/ProductImageWorkbenchWorkspace.vue'
import { shellStubs } from './support/nuxt-stubs'
import { workbenchQueueLimits } from '@/features/tools/product-image-workbench/queue'

/** No worker script can be fetched here, so every engine reports itself unsupported. */
function mountWorkspace() {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return mount(Workspace, { global: { stubs: shellStubs }, attachTo: document.body })
}

function steps(wrapper: ReturnType<typeof mountWorkspace>) {
  return Object.fromEntries(wrapper.findAll('[data-workbench-step]')
    .map(item => [item.attributes('data-workbench-step'), item.attributes('data-workbench-state')]))
}

const png = (name: string, bytes = 1024) => new File(
  [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...new Uint8Array(Math.max(0, bytes - 8))])],
  name,
  { type: 'image/png' },
)

async function selectFiles(wrapper: ReturnType<typeof mountWorkspace>, files: File[]) {
  const input = wrapper.find('#workbench-file')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  await flushPromises()
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('以有名稱的步驟列開場，合規主圖分支不提供品牌素材與壓縮步驟', async () => {
  const wrapper = mountWorkspace()
  await flushPromises()

  expect(wrapper.findAll('[data-workbench-step] button > span:first-of-type').map(item => item.text())).toEqual([
    '1. 匯入商品圖',
    '去背（選用）',
    '版型與尺寸',
    '品牌素材（選用）',
    '壓縮容量（選用）',
    '2. 輸出與下載',
  ])
  expect(wrapper.findAll('.workbench__state').map(item => item.text()))
    .toEqual(['可以開始', '不適用', '不適用', '不適用', '不適用', '尚未開放'])
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

it('批次上限在選檔前就寫在畫面上', async () => {
  const wrapper = mountWorkspace()
  await flushPromises()

  const help = wrapper.get('#workbench-import-help').text()
  expect(help).toContain(`最多 ${workbenchQueueLimits.maxItems} 張`)
  expect(help).toContain('單張最多 25 MiB')
  expect(wrapper.get('#workbench-file').attributes('multiple')).toBeDefined()
  wrapper.unmount()
})

it('匯入的每張圖片各自成為一列，標籤只有序號，不顯示來源檔名', async () => {
  const wrapper = mountWorkspace()
  await flushPromises()
  await selectFiles(wrapper, [png('secret-supplier-a.png'), png('secret-supplier-b.png')])

  const rows = wrapper.findAll('[data-queue-item]')
  expect(rows).toHaveLength(2)
  expect(rows.map(row => row.get('[data-queue-status]').element.previousElementSibling?.textContent))
    .toEqual(['第 1 項', '第 2 項'])
  expect(wrapper.get('.workbench__queue').text()).not.toContain('secret-supplier')
  wrapper.unmount()
})

it('超過張數上限的圖片在開始前就被退回並說明，已收下的不受影響', async () => {
  const wrapper = mountWorkspace()
  await flushPromises()
  await selectFiles(wrapper, Array.from({ length: workbenchQueueLimits.maxItems + 2 }, (_, index) => png(`item-${index}.png`)))

  expect(wrapper.findAll('[data-queue-item]')).toHaveLength(workbenchQueueLimits.maxItems)
  expect(wrapper.get('#workbench-import-issues').text()).toContain('超過張數上限')
  expect(wrapper.get('#workbench-import-issues').attributes('role')).toBe('alert')
  wrapper.unmount()
})

it('每一列的動作都是有名稱的按鈕，移除後焦點落在接手的那一列', async () => {
  const wrapper = mountWorkspace()
  await flushPromises()
  await selectFiles(wrapper, [png('a.png'), png('b.png')])

  const remove = wrapper.get('[data-queue-item="item-1"] [data-queue-remove]')
  expect(remove.text()).toBe('移除第 1 項')
  await remove.trigger('click')
  await flushPromises()

  expect(wrapper.findAll('[data-queue-item]').map(row => row.attributes('data-queue-item'))).toEqual(['item-2'])
  expect(document.activeElement).toBe(wrapper.get('[data-queue-item="item-2"] [data-queue-remove]').element)
  wrapper.unmount()
})

it('彙總摘要以 live region 宣告，且把每一張都算進去', async () => {
  const wrapper = mountWorkspace()
  await flushPromises()
  await selectFiles(wrapper, [png('a.png'), png('b.png'), png('c.png')])

  const summary = wrapper.get('.workbench__steps p[role="status"]')
  expect(summary.text()).toContain('共 3 張')
  expect(summary.text()).toContain('3 張等待處理')
  wrapper.unmount()
})
