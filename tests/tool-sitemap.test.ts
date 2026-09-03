import { describe, expect, it } from 'vitest'
import { renderToolSitemap } from '@/features/tools/sitemap'

describe('tool sitemap', () => {
  it('contains both localized routes for published tools only', () => {
    const sitemap = renderToolSitemap('https://toolsliang.com')

    expect(sitemap).toContain('<loc>https://toolsliang.com/zh-tw/tools/ntd-uppercase/</loc>')
    expect(sitemap).toContain('<loc>https://toolsliang.com/en/tools/ntd-uppercase/</loc>')
    expect(sitemap).not.toContain('image-resizer')
    expect(sitemap).not.toContain('/tw/')
  })
})
