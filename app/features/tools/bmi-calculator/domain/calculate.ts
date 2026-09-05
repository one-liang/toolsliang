import { bmiCategories, bmiInputRange, bmiPrecision, bmiUnitFactors, type BmiCategory } from './reference'

/**
 * The BMI calculator itself: raw field text in, a category and a display value
 * out. It holds no state, reads nothing from the browser and returns everything
 * the workspace needs to explain itself, so height and weight never have to
 * leave the call. Every rule here is fixed by
 * docs/research/001-bmi-formula-and-health-sources.md.
 */

export type BmiUnitSystem = 'metric' | 'imperial'
/** Height and weight are validated as measurements, not as individual controls. */
export type BmiMeasure = 'height' | 'weight'
export type BmiFieldId =
  | 'height-centimetres'
  | 'weight-kilograms'
  | 'height-feet'
  | 'height-inches'
  | 'weight-pounds'
export type BmiFieldErrorCode = 'missing' | 'invalid-number' | 'non-positive' | 'out-of-range'

export interface BmiFieldError {
  measure: BmiMeasure
  field: BmiFieldId
  code: BmiFieldErrorCode
}

export interface BmiMeasurementInput {
  unitSystem: BmiUnitSystem
  values: Partial<Record<BmiFieldId, string>>
}

export type BmiEvaluation =
  | { state: 'empty' }
  | { state: 'invalid', errors: BmiFieldError[] }
  | { state: 'ready', bmi: number, display: string, category: BmiCategory }

export const bmiFieldsByUnitSystem = {
  metric: ['height-centimetres', 'weight-kilograms'],
  imperial: ['height-feet', 'height-inches', 'weight-pounds'],
} as const satisfies Record<BmiUnitSystem, readonly BmiFieldId[]>

const INCHES_PER_FOOT = 12

/**
 * The same guarded range in the units each field is typed in, so an error
 * message can quote a bound the field will actually accept. Imperial bounds are
 * rounded inward: a visitor who types the number they are shown is inside the
 * range, never one hundredth of an inch outside it.
 */
export const bmiSupportedRange = {
  metric: {
    heightCentimetres: { min: bmiInputRange.heightMetres.min * 100, max: bmiInputRange.heightMetres.max * 100 },
    weightKilograms: { ...bmiInputRange.weightKilograms },
  },
  imperial: {
    height: {
      ...toFeetAndInches(ceilTo(bmiInputRange.heightMetres.min / bmiUnitFactors.inchToMetre, 2), 'min'),
      ...toFeetAndInches(floorTo(bmiInputRange.heightMetres.max / bmiUnitFactors.inchToMetre, 2), 'max'),
    },
    weightPounds: {
      min: ceilTo(bmiInputRange.weightKilograms.min / bmiUnitFactors.poundToKilogram, 2),
      max: floorTo(bmiInputRange.weightKilograms.max / bmiUnitFactors.poundToKilogram, 2),
    },
  },
}

export function evaluateBmi(input: BmiMeasurementInput): BmiEvaluation {
  const read = (field: BmiFieldId) => normalizeNumericText(input.values[field] ?? '')
  const fields = bmiFieldsByUnitSystem[input.unitSystem]
  if (fields.every(field => !read(field))) return { state: 'empty' }

  const height = input.unitSystem === 'metric' ? readMetricHeight(read) : readImperialHeight(read)
  const weight = input.unitSystem === 'metric' ? readMetricWeight(read) : readImperialWeight(read)
  const errors = [...height.errors, ...weight.errors]
  if (errors.length) return { state: 'invalid', errors }

  const bmi = weight.kilograms! / height.metres! / height.metres!
  const category = resolveCategory(bmi)

  return { state: 'ready', bmi, display: formatDisplay(bmi, category), category }
}

interface MeasurementReading {
  errors: BmiFieldError[]
  metres?: number
  kilograms?: number
}

type TextReader = (field: BmiFieldId) => string

function readMetricHeight(read: TextReader): MeasurementReading {
  const centimetres = readNumber(read('height-centimetres'), { measure: 'height', field: 'height-centimetres' })
  if ('error' in centimetres) return { errors: [centimetres.error] }

  return guardHeight(centimetres.value / 100, 'height-centimetres')
}

function readMetricWeight(read: TextReader): MeasurementReading {
  const kilograms = readNumber(read('weight-kilograms'), { measure: 'weight', field: 'weight-kilograms' })
  if ('error' in kilograms) return { errors: [kilograms.error] }

  return guardWeight(kilograms.value, 'weight-kilograms')
}

/**
 * Feet carry the height, so blank inches means a whole number of feet rather
 * than an unfinished entry. Inches beyond twelve are still converted: section
 * 5.1 of the decision record rules out judging whether a combination looks
 * sensible.
 */
function readImperialHeight(read: TextReader): MeasurementReading {
  const feet = readNumber(read('height-feet'), { measure: 'height', field: 'height-feet' })
  if ('error' in feet) return { errors: [feet.error] }
  if (!Number.isInteger(feet.value)) {
    return { errors: [{ measure: 'height', field: 'height-feet', code: 'invalid-number' }] }
  }

  const inchesText = read('height-inches')
  const inches = inchesText
    ? readNumber(inchesText, { measure: 'height', field: 'height-inches' }, { allowZero: true })
    : { value: 0 }
  if ('error' in inches) return { errors: [inches.error] }

  const metres = feet.value * bmiUnitFactors.footToMetre + inches.value * bmiUnitFactors.inchToMetre
  return guardHeight(metres, 'height-feet')
}

function readImperialWeight(read: TextReader): MeasurementReading {
  const pounds = readNumber(read('weight-pounds'), { measure: 'weight', field: 'weight-pounds' })
  if ('error' in pounds) return { errors: [pounds.error] }

  return guardWeight(pounds.value * bmiUnitFactors.poundToKilogram, 'weight-pounds')
}

/** An out-of-range composite height is reported on the field the message sits under. */
function guardHeight(metres: number, field: BmiFieldId): MeasurementReading {
  const { min, max } = bmiInputRange.heightMetres
  if (metres < min || metres > max) return { errors: [{ measure: 'height', field, code: 'out-of-range' }] }

  return { errors: [], metres }
}

function guardWeight(kilograms: number, field: BmiFieldId): MeasurementReading {
  const { min, max } = bmiInputRange.weightKilograms
  if (kilograms < min || kilograms > max) return { errors: [{ measure: 'weight', field, code: 'out-of-range' }] }

  return { errors: [], kilograms }
}

/**
 * Accepts what section 5.1 accepts and nothing else: half-width or full-width
 * digits, at most two decimal places, no exponent, no grouping separator. A
 * sign is read so that zero and negative values can be answered with the reason
 * they are refused instead of a generic format complaint.
 */
function readNumber(
  text: string,
  origin: { measure: BmiMeasure, field: BmiFieldId },
  options: { allowZero?: boolean } = {},
): { value: number } | { error: BmiFieldError } {
  if (!text) return { error: { ...origin, code: 'missing' } }
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(text)) return { error: { ...origin, code: 'invalid-number' } }

  const value = Number(text)
  if (options.allowZero ? value < 0 : value <= 0) return { error: { ...origin, code: 'non-positive' } }

  return { value }
}

function normalizeNumericText(value: string) {
  return value
    .replace(/[０-９]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
    .replace(/．/g, '.')
    .replace(/＋/g, '+')
    .replace(/－/g, '-')
    .trim()
}

/**
 * Section 5.3: compare at full precision with an absolute tolerance, so a value
 * that is mathematically on a boundary is not pushed into the lower category by
 * IEEE 754 representation error.
 */
function resolveCategory(bmi: number): BmiCategory {
  const { comparisonTolerance } = bmiPrecision
  const category = bmiCategories.find(candidate =>
    (candidate.minInclusive === null || bmi >= candidate.minInclusive - comparisonTolerance)
    && (candidate.maxExclusive === null || bmi < candidate.maxExclusive - comparisonTolerance))

  // The registered categories are contiguous and unbounded at both ends.
  return category ?? bmiCategories[bmiCategories.length - 1]!
}

/**
 * Section 5.4: round to one decimal, then fall back to truncation when rounding
 * would show a number that reads as the next category. The category is decided
 * by the source; the displayed number follows the category.
 */
function formatDisplay(bmi: number, category: BmiCategory) {
  const scale = 10 ** bmiPrecision.displayFractionDigits
  const rounded = Math.floor(bmi * scale + 0.5) / scale
  const display = category.maxExclusive !== null && rounded >= category.maxExclusive
    ? Math.floor(bmi * scale) / scale
    : rounded

  return display.toFixed(bmiPrecision.displayFractionDigits)
}

function toFeetAndInches(totalInches: number, bound: 'min' | 'max') {
  const feet = Math.floor(totalInches / INCHES_PER_FOOT)

  return bound === 'min'
    ? { minFeet: feet, minInches: roundTo(totalInches - feet * INCHES_PER_FOOT, 2) }
    : { maxFeet: feet, maxInches: roundTo(totalInches - feet * INCHES_PER_FOOT, 2) }
}

function ceilTo(value: number, digits: number) {
  return Math.ceil(roundTo(value, digits + 4) * 10 ** digits) / 10 ** digits
}

function floorTo(value: number, digits: number) {
  return Math.floor(roundTo(value, digits + 4) * 10 ** digits) / 10 ** digits
}

function roundTo(value: number, digits: number) {
  return Number(value.toFixed(digits))
}
