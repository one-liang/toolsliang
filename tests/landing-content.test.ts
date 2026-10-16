import { describe, expect, it } from 'vitest'
import {
  buildLandingStructuredData,
  getLandingCategories,
  getLandingCopy,
  getLandingFaq,
  landingCopyKeys,
  validateLandingContent,
} from '@/features/landing/content'
import { copy, getCategory, publishedTools, supportedLocales, unpublishedToolSlugs, type LocaleCode } from '@/features/tools/catalog'

function structuredNode(locale: LocaleCode, type: string) {
  const graph = buildLandingStructuredData(locale)['@graph'] as Array<Record<string, unknown>>
  return graph.find(node => node['@type'] === type)
}

describe('landing content registry', () => {
  it('passes its own validation', () => {
    expect(validateLandingContent()).toEqual([])
  })

  it('places every published tool in exactly one landing category', () => {
    for (const locale of supportedLocales) {
      const slugs = getLandingCategories(locale).flatMap(category => category.tools.map(tool => tool.slug))

      expect(slugs).toHaveLength(publishedTools.length)
      expect(new Set(slugs)).toEqual(new Set(publishedTools.map(tool => tool.slug)))
      for (const category of getLandingCategories(locale)) {
        expect(category.pitch.trim()).not.toBe('')
        for (const tool of category.tools) expect(tool.tagline.trim(), `${locale} ${tool.slug} 缺少一句話介紹`).not.toBe('')
      }
    }
  })

  it('names, files and badges each tool exactly as the tool directory does (#92)', () => {
    for (const locale of supportedLocales) {
      for (const category of getLandingCategories(locale)) {
        expect(category.name).toBe(copy(getCategory(category.id)!.name, locale))
        for (const entry of category.tools) {
          const tool = publishedTools.find(item => item.slug === entry.slug)!
          expect(entry.name, `${locale} ${entry.slug} 的名稱`).toBe(copy(tool.name, locale))
          expect(tool.category, `${entry.slug} 的分類`).toBe(category.id)
          expect(entry.status, `${entry.slug} 的狀態標籤`).toEqual(tool.status)
        }
      }
    }
  })

  it('counts the tools it advertises from the catalog', () => {
    expect(getLandingCopy('zh-tw').catalogTitle).toContain(String(publishedTools.length))
    expect(getLandingCopy('en').catalogTitle).toContain(String(publishedTools.length))
  })

  it('leaves the boundaries to the FAQ instead of repeating them above it', () => {
    const copy = getLandingCopy('zh-tw')
    for (const claim of ['不用註冊', '不上傳', '本機', '瀏覽器']) {
      expect(copy.heroIntro + copy.heroTitleLead + copy.heroTitleTail + copy.catalogTitle, `首頁上半部不得重複「${claim}」`).not.toContain(claim)
    }
    expect(getLandingFaq('zh-tw').map(entry => entry.heading)).toContain('檔案會被上傳到伺服器嗎？')
  })

  it('ships every landing string in both locales', () => {
    for (const locale of supportedLocales) {
      const copy = getLandingCopy(locale)
      for (const key of landingCopyKeys) {
        expect(copy[key].trim(), `${locale} 缺少 ${key}`).not.toBe('')
      }
    }
  })

  it('keeps the FAQ aligned across locales and lists the published tools', () => {
    const zhFaq = getLandingFaq('zh-tw')
    const enFaq = getLandingFaq('en')
    expect(zhFaq.length).toBeGreaterThanOrEqual(3)
    expect(enFaq).toHaveLength(zhFaq.length)
    for (const entry of [...zhFaq, ...enFaq]) {
      expect(entry.heading.trim()).not.toBe('')
      expect(entry.body.trim()).not.toBe('')
    }

    for (const locale of supportedLocales) {
      const toolList = getLandingFaq(locale).at(-1)!.body
      for (const category of getLandingCategories(locale)) {
        for (const tool of category.tools) expect(toolList).toContain(tool.name)
      }
    }
  })
})

describe('landing structured data', () => {
  it('describes the site and the organization per locale', () => {
    expect(structuredNode('zh-tw', 'WebSite')).toMatchObject({
      name: 'toolsliang',
      url: 'https://toolsliang.com/zh-tw/',
      inLanguage: 'zh-Hant-TW',
    })
    expect(structuredNode('en', 'WebSite')).toMatchObject({
      url: 'https://toolsliang.com/en/',
      inLanguage: 'en',
    })
    expect(structuredNode('en', 'Organization')).toMatchObject({
      name: 'toolsliang',
      url: 'https://toolsliang.com/',
    })
  })

  it('only publishes questions that are visible on the page', () => {
    for (const locale of supportedLocales) {
      const faq = getLandingFaq(locale)
      const mainEntity = structuredNode(locale, 'FAQPage')?.mainEntity as Array<Record<string, never>>

      expect(mainEntity).toHaveLength(faq.length)
      expect(mainEntity.map(entry => entry.name)).toEqual(faq.map(entry => entry.heading))
      expect(mainEntity.map(entry => (entry.acceptedAnswer as Record<string, string>).text))
        .toEqual(faq.map(entry => entry.body))
    }
  })

  it('never advertises a server-side search endpoint', () => {
    for (const locale of supportedLocales) {
      const serialized = JSON.stringify(buildLandingStructuredData(locale))
      expect(serialized, '本機搜尋不得宣告 SearchAction').not.toContain('SearchAction')
      expect(serialized).not.toContain('potentialAction')
      expect(serialized).not.toContain('search_term_string')
    }
  })

  it('never exposes an unpublished tool', () => {
    expect(unpublishedToolSlugs.length, '註冊表需要有未發布工具才能驗證邊界').toBeGreaterThan(0)

    for (const locale of supportedLocales) {
      const serialized = JSON.stringify(buildLandingStructuredData(locale))
      for (const slug of unpublishedToolSlugs) expect(serialized).not.toContain(slug)
    }
  })
})
