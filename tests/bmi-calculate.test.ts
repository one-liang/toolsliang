import { describe, expect, it } from 'vitest'
import {
  bmiFieldsByUnitSystem,
  bmiSupportedRange,
  evaluateBmi,
  type BmiFieldError,
  type BmiMeasurementInput,
} from '@/features/tools/bmi-calculator/domain/calculate'
import { parseImperialVectors, parseMetricVectors } from './support/bmi-decision-record'

function metric(heightCentimetres: string, weightKilograms: string): BmiMeasurementInput {
  return {
    unitSystem: 'metric',
    values: { 'height-centimetres': heightCentimetres, 'weight-kilograms': weightKilograms },
  }
}

function imperial(feet: string, inches: string, pounds: string): BmiMeasurementInput {
  return {
    unitSystem: 'imperial',
    values: { 'height-feet': feet, 'height-inches': inches, 'weight-pounds': pounds },
  }
}

function errorsOf(input: BmiMeasurementInput): BmiFieldError[] {
  const evaluation = evaluateBmi(input)
  return evaluation.state === 'invalid' ? evaluation.errors : []
}

describe('bmi calculator', () => {
  it('reproduces every documented metric vector', () => {
    const vectors = parseMetricVectors()
    expect(vectors.length).toBeGreaterThanOrEqual(10)

    for (const vector of vectors) {
      const evaluation = evaluateBmi(metric(String(vector.heightCentimetres), String(vector.weightKilograms)))

      expect(evaluation.state, `${vector.heightCentimetres}cm / ${vector.weightKilograms}kg 應可計算`).toBe('ready')
      if (evaluation.state !== 'ready') continue
      expect(evaluation.bmi).toBeCloseTo(vector.documentedBmi, 6)
      expect(evaluation.display).toBe(vector.documentedDisplay)
      expect(evaluation.category.id).toBe(vector.documentedCategory)
    }
  })

  it('reproduces every documented imperial vector through the exact conversion factors', () => {
    const vectors = parseImperialVectors()
    expect(vectors.length).toBeGreaterThanOrEqual(3)

    for (const vector of vectors) {
      const evaluation = evaluateBmi(imperial(String(vector.feet), String(vector.inches), String(vector.pounds)))

      expect(evaluation.state, `${vector.feet}ft ${vector.inches}in / ${vector.pounds}lb 應可計算`).toBe('ready')
      if (evaluation.state !== 'ready') continue
      expect(evaluation.bmi).toBeCloseTo(vector.documentedBmi, 6)
      expect(evaluation.display).toBe(vector.documentedDisplay)
      expect(evaluation.category.id).toBe(vector.documentedCategory)
    }
  })

  it('names the fields each unit system asks for', () => {
    expect(bmiFieldsByUnitSystem.metric).toEqual(['height-centimetres', 'weight-kilograms'])
    expect(bmiFieldsByUnitSystem.imperial).toEqual(['height-feet', 'height-inches', 'weight-pounds'])
  })

  it('treats an untouched form as empty rather than as an error', () => {
    expect(evaluateBmi(metric('', ''))).toEqual({ state: 'empty' })
    expect(evaluateBmi(imperial('', '', ''))).toEqual({ state: 'empty' })
    expect(evaluateBmi(metric('  ', ' '))).toEqual({ state: 'empty' })
  })

  it('reads only the active unit system', () => {
    expect(evaluateBmi({ unitSystem: 'metric', values: { 'height-feet': '5', 'weight-pounds': '160' } }))
      .toEqual({ state: 'empty' })
  })

  it('names the measurement that is still missing', () => {
    expect(errorsOf(metric('170', ''))).toEqual([
      { measure: 'weight', field: 'weight-kilograms', code: 'missing' },
    ])
    expect(errorsOf(imperial('', '', '160'))).toEqual([
      { measure: 'height', field: 'height-feet', code: 'missing' },
    ])
  })

  it('treats blank inches as zero, because whole feet is a complete height', () => {
    const evaluation = evaluateBmi(imperial('5', '', '100'))

    expect(evaluation.state).toBe('ready')
    if (evaluation.state !== 'ready') return
    expect(evaluation.display).toBe('19.5')
    expect(evaluation.category.id).toBe('healthy-weight')
  })

  it('accepts full-width digits and surrounding whitespace', () => {
    const evaluation = evaluateBmi(metric('　１７０ ', ' ６５'))

    expect(evaluation.state).toBe('ready')
    if (evaluation.state !== 'ready') return
    expect(evaluation.display).toBe('22.5')
  })

  it('rejects number formats the decision record does not accept', () => {
    for (const height of ['1e2', '1,70', '170.005', '17o', '170.', '1.7.0', '170%']) {
      expect(errorsOf(metric(height, '65')), `${height} 應被視為格式錯誤`).toEqual([
        { measure: 'height', field: 'height-centimetres', code: 'invalid-number' },
      ])
    }
  })

  it('requires whole feet', () => {
    expect(errorsOf(imperial('5.5', '0', '160'))).toEqual([
      { measure: 'height', field: 'height-feet', code: 'invalid-number' },
    ])
  })

  it('separates zero and negative values from unreadable ones', () => {
    expect(errorsOf(metric('0', '65'))).toEqual([
      { measure: 'height', field: 'height-centimetres', code: 'non-positive' },
    ])
    expect(errorsOf(metric('170', '-65'))).toEqual([
      { measure: 'weight', field: 'weight-kilograms', code: 'non-positive' },
    ])
  })

  it('guards the documented metric range on both sides', () => {
    expect(evaluateBmi(metric('100', '20')).state).toBe('ready')
    expect(evaluateBmi(metric('250', '500')).state).toBe('ready')
    expect(errorsOf(metric('99.99', '65'))).toEqual([
      { measure: 'height', field: 'height-centimetres', code: 'out-of-range' },
    ])
    expect(errorsOf(metric('250.01', '65'))).toEqual([
      { measure: 'height', field: 'height-centimetres', code: 'out-of-range' },
    ])
    expect(errorsOf(metric('170', '19.99'))).toEqual([
      { measure: 'weight', field: 'weight-kilograms', code: 'out-of-range' },
    ])
    expect(errorsOf(metric('170', '500.01'))).toEqual([
      { measure: 'weight', field: 'weight-kilograms', code: 'out-of-range' },
    ])
  })

  it('guards imperial input against the same range after conversion', () => {
    expect(evaluateBmi(imperial('3', '3.38', '150')).state).toBe('ready')
    expect(evaluateBmi(imperial('8', '2.42', '150')).state).toBe('ready')
    expect(errorsOf(imperial('3', '3.37', '150'))).toEqual([
      { measure: 'height', field: 'height-feet', code: 'out-of-range' },
    ])
    expect(errorsOf(imperial('8', '2.43', '150'))).toEqual([
      { measure: 'height', field: 'height-feet', code: 'out-of-range' },
    ])
    expect(errorsOf(imperial('5', '9', '44.09'))).toEqual([
      { measure: 'weight', field: 'weight-pounds', code: 'out-of-range' },
    ])
    expect(errorsOf(imperial('5', '9', '1102.32'))).toEqual([
      { measure: 'weight', field: 'weight-pounds', code: 'out-of-range' },
    ])
  })

  it('does not judge whether a combination is plausible', () => {
    expect(evaluateBmi(imperial('5', '15', '150')).state, '英吋欄不做跨欄位合理性判斷').toBe('ready')
  })

  it('reports every unusable measurement in one pass', () => {
    expect(errorsOf(metric('abc', '0'))).toEqual([
      { measure: 'height', field: 'height-centimetres', code: 'invalid-number' },
      { measure: 'weight', field: 'weight-kilograms', code: 'non-positive' },
    ])
  })

  it('publishes the supported ranges its messages quote', () => {
    expect(bmiSupportedRange.metric).toEqual({
      heightCentimetres: { min: 100, max: 250 },
      weightKilograms: { min: 20, max: 500 },
    })
    expect(bmiSupportedRange.imperial).toEqual({
      height: { minFeet: 3, minInches: 3.38, maxFeet: 8, maxInches: 2.42 },
      weightPounds: { min: 44.1, max: 1102.31 },
    })
  })
})
