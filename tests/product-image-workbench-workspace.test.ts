import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import Workspace from '@/components/ProductImageWorkbenchWorkspace.vue'
import { shellStubs } from './support/nuxt-stubs'

/** No worker script can be fetched here, so every engine reports itself unsupported. */
async function mountWorkspace() {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const wrapper = mount(Workspace, { global: { stubs: shellStubs }, attachTo: document.body })
  for (let round = 0; round < 4; round += 1) await flushPromises()
  return wrapper
}

const png = (name: string, bytes = 1024) => new File(
  [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...new Uint8Array(Math.max(0, bytes - 8))])],
  name,
  { type: 'image/png' },
)

async function selectFiles(wrapper: Awaited<ReturnType<typeof mountWorkspace>>, files: File[]) {
  const input = wrapper.find('[data-batch-input]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  for (let round = 0; round < 6; round += 1) await flushPromises()
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('選圖前只有選圖區，批次上限寫在畫面上，沒有步驟導覽列', async () => {
  const wrapper = await mountWorkspace()

  expect(wrapper.find('[data-batch-input]').exists()).toBe(true)
  expect(wrapper.text()).toContain('20 張')
  expect(wrapper.find('[data-workbench-step]').exists()).toBe(false)
  expect(wrapper.find('.workbench__layout').exists()).toBe(false)
  wrapper.unmount()
})

it('瀏覽器做不到的那一件只停用自己並說明，不會留著勾選', async () => {
  const wrapper = await mountWorkspace()
  await selectFiles(wrapper, [png('private-workbench-canary.png')])

  for (const job of ['cutout', 'compose', 'compress']) {
    const box = wrapper.find(`[data-workbench-job="${job}"] input[type=checkbox]`)
    expect(box.attributes('disabled')).toBeDefined()
    expect((box.element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.find(`#workbench-${job}-hint`).text()).toContain('這個瀏覽器無法在本機完成這一步')
  }
  // With nothing it can do, there is nothing to start.
  expect(wrapper.find('[data-workbench-run]').attributes('disabled')).toBeDefined()
  wrapper.unmount()
})

it('多張時出現縮圖列，可以切換與移除；清除全部後回到選圖區', async () => {
  const wrapper = await mountWorkspace()
  await selectFiles(wrapper, [png('a.png'), png('b.png'), png('c.png')])

  const options = wrapper.findAll('[role=option]')
  expect(options).toHaveLength(3)
  await options[1]!.trigger('click')
  expect(wrapper.find('[data-batch-current]').text()).toContain('第 2／3 張')

  await wrapper.find('[data-batch-remove]').trigger('click')
  await flushPromises()
  expect(wrapper.findAll('[role=option]')).toHaveLength(2)

  const button = (label: string) => wrapper.findAll('button').find(candidate => candidate.text().includes(label))!
  await button('全部清除').trigger('click')
  await button('確定清除').trigger('click')
  await flushPromises()
  expect(wrapper.find('.workbench__layout').exists()).toBe(false)
  wrapper.unmount()
})
