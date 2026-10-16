import { describe, expect, it } from 'vitest'
import { getPublicPageRoutes, getPublicToolRoutes, getWithdrawnToolRedirects, supportedLocales } from '@/features/tools/catalog'
import { renderToolSitemap } from '@/features/tools/sitemap'

describe('tool sitemap', () => {
  it('contains both localized routes for published tools only', () => {
    const sitemap = renderToolSitemap('https://toolsliang.com')

    expect(sitemap).toContain('<loc>https://toolsliang.com/zh-tw/tools/ntd-uppercase/</loc>')
    expect(sitemap).toContain('<loc>https://toolsliang.com/en/tools/ntd-uppercase/</loc>')
    expect(sitemap).not.toContain('image-resizer')
    expect(sitemap).not.toContain('/tw/')
  })

  it('drops a withdrawn tool, whose old address is now only a redirect (ADR-0021)', () => {
    const sitemap = renderToolSitemap('https://toolsliang.com')

    expect(sitemap).not.toContain('custom-calendar')
    for (const { from } of getWithdrawnToolRedirects()) expect(sitemap).not.toContain(from)
  })

  it('lists the landing page for every supported locale', () => {
    const sitemap = renderToolSitemap('https://toolsliang.com')

    for (const locale of supportedLocales) {
      expect(getPublicPageRoutes()).toContain(`/${locale}/`)
      expect(sitemap).toContain(`<loc>https://toolsliang.com/${locale}/</loc>`)
    }
  })

  it('keeps every indexable route inside the prerendered route list', () => {
    const prerendered = new Set([...getPublicPageRoutes(), ...getPublicToolRoutes()])
    const sitemapRoutes = [...renderToolSitemap('https://toolsliang.com').matchAll(/<loc>https:\/\/toolsliang\.com([^<]*)<\/loc>/g)]
      .map(match => match[1]!)

    expect(sitemapRoutes.length).toBeGreaterThan(0)
    for (const route of sitemapRoutes) {
      expect(prerendered, `${route} 必須事先產生 server-rendered metadata`).toContain(route)
    }
  })
})
