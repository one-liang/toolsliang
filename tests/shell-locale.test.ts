import { describe, expect, it } from 'vitest'
import { alternateLocalePath } from '@/features/shell/locale'

describe('alternateLocalePath', () => {
  it('keeps the current tool when switching language', () => {
    expect(alternateLocalePath('/zh-tw/tools/ntd-uppercase/', 'en')).toBe('/en/tools/ntd-uppercase/')
    expect(alternateLocalePath('/en/tools/ntd-uppercase/', 'zh-tw')).toBe('/zh-tw/tools/ntd-uppercase/')
  })

  it('keeps query and hash', () => {
    expect(alternateLocalePath('/zh-tw/tools/?saved=true', 'en')).toBe('/en/tools/?saved=true')
    expect(alternateLocalePath('/zh-tw/design-system/#ds-color', 'en')).toBe('/en/design-system/#ds-color')
  })

  it('handles a locale root without a trailing slash', () => {
    expect(alternateLocalePath('/zh-tw', 'en')).toBe('/en')
  })

  it('adds the locale prefix when the path has none', () => {
    expect(alternateLocalePath('/', 'en')).toBe('/en/')
  })

  it('only replaces a complete locale segment', () => {
    expect(alternateLocalePath('/zh-tw-legacy/', 'en')).toBe('/en/zh-tw-legacy/')
  })
})
