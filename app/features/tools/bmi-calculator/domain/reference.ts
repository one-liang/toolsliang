import type { LocalizedCopy, PublishedToolDefinition } from '@/features/tools/catalog'

/**
 * Sourced constants for the BMI tool. This module carries decisions only: the
 * calculator, copy and page belong to the implementation ticket. Every value
 * here is traceable to docs/research/001-bmi-formula-and-health-sources.md,
 * and tests/bmi-reference.test.ts keeps the two from drifting apart.
 */

/** Names the reviewed edition of the Taiwan adult standard these values follow. */
export const bmiReferenceVersion = 'hpa-adult-2025-09-11'

/** The Taiwan adult standard applies from this age; the tool never asks for it. */
export const bmiAdultMinimumAgeYears = 18

export type BmiCategoryId = 'underweight' | 'healthy-weight' | 'overweight' | 'obese'

export interface BmiCategory {
  id: BmiCategoryId
  /** Inclusive lower bound; null when the category is unbounded below. */
  minInclusive: number | null
  /** Exclusive upper bound; null when the category is unbounded above. */
  maxExclusive: number | null
  /** Wording published by the source; it is not paraphrased. */
  name: LocalizedCopy
}

/**
 * The four contiguous categories of the Health Promotion Administration adult
 * standard. Obesity is not subdivided: the published standard stops at 肥胖,
 * and mixing a second document would make the version identifier meaningless.
 */
export const bmiCategories: readonly BmiCategory[] = [
  {
    id: 'underweight',
    minInclusive: null,
    maxExclusive: 18.5,
    name: { 'zh-tw': '體重過輕', en: 'Underweight' },
  },
  {
    id: 'healthy-weight',
    minInclusive: 18.5,
    maxExclusive: 24,
    name: { 'zh-tw': '健康體重', en: 'Healthy weight' },
  },
  {
    id: 'overweight',
    minInclusive: 24,
    maxExclusive: 27,
    name: { 'zh-tw': '體重過重', en: 'Overweight' },
  },
  {
    id: 'obese',
    minInclusive: 27,
    maxExclusive: null,
    name: { 'zh-tw': '肥胖', en: 'Obesity' },
  },
]

/**
 * Exact NIST factors. Imperial input is normalized to metres and kilograms
 * before the formula runs, so the 703 approximation is never used.
 */
export const bmiUnitFactors = {
  inchToMetre: 0.0254,
  footToMetre: 0.3048,
  poundToKilogram: 0.45359237,
} as const

/**
 * Typing guardrails, not medical bounds. Imperial input is validated after
 * conversion so both unit systems accept exactly the same people.
 */
export const bmiInputRange = {
  heightMetres: { min: 1, max: 2.5 },
  weightKilograms: { min: 20, max: 500 },
} as const

export const bmiPrecision = {
  displayFractionDigits: 1,
  /**
   * Absolute tolerance for threshold comparison. 47.36 kg at 1.6 m evaluates to
   * 18.499999999999996 in IEEE 754, and 18.5 is the published boundary.
   */
  comparisonTolerance: 1e-9,
  /**
   * Round to one decimal, then floor into the category when rounding would
   * reach its upper bound. Every boundary is expressible in one decimal, so the
   * displayed value always stays inside the category it is labelled with.
   */
  displayRule: 'round-then-floor-into-category',
} as const

export type BmiCaveatKey =
  | 'not-a-diagnosis'
  | 'adults-only'
  | 'body-composition'
  | 'pregnancy'
  | 'older-adults'
  | 'professional-advice'

/** Every caveat must appear next to the result, in both locales. */
export const bmiCaveatKeys: readonly BmiCaveatKey[] = [
  'not-a-diagnosis',
  'adults-only',
  'body-composition',
  'pregnancy',
  'older-adults',
  'professional-advice',
]

/** Ready to register as the tool's contentReview once the tool page exists. */
export const bmiContentReview: PublishedToolDefinition['contentReview'] = {
  reviewedAt: '2026-09-05',
  sourceEdition: {
    'zh-tw': '衛生福利部國民健康署「成人健康體位標準」（2025 年 9 月 11 日更新）',
    en: 'Health Promotion Administration, MOHW, “Adult healthy body standards” (updated September 11, 2025)',
  },
  sourceEffectiveAt: '2025-09-11',
  sources: [
    {
      title: {
        'zh-tw': '國民健康署：成人健康體位標準',
        en: 'Health Promotion Administration: Adult healthy body standards',
      },
      url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=542&pid=9737',
    },
    {
      title: {
        'zh-tw': '國民健康署：兒童與青少年生長身體質量指數(BMI)建議值',
        en: 'Health Promotion Administration: Recommended BMI values for children and adolescents',
      },
      url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=542&pid=9547',
    },
    {
      title: {
        'zh-tw': '國民健康署孕產婦關懷網站：孕期體重過輕或過重對母嬰健康都有影響',
        en: 'HPA maternal care site: Gestational weight and maternal-infant health',
      },
      url: 'https://mammy.hpa.gov.tw/Home/NewsKBContent?id=1919&type=01',
    },
    {
      title: {
        'zh-tw': '世界衛生組織：肥胖與過重',
        en: 'WHO: Obesity and overweight',
      },
      url: 'https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight',
    },
    {
      title: {
        'zh-tw': 'WHO 專家諮詢：亞洲族群適用的身體質量指數（Lancet 2004）',
        en: 'WHO expert consultation: Appropriate body-mass index for Asian populations (Lancet 2004)',
      },
      url: 'https://doi.org/10.1016/S0140-6736(03)15268-3',
    },
    {
      title: {
        'zh-tw': '美國疾病管制與預防中心：關於身體質量指數',
        en: 'CDC: About Body Mass Index (BMI)',
      },
      url: 'https://www.cdc.gov/bmi/about/index.html',
    },
    {
      title: {
        'zh-tw': 'NIST SP 811 附錄 B.9：單位換算係數',
        en: 'NIST SP 811 Appendix B.9: Conversion factors',
      },
      url: 'https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9',
    },
    {
      title: {
        'zh-tw': 'NIST Handbook 44 附錄 C：度量衡單位總表',
        en: 'NIST Handbook 44 Appendix C: General tables of units of measurement',
      },
      url: 'https://www.nist.gov/system/files/documents/2025/12/30/appc-26-HB44-20251222.pdf',
    },
  ],
}
