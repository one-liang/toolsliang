import { describe, expect, it } from 'vitest'
import {
  bmiAdultMinimumAgeYears,
  bmiCategories,
  bmiInputRange,
  bmiPrecision,
  bmiUnitFactors,
  type BmiCategoryId,
} from '@/features/tools/bmi-calculator/domain/reference'
import {
  bmiCaveatKeys,
  bmiContentReview,
  bmiReferenceVersion,
} from '@/features/tools/bmi-calculator/domain/sources'
import {
  bmiDecisionRecord as decisionRecord,
  parseImperialVectors,
  parseMetricVectors,
} from './support/bmi-decision-record'

interface DocumentedVector {
  heightMetres: number
  weightKilograms: number
  documentedBmi: number
  documentedDisplay: string
  documentedCategory: string
}

/** The published formula divides twice, so the vectors have to as well. */
function calculateBmi({ heightMetres, weightKilograms }: DocumentedVector) {
  return weightKilograms / heightMetres / heightMetres
}

function resolveCategory(bmi: number) {
  return bmiCategories.find(category =>
    (category.minInclusive === null || bmi >= category.minInclusive - bmiPrecision.comparisonTolerance)
    && (category.maxExclusive === null || bmi < category.maxExclusive - bmiPrecision.comparisonTolerance))
}

/** Section 5.4: round to one decimal, then floor back into the category. */
function formatBmi(bmi: number, maxExclusive: number | null) {
  const scale = 10 ** bmiPrecision.displayFractionDigits
  const rounded = Math.floor(bmi * scale + 0.5) / scale
  const display = maxExclusive !== null && rounded >= maxExclusive ? Math.floor(bmi * scale) / scale : rounded

  return display.toFixed(bmiPrecision.displayFractionDigits)
}

describe('bmi categories', () => {
  it('follows the Health Promotion Administration adult standard', () => {
    expect(bmiCategories.map(category => [category.id, category.minInclusive, category.maxExclusive])).toEqual([
      ['underweight', null, 18.5],
      ['healthy-weight', 18.5, 24],
      ['overweight', 24, 27],
      ['obese', 27, null],
    ])
  })

  it('leaves no gap or overlap and stays unbounded at both ends', () => {
    const [first] = bmiCategories
    const last = bmiCategories[bmiCategories.length - 1]

    expect(first?.minInclusive).toBeNull()
    expect(last?.maxExclusive).toBeNull()
    bmiCategories.slice(1).forEach((category, index) => {
      expect(category.minInclusive).toBe(bmiCategories[index]?.maxExclusive)
    })
  })

  it('keeps every boundary expressible in one decimal, which the display rule relies on', () => {
    bmiCategories.forEach((category) => {
      [category.minInclusive, category.maxExclusive]
        .filter(bound => bound !== null)
        .forEach(bound => expect(Number.isInteger(bound * 10)).toBe(true))
    })
  })

  it('publishes bilingual source wording and applies to adults only', () => {
    bmiCategories.forEach((category) => {
      expect(category.name['zh-tw'].length).toBeGreaterThan(0)
      expect(category.name.en.length).toBeGreaterThan(0)
      expect(decisionRecord).toContain(category.name['zh-tw'])
    })
    expect(bmiAdultMinimumAgeYears).toBe(18)
  })
})

describe('bmi conversion and precision', () => {
  it('uses the exact NIST factors instead of the 703 approximation', () => {
    expect(bmiUnitFactors.inchToMetre).toBe(0.0254)
    expect(bmiUnitFactors.footToMetre).toBe(0.3048)
    expect(bmiUnitFactors.poundToKilogram).toBe(0.45359237)
    expect(bmiUnitFactors.poundToKilogram / bmiUnitFactors.inchToMetre ** 2).toBeCloseTo(703.06958, 5)
  })

  it('guards adult input ranges in metric units', () => {
    expect(bmiInputRange.heightMetres).toEqual({ min: 1, max: 2.5 })
    expect(bmiInputRange.weightKilograms).toEqual({ min: 20, max: 500 })
  })

  it('tolerates the floating point error of a boundary case', () => {
    const boundaryBmi = 47.36 / 1.6 / 1.6

    expect(boundaryBmi).toBeLessThan(18.5)
    expect(boundaryBmi).toBeGreaterThanOrEqual(18.5 - bmiPrecision.comparisonTolerance)
    expect(bmiPrecision.comparisonTolerance).toBeLessThan(0.0001)
  })
})

describe('bmi health boundary', () => {
  it('keeps the caveats the implementation has to show, without duplicates', () => {
    expect(new Set(bmiCaveatKeys).size).toBe(bmiCaveatKeys.length)
    expect(bmiCaveatKeys).toEqual([
      'not-a-diagnosis',
      'adults-only',
      'body-composition',
      'pregnancy',
      'older-adults',
      'professional-advice',
    ])
  })

  it('records traceable sources that satisfy the tool registration contract', () => {
    expect(bmiContentReview.sourceEffectiveAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(bmiContentReview.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(bmiReferenceVersion).toContain(bmiContentReview.sourceEffectiveAt)
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

describe('bmi decision record', () => {
  it('cites the same version, sources and caveats as the modules', () => {
    expect(decisionRecord).toContain(bmiReferenceVersion)
    bmiContentReview.sources.forEach(source => expect(decisionRecord).toContain(source.url))
    bmiCaveatKeys.forEach(key => expect(decisionRecord).toContain(key))
  })

  it('states every category boundary the modules encode', () => {
    expect(decisionRecord).toContain('BMI < 18.5')
    expect(decisionRecord).toContain('18.5 ≦ BMI < 24')
    expect(decisionRecord).toContain('24 ≦ BMI < 27')
    expect(decisionRecord).toContain('BMI ≧ 27')
  })

  it.each([
    ['metric', parseMetricVectors()],
    ['imperial', parseImperialVectors()],
  ])('recomputes every documented %s vector', (_units, vectors) => {
    expect(vectors.length).toBeGreaterThan(0)
    vectors.forEach((vector) => {
      const bmi = calculateBmi(vector)
      const category = resolveCategory(bmi)

      expect(bmi).toBeCloseTo(vector.documentedBmi, 6)
      expect(category?.id).toBe(vector.documentedCategory as BmiCategoryId)
      expect(formatBmi(bmi, category?.maxExclusive ?? null)).toBe(vector.documentedDisplay)
    })
  })

  it('covers both unit systems and the guarded range in its vectors', () => {
    const metric = parseMetricVectors()

    expect(metric.length).toBeGreaterThanOrEqual(10)
    expect(parseImperialVectors().length).toBeGreaterThanOrEqual(3)
    expect(metric.some(vector => vector.heightMetres === bmiInputRange.heightMetres.min)).toBe(true)
    expect(metric.some(vector => vector.heightMetres === bmiInputRange.heightMetres.max)).toBe(true)
    expect(metric.some(vector => vector.weightKilograms === bmiInputRange.weightKilograms.min)).toBe(true)
    expect(metric.some(vector => vector.weightKilograms === bmiInputRange.weightKilograms.max)).toBe(true)
  })
})
