import { describe, expect, it } from 'vitest'
import { backgroundRemovalFailureCodes } from '@/features/tools/image-background-remover/domain/reference'
import {
  backgroundRemovalErrors,
  backgroundRemovalStages,
  imageBackgroundRemoverFaq,
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

  it('說明首次下載、本機推論與已知限制，不宣稱完美邊緣', () => {
    const zh = imageBackgroundRemoverFaq.map(entry => `${entry.heading['zh-tw']}${entry.body['zh-tw']}`).join('\n')
    expect(zh).toContain('下載')
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

  it('離線資產的標籤說明下載的是什麼，且雙語完整', () => {
    for (const asset of tool.offlineAssets ?? []) {
      expect(hasLocalizedCopy(asset.label), asset.id).toBe(true)
    }
  })
})
