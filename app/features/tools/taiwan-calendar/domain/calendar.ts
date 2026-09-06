import type {
  CalendarLayerEdition,
  CalendarYearDataset,
  LunarMonthSegment,
  OfficialDayEntry,
} from './dataset'
import {
  rocEpochOffset,
  rocFirstGregorianYear,
  type OfficialDayKind,
  type SolarTermName,
} from './reference'

/**
 * Assembles a baked year into the days a page renders: the arithmetic layer, the
 * lunar layer expanded from its month segments, the solar terms, and the office
 * calendar. Nothing here reaches for the device clock, the network or storage —
 * every function is a pure reading of one dataset, so a date can be asserted
 * without a browser and the year a visitor is looking at never leaves the tab.
 *
 * The one thing this module derives rather than reads is the ordinary
 * workday/weekend split, which the ingestion has already checked against the
 * source's own 是否放假 column on every unannotated day.
 */

const HEAVENLY_STEMS = '甲乙丙丁戊己庚辛壬癸'
const EARTHLY_BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
const ZODIAC = '鼠牛虎兔龍蛇馬羊猴雞狗豬'
const DAY_MS = 24 * 60 * 60 * 1000

export interface LunarDate {
  sexagenaryYear: string
  zodiac: string
  month: number
  leapMonth: boolean
  day: number
}

export interface SolarTerm {
  name: SolarTermName
  time: string
}

export interface OfficialDay {
  kind: OfficialDayKind
  holidays: OfficialDayEntry['holidays']
  label: string
}

export interface CalendarDay {
  date: string
  month: number
  dayOfMonth: number
  rocYear: number | null
  /** 1 is Monday and 7 is Sunday, as the source's weekday column numbers them. */
  isoWeekday: number
  lunar: LunarDate
  solarTerm: SolarTerm | null
  official: OfficialDay
}

export interface CalendarYear {
  year: number
  rocYear: number
  layers: CalendarYearDataset['layers']
  days: CalendarDay[]
}

/** A month laid out as the source lays it out: whole weeks, Sunday first. */
export type CalendarWeek = Array<CalendarDay | null>

export function rocYearOf(date: string): number | null {
  const year = Number(date.slice(0, 4))
  return date >= `${rocFirstGregorianYear}-01-01` ? year - rocEpochOffset : null
}

/** Read in Taiwan time, which is what a date string with no time zone already is. */
export function isoWeekdayOf(date: string): number {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
}

export function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

/**
 * The sexagenary year turns on 正月初一, not on 1 January, so a date in the
 * weeks before Lunar New Year still belongs to the previous animal.
 */
export function sexagenaryYearOf(date: string, lunarNewYear: string) {
  const gregorianYear = Number(date.slice(0, 4))
  const lunarYear = date >= lunarNewYear ? gregorianYear : gregorianYear - 1
  const index = ((lunarYear - 4) % 60 + 60) % 60

  return {
    sexagenaryYear: HEAVENLY_STEMS[index % 10]! + EARTHLY_BRANCHES[index % 12]!,
    zodiac: ZODIAC[index % 12]!,
  }
}

export function buildCalendarYear(dataset: CalendarYearDataset): CalendarYear {
  const terms = new Map(dataset.solarTerms.map(term => [term.date, { name: term.name, time: term.time }]))
  const official = new Map(dataset.officialDays.map(day => [day.date, {
    kind: day.kind,
    holidays: day.holidays,
    label: day.label,
  }]))

  const days: CalendarDay[] = []
  const end = `${dataset.year}-12-31`
  let segment = 0
  for (let date = `${dataset.year}-01-01`; date <= end; date = addDays(date, 1)) {
    while (segment + 1 < dataset.lunarMonths.length && dataset.lunarMonths[segment + 1]!.start <= date) segment += 1

    const isoWeekday = isoWeekdayOf(date)
    days.push({
      date,
      month: Number(date.slice(5, 7)),
      dayOfMonth: Number(date.slice(8, 10)),
      rocYear: rocYearOf(date),
      isoWeekday,
      lunar: lunarDateOn(date, dataset.lunarMonths[segment]!, dataset.lunarNewYear),
      solarTerm: terms.get(date) ?? null,
      // An unannotated day is ordinary, and which of the two it is follows from
      // the weekday — the ingestion refuses any year where the source disagrees.
      official: official.get(date) ?? { kind: isoWeekday >= 6 ? 'weekend' : 'workday', holidays: [], label: '' },
    })
  }

  return { year: dataset.year, rocYear: dataset.rocYear, layers: dataset.layers, days }
}

function lunarDateOn(date: string, segment: LunarMonthSegment, lunarNewYear: string): LunarDate {
  const offset = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${segment.start}T00:00:00Z`)) / DAY_MS)

  return {
    ...sexagenaryYearOf(date, lunarNewYear),
    month: segment.month,
    leapMonth: segment.leapMonth,
    day: segment.startDay + offset,
  }
}

export function getMonthDays(year: CalendarYear, month: number): CalendarDay[] {
  return year.days.filter(day => day.month === month)
}

/**
 * Whole weeks with the days of neighbouring months left empty. A grid that
 * spilled into the next month would be showing days this year's sources do not
 * cover, so the padding stays blank rather than borrowing them.
 */
export function getMonthGrid(year: CalendarYear, month: number): CalendarWeek[] {
  const days = getMonthDays(year, month)
  if (!days.length) return []

  const leading = days[0]!.isoWeekday % 7
  const cells: CalendarWeek = [...Array.from({ length: leading }, () => null), ...days]
  while (cells.length % 7) cells.push(null)

  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}

export function findDay(year: CalendarYear, date: string): CalendarDay | undefined {
  return year.days.find(day => day.date === date)
}

/** The editions a year is currently built from, deduplicated by source file. */
export function citedEditions(layers: CalendarYear['layers']): CalendarLayerEdition[] {
  const cited = new Map<string, CalendarLayerEdition>()
  for (const layer of Object.values(layers)) cited.set(`${layer.datasetId}:${layer.edition}`, layer)

  return [...cited.values()]
}
