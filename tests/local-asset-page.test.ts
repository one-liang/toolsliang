import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AppSidebar from '@/components/AppSidebar.vue'
import LocalAssetManager from '@/components/LocalAssetManager.vue'
import LocalAssetRow from '@/components/LocalAssetRow.vue'
import StoragePage from '@/pages/[locale]/storage.vue'
import ToolCategoryDrawer from '@/components/ToolCategoryDrawer.vue'
import { buildShellPrecacheUrls, storageRoutes } from '@/features/pwa/cache-policy'
import { getPublicPageRoutes, supportedLocales } from '@/features/tools/catalog'
import { renderToolSitemap } from '@/features/tools/sitemap'
import { Button } from '@/components/ui/button'
import { setTestRoute, shellStubs } from './support/nuxt-stubs'

function mountPage(locale: 'zh-tw' | 'en' = 'zh-tw') {
  setTestRoute({ path: `/${locale}/storage/`, fullPath: `/${locale}/storage/`, params: { locale } })
  return mount(StoragePage, {
    global: {
      components: { Button, LocalAssetManager, LocalAssetRow },
      stubs: shellStubs,
    },
  })
}

describe('本機資產管理頁', () => {
  it('以工具外殼呈現標題、用途說明與資產管理介面', async () => {
    const page = mountPage()
    await flushPromises()

    expect(page.get('h1').text()).toBe('本機資產')
    expect(page.get('main').attributes('id')).toBe('main-content')
    expect(page.find('.local-assets').exists()).toBe(true)
    expect(page.text()).toContain('不會上傳')
  })

  it('在不支援本機資料庫的裝置上說明狀況並保留其他功能', async () => {
    const page = mountPage()
    await flushPromises()

    // happy-dom has no IndexedDB, which is exactly the unsupported device case.
    const alert = page.get('.local-assets__error')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('沒有可用的本機資料庫')
    expect(alert.text()).toContain('工具仍可正常使用')
  })

  it('提供英文版本', async () => {
    const page = mountPage('en')
    await flushPromises()

    expect(page.get('h1').text()).toBe('Local assets')
    expect(page.text()).toContain('never uploaded')
  })

  it('不被索引，因為內容完全取決於這台裝置', () => {
    const meta: Array<Record<string, unknown>> = []
    vi.stubGlobal('useSeoMeta', (options: Record<string, unknown>) => meta.push(options))

    mountPage()
    expect(meta.at(0)?.robots).toBe('noindex, follow')
    vi.stubGlobal('useSeoMeta', () => {})
  })
})

describe('本機資產頁的路由邊界', () => {
  it('兩種語言都有可直接開啟的頁面', () => {
    expect(storageRoutes()).toEqual(supportedLocales.map(locale => `/${locale}/storage/`))
  })

  it('離線也能檢視與清除已保存的資產', () => {
    for (const route of storageRoutes()) {
      expect(buildShellPrecacheUrls(), `${route} 需在 App Shell 預先快取`).toContain(route)
    }
  })

  it('不進入 sitemap 與可索引頁面清單', () => {
    const sitemap = renderToolSitemap('https://toolsliang.com')

    for (const route of storageRoutes()) {
      expect(sitemap).not.toContain(route)
      expect(getPublicPageRoutes()).not.toContain(route)
    }
  })
})

describe('本機資產的導覽入口', () => {
  it('側邊欄提供入口，收合時保留可存取名稱', () => {
    setTestRoute({ path: '/zh-tw/tools/', params: { locale: 'zh-tw' } })
    const sidebar = mount(AppSidebar, { props: { collapsed: false }, global: { components: { Button }, stubs: shellStubs } })
    const link = sidebar.get('.sidebar-primary-link--storage')

    expect(link.attributes('href')).toBe('/zh-tw/storage/')
    expect(link.text()).toBe('本機資產')

    const collapsed = mount(AppSidebar, { props: { collapsed: true }, global: { components: { Button }, stubs: shellStubs } })
    const collapsedLink = collapsed.get('.sidebar-primary-link--storage')
    expect(collapsedLink.get('span').classes()).toContain('sr-only')
    expect(collapsedLink.attributes('title')).toBe('本機資產')
  })

  it('手機分類抽屜也能開啟本機資產', async () => {
    const drawer = mount(ToolCategoryDrawer, { attachTo: document.body, global: { stubs: shellStubs } })
    await drawer.get('button').trigger('click')
    await nextTick()

    const link = document.body.querySelector('.drawer-storage-link')!
    expect(link.getAttribute('href')).toBe('/zh-tw/storage/')
    expect(link.textContent).toContain('本機資產')
    drawer.unmount()
  })

  it('目前位於本機資產頁時標示為使用中', () => {
    setTestRoute({ path: '/zh-tw/storage/', fullPath: '/zh-tw/storage/', params: { locale: 'zh-tw' } })
    const sidebar = mount(AppSidebar, { props: { collapsed: false }, global: { components: { Button }, stubs: shellStubs } })

    expect(sidebar.get('.sidebar-primary-link--storage').classes()).toContain('sidebar-primary-link--active')
    expect(sidebar.findAll('.sidebar-primary-link--active')).toHaveLength(1)
  })
})
