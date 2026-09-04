import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LandingPage from '@/pages/[locale]/index.vue'
import { getFeaturedTools, getLandingFaq } from '@/features/landing/content'
import { publishedTools, unpublishedToolSlugs } from '@/features/tools/catalog'
import { landingGlobals, setTestRoute } from './support/nuxt-stubs'

function mountLanding(locale: 'zh-tw' | 'en' = 'zh-tw') {
  setTestRoute({ path: `/${locale}/`, fullPath: `/${locale}/`, params: { locale } })
  return mount(LandingPage, { global: landingGlobals() })
}

describe('landing page', () => {
  it('opens every published tool from the category grid', () => {
    const wrapper = mountLanding()
    const hrefs = wrapper.findAll('a').map(link => link.attributes('href'))

    for (const tool of publishedTools) {
      expect(hrefs, `${tool.slug} 必須可從首頁進入`).toContain(`/zh-tw/tools/${tool.slug}/`)
    }
  })

  it('never links an unpublished tool', () => {
    const html = mountLanding().html()
    expect(unpublishedToolSlugs.length, '註冊表需要有未發布工具才能驗證邊界').toBeGreaterThan(0)
    for (const slug of unpublishedToolSlugs) {
      expect(html, `${slug} 尚未發布，不得產生入口`).not.toContain(slug)
    }
  })

  it('offers local search with a visible on-device notice', () => {
    const wrapper = mountLanding()

    expect(wrapper.get('.tool-search--large input').attributes('type')).toBe('search')
    expect(wrapper.get('.landing-search-note').text()).toContain('瀏覽器')
  })

  it('keeps one h1 and a continuous heading hierarchy', () => {
    const wrapper = mountLanding()

    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.findAll('.landing-section > .section-heading h2').length).toBeGreaterThanOrEqual(3)
    expect(wrapper.findAll('.category-panel h2'), '首頁分類標題位於區段標題之下').toHaveLength(0)
    expect(wrapper.findAll('.category-panel h3').length).toBeGreaterThan(0)
  })

  it('highlights the editorial tool selection', () => {
    const wrapper = mountLanding()
    const featured = wrapper.get('.landing-featured')

    expect(featured.findAll('.tool-card')).toHaveLength(getFeaturedTools().length)
  })

  it('answers the visible questions in both locales', () => {
    for (const locale of ['zh-tw', 'en'] as const) {
      const wrapper = mountLanding(locale)
      const faq = getLandingFaq(locale)

      expect(wrapper.findAll('.landing-faq__question')).toHaveLength(faq.length)
      expect(wrapper.get('.landing-faq__question').text()).toBe(faq[0]!.heading)
      expect(wrapper.get('.landing-faq__answer').text()).toBe(faq[0]!.body)
    }
  })

  it('does not render App Shell navigation', () => {
    const html = mountLanding().html()

    expect(html).not.toContain('app-sidebar')
    expect(html).not.toContain('mobile-nav')
  })
})
