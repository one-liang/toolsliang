import { describe, expect, it } from 'vitest'
import {
  categoriesForTools,
  formatReviewDate,
  getPublicToolRoutes,
  resolvePublishedTools,
  resolveToolSlug,
  getUnavailableCapabilities,
  getTool,
  getVisibleStatus,
  isSupportedLocale,
  publishedToolCategories,
  publishedTools,
  toolCategories,
  toolsByCategory,
  validateToolRegistry,
  type PublishedToolDefinition,
} from '@/features/tools/catalog'
import { bmiContentReview } from '@/features/tools/bmi-calculator/domain/sources'
import { ntdContentReview } from '@/features/tools/ntd-uppercase/domain/sources'

describe('tool catalog', () => {
  it('accepts the registered catalog contract', () => {
    expect(validateToolRegistry()).toEqual([])
  })

  it('rejects a published registration without SEO metadata', () => {
    const invalidTool = { ...getTool('ntd-uppercase')! }
    delete (invalidTool as Partial<PublishedToolDefinition>).seo

    expect(validateToolRegistry([invalidTool])).toContain('[ntd-uppercase] published tool requires complete SEO/AEO metadata')
  })

  it('rejects an impossible NEW status date', () => {
    const invalidTool = { ...getTool('ntd-uppercase')! }
    invalidTool.status = { kind: 'new', startsAt: '2026-02-30', endsAt: '2026-03-10' }

    expect(validateToolRegistry([invalidTool])).toContain('[ntd-uppercase] NEW status requires a valid startsAt/endsAt range')
  })

  it('rejects incomplete or insecure source review metadata', () => {
    const invalidTool = structuredClone(getTool('ntd-uppercase')!)
    invalidTool.contentReview.sources[0]!.url = 'http://example.com/rules'

    expect(validateToolRegistry([invalidTool])).toContain('[ntd-uppercase] published tool requires content/source review metadata')
  })

  it('exposes only published tools to public catalog consumers', () => {
    expect(publishedTools.map(tool => tool.slug)).toEqual(['bmi-calculator', 'ntd-uppercase'])
  })

  it('keeps unpublished registrations out of public lookup and category output', () => {
    expect(getTool('image-resizer')).toBeUndefined()
    expect(toolsByCategory('image-commerce')).toEqual([])
    expect(publishedToolCategories.map(category => category.id)).toEqual(['calculation', 'document'])
  })

  it('provides the complete public route and content contract from one registration', () => {
    const tool = getTool('ntd-uppercase')!

    expect(tool).toMatchObject({
      availability: { state: 'published' },
      processingClass: 'instant',
      routeComponentKey: 'NtdUppercaseWorkspace',
      offlineMode: 'ready',
      capabilities: ['javascript'],
      aliases: {
        'zh-tw': ['新臺幣國字大寫', '國字金額'],
        en: ['Taiwan dollar uppercase', 'Chinese amount wording'],
      },
      keywords: {
        'zh-tw': ['支票', '會計', '國庫', '金額'],
        en: ['cheque', 'accounting', 'treasury', 'amount'],
      },
      acceptedInput: {
        'zh-tw': '一筆新臺幣數字金額，小數點後最多兩位',
        en: 'One New Taiwan dollar amount, with at most two decimal places',
      },
      localProcessingStatement: {
        'zh-tw': '金額、用途與轉換結果只在此裝置處理。',
        en: 'The amount, the purpose, and the wording are processed only on this device.',
      },
      pagePresentation: {
        showHeadingIcon: false,
        showLocalProcessingStatement: false,
      },
      seo: {
        contentKey: 'ntd-uppercase',
        title: { 'zh-tw': '新臺幣國字大寫', en: 'NTD Uppercase' },
      },
    })
    expect(tool.contentReview, '換寫規則的來源必須沿用 T10 鎖定的審閱結果').toBe(ntdContentReview)
    expect(tool.seo.answer['zh-tw'], '工具頁必須說明三種用途要自己選').toContain('國庫付款憑單')
  })

  it('registers the BMI tool against its reviewed health source', () => {
    const tool = getTool('bmi-calculator')!

    expect(tool).toMatchObject({
      category: 'calculation',
      processingClass: 'instant',
      routeComponentKey: 'BmiCalculatorWorkspace',
      offlineMode: 'ready',
      capabilities: ['javascript'],
      pagePresentation: {
        showHeadingIcon: false,
        showLocalProcessingStatement: true,
      },
      seo: { contentKey: 'bmi-calculator' },
    })
    expect(tool.contentReview, '健康資訊來源必須沿用 T07 鎖定的審閱結果').toBe(bmiContentReview)
    expect(tool.localProcessingStatement['zh-tw'], '工具頁必須說明身高體重留在裝置').toContain('此裝置')
  })

  it('expires NEW status from its registered date range', () => {
    const tool = getTool('ntd-uppercase')!

    expect(getVisibleStatus(tool.status, new Date('2026-09-15T00:00:00Z'))).toBe('new')
    expect(getVisibleStatus(tool.status, new Date('2026-10-04T00:00:00Z'))).toBeUndefined()
  })

  it('reports missing browser capabilities before a workspace starts', () => {
    expect(getUnavailableCapabilities(['javascript', 'web-worker'], {
      javascript: true,
      'web-worker': false,
    })).toEqual(['web-worker'])
  })

  it('generates public routes only for supported locales and published stable slugs', () => {
    expect(getPublicToolRoutes()).toEqual([
      '/zh-tw/tools/bmi-calculator/',
      '/zh-tw/tools/ntd-uppercase/',
      '/en/tools/bmi-calculator/',
      '/en/tools/ntd-uppercase/',
    ])
    expect(isSupportedLocale('tw')).toBe(false)
  })

  it('resolves saved and curated slugs through the published registry', () => {
    expect(resolvePublishedTools(['image-resizer', 'ntd-uppercase']).map(tool => tool.slug)).toEqual(['ntd-uppercase'])
  })

  it('answers which published tool a saved slug still points at', () => {
    expect(resolveToolSlug('ntd-uppercase')).toBe('ntd-uppercase')
    expect(resolveToolSlug('image-resizer'), '未上線工具不得成為導覽目標').toBeUndefined()
    expect(resolveToolSlug('tool-that-never-existed')).toBeUndefined()
  })

  it('follows a renamed tool from the slug a device saved earlier', () => {
    const renamed: PublishedToolDefinition = {
      ...getTool('ntd-uppercase')!,
      slug: 'ntd-amount-in-words',
      formerSlugs: ['ntd-uppercase'],
    }

    expect(resolveToolSlug('ntd-uppercase', [renamed])).toBe('ntd-amount-in-words')
    expect(resolveToolSlug('ntd-amount-in-words', [renamed])).toBe('ntd-amount-in-words')
  })

  it('rejects a former slug that collides with a live slug or is not stable English kebab-case', () => {
    const collides: PublishedToolDefinition = { ...getTool('ntd-uppercase')!, formerSlugs: ['ntd-uppercase'] }
    expect(validateToolRegistry([collides])).toContain('[ntd-uppercase] former slug must not collide with a registered slug: ntd-uppercase')

    const malformed: PublishedToolDefinition = { ...getTool('ntd-uppercase')!, formerSlugs: ['NTD_Uppercase'] }
    expect(validateToolRegistry([malformed])).toContain('[ntd-uppercase] former slug must be stable English kebab-case: NTD_Uppercase')
  })

  it('uses unique stable English slugs', () => {
    const slugs = publishedTools.map(tool => tool.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs.every(slug => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))).toBe(true)
  })

  it('provides bilingual copy and a valid category for every tool', () => {
    expect(toolCategories.map(category => category.id)).toEqual([
      'calculation',
      'time-calendar',
      'random-selection',
      'image-commerce',
      'document',
    ])

    const categoryIds = new Set(toolCategories.map(category => category.id))
    for (const tool of publishedTools) {
      expect(tool.name['zh-tw']).toBeTruthy()
      expect(tool.name.en).toBeTruthy()
      expect(tool.description['zh-tw']).toBeTruthy()
      expect(tool.description.en).toBeTruthy()
      expect(categoryIds.has(tool.category)).toBe(true)
    }
  })

  it('lists every tool exactly once through category groups', () => {
    const grouped = toolCategories.flatMap(category => toolsByCategory(category.id))
    expect(grouped).toHaveLength(publishedTools.length)
    expect(new Set(grouped.map(tool => tool.slug)).size).toBe(publishedTools.length)
  })

  it('derives displayed categories from any published tool collection', () => {
    expect(categoriesForTools([])).toEqual([])
    expect(categoriesForTools([getTool('ntd-uppercase')!]).map(category => category.id)).toEqual(['document'])
  })

  it('formats canonical review dates for the active locale', () => {
    expect(formatReviewDate('2013-07-31', 'zh-tw')).toBe('2013年7月31日')
    expect(formatReviewDate('2013-07-31', 'en')).toBe('Jul 31, 2013')
  })
})
