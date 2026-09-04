import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import AppSidebar from '@/components/AppSidebar.vue'
import MobileBottomNav from '@/components/MobileBottomNav.vue'
import ToolCategoryDrawer from '@/components/ToolCategoryDrawer.vue'
import ToolCategoryGrid from '@/components/ToolCategoryGrid.vue'
import { publishedToolCategories, publishedTools } from '@/features/tools/catalog'
import { shellStubs } from './support/nuxt-stubs'

describe('MobileBottomNav', () => {
  it('offers home, tools, saved and a category drawer entry', () => {
    const wrapper = mount(MobileBottomNav, { global: { stubs: shellStubs } })

    expect(wrapper.findAll('.mobile-nav__item')).toHaveLength(4)
    expect(wrapper.get('.mobile-nav__item--categories').text()).toContain('分類')
  })
})

describe('ToolCategoryDrawer', () => {
  it('browses every published category and tool once opened', async () => {
    const wrapper = mount(ToolCategoryDrawer, { attachTo: document.body, global: { stubs: shellStubs } })

    const trigger = wrapper.get('button')
    expect(trigger.attributes('aria-haspopup')).toBe('dialog')

    await trigger.trigger('click')
    await nextTick()

    const dialog = document.body.querySelector('[role="dialog"]')!
    expect(dialog).toBeTruthy()
    expect(dialog.querySelectorAll('.drawer-category__title')).toHaveLength(publishedToolCategories.length)
    expect(dialog.querySelectorAll('.drawer-tool-link')).toHaveLength(publishedTools.length)

    for (const heading of dialog.querySelectorAll('.drawer-category__title')) {
      expect(heading.querySelector('svg'), '分類大標題不使用圖示').toBeNull()
    }

    wrapper.unmount()
  })
})

describe('AppSidebar', () => {
  it('keeps every tool reachable with an accessible name while collapsed', () => {
    const wrapper = mount(AppSidebar, {
      props: { collapsed: true },
      global: { stubs: shellStubs },
    })

    const toolLinks = wrapper.findAll('.sidebar-tool-link')
    expect(toolLinks).toHaveLength(publishedTools.length)
    for (const link of toolLinks) {
      expect(link.text().trim().length, '收合時工具連結仍需有可讀名稱').toBeGreaterThan(0)
    }
  })

  it('hides category titles from sight but keeps them for assistive technology when collapsed', () => {
    const wrapper = mount(AppSidebar, {
      props: { collapsed: true },
      global: { stubs: shellStubs },
    })

    const titles = wrapper.findAll('.sidebar-group__title')
    expect(titles).toHaveLength(publishedToolCategories.length)
    for (const title of titles) expect(title.classes()).toContain('sr-only')
  })

  it('shows category titles when expanded', () => {
    const wrapper = mount(AppSidebar, {
      props: { collapsed: false },
      global: { stubs: shellStubs },
    })

    for (const title of wrapper.findAll('.sidebar-group__title')) {
      expect(title.classes()).not.toContain('sr-only')
    }
  })
})

describe('ToolCategoryGrid', () => {
  it('builds category hierarchy without a heading icon', () => {
    const wrapper = mount(ToolCategoryGrid, {
      props: { locale: 'zh-tw' },
      global: { stubs: { ...shellStubs, ToolCard: true } },
    })

    expect(wrapper.findAll('.category-panel__icon')).toHaveLength(0)
    for (const header of wrapper.findAll('.category-panel__header')) {
      expect(header.find('svg').exists(), '分類大標題不使用圖示').toBe(false)
    }
    expect(wrapper.findAll('.category-panel h2')).toHaveLength(publishedToolCategories.length)
  })
})
