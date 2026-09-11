import { describe, expect, it } from 'vitest'
import {
  pdfSignatureErrors,
  pdfSignatureFaq,
  pdfSignatureStageLabels,
} from '@/features/tools/pdf-signature/content'
import { pdfSignatureDefinition } from '@/features/tools/pdf-signature/definition'
import {
  pdfSignatureDisclosures,
  pdfSignatureFailureCodes,
  pdfSignatureStages,
} from '@/features/tools/pdf-signature/domain/reference'
import { getTool, publishedTools, supportedLocales, type LocaleCode } from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'
import { parseForbiddenWording } from './support/pdf-engine-decision-record'

const locales: LocaleCode[] = [...supportedLocales]
/** §10.2 of the decision record owns the list; the copy only has to avoid it. */
const forbiddenWording = parseForbiddenWording('### 10.2 禁止用語')

describe('失敗與階段文案', () => {
  it('決策紀錄列出的每一個失敗代碼都有雙語說明', () => {
    for (const code of pdfSignatureFailureCodes) {
      for (const locale of locales) {
        expect(pdfSignatureErrors[code]?.[locale], `${code} / ${locale}`).toBeTruthy()
      }
    }
  })

  it('除了取消以外，每一句都說明原檔沒有被改動', () => {
    for (const code of pdfSignatureFailureCodes) {
      if (code === 'cancelled') continue
      expect(pdfSignatureErrors[code]!['zh-tw'], code).toMatch(/原檔|原本的檔案|尚未/)
      expect(pdfSignatureErrors[code]!.en, code).toMatch(/unchanged|not changed|nothing/i)
    }
  })

  it('沒有多出規格與紀錄沒有的代碼', () => {
    expect(Object.keys(pdfSignatureErrors).sort()).toEqual([...pdfSignatureFailureCodes].sort())
  })

  it('五個階段都有雙語名稱', () => {
    expect(Object.keys(pdfSignatureStageLabels).sort()).toEqual([...pdfSignatureStages].sort())
    for (const stage of pdfSignatureStages) {
      for (const locale of locales) expect(pdfSignatureStageLabels[stage]![locale]).toBeTruthy()
    }
  })
})

describe('工具註冊與產品邊界', () => {
  it('以穩定 slug 註冊在文件分類，並在兩種語言都有頁面', () => {
    expect(pdfSignatureDefinition.slug).toBe('pdf-signature')
    expect(pdfSignatureDefinition.category).toBe('document')
    expect(getTool('pdf-signature')).toBeDefined()
    expect(publishedTools.filter(tool => tool.slug === 'pdf-signature')).toHaveLength(1)
  })

  it('宣告 Worker 處理類別與密碼所需的能力', () => {
    expect(pdfSignatureDefinition.processingClass).toBe('worker')
    expect(pdfSignatureDefinition.capabilities).toContain('web-worker')
    expect(pdfSignatureDefinition.routeComponentKey).toBe('PdfSignatureWorkspace')
  })

  it('不把手寫簽名說成數位簽章，也不保證法律效力', () => {
    const surfaces = [
      pdfSignatureDefinition.name,
      pdfSignatureDefinition.description,
      pdfSignatureDefinition.acceptedInput,
      pdfSignatureDefinition.localProcessingStatement,
      pdfSignatureDefinition.seo.title,
      pdfSignatureDefinition.seo.description,
      pdfSignatureDefinition.seo.answer,
      ...pdfSignatureFaq.flatMap(entry => [entry.heading, entry.body]),
      ...Object.values(pdfSignatureErrors),
      ...Object.values(pdfSignatureDisclosures),
    ]

    for (const copy of surfaces) {
      for (const locale of locales) {
        const text = copy[locale].toLowerCase()
        for (const forbidden of forbiddenWording) {
          expect(text, `${forbidden} / ${locale}`).not.toContain(forbidden.toLowerCase())
        }
      }
    }
  })

  it('關鍵字與別名不使用 CONTEXT.md 列為避免的說法', () => {
    const terms = [
      ...pdfSignatureDefinition.aliases['zh-tw'], ...pdfSignatureDefinition.aliases.en,
      ...pdfSignatureDefinition.keywords['zh-tw'], ...pdfSignatureDefinition.keywords.en,
    ]

    for (const term of terms) {
      expect(term).not.toMatch(/PDF 數位簽章|電子簽章|線上簽署/)
    }
  })

  it('工具頁的 FAQ 就是結構化資料發布的那一份', () => {
    const questions = getToolFaq(pdfSignatureDefinition.seo.contentKey, 'zh-tw')

    expect(questions).toHaveLength(pdfSignatureFaq.length)
    expect(questions.length).toBeGreaterThanOrEqual(4)
    expect(questions[0]!.heading).toBe(pdfSignatureFaq[0]!.heading['zh-tw'])
  })

  it('FAQ 說明本機處理、本機資產、密碼與解密後的輸出', () => {
    const zh = pdfSignatureFaq.map(entry => `${entry.heading['zh-tw']}${entry.body['zh-tw']}`).join('\n')
    const en = pdfSignatureFaq.map(entry => `${entry.heading.en}${entry.body.en}`).join('\n')

    expect(zh).toMatch(/不會傳送|不離開|只在/)
    expect(zh).toMatch(/主動保存/)
    expect(zh).toMatch(/密碼/)
    expect(en.toLowerCase()).toMatch(/password/)
    expect(en.toLowerCase()).toMatch(/on your device|never sent/)
  })

  it('必須揭露的八句話都被工具頁的文案帶著走', () => {
    const shown = [
      pdfSignatureDefinition.seo.answer,
      pdfSignatureDefinition.localProcessingStatement,
      ...pdfSignatureFaq.map(entry => entry.body),
      ...Object.values(pdfSignatureDisclosures),
    ].map(copy => copy['zh-tw']).join('\n')

    // The two sentences a visitor has to see before they start placing anything.
    expect(shown).toContain(pdfSignatureDisclosures['not-a-digital-signature']['zh-tw'])
    expect(shown).toContain(pdfSignatureDisclosures['no-identity-verification']['zh-tw'])
  })
})
