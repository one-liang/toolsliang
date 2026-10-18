import { addDays, type CalendarDay, type CalendarYear } from '../../taiwan-calendar/domain/calendar'
import type { OfficialDayKind, OfficialHolidayId } from '../../taiwan-calendar/domain/reference'
import { workingDayCoverage } from './sources'

/**
 * Counting working days on the government agency office calendar (ADR-0025):
 * a working day is a day that calendar marks as a workday or a makeup workday,
 * and nothing else. Every function reads the office calendar years the Taiwan
 * Calendar already ships, and none reaches for the device clock, the network
 * or storage, so an answer can be asserted without a page and the dates a
 * visitor counts never leave the tab.
 *
 * One rule decides when to stop: only a day that has to be judged needs its
 * year. The start of a forward or backward count is never judged, so it may sit
 * outside the years covered; the first day that has to be judged and cannot be
 * ends the count with a refusal that says how far it got, never with a guess.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const workingDayKinds = ['workday', 'makeup-workday'] as const satisfies readonly OfficialDayKind[]

export type WorkingDayDirection = 'forward' | 'backward'

export type SkippedDayKind = Exclude<OfficialDayKind, 'workday' | 'weekend' | 'makeup-workday'>

export interface SkippedDay {
  date: string
  kind: SkippedDayKind
  holidays: OfficialHolidayId[]
}

/** What a count passed over: the days off by name, the weekends by number. */
export interface WorkingDayBreakdown {
  skipped: SkippedDay[]
  weekendDays: number
  makeupWorkdays: string[]
}

/**
 * `not-announced` is a year after the last one the authority has published,
 * `out-of-range` a year before the first one this site carries, and
 * `not-downloaded` a covered year this device could not load — three different
 * things to tell a visitor, so they are never folded into one.
 */
export type WorkingDayRefusalReason = 'not-announced' | 'out-of-range' | 'not-downloaded'

export interface WorkingDayRefusal {
  reason: WorkingDayRefusalReason
  /** The first day that had to be judged and could not be. */
  blockedAt: string
  /** Working days already counted when the count stopped. */
  reached: number
  lastCounted?: string
}

export type WorkingDayStep =
  | {
    ok: true
    start: string
    direction: WorkingDayDirection
    count: number
    date: string
    landsOnMakeupWorkday: boolean
    breakdown: WorkingDayBreakdown
  }
  | { ok: false, start: string, direction: WorkingDayDirection, count: number, refusal: WorkingDayRefusal }

export type WorkingDaySpan =
  | { ok: true, from: string, to: string, workingDays: number, calendarDays: number, breakdown: WorkingDayBreakdown }
  | { ok: false, from: string, to: string, refusal: Omit<WorkingDayRefusal, 'reached' | 'lastCounted'> }

export interface OfficeCalendar {
  dayOn: (date: string) => CalendarDay | WorkingDayRefusalReason
}

export function isWorkingDay(kind: OfficialDayKind) {
  return (workingDayKinds as readonly OfficialDayKind[]).includes(kind)
}

/**
 * The office calendar a count reads. A covered year that is missing from
 * `years` is one this device has not downloaded, which is a different answer
 * from a year nobody has announced yet.
 */
export function buildOfficeCalendar(
  years: CalendarYear[],
  coverage: { firstYear: number, lastYear: number } = workingDayCoverage,
): OfficeCalendar {
  const days = new Map(years.flatMap(year => year.days.map(day => [day.date, day] as const)))

  return {
    dayOn(date) {
      const day = days.get(date)
      if (day) return day
      const year = Number(date.slice(0, 4))
      if (year > coverage.lastYear) return 'not-announced'
      if (year < coverage.firstYear) return 'out-of-range'
      return 'not-downloaded'
    },
  }
}

export function isIsoDate(text: string) {
  return ISO_DATE.test(text) && new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) === text
}

/**
 * Counts `count` working days from `start`, which itself never counts: the
 * first candidate is the day after it, or the day before it going backward.
 */
export function stepWorkingDays(
  calendar: OfficeCalendar,
  start: string,
  count: number,
  direction: WorkingDayDirection,
): WorkingDayStep {
  const offset = direction === 'forward' ? 1 : -1
  const counted: CalendarDay[] = []
  const passed: CalendarDay[] = []

  for (let date = addDays(start, offset); counted.length < count; date = addDays(date, offset)) {
    const day = calendar.dayOn(date)
    if (typeof day === 'string') {
      return {
        ok: false,
        start,
        direction,
        count,
        refusal: { reason: day, blockedAt: date, reached: counted.length, lastCounted: counted.at(-1)?.date },
      }
    }
    if (isWorkingDay(day.official.kind)) counted.push(day)
    passed.push(day)
  }

  const answer = counted.at(-1)!
  return {
    ok: true,
    start,
    direction,
    count,
    date: answer.date,
    landsOnMakeupWorkday: answer.official.kind === 'makeup-workday',
    breakdown: breakdownOf(passed),
  }
}

/** Counts the working days from one date to the other, both ends included, in either order. */
export function countWorkingDays(calendar: OfficeCalendar, first: string, second: string): WorkingDaySpan {
  const [from, to] = first <= second ? [first, second] : [second, first]
  const days: CalendarDay[] = []

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const day = calendar.dayOn(date)
    if (typeof day === 'string') return { ok: false, from, to, refusal: { reason: day, blockedAt: date } }
    days.push(day)
  }

  return {
    ok: true,
    from,
    to,
    workingDays: days.filter(day => isWorkingDay(day.official.kind)).length,
    calendarDays: Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1,
    breakdown: breakdownOf(days),
  }
}

/** Always in date order, whichever way the count walked. */
function breakdownOf(days: CalendarDay[]): WorkingDayBreakdown {
  const ordered = [...days].sort((left, right) => left.date.localeCompare(right.date))

  return {
    skipped: ordered
      .filter(day => !isWorkingDay(day.official.kind) && day.official.kind !== 'weekend')
      .map(day => ({ date: day.date, kind: day.official.kind as SkippedDayKind, holidays: day.official.holidays })),
    weekendDays: ordered.filter(day => day.official.kind === 'weekend').length,
    makeupWorkdays: ordered.filter(day => day.official.kind === 'makeup-workday').map(day => day.date),
  }
}

export type WorkingDayCountErrorCode = 'empty' | 'not-a-number' | 'not-whole' | 'below-one'

export type WorkingDayCountInput =
  | { state: 'ready', count: number }
  | { state: 'error', code: WorkingDayCountErrorCode }

/**
 * Reads how many working days to count. Half-width and full-width digits are
 * both accepted, because a Chinese input method types the second kind. There
 * is no upper bound: a count that runs past the covered years stops there.
 */
export function parseWorkingDayCount(text: string): WorkingDayCountInput {
  const normalized = text
    .replace(/[０-９]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
    .replace(/．/g, '.')
    .replace(/＋/g, '+')
    .replace(/[－−]/g, '-')
    .trim()
  const fail = (code: WorkingDayCountErrorCode): WorkingDayCountInput => ({ state: 'error', code })

  if (!normalized) return fail('empty')
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return fail('not-a-number')
  if (normalized.includes('.') && !/\.0+$/.test(normalized)) return fail('not-whole')

  const count = Math.trunc(Number(normalized))
  return count < 1 ? fail('below-one') : { state: 'ready', count }
}
