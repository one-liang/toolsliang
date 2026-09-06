import {
  calendarDataStatuses,
  lunarDayRange,
  lunarMonthRange,
  officialDayKinds,
  officialHolidayIds,
  solarTermNames,
  type CalendarDataStatus,
  type OfficialDayKind,
  type OfficialHolidayId,
  type SolarTermName,
} from './reference'
import { taiwanCalendarDatasetIds, type TaiwanCalendarDatasetId } from './sources'

/**
 * The shape of one baked year, and the check that a file on disk really is one.
 *
 * `scripts/ingest_taiwan_calendar.py` writes these from the primary sources and
 * refuses to write a year that fails any check in section 5.5 of the decision
 * record, so the browser never talks to a source and never has to guess. What
 * the ingestion cannot express — a file edited by hand, a rename that silently
 * drops a field — is caught here, because a malformed year must read as an
 * unavailable year rather than as a calendar full of blanks.
 *
 * Only the days the source annotates are stored. An ordinary day is a weekday
 * question, and the ingestion has already proved the source's 是否放假 column
 * agrees with the weekday on every unannotated day, so deriving the two
 * ordinary kinds is reading the source rather than guessing past it.
 */

export interface CalendarLayerEdition {
  status: CalendarDataStatus
  datasetId: TaiwanCalendarDatasetId
  /** The source's own edition string, so a visitor can find the same file again. */
  edition: string
  publishedAt: string
  retrievedAt: string
  checksum: string
}

export interface LunarMonthSegment {
  /** First date of this lunar month inside the Gregorian year, which for the
   * first segment is 1 January rather than the lunar first day. */
  start: string
  month: number
  leapMonth: boolean
  /** The lunar day on `start`; 1 except for the month the year opens inside. */
  startDay: number
}

export interface SolarTermEntry {
  name: SolarTermName
  date: string
  /** Taiwan time. The calendar reads the date from it and never shows it. */
  time: string
}

export interface OfficialDayEntry {
  date: string
  kind: OfficialDayKind
  holidays: OfficialHolidayId[]
  /** The source's 備註 verbatim, so a day can name the cell it came from. */
  label: string
}

export interface CalendarYearDataset {
  year: number
  rocYear: number
  layers: {
    lunar: CalendarLayerEdition
    solarTerm: CalendarLayerEdition
    official: CalendarLayerEdition
  }
  /** 正月初一 in this Gregorian year; every year has exactly one. */
  lunarNewYear: string
  lunarMonths: LunarMonthSegment[]
  solarTerms: SolarTermEntry[]
  officialDays: OfficialDayEntry[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isCalendarYearDataset(value: unknown): value is CalendarYearDataset {
  return validateCalendarYearDataset(value).length === 0
}

/**
 * Every reason a file cannot be read as a year, all of them at once: a
 * maintainer fixing an ingestion wants the whole list, not the first line.
 */
export function validateCalendarYearDataset(value: unknown): string[] {
  const issues: string[] = []
  const dataset = value as Partial<CalendarYearDataset> | null

  if (!dataset || typeof dataset !== 'object') return ['dataset is not an object']
  if (!Number.isInteger(dataset.year)) return ['dataset has no year']

  const year = dataset.year!
  const inYear = (date: string | undefined) => Boolean(date && ISO_DATE.test(date) && date.startsWith(`${year}-`))

  for (const layer of ['lunar', 'solarTerm', 'official'] as const) {
    const edition = dataset.layers?.[layer]
    const prefix = `[layer:${layer}]`
    if (!edition) {
      issues.push(`${prefix} missing`)
      continue
    }
    if (!calendarDataStatuses.includes(edition.status)) issues.push(`${prefix} unknown status: ${edition.status}`)
    if (!taiwanCalendarDatasetIds.includes(edition.datasetId)) issues.push(`${prefix} unknown dataset: ${edition.datasetId}`)
    if (!edition.edition?.trim()) issues.push(`${prefix} missing source edition`)
    if (!ISO_DATE.test(edition.publishedAt ?? '')) issues.push(`${prefix} missing publication date`)
    if (!ISO_DATE.test(edition.retrievedAt ?? '')) issues.push(`${prefix} missing retrieval date`)
    if (!edition.checksum?.startsWith('sha256-')) issues.push(`${prefix} missing checksum`)
  }

  if (!inYear(dataset.lunarNewYear)) issues.push('[lunar] lunar new year is not inside the year')

  const months = dataset.lunarMonths ?? []
  if (months[0]?.start !== `${year}-01-01`) issues.push('[lunar] the first month segment must open on 1 January')
  months.forEach((month, index) => {
    const prefix = `[lunar:${month.start}]`
    if (!ISO_DATE.test(month.start ?? '')) issues.push(`${prefix} unreadable start date`)
    if (index && month.start <= months[index - 1]!.start) issues.push(`${prefix} is out of order`)
    if (!(month.month >= lunarMonthRange.min && month.month <= lunarMonthRange.max)) issues.push(`${prefix} month ${month.month} is out of range`)
    if (typeof month.leapMonth !== 'boolean') issues.push(`${prefix} does not say whether it is a leap month`)
    if (!(month.startDay >= lunarDayRange.min && month.startDay <= lunarDayRange.max)) issues.push(`${prefix} day ${month.startDay} is out of range`)
    if (index && month.startDay !== 1) issues.push(`${prefix} only the opening segment may start mid-month`)
  })

  const terms = dataset.solarTerms ?? []
  if (terms.length !== solarTermNames.length) issues.push(`[solar-term] ${terms.length} of ${solarTermNames.length} terms`)
  terms.forEach((term, index) => {
    if (term.name !== solarTermNames[index]) issues.push(`[solar-term:${index}] expected ${solarTermNames[index]}, got ${term.name}`)
    if (!inYear(term.date)) issues.push(`[solar-term:${term.name}] ${term.date} is not inside the year`)
    if (!/^\d{2}:\d{2}$/.test(term.time ?? '')) issues.push(`[solar-term:${term.name}] unreadable time`)
  })

  const days = dataset.officialDays ?? []
  days.forEach((day, index) => {
    const prefix = `[official:${day.date}]`
    if (!inYear(day.date)) issues.push(`${prefix} is not inside the year`)
    if (index && day.date <= days[index - 1]!.date) issues.push(`${prefix} is out of order`)
    if (!officialDayKinds.includes(day.kind)) issues.push(`${prefix} unknown day kind: ${day.kind}`)
    // A stored day is an annotated day; the ordinary kinds are read off the weekday.
    if (day.kind === 'workday' || day.kind === 'weekend') issues.push(`${prefix} an ordinary day is not stored`)
    if (!day.label?.trim()) issues.push(`${prefix} has no source annotation`)
    if (day.holidays?.some(holiday => !officialHolidayIds.includes(holiday))) issues.push(`${prefix} unknown holiday id`)
    if (day.holidays?.length && day.kind !== 'national-holiday') issues.push(`${prefix} is ${day.kind} yet names a holiday`)
  })

  return issues
}
