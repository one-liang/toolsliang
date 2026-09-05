import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bmiAdultMinimumAgeYears,
  bmiCaveatKeys,
  bmiCategories,
  bmiContentReview,
  bmiInputRange,
  bmiPrecision,
  bmiReferenceVersion,
  bmiUnitFactors,
} from '@/features/tools/bmi-calculator/domain/reference'

const decisionRecord = readFileSync(
  resolve(process.cwd(), 'docs/research/001-bmi-formula-and-health-sources.md'),
  'utf8',
)

describe('BMI 分級', () => {
  it('採用國民健康署成人健康體位標準的界線', () => {
    expect(bmiCategories.map(category => [category.id, category.minInclusive, category.maxExclusive])).toEqual([
      ['underweight', null, 18.5],
      ['healthy-weight', 18.5, 24],
      ['overweight', 24, 27],
      ['obese', 27, null],
    ])
  })

  it('沒有缺口或重疊，且兩端沒有界線', () => {
    const [first] = bmiCategories
    const last = bmiCategories[bmiCategories.length - 1]

    expect(first?.minInclusive).toBeNull()
    expect(last?.maxExclusive).toBeNull()
    bmiCategories.slice(1).forEach((category, index) => {
      expect(category.minInclusive).toBe(bmiCategories[index]?.maxExclusive)
    })
  })

  it('每個界線都能以一位小數表示，顯示規則才不會與分級矛盾', () => {
    bmiCategories.forEach((category) => {
      const bounds = [category.minInclusive, category.maxExclusive].filter(bound => bound !== null)
      bounds.forEach(bound => expect(Number.isInteger(bound * 10)).toBe(true))
    })
  })

  it('雙語名稱完整且只適用成人', () => {
    bmiCategories.forEach((category) => {
      expect(category.name['zh-tw'].length).toBeGreaterThan(0)
      expect(category.name.en.length).toBeGreaterThan(0)
    })
    expect(bmiAdultMinimumAgeYears).toBe(18)
  })
})

describe('BMI 換算與精度', () => {
  it('使用 NIST 定義的精確換算係數，而非 703 近似值', () => {
    expect(bmiUnitFactors.inchToMetre).toBe(0.0254)
    expect(bmiUnitFactors.footToMetre).toBe(0.3048)
    expect(bmiUnitFactors.poundToKilogram).toBe(0.45359237)
    expect(bmiUnitFactors.poundToKilogram / bmiUnitFactors.inchToMetre ** 2).toBeCloseTo(703.06958, 5)
  })

  it('輸入範圍是成人的合理護欄', () => {
    expect(bmiInputRange.heightMetres.min).toBeLessThan(bmiInputRange.heightMetres.max)
    expect(bmiInputRange.weightKilograms.min).toBeLessThan(bmiInputRange.weightKilograms.max)
    expect(bmiInputRange.heightMetres).toEqual({ min: 1, max: 2.5 })
    expect(bmiInputRange.weightKilograms).toEqual({ min: 20, max: 500 })
  })

  it('顯示與比較規則可吸收浮點誤差', () => {
    expect(bmiPrecision.displayFractionDigits).toBe(1)
    expect(bmiPrecision.comparisonTolerance).toBeGreaterThan(0)
    expect(bmiPrecision.comparisonTolerance).toBeLessThan(0.0001)
    expect(bmiPrecision.displayRule).toBe('round-then-floor-into-category')
  })

  it('容差足以修正界線案例的 IEEE754 誤差', () => {
    const boundaryBmi = 47.36 / (1.6 * 1.6)

    expect(boundaryBmi).toBeLessThan(18.5)
    expect(boundaryBmi).toBeGreaterThanOrEqual(18.5 - bmiPrecision.comparisonTolerance)
  })
})

describe('BMI 健康資訊邊界', () => {
  it('保留實作必須呈現的免責主題且不重複', () => {
    expect(new Set(bmiCaveatKeys).size).toBe(bmiCaveatKeys.length)
    expect(bmiCaveatKeys).toEqual(expect.arrayContaining([
      'not-a-diagnosis',
      'adults-only',
      'body-composition',
      'pregnancy',
      'older-adults',
      'professional-advice',
    ]))
  })

  it('來源紀錄符合工具註冊契約並可追溯', () => {
    expect(bmiContentReview.sourceEffectiveAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(bmiContentReview.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(bmiReferenceVersion).toContain(bmiContentReview.sourceEffectiveAt)
    expect(bmiContentReview.sources.length).toBeGreaterThanOrEqual(4)
    bmiContentReview.sources.forEach((source) => {
      expect(source.url.startsWith('https://')).toBe(true)
      expect(source.title['zh-tw'].length).toBeGreaterThan(0)
      expect(source.title.en.length).toBeGreaterThan(0)
    })
    expect(bmiContentReview.sources.map(source => source.url)).toContain(
      'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=542&pid=9737',
    )
  })
})

describe('BMI 決策紀錄', () => {
  it('與程式碼引用的版本、來源與免責主題一致', () => {
    expect(decisionRecord).toContain(bmiReferenceVersion)
    bmiContentReview.sources.forEach(source => expect(decisionRecord).toContain(source.url))
    bmiCaveatKeys.forEach(key => expect(decisionRecord).toContain(key))
  })

  it('記錄公制與英制的代表與邊界案例', () => {
    ['18.5', '24', '27', '0.45359237', '0.0254'].forEach(value => expect(decisionRecord).toContain(value))
  })
})
