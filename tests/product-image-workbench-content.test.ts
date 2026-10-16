import { describe, expect, it } from 'vitest'
import { copy, getTool, supportedLocales, type PublishedToolDefinition } from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'
import { buildToolStructuredData } from '@/features/tools/structured-data'
import { resolveToolWorkspace } from '@/features/tools/workspace-resolver'
import * as workbenchContent from '@/features/tools/product-image-workbench/content'
import { workbenchErrors, workbenchJobHints, workbenchJobLabels, workbenchStages } from '@/features/tools/product-image-workbench/content'
import { backgroundRemovalErrors } from '@/features/tools/image-background-remover/content'
import { promoErrors } from '@/features/tools/brand-promo-image/content'
import { compressorErrors } from '@/features/tools/image-compressor/content'

describe('商品圖工作台的目錄註冊', () => {
  it('以穩定 slug 註冊雙語工具頁與寬版工作區', () => {
    const tool = getTool('product-image-workbench') as PublishedToolDefinition

    expect(tool.routeComponentKey).toBe('ProductImageWorkbenchWorkspace')
    expect(resolveToolWorkspace('ProductImageWorkbenchWorkspace')).toBeDefined()
    expect(tool.name).toEqual({ 'zh-tw': '商品圖工作台', en: 'Product Image Workbench' })
    expect(tool.category).toBe('image-commerce')
    expect(tool.pagePresentation.workspace).toBe('wide')
  })

  it('工作台本身離線可用，去背需要的檔案在勾選去背時才取得', () => {
    const tool = getTool('product-image-workbench')

    expect(tool?.offlineMode).toBe('ready')
    expect(tool?.offlineAssets).toBeUndefined()
  })

  it('說明本機邊界、單張失敗不影響其他張，也不保存工作', () => {
    const tool = getTool('product-image-workbench') as PublishedToolDefinition
    const answers = getToolFaq('product-image-workbench', 'zh-tw').map(entry => entry.body).join('')

    expect(tool.localProcessingStatement['zh-tw']).toContain('留在這台裝置')
    expect(answers).toContain('失敗只記在那一張上')
    expect(answers).toContain('只學過把人和背景分開')
    expect(getToolFaq('product-image-workbench', 'en').map(entry => entry.body).join(' ')).toContain('never sync to the cloud')
  })
})

/**
 * ADR-0022 removed the channel presets: the page, its FAQ, its structured data
 * and the workspace copy no longer speak of channels, specifications or a
 * compliant main image anywhere.
 */
describe('商品圖工作台不再提到通路規格', () => {
  const channelWording = /通路|合規|主圖|上架規格|preset|channel|complian|main image/i

  function strings(value: unknown, found: string[] = []): string[] {
    if (typeof value === 'string') found.push(value)
    else if (value && typeof value === 'object') Object.values(value).forEach(child => strings(child, found))
    return found
  }

  it.each(supportedLocales)('%s 的工具頁、FAQ 與結構化資料', (locale) => {
    const tool = getTool('product-image-workbench') as PublishedToolDefinition
    const page = [
      copy(tool.name, locale),
      copy(tool.description, locale),
      copy(tool.seo.title, locale),
      copy(tool.seo.description, locale),
      copy(tool.seo.answer, locale),
      ...tool.keywords[locale],
      ...tool.aliases[locale],
      ...getToolFaq('product-image-workbench', locale).flatMap(entry => [entry.heading, entry.body]),
      ...strings(buildToolStructuredData(tool, locale)),
    ]

    expect(page.filter(text => channelWording.test(text))).toEqual([])
  })

  it('工作區自己的每一句文案', () => {
    const own = { jobs: workbenchJobLabels, hints: workbenchJobHints, stages: workbenchStages, faq: workbenchContent.productImageWorkbenchFaq }
    expect(strings(own).filter(text => channelWording.test(text))).toEqual([])
  })
})

describe('三件事和各自的工具說同樣的話', () => {
  it.each(supportedLocales)('%s：每一件都有名稱與一句說明', (locale) => {
    for (const job of ['cutout', 'compose', 'compress'] as const) {
      expect(copy(workbenchJobLabels[job], locale).trim()).not.toBe('')
      expect(copy(workbenchJobHints[job], locale).trim()).not.toBe('')
    }
  })

  it('去背只適用人像，和人像去背一致', () => {
    expect(copy(workbenchJobHints.cutout, 'zh-tw')).toContain('人像')
    expect(copy(workbenchJobHints.cutout, 'en')).toMatch(/portrait/i)
  })

  it('失敗原因沿用三個工具自己的錯誤說明', () => {
    for (const code of Object.keys(backgroundRemovalErrors).filter(key => key !== 'failed')) expect(workbenchErrors[code]).toEqual(backgroundRemovalErrors[code])
    expect(workbenchErrors.missing_asset).toEqual(promoErrors.missing_asset)
    expect(workbenchErrors.unsupported_encoder).toEqual(compressorErrors.unsupported_encoder)
    expect(copy(workbenchErrors.failed!, 'zh-tw')).toContain('原圖未變更')
  })
})
