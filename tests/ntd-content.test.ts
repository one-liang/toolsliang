import { describe, expect, it } from 'vitest'
import {
  getNtdCopy,
  getNtdPurposeSummary,
  ntdComparisonExamples,
  ntdErrorMessage,
  ntdFaq,
  validateNtdContent,
} from '@/features/tools/ntd-uppercase/content'
import {
  ntdErrorCodes,
  ntdGoldenVectors,
  ntdPurposeRules,
  ntdPurposes,
  type NtdPurpose,
} from '@/features/tools/ntd-uppercase/domain/reference'
import { ntdCaveatKeys, ntdContentReview } from '@/features/tools/ntd-uppercase/domain/sources'
import { getTool, supportedLocales } from '@/features/tools/catalog'

const tool = getTool('ntd-uppercase')!

/**
 * Section 7.3 forbids claiming legal effect, acceptance or that the tool
 * produces a document. Bare 法律 and legal are not on this list: the reviewed
 * caveat says the result is *not* legal review, and the reviewed question asks
 * whether it has legal effect precisely so the answer can refuse it.
 */
const forbiddenClaims = [
  '具法律效力', '合法', '保證通過', '保證受理', '審核通過', '正式文件', '電子簽章', '代開支票',
  'legally binding', 'guaranteed', 'certified', 'official document', 'issue a cheque',
]

function everyPublishedString() {
  return supportedLocales.flatMap(locale => [
    ...Object.values(getNtdCopy(locale)),
    tool.seo.answer[locale],
    ...ntdContentReview.sources.flatMap(source => [source.title[locale], source.description?.[locale] ?? '']),
    ...ntdFaq.flatMap(entry => [entry.heading[locale], entry.body[locale]]),
    ...ntdErrorCodes.flatMap(code => ntdPurposes.map(purpose => ntdErrorMessage(code, purpose, locale))),
  ])
}

describe('ntd uppercase content', () => {
  it('passes its own bilingual validation', () => {
    expect(validateNtdContent()).toEqual([])
  })

  /**
   * §7.1 as revised for #82: the workspace keeps the purpose hint and the rules
   * of the selected purpose, which carry the purpose caveats; the rest moved to
   * the before-you-start answer and the FAQ. The claims are the record's.
   */
  it('still states every reviewed caveat, in both locales', () => {
    const rules = (purpose: NtdPurpose, locale: 'zh-tw' | 'en') => Object.values(getNtdPurposeSummary(purpose, locale)).join('\n')
    const privacy = ntdFaq.find(entry => entry.heading['zh-tw'].includes('上傳'))!
    const where: Record<typeof ntdCaveatKeys[number], Record<'zh-tw' | 'en', [string, string]>> = {
      'no-legal-effect': { 'zh-tw': [tool.seo.answer['zh-tw'], '不是法律或會計審查'], en: [tool.seo.answer.en, 'not legal or accounting review'] },
      'purpose-differs': { 'zh-tw': [getNtdCopy('zh-tw').purposeHint, '三種用途的寫法不同'], en: [getNtdCopy('en').purposeHint, 'written differently'] },
      'cheque-yuan-only': { 'zh-tw': [rules('cheque', 'zh-tw'), '寫到「元」為止'], en: [rules('cheque', 'en'), 'Written to 元 only'] },
      'treasury-rounds-to-yuan': { 'zh-tw': [rules('treasury', 'zh-tw'), '元以下四捨五入'], en: [rules('treasury', 'en'), 'Rounds half-up'] },
      'treasury-omits-zero': { 'zh-tw': [rules('treasury', 'zh-tw'), '中間的零不書寫'], en: [rules('treasury', 'en'), 'Omits the internal 零'] },
      'written-amount-governs': { 'zh-tw': [tool.seo.answer['zh-tw'], '以文字為準'], en: [tool.seo.answer.en, 'the words govern'] },
      'local-processing': { 'zh-tw': [privacy.body['zh-tw'], '不會送到'], en: [privacy.body.en, 'never stored'] },
    }

    expect(Object.keys(where).sort()).toEqual([...ntdCaveatKeys].sort())
    for (const key of ntdCaveatKeys) {
      for (const locale of supportedLocales) {
        const [text, phrase] = where[key][locale]
        expect(text, `${key}/${locale}`).toContain(phrase)
      }
    }
  })

  it('says how to fix every refused amount, in both locales', () => {
    for (const locale of supportedLocales) {
      for (const code of ntdErrorCodes) {
        const message = ntdErrorMessage(code, 'accounting', locale)

        expect(message.trim(), `${code} ${locale}`).not.toBe('')
        expect(message, `${code} ${locale} 必須說明怎麼改`).toMatch(locale === 'en' ? /[a-z]/ : /[一-鿿]/)
      }
    }
    expect(ntdErrorMessage('too-many-decimals', 'cheque', 'zh-tw')).toContain('最多兩位')
    expect(ntdErrorMessage('fraction-not-supported', 'cheque', 'zh-tw')).toContain('與收款人確認')
    expect(ntdErrorMessage('negative', 'accounting', 'en')).toContain('zero or a positive amount')
  })

  it('quotes the bound of the purpose that refused the amount', () => {
    expect(ntdErrorMessage('out-of-range', 'accounting', 'zh-tw')).toContain('9,999,999,999,999,999.99')
    expect(ntdErrorMessage('out-of-range', 'cheque', 'zh-tw')).toContain('999,999,999,999')
    expect(ntdErrorMessage('out-of-range', 'cheque', 'en')).toContain('999,999,999,999')
    expect(ntdErrorMessage('out-of-range', 'treasury', 'zh-tw')).toContain('9,999,999,999,999,999')
  })

  it('summarizes what each purpose changes, using the reviewed labels', () => {
    const cheque = getNtdPurposeSummary('cheque', 'zh-tw')

    expect(cheque.label).toBe(ntdPurposeRules.cheque.label['zh-tw'])
    expect(cheque.limit).toBe('999,999,999,999')
    expect(cheque.fraction).toContain('元')
    expect(getNtdPurposeSummary('treasury', 'zh-tw').internalZero).toContain('不書寫')
    expect(getNtdPurposeSummary('accounting', 'en').label).toBe('Accounting')
    expect(getNtdPurposeSummary('treasury', 'en').fraction.toLowerCase()).toContain('round')
  })

  it('says on the source list which source governs each purpose', () => {
    const source = (url: string) => ntdContentReview.sources.find(item => item.url === url)!

    expect(source('https://www.twnch.org.tw/manual.html').description!['zh-tw'], '一般會計沒有法規限制，必須說清楚').toContain('沒有法規限制')
    expect(source('https://www.nta.gov.tw/singlehtml/296?cntId=nta_102_296').description!['zh-tw']).toContain('國庫付款憑單')
    const cheque = source('https://www.law.cbc.gov.tw/Law/ShowAll?LawID=LA06C001001&LawDataType=1')
    expect(cheque.title['zh-tw'], '非現行法規必須標示').toContain('非現行法規')
    expect(cheque.description!['zh-tw']).toContain('支票')
  })

  it('warns that the treasury example covers one unit boundary only', () => {
    const note = getNtdCopy('zh-tw').treasuryZeroNote

    expect(note, '§11 要求說明公開例示只涵蓋單一交界').toContain('單一單位交界')
    expect(note, '§11 要求建議與付款機關再確認').toContain('付款機關')
    expect(note, '§11 要求提醒逐位讀').toContain('逐位讀')
    expect(getNtdCopy('en').treasuryZeroNote.toLowerCase()).toContain('paying agency')
  })

  it('builds the worked examples from the reviewed vectors, not from prose', () => {
    expect(ntdComparisonExamples.length).toBeGreaterThan(2)

    for (const example of ntdComparisonExamples) {
      for (const purpose of ntdPurposes) {
        const vector = ntdGoldenVectors
          .find(item => item.input === example.input && item.purpose === purpose)

        expect(vector, `${example.input} 缺少 ${purpose} 向量`).toBeDefined()
        expect(example.wordings[purpose]).toBe(vector!.wording)
      }
    }

    const hazard = ntdComparisonExamples.find(example => example.input === '101')!
    expect(hazard.wordings.accounting).toBe('新臺幣壹佰零壹元整')
    expect(hazard.wordings.treasury, '國庫寫法必須看得出差異').toBe('新臺幣壹佰壹元整')
  })

  it('publishes the reviewed questions in both locales', () => {
    expect(ntdFaq).toHaveLength(9)

    const questions = ntdFaq.map(entry => entry.heading['zh-tw'])
    expect(questions).toContain('新臺幣國字大寫怎麼寫？')
    expect(questions).toContain('國庫付款憑單為什麼不寫中間的「零」？')
    expect(questions).toContain('我輸入的金額會被上傳嗎？')
    expect(new Set(questions).size).toBe(ntdFaq.length)
    for (const entry of ntdFaq) {
      expect(entry.heading.en.trim()).not.toBe('')
      expect(entry.body.en.trim()).not.toBe('')
    }
  })

  it('answers the legal-effect question by refusing it', () => {
    const entry = ntdFaq.find(item => item.heading['zh-tw'].includes('法律效力'))!

    expect(entry.body['zh-tw']).toContain('不是')
    expect(entry.body.en.toLowerCase()).toContain('no')
  })

  it('says the amount never leaves the device, wherever the question is asked', () => {
    const privacy = ntdFaq.find(entry => entry.heading['zh-tw'].includes('上傳'))!

    expect(privacy.body['zh-tw']).toContain('瀏覽器')
    expect(privacy.body['zh-tw']).toContain('不會送到')
    expect(privacy.body.en).toContain('never stored')
  })

  it('never claims legal effect, acceptance, or that it produces a document', () => {
    for (const text of everyPublishedString()) {
      for (const claim of forbiddenClaims) {
        expect(text.toLowerCase(), `禁止用語：${claim}`).not.toContain(claim.toLowerCase())
      }
    }
  })
})
