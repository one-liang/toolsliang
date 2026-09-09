import { describe, expect, it } from 'vitest'
import { getTool } from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'
import { resolveToolWorkspace } from '@/features/tools/workspace-resolver'
import {
  workbenchBlockReasons,
  workbenchErrorMessage,
  workbenchLocalNotice,
  workbenchStepErrors,
  workbenchStepLabels,
} from '@/features/tools/product-image-workbench/content'
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
    expect(answers.map(entry => entry.body).join('')).toContain('不保證通路審核通過')
    expect(answers.map(entry => entry.body).join('')).toContain('先前完成的步驟仍然保留')
    expect(getToolFaq('product-image-workbench', 'en').map(entry => entry.body).join(' ')).toContain('never syncs to the cloud')
  })

  it('不宣稱合規主圖可以加上框版或 Logo', () => {
    expect(workbenchBlockReasons.purpose['zh-tw']).toContain('合規主圖不得加入框版、Logo 或促銷文字')
    expect(workbenchBlockReasons.capability['zh-tw']).toContain('其餘步驟仍可正常使用')
  })
})

describe('每個步驟說自己引擎的話', () => {
  it('相同代碼在不同步驟給出該步驟的解釋', () => {
    expect(workbenchErrorMessage('cutout', 'unsupported_browser', 'zh-tw')).toContain('去背模型')
    expect(workbenchErrorMessage('layout', 'unsupported_browser', 'zh-tw')).toContain('OffscreenCanvas')
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
