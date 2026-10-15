import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LandingPage from '@/pages/[locale]/index.vue'
import { getLandingCategories, getLandingFaq } from '@/features/landing/content'
import { getNtdDemo } from '@/features/landing/demos'
import { publishedTools, unpublishedToolSlugs } from '@/features/tools/catalog'
import { landingGlobals, setTestRoute } from './support/nuxt-stubs'

function mountLanding(locale: 'zh-tw' | 'en' = 'zh-tw') {
  setTestRoute({ path: `/${locale}/`, fullPath: `/${locale}/`, params: { locale } })
  return mount(LandingPage, { global: landingGlobals() })
}

describe('landing page', () => {
  it('lists every published tool exactly once in the category blocks', () => {
    const wrapper = mountLanding()
    const hrefs = wrapper.findAll('.nb-block .nb-tool').map(link => link.attributes('href'))

    expect(hrefs).toHaveLength(publishedTools.length)
    for (const tool of publishedTools) {
      expect(hrefs, `${tool.slug} 必須可從首頁分類進入`).toContain(`/zh-tw/tools/${tool.slug}/`)
    }
  })

  it('never links an unpublished tool', () => {
    const html = mountLanding().html()
    expect(unpublishedToolSlugs.length, '註冊表需要有未發布工具才能驗證邊界').toBeGreaterThan(0)
    for (const slug of unpublishedToolSlugs) {
      expect(html, `${slug} 尚未發布，不得產生入口`).not.toContain(slug)
    }
  })

  it('offers the local tool search in the hero', () => {
    const wrapper = mountLanding()

    expect(wrapper.get('.nb-hero .tool-search--large input').attributes('type')).toBe('search')
  })

  it('keeps one h1 and a continuous heading hierarchy', () => {
    const wrapper = mountLanding()

    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.findAll('main > section h2').length).toBeGreaterThanOrEqual(3)
    expect(wrapper.findAll('.nb-block h2'), '分類標題位於區段標題之下').toHaveLength(0)
    expect(wrapper.findAll('.nb-block h3')).toHaveLength(getLandingCategories('zh-tw').length)
  })

  it('shows what a tool produces with the tool’s own output', () => {
    const wrapper = mountLanding()
    const deck = wrapper.get('.nb-deck')

    expect(deck.text()).toContain(getNtdDemo().wording)
    expect(deck.findAll('a').map(link => link.attributes('href'))).toContain('/zh-tw/tools/ntd-uppercase/')
  })

  it('states the privacy boundary once, as a visible question, not as a section of its own', () => {
    const wrapper = mountLanding()
    const questions = wrapper.findAll('.landing-faq__question').map(question => question.text())

    expect(questions).toContain('檔案會被上傳到伺服器嗎？')
    expect(wrapper.findAll('main > section').map(section => section.attributes('aria-labelledby'))).not.toContain('privacy-title')
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
