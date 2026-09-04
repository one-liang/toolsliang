import { describe, expect, it } from 'vitest'
import { appIcons, buildWebAppManifest, manifestPath } from '@/features/pwa/manifest'
import { publishedTools } from '@/features/tools/catalog'

describe('web app manifest', () => {
  const zh = buildWebAppManifest('zh-tw')
  const en = buildWebAppManifest('en')

  it('serves one manifest per locale under that locale', () => {
    expect(manifestPath('zh-tw')).toBe('/zh-tw/manifest.webmanifest')
    expect(manifestPath('en')).toBe('/en/manifest.webmanifest')
  })

  it('describes the installed application in the visitor locale', () => {
    expect(zh.name).toBe('toolsliang 萬用工具')
    expect(zh.short_name).toBe('toolsliang')
    expect(zh.description).toContain('留在你的裝置')
    expect(zh.lang).toBe('zh-Hant-TW')
    expect(en.lang).toBe('en')
    expect(en.description).toContain('device')
  })

  it('installs as a standalone app that opens in the visitor locale', () => {
    expect(zh.display).toBe('standalone')
    expect(zh.start_url).toBe('/zh-tw/')
    expect(zh.scope).toBe('/')
    expect(zh.id).toBe('/zh-tw/')
    expect(en.start_url).toBe('/en/')
  })

  it('uses the approved light theme and background colors', () => {
    expect(zh.theme_color).toBe('#f6f3f0')
    expect(zh.background_color).toBe('#f6f3f0')
  })

  it('declares a maskable and an any-purpose icon at the installable sizes', () => {
    expect(zh.icons).toEqual(appIcons)
    expect(zh.icons.some(icon => icon.sizes === '192x192' && icon.purpose === 'any')).toBe(true)
    expect(zh.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any')).toBe(true)
    expect(zh.icons.some(icon => icon.purpose === 'maskable')).toBe(true)
    expect(zh.icons.every(icon => icon.type === 'image/png' && icon.src.startsWith('/icons/'))).toBe(true)
  })

  it('shortcuts only to tools that already work offline, so an installed icon never promises a download', () => {
    const heavySlugs = publishedTools.filter(tool => tool.offlineMode !== 'ready').map(tool => tool.slug)

    expect(zh.shortcuts.length).toBeGreaterThan(0)
    expect(zh.shortcuts.map(shortcut => shortcut.url)).toContain('/zh-tw/tools/ntd-uppercase/')
    for (const shortcut of zh.shortcuts) {
      expect(heavySlugs.some(slug => shortcut.url.includes(slug))).toBe(false)
    }
  })

  it('carries no user or tool content', () => {
    expect(JSON.stringify(zh)).not.toMatch(/token|session|user|email/i)
  })
})
