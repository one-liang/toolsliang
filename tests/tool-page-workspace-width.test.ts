import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ToolCapabilityGate from '@/components/ToolCapabilityGate.vue'
import ToolPage from '@/pages/[locale]/tools/[slug].vue'
import { savedToolsGlobals, setTestRoute } from './support/nuxt-stubs'

// A tool opens the wide workspace from its own definition. The page has to honour
// that for whichever tool asks, so the test opens it for one here.
const wideTools = vi.hoisted(() => new Set<string>())

vi.mock('@/features/tools/catalog', async (importOriginal) => {
  const catalog = await importOriginal<typeof import('@/features/tools/catalog')>()
  return {
    ...catalog,
    getTool(slug: string) {
      const tool = catalog.getTool(slug)
      if (!tool || !wideTools.has(slug)) return tool
      return { ...tool, pagePresentation: { ...tool.pagePresentation, workspace: 'wide' as const } }
    },
  }
})

// The layout is the page's, not the tool's: any workspace stands in for the real one.
vi.mock('@/features/tools/workspace-resolver', async () => {
  const { defineComponent, h } = await import('vue')
  const StandInWorkspace = defineComponent({ render: () => h('section', { 'data-stand-in-workspace': '' }) })
  return { resolveToolWorkspace: () => StandInWorkspace, getToolWorkspaceAssets: () => [] }
})

let page: VueWrapper

afterEach(() => {
  page?.unmount()
  wideTools.clear()
})

async function openTool(slug: string) {
  setTestRoute({ path: `/zh-tw/tools/${slug}/`, params: { locale: 'zh-tw', slug } })
  const globals = savedToolsGlobals()
  page = mount(ToolPage, {
    global: {
      ...globals,
      components: { ...globals.components, ToolCapabilityGate },
      stubs: { ...globals.stubs, ToolCapabilityGate: false },
    },
  })
  await flushPromises()
  return page.get('main')
}

describe('工具頁工作區寬度', () => {
  it('沒有開啟寬版的工具，頁面 class 與原本相同', async () => {
    const main = await openTool('ntd-uppercase')

    expect(main.classes()).toEqual(['workspace-page', 'tool-page'])
    expect(main.get('[data-capability-gate]').classes()).toEqual(['tool-page__workspace'])
  })

  it('開啟寬版時整頁一起放寬，標題、工作區與說明都是頁面的直接子元素（#124）', async () => {
    wideTools.add('ntd-uppercase')
    const main = await openTool('ntd-uppercase')
    const workspace = main.get('.tool-page__workspace')

    expect(main.classes()).toEqual(['workspace-page', 'tool-page', 'tool-page--wide'])
    expect(workspace.element.parentElement, '工作區必須是頁面的直接子元素，寬版樣式才只套在它身上').toBe(main.element)
    expect(workspace.attributes('data-capability-gate')).toBeDefined()
    expect(workspace.find('[data-stand-in-workspace]').exists(), '工具的工作區畫在放寬的區塊裡').toBe(true)
    for (const reading of ['.breadcrumbs', '.tool-heading', '.tool-contract']) {
      expect(main.get(reading).element.parentElement, `${reading} 是頁面的直接子元素`).toBe(main.element)
      expect(workspace.find(reading).exists(), `${reading} 不在放寬的工作區內`).toBe(false)
    }
  })
})
