import type { LocaleCode, LocalizedCopy } from '@/features/tools/catalog'
import { copy } from '@/features/tools/catalog'
import { evaluateBmi, type BmiEvaluation } from '@/features/tools/bmi-calculator/domain/calculate'
import { convertNtd } from '@/features/tools/ntd-uppercase/domain/convert'
import { wheelSlices, wheelStopRotation } from '@/features/tools/random-picker/domain/wheel'
import { buildCalendarYear, getMonthGrid, type CalendarDay } from '@/features/tools/taiwan-calendar/domain/calendar'
import type { CalendarYearDataset } from '@/features/tools/taiwan-calendar/domain/dataset'
import type { OfficialDayKind } from '@/features/tools/taiwan-calendar/domain/reference'
import calendar2026 from '@/features/tools/taiwan-calendar/data/2026.json'

/**
 * What the landing page shows each tool producing. Every value is computed by
 * the tool's own domain module from a fixed example input, so a rule change in
 * a tool changes its demonstration too, and the page never states an output
 * the tool would not give.
 */

export const ntdDemoInput = { amount: '128500', purpose: 'cheque' } as const
export const bmiDemoInput = { heightCentimetres: '170', weightKilograms: '65' } as const
export const calendarDemoMonth = { year: 2026, month: 2 } as const

const OFF_KINDS: ReadonlySet<OfficialDayKind> = new Set(['weekend', 'national-holiday', 'substitute-holiday', 'bridge-holiday'])

const breakNames: Record<string, LocalizedCopy> = {
  'spring-festival': { 'zh-tw': '春節', en: 'Lunar New Year' },
}

export interface NtdDemo {
  amount: string
  wording: string
}

export function getNtdDemo(): NtdDemo {
  const outcome = convertNtd(ntdDemoInput.amount, ntdDemoInput.purpose)
  if (outcome.state !== 'ready') throw new Error(`NTD demo input is rejected: ${outcome.code}`)

  return { amount: outcome.conversion.normalized, wording: outcome.conversion.wording }
}

export interface BmiDemo {
  display: string
  categoryName: string
  /** The calculator's own result, which the demo shows in the calculator's own panel (#92). */
  result: Extract<BmiEvaluation, { state: 'ready' }>
}

export function getBmiDemo(locale: LocaleCode): BmiDemo {
  const evaluation = evaluateBmi({
    unitSystem: 'metric',
    values: {
      'height-centimetres': bmiDemoInput.heightCentimetres,
      'weight-kilograms': bmiDemoInput.weightKilograms,
    },
  })
  if (evaluation.state !== 'ready') throw new Error('BMI demo input is rejected')

  return {
    display: evaluation.display,
    categoryName: copy(evaluation.category.name, locale),
    result: evaluation,
  }
}

export interface CalendarDemoCell {
  date: string
  day: number
  off: boolean
  /** Inside the month's longest run of days off. */
  inBreak: boolean
}

export interface CalendarDemo {
  year: number
  month: number
  weeks: Array<Array<CalendarDemoCell | null>>
  breakLength: number
  /** The holiday id the run is named after, when the run has one. */
  breakHoliday: string | null
}

export function getCalendarDemo(): CalendarDemo {
  const year = buildCalendarYear(calendar2026 as unknown as CalendarYearDataset)
  const grid = getMonthGrid(year, calendarDemoMonth.month)
  const days = grid.flat().filter((day): day is CalendarDay => day !== null)
  const run = longestOffRun(days)
  const inRun = new Set(run.map(day => day.date))
  const holiday = run.flatMap(day => day.official.holidays).find(id => id in breakNames) ?? null

  return {
    year: calendarDemoMonth.year,
    month: calendarDemoMonth.month,
    weeks: grid.map(week => week.map(day => day && {
      date: day.date,
      day: day.dayOfMonth,
      off: OFF_KINDS.has(day.official.kind),
      inBreak: inRun.has(day.date),
    })),
    breakLength: run.length,
    breakHoliday: holiday,
  }
}

/** The same sentence split for a large figure: the count, its unit, and what the break is. */
export function calendarBreakParts(holiday: string | null, length: number, locale: LocaleCode) {
  const name = holiday ? copy(breakNames[holiday]!, locale) : null
  return locale === 'en'
    ? { count: String(length), unit: 'days off', name: name ?? 'In a row' }
    : { count: String(length), unit: '天', name: name ? `${name}連假` : '連續放假' }
}

export const documentDemoInput = { amount: '36800', purpose: 'cheque' } as const

/** The form in the document block: an amount written out by the NTD converter, then signed. */
export function getDocumentDemo(): NtdDemo {
  const outcome = convertNtd(documentDemoInput.amount, documentDemoInput.purpose)
  if (outcome.state !== 'ready') throw new Error(`Document demo input is rejected: ${outcome.code}`)

  return { amount: outcome.conversion.normalized, wording: outcome.conversion.wording }
}

export function describeCalendarBreak(holiday: string | null, length: number, locale: LocaleCode) {
  const name = holiday ? copy(breakNames[holiday]!, locale) : null
  if (locale === 'en') return name ? `${name}: ${length} days off in a row` : `${length} days off in a row`
  return name ? `${name}連假 ${length} 天` : `連續放假 ${length} 天`
}

function longestOffRun(days: CalendarDay[]) {
  let best: CalendarDay[] = []
  let current: CalendarDay[] = []
  for (const day of days) {
    current = OFF_KINDS.has(day.official.kind) ? [...current, day] : []
    if (current.length > best.length) best = current
  }
  return best
}

/** Names for the draw demo. They are placeholders, not anyone's data. */
export const pickerDemoNames: Record<LocaleCode, string[]> = {
  'zh-tw': ['小明', '阿美', '志豪', '佳穎', '小傑', '怡君'],
  'en': ['Alex', 'Mia', 'Sam', 'Jo', 'Lee', 'Ana'],
}

/** The demo always lands on the same name, so the page renders identically on server and client. */
export const pickerDemoWinnerIndex = 3

/**
 * The draw demo is the picker's own wheel (#106), resting where the picker
 * would stop it for the same result: the winner under the pointer and every
 * name laid out to read the right way up at that angle.
 */
export function getPickerDemo(locale: LocaleCode) {
  const names = pickerDemoNames[locale]
  const rotation = wheelStopRotation(pickerDemoWinnerIndex, names.length, 0)

  return {
    slices: wheelSlices(names, rotation),
    rotation,
    winnerIndex: pickerDemoWinnerIndex,
    winner: names[pickerDemoWinnerIndex]!,
  }
}
