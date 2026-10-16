import { describe, expect, it } from 'vitest'
import { copy, getTool, supportedLocales, type PublishedToolDefinition } from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'
import { buildToolStructuredData } from '@/features/tools/structured-data'
import { resolveToolWorkspace } from '@/features/tools/workspace-resolver'
import * as workbenchContent from '@/features/tools/product-image-workbench/content'
import {
  workbenchAdmissionMessage,
  workbenchBlockReasons,
  workbenchErrorMessage,
  workbenchItemLabel,
  workbenchLimitsNotice,
  workbenchLocalNotice,
  workbenchQueueSummary,
  workbenchStepErrors,
  workbenchStepLabels,
} from '@/features/tools/product-image-workbench/content'
import { workbenchQueueLimits } from '@/features/tools/product-image-workbench/queue'
import { workbenchSteps } from '@/features/tools/product-image-workbench/session'

describe('商品圖工作台的目錄註冊', () => {
  it('以穩定 slug 註冊雙語工具頁與工作區', () => {
    const tool = getTool('product-image-workbench')

    expect(tool?.routeComponentKey).toBe('ProductImageWorkbenchWorkspace')
    expect(resolveToolWorkspace('ProductImageWorkbenchWorkspace')).toBeDefined()
    expect(tool?.name).toEqual({ 'zh-tw': '商品圖工作台', en: 'Product Image Workbench' })
    expect(tool?.category).toBe('image-commerce')
  })

  it('工作台本身離線可用，去背的模型下載留在需要它的步驟裡說明', () => {
    const tool = getTool('product-image-workbench')

    expect(tool?.offlineMode).toBe('ready')
    expect(tool?.offlineAssets).toBeUndefined()
  })

  it('目錄與 FAQ 說明本機邊界、產品邊界與失敗隔離', () => {
    const tool = getTool('product-image-workbench')
    const answers = getToolFaq('product-image-workbench', 'zh-tw')

    expect(tool?.localProcessingStatement['zh-tw']).toContain('留在這台裝置')
    expect(copyOf(workbenchLocalNotice)).toContain('留在這台裝置')
    expect(answers.map(entry => entry.body).join('')).toContain('先前完成的步驟仍然保留')
    expect(getToolFaq('product-image-workbench', 'en').map(entry => entry.body).join(' ')).toContain('never syncs to the cloud')
  })

  it('步驟停用的唯一理由是瀏覽器做不到，且說明其餘步驟仍可使用', () => {
    expect(Object.keys(workbenchBlockReasons)).toEqual(['capability'])
    expect(copyOf(workbenchBlockReasons.capability)).toContain('其餘步驟仍可正常使用')
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

  it('工作區的每一句文案', () => {
    expect(strings(workbenchContent).filter(text => channelWording.test(text))).toEqual([])
  })
})

describe('批次的說明文字', () => {
  it('項目標籤只由序號產生，不含來源檔名', () => {
    expect(workbenchItemLabel(3, 'zh-tw')).toBe('第 3 項')
    expect(workbenchItemLabel(3, 'en')).toBe('Item 3')
  })

  it('退回的檔案說明上限本身，並說明怎麼修正', () => {
    const message = workbenchAdmissionMessage('too_many_items', workbenchQueueLimits, 'zh-tw')

    expect(message).toContain(String(workbenchQueueLimits.maxItems))
    expect(message).toContain('移除幾張後可以再加')
    expect(workbenchAdmissionMessage('batch_too_large', workbenchQueueLimits, 'en')).toContain('did not fit')
  })

  it('上限說明與退回說明用同一組數字', () => {
    expect(workbenchLimitsNotice(workbenchQueueLimits, 'zh-tw')).toContain('20 張')
    expect(workbenchLimitsNotice({ maxItems: 6, maxBytes: 64 * 1024 * 1024 }, 'zh-tw')).toContain('6 張')
  })

  it('彙總摘要把每一張都算進去，不會只報成功的', () => {
    const summary = workbenchQueueSummary({ total: 5, done: 2, failed: 1, running: 1, pending: 1 }, 'zh-tw')

    expect(summary).toContain('共 5 張')
    expect(summary).toContain('1 張未完成')
    expect(workbenchQueueSummary({ total: 0, done: 0, failed: 0, running: 0, pending: 0 }, 'en')).toContain('No images')
  })
})

describe('每個步驟說自己引擎的話', () => {
  it('相同代碼在不同步驟給出該步驟的解釋', () => {
    expect(workbenchErrorMessage('cutout', 'unsupported_browser', 'zh-tw')).toContain('去背模型')
    expect(workbenchErrorMessage('layout', 'unsupported_browser', 'zh-tw')).toContain('背景處理圖片')
    expect(workbenchErrorMessage('layout', 'unsupported_browser', 'zh-tw'))
      .not.toBe(workbenchErrorMessage('cutout', 'unsupported_browser', 'zh-tw'))
  })

  it('未知代碼退回同一句可行動的說明，且不丟失先前成果的承諾', () => {
    for (const step of workbenchSteps) {
      expect(workbenchErrorMessage(step, 'a-code-no-engine-returns', 'zh-tw')).toContain('先前完成的步驟仍保留')
      expect(workbenchErrorMessage(step, 'a-code-no-engine-returns', 'en')).toContain('completed earlier is kept')
    }
  })

  it('每個步驟都有雙語名稱與可解釋的錯誤來源', () => {
    for (const step of workbenchSteps) {
      expect(workbenchStepLabels[step]['zh-tw'].trim()).not.toBe('')
      expect(workbenchStepLabels[step].en.trim()).not.toBe('')
      expect(Object.keys(workbenchStepErrors[step]).length).toBeGreaterThan(0)
    }
  })
})

function copyOf(value: { 'zh-tw': string }) {
  return value['zh-tw']
}
