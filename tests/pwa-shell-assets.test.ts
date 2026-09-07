import { describe, expect, it } from 'vitest'
import { extractShellAssets, extractShellFonts } from '@/features/pwa/shell-assets'

describe('shell asset extraction', () => {
  const html = [
    '<link rel="modulepreload" as="script" crossorigin href="/_nuxt/entry.Bx1.js">',
    '<link rel="stylesheet" href="/_nuxt/entry.Cd2.css">',
    '<script type="module" src="/_nuxt/tools.slug.Ee3.js"></script>',
    '<link rel="canonical" href="https://toolsliang.com/zh-tw/tools/">',
    '<img src="/icons/icon-192.png">',
  ].join('\n')

  it('collects the build-hashed assets a precached page needs in order to hydrate', () => {
    expect(extractShellAssets(html)).toEqual([
      '/_nuxt/entry.Bx1.js',
      '/_nuxt/entry.Cd2.css',
      '/_nuxt/tools.slug.Ee3.js',
    ])
  })

  it('ignores canonical links and assets that are not build scoped', () => {
    expect(extractShellAssets(html)).not.toContain('https://toolsliang.com/zh-tw/tools/')
    expect(extractShellAssets(html)).not.toContain('/icons/icon-192.png')
  })

  it('lists a repeated asset once', () => {
    expect(extractShellAssets(`${html}\n${html}`)).toHaveLength(3)
  })

  it('returns nothing for a page with no application assets', () => {
    expect(extractShellAssets('<html><body>offline</body></html>')).toEqual([])
  })
})

describe('shell font extraction', () => {
  const cssUrl = 'https://toolsliang.com/_nuxt/entry.Cd2.css'
  const css = [
    '@font-face{font-family:Roboto Variable;src:url(./roboto-cyrillic-wght-normal.aa1.woff2) format("woff2-variations")}',
    '@font-face{font-family:Roboto Variable;src:url(./roboto-latin-wght-normal.bb2.woff2) format("woff2-variations")}',
    '@font-face{font-family:Roboto Variable;src:url("./roboto-latin-ext-wght-normal.cc3.woff2")}',
    '@font-face{font-family:Roboto Variable;src:url(./roboto-greek-wght-normal.dd4.woff2)}',
  ].join('\n')

  it('resolves a stylesheet-relative font reference to its served path', () => {
    expect(extractShellFonts(css, cssUrl)).toEqual([
      '/_nuxt/roboto-latin-wght-normal.bb2.woff2',
      '/_nuxt/roboto-latin-ext-wght-normal.cc3.woff2',
    ])
  })

  it('leaves scripts the supported locales never render to an online visit', () => {
    expect(extractShellFonts(css, cssUrl)).not.toContain('/_nuxt/roboto-cyrillic-wght-normal.aa1.woff2')
    expect(extractShellFonts(css, cssUrl)).not.toContain('/_nuxt/roboto-greek-wght-normal.dd4.woff2')
  })

  it('over-caches rather than caching nothing when the font package renames its subsets', () => {
    const renamed = '@font-face{src:url(./roboto-wght-normal.ee5.woff2)}'
    expect(extractShellFonts(renamed, cssUrl)).toEqual(['/_nuxt/roboto-wght-normal.ee5.woff2'])
  })

  it('returns nothing for a stylesheet that declares no font file', () => {
    expect(extractShellFonts('body{color:red}', cssUrl)).toEqual([])
  })
})

it('公開 Nuxt 建置資訊必須在首次離線前預先快取', async () => {
  const { buildShellAssetUrls } = await import('@/features/pwa/cache-policy')
  expect(buildShellAssetUrls('test-build')).toContain('/_nuxt/builds/meta/test-build.json')
})
