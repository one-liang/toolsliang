import type { LocalizedCopy } from '@/features/tools/catalog'

/**
 * Measurement decisions for the BMI tool: categories, unit factors, accepted
 * ranges and precision. The calculator, copy and page belong to the
 * implementation ticket; this module only carries what was researched.
 * Every value is traceable to docs/research/001-bmi-formula-and-health-sources.md,
 * and tests/bmi-reference.test.ts keeps the two from drifting apart.
 */

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
 * and mixing a second document would make the source version meaningless.
 */
export const bmiCategories = [
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
] as const satisfies readonly BmiCategory[]

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
} as const
