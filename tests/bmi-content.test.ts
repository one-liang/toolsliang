import { describe, expect, it } from 'vitest'
import {
  bmiCaveats,
  bmiCategoryRangeText,
  bmiCopy,
  bmiCopyKeys,
  bmiFaq,
  bmiFieldErrorMessage,
  validateBmiContent,
} from '@/features/tools/bmi-calculator/content'
import {
  bmiFieldsByUnitSystem,
  type BmiFieldErrorCode,
  type BmiFieldId,
} from '@/features/tools/bmi-calculator/domain/calculate'
import { bmiCategories } from '@/features/tools/bmi-calculator/domain/reference'
import { bmiCaveatKeys } from '@/features/tools/bmi-calculator/domain/sources'
import { supportedLocales } from '@/features/tools/catalog'
import { bmiDecisionRecord } from './support/bmi-decision-record'

const allFields = [...bmiFieldsByUnitSystem.metric, ...bmiFieldsByUnitSystem.imperial] as BmiFieldId[]
const allCodes: BmiFieldErrorCode[] = ['missing', 'invalid-number', 'non-positive', 'out-of-range']

function everyVisibleString() {
  return [
    ...bmiCopyKeys.flatMap(key => supportedLocales.map(locale => bmiCopy[key][locale])),
    ...bmiCaveatKeys.flatMap(key => supportedLocales.map(locale => bmiCaveats[key][locale])),
    ...bmiFaq.flatMap(entry => supportedLocales.flatMap(locale => [entry.heading[locale], entry.body[locale]])),
    ...bmiCategories.flatMap(category => supportedLocales.map(locale => category.name[locale])),
    ...allFields.flatMap(field => allCodes.flatMap(code => supportedLocales.map(locale =>
      bmiFieldErrorMessage({ measure: field.startsWith('height') ? 'height' : 'weight', field, code }, locale),
    ))),
  ]
}

describe('bmi content', () => {
  it('passes its own validation', () => {
    expect(validateBmiContent()).toEqual([])
  })

  it('shows every caveat the decision record requires, in both locales and in its published wording', () => {
    expect(Object.keys(bmiCaveats)).toEqual([...bmiCaveatKeys])

    for (const key of bmiCaveatKeys) {
      for (const locale of supportedLocales) {
        expect(bmiCaveats[key][locale].trim(), `${key}/${locale} 免責內容不得留空`).not.toBe('')
        expect(bmiDecisionRecord, `${key}/${locale} 必須沿用決策紀錄的原文`).toContain(bmiCaveats[key][locale])
      }
    }
  })

  it('answers exactly the questions the decision record approved', () => {
    expect(bmiFaq).toHaveLength(8)

    for (const entry of bmiFaq) {
      for (const locale of supportedLocales) {
        expect(bmiDecisionRecord, `${entry.heading[locale]} 必須來自決策紀錄 §7`).toContain(entry.heading[locale])
        expect(entry.body[locale].trim()).not.toBe('')
      }
    }
    expect(new Set(bmiFaq.map(entry => entry.heading['zh-tw'])).size).toBe(bmiFaq.length)
  })

  it('states the category range as text, never as colour alone', () => {
    expect(bmiCategories.map(category => bmiCategoryRangeText(category))).toEqual([
      'BMI < 18.5',
      '18.5 ≦ BMI < 24',
      '24 ≦ BMI < 27',
      'BMI ≧ 27',
    ])
    for (const range of bmiCategories.map(category => bmiCategoryRangeText(category))) {
      expect(bmiDecisionRecord).toContain(range)
    }
  })

  it('explains every input error in both locales', () => {
    for (const field of allFields) {
      for (const code of allCodes) {
        for (const locale of supportedLocales) {
          const message = bmiFieldErrorMessage({
            measure: field.startsWith('height') ? 'height' : 'weight',
            field,
            code,
          }, locale)
          expect(message.trim(), `${field}/${code}/${locale} 需要可理解的訊息`).not.toBe('')
        }
      }
    }
  })

  it('writes the supported range into the out-of-range message of each field', () => {
    const outOfRange = (field: BmiFieldId, locale: 'zh-tw' | 'en') => bmiFieldErrorMessage({
      measure: field.startsWith('height') ? 'height' : 'weight',
      field,
      code: 'out-of-range',
    }, locale)

    expect(outOfRange('height-centimetres', 'zh-tw')).toContain('100')
    expect(outOfRange('height-centimetres', 'zh-tw')).toContain('250')
    expect(outOfRange('height-centimetres', 'en')).toContain('250')
    expect(outOfRange('weight-kilograms', 'zh-tw')).toContain('500')
    expect(outOfRange('height-feet', 'zh-tw')).toContain('3.38')
    expect(outOfRange('height-feet', 'en')).toContain('2.42')
    expect(outOfRange('weight-pounds', 'zh-tw')).toContain('44.1')
    expect(outOfRange('weight-pounds', 'en')).toContain('1102.31')
  })

  it('tells someone how to correct the number they typed', () => {
    expect(bmiFieldErrorMessage({ measure: 'height', field: 'height-feet', code: 'invalid-number' }, 'zh-tw'))
      .toContain('整數')
    expect(bmiFieldErrorMessage({ measure: 'height', field: 'height-centimetres', code: 'invalid-number' }, 'zh-tw'))
      .toContain('兩位小數')
  })
})

/**
 * Section 6.3 of the decision record forbids claiming to diagnose or to treat.
 * A plain substring ban is impossible: the mandated caveats have to say the tool
 * is *not* a medical diagnosis. So the words that only ever appear in a denial
 * are checked for that denial, and the words that would always be a claim are
 * banned outright.
 */
describe('bmi health-claim boundary', () => {
  const forbiddenClaims = [
    '確診', '療程', '保證', '標準體重', '正常人', '很健康', '不健康',
    /\bcures?\b/i, /\btreatments?\b/i, /\bguarantees?\b/i, /\brisk-free\b/i, /\bhealthy person\b/i, /\bdiagnoses?\b/i,
  ]
  const claimsOnlyAllowedInDenial = ['診斷', '疾病風險', 'diagnosis', 'disease risk']
  const denials = ['不是', '不能', '不會', '不適用', '不用', '不做', '不提供', 'not ', 'no ', 'No ', 'never', 'cannot']

  it('never claims to diagnose, treat, or guarantee anything', () => {
    for (const text of everyVisibleString()) {
      for (const claim of forbiddenClaims) {
        expect(text, `文案不得出現 ${claim}`).not.toMatch(
          typeof claim === 'string' ? new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : claim,
        )
      }
    }
  })

  it('mentions diagnosis and disease risk only to rule them out', () => {
    for (const text of everyVisibleString()) {
      for (const sentence of text.split(/(?<=[。！？!?])/)) {
        for (const claim of claimsOnlyAllowedInDenial) {
          if (!sentence.includes(claim)) continue
          expect(denials.some(denial => sentence.includes(denial)), `「${sentence}」提到 ${claim} 時必須是否定語句`).toBe(true)
        }
      }
    }
  })
})
