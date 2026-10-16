import { describe, expect, it } from 'vitest'
import { backgroundRemovalFailureCodes } from '@/features/tools/image-background-remover/domain/reference'
import {
  backgroundRemovalErrors,
  backgroundRemovalStages,
  imageBackgroundRemoverFaq,
  modelPreparationIssues,
  portraitScopeNotice,
} from '@/features/tools/image-background-remover/content'
import { heicMessage } from '@/features/tools/image-compressor/content'
import { getTool, hasLocalizedCopy } from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'

const tool = getTool('image-background-remover')!

describe('人像去背文案', () => {
  it('每個決策紀錄列出的失敗模式都有可恢復的雙語說明', () => {
    for (const code of backgroundRemovalFailureCodes) {
      if (code === 'cancelled') continue
      expect(hasLocalizedCopy(backgroundRemovalErrors[code]), code).toBe(true)
    }
    expect(hasLocalizedCopy(backgroundRemovalErrors.failed)).toBe(true)
  })

  it('規格 §12.8 的每個階段都有雙語進度文字', () => {
    for (const stage of ['decoding', 'preparing-model', 'inference', 'mask', 'encoding', 'preparing-download']) {
      expect(hasLocalizedCopy(backgroundRemovalStages[stage]), stage).toBe(true)
    }
  })

  it('沿用共用的 HEIC／HEIF 拒絕訊息，不另寫一份', () => {
    expect(backgroundRemovalErrors.unsupported_heic).toBe(heicMessage)
  })

  it('在名稱、描述與可見說明都先講清楚只處理人像', () => {
    expect(hasLocalizedCopy(portraitScopeNotice)).toBe(true)
    expect(portraitScopeNotice['zh-tw']).toContain('人像')
    expect(portraitScopeNotice.en.toLowerCase()).toContain('people')
    for (const copy of [tool.name, tool.description, tool.seo.title, tool.seo.description, tool.seo.answer, tool.acceptedInput]) {
      expect(hasLocalizedCopy(copy)).toBe(true)
    }
    expect(tool.name['zh-tw']).toContain('人像')
    expect(tool.description['zh-tw']).toContain('人像')
    expect(tool.seo.answer['zh-tw']).toContain('人像')
  })

  it('說明第一次使用要等一下、本機處理與已知限制，不宣稱完美邊緣', () => {
    const zh = imageBackgroundRemoverFaq.map(entry => `${entry.heading['zh-tw']}${entry.body['zh-tw']}`).join('\n')
    expect(zh).toContain('第一次使用')
    expect(zh).toContain('用過一次後，離線也能使用')
    expect(zh).toContain('自動接著去背')
    expect(zh).toContain('MB')
    expect(zh).toContain('不會')
    expect(zh).toContain('半透明')
    expect(zh).toContain('瀏覽器')
    expect(zh).not.toMatch(/完美|保證去除|一定準確/)
    expect(tool.localProcessingStatement['zh-tw']).toContain('不')
  })

  it('FAQ 由工具頁的 contentKey 取得且雙語完整', () => {
    expect(getToolFaq(tool.seo.contentKey, 'zh-tw').length).toBe(imageBackgroundRemoverFaq.length)
    expect(getToolFaq(tool.seo.contentKey, 'en').length).toBe(imageBackgroundRemoverFaq.length)
    for (const entry of imageBackgroundRemoverFaq) {
      expect(hasLocalizedCopy(entry.heading)).toBe(true)
      expect(hasLocalizedCopy(entry.body)).toBe(true)
    }
  })

  it('準備與離線的說明用白話：不要求使用者下載模型，也不出現技術名詞', () => {
    const copies = [
      tool.seo.description, tool.seo.answer,
      ...Object.values(modelPreparationIssues),
      ...imageBackgroundRemoverFaq.flatMap(entry => [entry.heading, entry.body]),
      backgroundRemovalErrors.unsupported_browser!,
    ]
    for (const copy of copies) {
      expect(hasLocalizedCopy(copy)).toBe(true)
      for (const text of [copy['zh-tw'], copy.en]) {
        expect(text).not.toMatch(/ONNX|WebAssembly|WASM|runtime|執行提供者|推論資源|SHA-256|指紋|fingerprint/i)
        expect(text).not.toMatch(/下載模型|首次使用需下載|download the model|downloads the model/i)
      }
    }
    expect(tool.seo.answer['zh-tw']).toContain('用過一次後，離線也能使用')
    expect(tool.seo.description['zh-tw']).toContain('用過一次後離線也能使用')
  })

  it('每一種準備不完成的原因都告訴使用者按「重試」', () => {
    for (const copy of Object.values(modelPreparationIssues)) {
      expect(copy['zh-tw']).toContain('「重試」')
      expect(copy.en).toContain('Try again')
      expect(copy['zh-tw']).not.toContain('下載')
      expect(copy.en.toLowerCase()).not.toContain('download')
    }
  })

  it('離線資產的標籤說明下載的是什麼，且雙語完整', () => {
    for (const asset of tool.offlineAssets ?? []) {
      expect(hasLocalizedCopy(asset.label), asset.id).toBe(true)
    }
  })
})
