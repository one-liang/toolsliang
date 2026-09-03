import { describe, expect, it } from 'vitest'
import {
  categoriesForTools,
  formatReviewDate,
  getPublicToolRoutes,
  getSavedTools,
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
    expect(publishedTools.map(tool => tool.slug)).toEqual(['ntd-uppercase'])
  })

  it('keeps unpublished registrations out of public lookup and category output', () => {
    expect(getTool('image-resizer')).toBeUndefined()
    expect(toolsByCategory('image-commerce')).toEqual([])
    expect(publishedToolCategories.map(category => category.id)).toEqual(['document'])
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
        'zh-tw': ['支票', '會計', '金額'],
        en: ['cheque', 'accounting', 'amount'],
      },
      acceptedInput: {
        'zh-tw': '新臺幣數字金額',
        en: 'A numeric New Taiwan dollar amount',
      },
      localProcessingStatement: {
        'zh-tw': '輸入與結果只在此裝置處理。',
        en: 'Input and results are processed only on this device.',
      },
      pagePresentation: {
        showHeadingIcon: false,
        showLocalProcessingStatement: false,
      },
      seo: {
        contentKey: 'ntd-uppercase',
        title: { 'zh-tw': '新臺幣國字大寫', en: 'NTD Uppercase' },
      },
      contentReview: {
        reviewedAt: '2026-09-03',
        sourceEdition: {
          'zh-tw': '國庫支票管理辦法（民國 102 年 7 月 31 日修正）',
          en: 'Regulations Governing Treasury Checks (amended July 31, 2013)',
        },
        sourceEffectiveAt: '2013-07-31',
        sources: [
          {
            title: { 'zh-tw': '財政部主管法規查詢系統', en: 'Ministry of Finance Laws and Regulations' },
            url: 'https://law-out.mof.gov.tw/LawContent.aspx?KeyWord=&id=FL005816',
          },
          {
            title: { 'zh-tw': '財政部國庫署', en: 'National Treasury Administration' },
            url: 'https://www.nta.gov.tw/singlehtml/296?cntId=nta_102_296',
          },
        ],
      },
    })
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
      '/zh-tw/tools/ntd-uppercase/',
      '/en/tools/ntd-uppercase/',
    ])
    expect(isSupportedLocale('tw')).toBe(false)
  })

  it('resolves common-tool slugs through the published registry', () => {
    expect(getSavedTools(['image-resizer', 'ntd-uppercase']).map(tool => tool.slug)).toEqual(['ntd-uppercase'])
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
