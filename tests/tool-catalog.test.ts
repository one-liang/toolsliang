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
import { randomPickerContentReview } from '@/features/tools/random-picker/domain/sources'

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
    expect(publishedTools.map(tool => tool.slug)).toEqual(['device-time', 'image-compressor', 'image-background-remover', 'compliant-product-image', 'brand-promo-image', 'product-image-workbench', 'bmi-calculator', 'ntd-uppercase', 'random-picker', 'taiwan-calendar', 'custom-calendar', 'pdf-signature'])
  })

  it('keeps unpublished registrations out of public lookup and category output', () => {
    expect(getTool('image-resizer')).toBeUndefined()
    expect(toolsByCategory('image-commerce').map(tool => tool.slug)).toEqual(['image-compressor', 'image-background-remover', 'compliant-product-image', 'brand-promo-image', 'product-image-workbench'])
    expect(publishedToolCategories.map(category => category.id)).toEqual(['calculation', 'time-calendar', 'random-selection', 'image-commerce', 'document'])
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

  it('registers the random picker against its reviewed fairness sources', () => {
    const tool = getTool('random-picker')!

    expect(tool).toMatchObject({
      category: 'random-selection',
      processingClass: 'instant',
      routeComponentKey: 'RandomPickerWorkspace',
      offlineMode: 'ready',
      capabilities: ['javascript'],
      pagePresentation: {
        showHeadingIcon: false,
        showLocalProcessingStatement: true,
      },
      seo: { contentKey: 'random-picker' },
    })
    expect(tool.contentReview, '等機率的依據必須沿用 T12 鎖定的審閱結果').toBe(randomPickerContentReview)
    expect(tool.seo.answer['zh-tw'], '工具頁必須說明結果無法由第三方稽核').toContain('稽核')
    expect(tool.localProcessingStatement['zh-tw'], '工具頁必須說明名單留在裝置').toContain('此裝置')
  })

  it('registers the custom calendar as a local-asset tool over the official calendar', () => {
    const tool = getTool('custom-calendar')!

    expect(tool).toMatchObject({
      category: 'time-calendar',
      processingClass: 'instant',
      routeComponentKey: 'CustomCalendarWorkspace',
      offlineMode: 'ready',
      capabilities: ['javascript'],
      pagePresentation: {
        showHeadingIcon: false,
        showLocalProcessingStatement: true,
      },
      seo: { contentKey: 'custom-calendar' },
    })
    expect(tool.localProcessingStatement['zh-tw'], '工具頁必須說明自訂項目留在裝置').toContain('這台裝置')
    expect(tool.seo.answer['zh-tw'], '工具頁必須說明資料可能因瀏覽器清除而消失').toContain('匯出')
    expect(tool.acceptedInput['zh-tw'], '可接受輸入必須說明只收自訂項目').toContain('自訂')
  })

  it('expires NEW status from its registered date range', () => {
    const tool = getTool('ntd-uppercase')!

    expect(getVisibleStatus(tool.status, new Date('2026-09-15T00:00:00Z'))).toBe('new')
    expect(getVisibleStatus(tool.status, new Date('2026-10-04T00:00:00Z'))).toBeUndefined()
  })

  it('leaves NEW undecided without a clock, so a prerendered page cannot answer for the device', () => {
    expect(getVisibleStatus(getTool('ntd-uppercase')!.status)).toBeUndefined()
    expect(getVisibleStatus({ kind: 'pro' })).toBe('pro')
    expect(getVisibleStatus({ kind: 'hot', source: 'site-pageviews' })).toBe('hot')
    expect(getVisibleStatus(undefined)).toBeUndefined()
  })

  it('reports missing browser capabilities before a workspace starts', () => {
    expect(getUnavailableCapabilities(['javascript', 'web-worker'], {
      javascript: true,
      'web-worker': false,
    })).toEqual(['web-worker'])
  })

  it('generates public routes only for supported locales and published stable slugs', () => {
    expect(getPublicToolRoutes()).toEqual([
      '/zh-tw/tools/device-time/',
      '/zh-tw/tools/image-compressor/',
      '/zh-tw/tools/image-background-remover/',
      '/zh-tw/tools/compliant-product-image/',
      '/zh-tw/tools/brand-promo-image/',
      '/zh-tw/tools/product-image-workbench/',
      '/zh-tw/tools/bmi-calculator/',
      '/zh-tw/tools/ntd-uppercase/',
      '/zh-tw/tools/random-picker/',
      '/zh-tw/tools/taiwan-calendar/',
      '/zh-tw/tools/custom-calendar/',
      '/zh-tw/tools/pdf-signature/',
      '/en/tools/device-time/',
      '/en/tools/image-compressor/',
      '/en/tools/image-background-remover/',
      '/en/tools/compliant-product-image/',
      '/en/tools/brand-promo-image/',
      '/en/tools/product-image-workbench/',
      '/en/tools/bmi-calculator/',
      '/en/tools/ntd-uppercase/',
      '/en/tools/random-picker/',
      '/en/tools/taiwan-calendar/',
      '/en/tools/custom-calendar/',
      '/en/tools/pdf-signature/',
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
