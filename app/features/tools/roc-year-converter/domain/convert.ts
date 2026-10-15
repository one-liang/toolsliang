/**
 * The arithmetic of the Republic of China era, kept free of any wording so the
 * boundaries can be asserted without a page: ROC year 1 is the Gregorian year
 * 1912, a Gregorian year is the ROC year plus 1911, and the years before 1912
 * count backwards as "N years before the ROC era". There is no ROC year 0 —
 * year 1 follows "1 year before" directly, so no input and no table row can
 * ever name one.
 */

/** Gregorian year = ROC year + this offset. */
export const rocYearOffset = 1911
/** The Gregorian year the ROC era starts in: ROC year 1. */
export const rocFirstGregorianYear = rocYearOffset + 1

/**
 * Four-digit Gregorian years, and the ROC years they reach. The bound is not a
 * rule of the era; it keeps every answer a year a person would write down.
 */
export const rocYearSupportedRange = {
  gregorian: { min: 1, max: 9999 },
  roc: { min: 1, max: 9999 - rocYearOffset },
} as const

export type RocYearDirection = 'roc-to-gregorian' | 'gregorian-to-roc'

/**
 * A year as the ROC era names it. `before-roc` years count backwards from the
 * year before ROC year 1, so 1911 is 1 year before and 1910 is 2 years before.
 */
export type RocEraYear =
  | { era: 'roc', year: number }
  | { era: 'before-roc', yearsBefore: number }

export interface RocYearPair {
  gregorian: number
  roc: RocEraYear
}

export type RocYearInputErrorCode =
  | 'empty'
  | 'not-a-number'
  | 'not-whole'
  | 'roc-zero'
  | 'below-range'
  | 'above-range'

export type RocYearLookup =
  | { state: 'ready', direction: RocYearDirection, pair: RocYearPair }
  | { state: 'error', direction: RocYearDirection, code: RocYearInputErrorCode }

export function gregorianToRoc(gregorian: number): RocEraYear {
  return gregorian >= rocFirstGregorianYear
    ? { era: 'roc', year: gregorian - rocYearOffset }
    : { era: 'before-roc', yearsBefore: rocFirstGregorianYear - gregorian }
}

export function rocToGregorian(year: RocEraYear): number {
  return year.era === 'roc'
    ? year.year + rocYearOffset
    : rocFirstGregorianYear - year.yearsBefore
}

/**
 * Reads what a visitor typed for one direction. Half-width and full-width
 * digits are both accepted, because a Chinese input method types the second
 * kind. A sign and a decimal point are read only so the answer can say why the
 * value is refused rather than calling it unreadable.
 */
export function lookUpYear(text: string, direction: RocYearDirection): RocYearLookup {
  const normalized = normalizeYearText(text)
  const fail = (code: RocYearInputErrorCode): RocYearLookup => ({ state: 'error', direction, code })

  if (!normalized) return fail('empty')
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return fail('not-a-number')
  if (normalized.includes('.') && !/\.0+$/.test(normalized)) return fail('not-whole')

  const value = Math.trunc(Number(normalized))

  if (direction === 'roc-to-gregorian') {
    if (value === 0) return fail('roc-zero')
    const { min, max } = rocYearSupportedRange.roc
    if (value < min) return fail('below-range')
    if (value > max) return fail('above-range')

    const roc: RocEraYear = { era: 'roc', year: value }
    return { state: 'ready', direction, pair: { gregorian: rocToGregorian(roc), roc } }
  }

  const { min, max } = rocYearSupportedRange.gregorian
  if (value < min) return fail('below-range')
  if (value > max) return fail('above-range')

  return { state: 'ready', direction, pair: { gregorian: value, roc: gregorianToRoc(value) } }
}

/**
 * Every row of the comparison table: ROC year 1 up to ten years after the
 * device's current year. The current year is passed in, never read here, so a
 * table always describes the visitor's own clock and a test can pin it.
 */
export function rocYearTableRows(currentGregorianYear: number, yearsAhead = 10): RocYearPair[] {
  const last = Math.max(currentGregorianYear + yearsAhead, rocFirstGregorianYear)
  const rows: RocYearPair[] = []

  for (let gregorian = rocFirstGregorianYear; gregorian <= last; gregorian += 1) {
    rows.push({ gregorian, roc: { era: 'roc', year: gregorian - rocYearOffset } })
  }

  return rows
}

function normalizeYearText(value: string) {
  return value
    .replace(/[０-９]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
    .replace(/．/g, '.')
    .replace(/＋/g, '+')
    .replace(/[－−]/g, '-')
    .trim()
}
