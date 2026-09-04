import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import AppSidebar from '@/components/AppSidebar.vue'
import MobileBottomNav from '@/components/MobileBottomNav.vue'
import SavedToolList from '@/components/SavedToolList.vue'
import { useSavedTools } from '@/composables/useSavedTools'
import { LEGACY_SAVED_TOOLS_STORAGE_KEY, SAVED_TOOLS_STORAGE_KEY } from '@/features/shell/saved-tools'
import { getTool, type LocaleCode, type PublishedToolDefinition } from '@/features/tools/catalog'
import DirectoryPage from '@/pages/[locale]/tools/index.vue'
import ToolPage from '@/pages/[locale]/tools/[slug].vue'
import { savedToolsGlobals, setTestRoute, shellStubs } from './support/nuxt-stubs'

const firstTool = getTool('ntd-uppercase')!
/** The catalog publishes one tool today; ordering needs a second registration to observe. */
const secondTool: PublishedToolDefinition = {
  ...firstTool,
  slug: 'second-tool',
  name: { 'zh-tw': '第二個工具', en: 'Second tool' },
}
const thirdTool: PublishedToolDefinition = {
  ...firstTool,
  slug: 'third-tool',
  name: { 'zh-tw': '第三個工具', en: 'Third tool' },
}

function mountSavedList(tools: PublishedToolDefinition[], locale: LocaleCode = 'zh-tw') {
  return mount(SavedToolList, { props: { tools, locale }, global: { stubs: shellStubs } })
}

function mountDirectory(locale: LocaleCode = 'zh-tw', query: Record<string, string> = { saved: 'true' }) {
  setTestRoute({ path: `/${locale}/tools/`, fullPath: `/${locale}/tools/`, params: { locale }, query })
  return mount(DirectoryPage, { global: savedToolsGlobals() })
}

const SavedToolsHost = defineComponent({
  setup: () => useSavedTools(),
  template: '<div />',
})

describe('SavedToolList', () => {
  it('lists saved tools in their saved order with a link to each tool', () => {
    const wrapper = mountSavedList([secondTool, firstTool])
    const items = wrapper.findAll('.saved-tool')

    expect(items).toHaveLength(2)
    expect(items[0]!.get('.saved-tool__link').attributes('href')).toBe('/zh-tw/tools/second-tool/')
    expect(items[1]!.get('.saved-tool__link').attributes('href')).toBe('/zh-tw/tools/ntd-uppercase/')
  })

  it('explains the empty state instead of showing an empty list', () => {
    const wrapper = mountSavedList([])

    expect(wrapper.findAll('.saved-tool')).toHaveLength(0)
    expect(wrapper.get('.saved-tools__empty').text()).toContain('常用工具')
  })

  it('offers keyboard and touch operable move and remove controls with an accessible name', () => {
    const wrapper = mountSavedList([firstTool, secondTool])
    const controls = wrapper.findAll('.saved-tool__actions button')

    expect(controls.length).toBe(6)
    for (const control of controls) {
      expect(control.element.tagName, '排序與移除必須是原生按鈕，鍵盤與觸控都能操作').toBe('BUTTON')
      expect(control.attributes('aria-label')?.length).toBeGreaterThan(0)
    }
    expect(wrapper.get('[data-saved-action="remove"]').attributes('aria-label')).toContain('新臺幣國字大寫')
  })

  it('disables moving past the ends of the list', () => {
    const wrapper = mountSavedList([firstTool, secondTool, thirdTool])
    const items = wrapper.findAll('.saved-tool')

    expect(items[0]!.get('[data-saved-action="move-up"]').attributes('disabled')).toBeDefined()
    expect(items[0]!.get('[data-saved-action="move-down"]').attributes('disabled')).toBeUndefined()
    expect(items[2]!.get('[data-saved-action="move-down"]').attributes('disabled')).toBeDefined()
  })

  it('asks its host to move or remove the tool a control belongs to', async () => {
    const wrapper = mountSavedList([firstTool, secondTool])

    await wrapper.findAll('.saved-tool')[1]!.get('[data-saved-action="move-up"]').trigger('click')
    await wrapper.findAll('.saved-tool')[0]!.get('[data-saved-action="remove"]').trigger('click')

    expect(wrapper.emitted('move')).toEqual([['second-tool', -1]])
    expect(wrapper.emitted('remove')).toEqual([['ntd-uppercase']])
  })

  it('announces the new position politely after a move', async () => {
    const wrapper = mountSavedList([firstTool, secondTool])
    const status = wrapper.get('.saved-tools__status')

    expect(status.attributes('aria-live')).toBe('polite')

    await wrapper.findAll('.saved-tool')[1]!.get('[data-saved-action="move-up"]').trigger('click')
    await wrapper.setProps({ tools: [secondTool, firstTool] })

    expect(status.text()).toContain('第二個工具')
    expect(status.text()).toContain('1')
  })

  it('localizes controls and announcements', () => {
    const wrapper = mountSavedList([firstTool, secondTool], 'en')

    expect(wrapper.get('[data-saved-action="remove"]').attributes('aria-label')).toContain('Remove')
    expect(wrapper.get('.saved-tool__link').attributes('href')).toBe('/en/tools/ntd-uppercase/')
  })
})

describe('anonymous saved tools state', () => {
  it('writes nothing to the device before the visitor saves a tool', async () => {
    mount(SavedToolsHost)
    await nextTick()

    expect(localStorage.length, '未主動收藏前不得寫入本機儲存').toBe(0)
  })

  it('keeps a saved tool on the device across a reload', async () => {
    const first = mount(SavedToolsHost)
    await nextTick()

    first.vm.toggleSaved('ntd-uppercase')
    await nextTick()
    expect(first.vm.savedTools.map(tool => tool.slug)).toEqual(['ntd-uppercase'])
    expect(localStorage.getItem(SAVED_TOOLS_STORAGE_KEY)).toContain('ntd-uppercase')

    first.unmount()
    const reloaded = mount(SavedToolsHost)
    await nextTick()

    expect(reloaded.vm.savedTools.map(tool => tool.slug)).toEqual(['ntd-uppercase'])
  })

  it('drops a withdrawn or unknown tool from what it restores', async () => {
    localStorage.setItem(SAVED_TOOLS_STORAGE_KEY, JSON.stringify({ version: 1, slugs: ['image-resizer', 'ntd-uppercase'] }))

    const wrapper = mount(SavedToolsHost)
    await nextTick()

    expect(wrapper.vm.savedSlugs, '未上線工具不得留在常用清單').toEqual(['ntd-uppercase'])
  })

  it('restores the list an earlier release saved under its own key', async () => {
    localStorage.setItem(LEGACY_SAVED_TOOLS_STORAGE_KEY, JSON.stringify(['ntd-uppercase']))

    const wrapper = mount(SavedToolsHost)
    await nextTick()

    expect(wrapper.vm.savedTools.map(tool => tool.slug)).toEqual(['ntd-uppercase'])
  })

  it('never records anything but tool identity and order', async () => {
    const wrapper = mount(SavedToolsHost)
    await nextTick()

    wrapper.vm.toggleSaved('ntd-uppercase')
    await nextTick()

    expect(localStorage.length, '常用工具只使用一個本機鍵').toBe(1)
    expect(localStorage.key(0)).toBe(SAVED_TOOLS_STORAGE_KEY)
    expect(JSON.parse(localStorage.getItem(SAVED_TOOLS_STORAGE_KEY)!)).toEqual({ version: 1, slugs: ['ntd-uppercase'] })
  })
})

describe('saved tools navigation entries', () => {
  it('opens the saved view from the desktop sidebar and lists what is saved there', async () => {
    const host = mount(SavedToolsHost)
    await nextTick()
    host.vm.toggleSaved('ntd-uppercase')

    const wrapper = mount(AppSidebar, { props: { collapsed: false }, global: { stubs: shellStubs } })
    await nextTick()

    const savedEntry = wrapper.get('.sidebar-primary-link--saved')
    expect(savedEntry.attributes('href')).toBe('/zh-tw/tools/?saved=true')
    expect(wrapper.findAll('.sidebar-saved__link').map(link => link.attributes('href')))
      .toEqual(['/zh-tw/tools/ntd-uppercase/'])
  })

  /**
   * The directory is prerendered without the filter, so the saved view can only
   * be recognised on the client. Both navigations decide it the same way.
   */
  it('marks the saved entry active in both navigations while the saved view is open', async () => {
    setTestRoute({
      path: '/zh-tw/tools/',
      fullPath: '/zh-tw/tools/?saved=true',
      params: { locale: 'zh-tw' },
      query: { saved: 'true' },
    })

    const sidebar = mount(AppSidebar, { props: { collapsed: false }, global: { stubs: shellStubs } })
    const nav = mount(MobileBottomNav, { global: { stubs: shellStubs } })
    await nextTick()

    expect(sidebar.get('.sidebar-primary-link--saved').classes()).toContain('sidebar-primary-link--active')
    expect(sidebar.findAll('.sidebar-primary-link--active')).toHaveLength(1)
    expect(nav.get('.mobile-nav__item--saved').classes()).toContain('mobile-nav--active')
    expect(nav.findAll('.mobile-nav--active'), '手機導覽同時只標示一個位置').toHaveLength(1)
  })

  it('offers the same saved view path on desktop and mobile', () => {
    const sidebar = mount(AppSidebar, { props: { collapsed: false }, global: { stubs: shellStubs } })
    const nav = mount(MobileBottomNav, { global: { stubs: shellStubs } })

    expect(nav.get('.mobile-nav__item--saved').attributes('href'))
      .toBe(sidebar.get('.sidebar-primary-link--saved').attributes('href'))
  })

  it('tells the visitor how the sidebar list fills up while it is empty', () => {
    const wrapper = mount(AppSidebar, { props: { collapsed: false }, global: { stubs: shellStubs } })

    expect(wrapper.findAll('.sidebar-saved__link')).toHaveLength(0)
    expect(wrapper.get('.sidebar-saved__empty').text().length).toBeGreaterThan(0)
  })

  it('keeps the saved section out of sight but reachable while the sidebar is collapsed', async () => {
    const host = mount(SavedToolsHost)
    await nextTick()
    host.vm.toggleSaved('ntd-uppercase')

    const wrapper = mount(AppSidebar, { props: { collapsed: true }, global: { stubs: shellStubs } })
    await nextTick()

    expect(wrapper.get('.sidebar-saved__title').classes()).toContain('sr-only')
    for (const link of wrapper.findAll('.sidebar-saved__link')) {
      expect(link.text().trim().length, '收合時常用工具仍需有可讀名稱').toBeGreaterThan(0)
    }
  })
})

describe('saved tools directory view', () => {
  it('manages saved tools from the saved view and keeps it out of the index', async () => {
    const host = mount(SavedToolsHost)
    await nextTick()
    host.vm.toggleSaved('ntd-uppercase')

    const wrapper = mountDirectory()
    await nextTick()

    expect(wrapper.findAll('.saved-tool')).toHaveLength(1)
    expect(wrapper.findAll('.tool-search'), '常用工具檢視聚焦在管理，不重複搜尋').toHaveLength(0)

    await wrapper.get('[data-saved-action="remove"]').trigger('click')

    expect(host.vm.savedSlugs).toEqual([])
    expect(wrapper.findAll('.saved-tool')).toHaveLength(0)
    expect(wrapper.get('.saved-tools__empty').exists()).toBe(true)
  })

  /**
   * The catalog publishes one tool today, so a browser can only ever hold one
   * saved tool. Multi-tool ordering is covered where it can be observed: the
   * pure list operations and the presentational list component.
   */
  it('hands reordering from the saved view to the saved-tool state', async () => {
    const host = mount(SavedToolsHost)
    await nextTick()
    host.vm.toggleSaved('ntd-uppercase')

    const wrapper = mountDirectory()
    await nextTick()

    wrapper.findComponent(SavedToolList).vm.$emit('move', 'ntd-uppercase', 1)
    await nextTick()

    expect(host.vm.savedSlugs, '單一常用工具移動後順序不變').toEqual(['ntd-uppercase'])
    expect(wrapper.get('[data-saved-action="move-down"]').attributes('disabled'), '清單只有一項時無法再往下移').toBeDefined()
  })

  it('browses the full catalog when the saved filter is off', async () => {
    const wrapper = mountDirectory('zh-tw', {})
    await nextTick()

    expect(wrapper.findAll('.saved-tool')).toHaveLength(0)
    expect(wrapper.findAll('.tool-search')).toHaveLength(1)
    expect(wrapper.findAll('.category-panel').length).toBeGreaterThan(0)
  })

  it('points both locales at the same saved tool', async () => {
    const host = mount(SavedToolsHost)
    await nextTick()
    host.vm.toggleSaved('ntd-uppercase')

    const chinese = mountDirectory('zh-tw')
    await nextTick()
    expect(chinese.get('.saved-tool__link').attributes('href')).toBe('/zh-tw/tools/ntd-uppercase/')

    const english = mountDirectory('en')
    await nextTick()
    expect(english.get('.saved-tool__link').attributes('href')).toBe('/en/tools/ntd-uppercase/')
    expect(host.vm.savedSlugs, '切換語言不影響保存的工具識別碼').toEqual(['ntd-uppercase'])
  })
})

describe('saved tools tool page control', () => {
  it('saves and unsaves the open tool with a pressed state', async () => {
    setTestRoute({
      path: '/zh-tw/tools/ntd-uppercase/',
      fullPath: '/zh-tw/tools/ntd-uppercase/',
      params: { locale: 'zh-tw', slug: 'ntd-uppercase' },
    })
    const wrapper = mount(ToolPage, { global: savedToolsGlobals() })
    await nextTick()

    const toggle = wrapper.get('.tool-heading__save')
    expect(toggle.attributes('aria-pressed')).toBe('false')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(JSON.parse(localStorage.getItem(SAVED_TOOLS_STORAGE_KEY)!).slugs).toEqual(['ntd-uppercase'])

    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(JSON.parse(localStorage.getItem(SAVED_TOOLS_STORAGE_KEY)!).slugs).toEqual([])
  })
})
