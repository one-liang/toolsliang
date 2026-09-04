import { describe, expect, it } from 'vitest'
import {
  buildLandingStructuredData,
  getFeaturedTools,
  getLandingCopy,
  getLandingFaq,
  getLandingPrivacyPoints,
  landingCopyKeys,
  validateLandingContent,
} from '@/features/landing/content'
import { publishedTools, supportedLocales, unpublishedToolSlugs, type LocaleCode } from '@/features/tools/catalog'

function structuredNode(locale: LocaleCode, type: string) {
  const graph = buildLandingStructuredData(locale)['@graph'] as Array<Record<string, unknown>>
  return graph.find(node => node['@type'] === type)
}

describe('landing content registry', () => {
  it('passes its own validation', () => {
    expect(validateLandingContent()).toEqual([])
  })

  it('highlights published tools only, without duplicates', () => {
    const featured = getFeaturedTools()

    expect(featured.length).toBeGreaterThan(0)
    expect(new Set(featured.map(tool => tool.slug)).size).toBe(featured.length)
    for (const tool of featured) {
      expect(publishedTools).toContain(tool)
    }
  })

  it('ships every landing string in both locales', () => {
    for (const locale of supportedLocales) {
      const copy = getLandingCopy(locale)
      for (const key of landingCopyKeys) {
        expect(copy[key].trim(), `${locale} 缺少 ${key}`).not.toBe('')
      }
    }
  })

  it('keeps privacy commitments and FAQ aligned across locales', () => {
    const zhPoints = getLandingPrivacyPoints('zh-tw')
    const enPoints = getLandingPrivacyPoints('en')
    expect(zhPoints.length).toBeGreaterThanOrEqual(3)
    expect(enPoints).toHaveLength(zhPoints.length)

    const zhFaq = getLandingFaq('zh-tw')
    const enFaq = getLandingFaq('en')
    expect(zhFaq.length).toBeGreaterThanOrEqual(3)
    expect(enFaq).toHaveLength(zhFaq.length)
    for (const entry of [...zhFaq, ...enFaq, ...zhPoints, ...enPoints]) {
      expect(entry.heading.trim()).not.toBe('')
      expect(entry.body.trim()).not.toBe('')
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
