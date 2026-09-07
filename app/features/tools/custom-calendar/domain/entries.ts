import { addDays, type CalendarDay } from '../../taiwan-calendar/domain/calendar'

/**
 * What a visitor may add on top of the office calendar, and what that addition
 * is allowed to change. Every function here is a pure reading of entries the
 * device already holds: nothing reaches storage, the clock or the network, so a
 * title a person typed can be validated and laid over a month without ever
 * leaving the tab it was typed in.
 *
 * The official layer is never rewritten. An entry answers a separate question —
 * "what does this device's owner say about this day?" — and the result carries
 * both answers so a page can show the office calendar and the visitor's own
 * override side by side, and say which one is on screen.
 */

export const customEntryMarks = ['note', 'day-off', 'workday'] as const
export type CustomEntryMark = typeof customEntryMarks[number]

export const customEntryFields = ['title', 'dates', 'note'] as const
export type CustomEntryField = typeof customEntryFields[number]

export const customEntryIssueCodes = [
  'title-required',
  'title-too-long',
  'note-too-long',
  'invalid-date',
  'end-before-start',
  'range-too-long',
  'date-out-of-range',
  'entry-limit-reached',
] as const
export type CustomEntryIssueCode = typeof customEntryIssueCodes[number]

export interface CustomEntryIssue {
  field: CustomEntryField
  code: CustomEntryIssueCode
}

/**
 * Limits chosen so one document stays readable and writable on a phone: the
 * whole calendar is rewritten on every edit, so the ceiling is what a device can
 * re-serialize without a visitor noticing. They are exported because the copy
 * that explains them has to name the same numbers.
 */
export const CUSTOM_ENTRY_TITLE_MAX = 60
export const CUSTOM_ENTRY_NOTE_MAX = 500
export const CUSTOM_ENTRY_RANGE_MAX_DAYS = 366
export const CUSTOM_CALENDAR_ENTRY_LIMIT = 5000

export interface CustomCalendarEntry {
  id: string
  /** Inclusive, always a real day, and always inside the covered years. */
  startDate: string
  endDate: string
  mark: CustomEntryMark
  title: string
  note: string
  updatedAt: string
}

export interface CustomCalendarEntryDraft {
  startDate: string
  endDate: string
  mark: CustomEntryMark
  title: string
  note: string
}

export interface CustomEntryLimits {
  /** The years the official calendar covers; an entry outside them could never be seen. */
  firstYear: number
  lastYear: number
  /** Entries already saved, not counting the one being replaced. */
  existing: number
}

/** What this device's owner says about a day, when they said anything at all. */
export type CustomDayOverride = 'day-off' | 'workday'

export interface CustomCalendarDay {
  day: CalendarDay
  entries: CustomCalendarEntry[]
  override: CustomDayOverride | null
  /** Two saved entries claim the opposite about this day. */
  conflict: boolean
  /** The override disagrees with the office calendar, which is the point of saying it. */
  changed: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isCustomEntryMark(value: unknown): value is CustomEntryMark {
  return typeof value === 'string' && (customEntryMarks as readonly string[]).includes(value)
}

/** A calendar day, not merely a well-formed string: 2026-02-30 is neither. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false

  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

/**
 * Everything wrong with a draft, in the order the form asks for it. All of it at
 * once: a visitor fixing one field at a time would have to guess how many more
 * rounds are left.
 */
export function validateEntryDraft(draft: CustomCalendarEntryDraft, limits: CustomEntryLimits): CustomEntryIssue[] {
  const issues: CustomEntryIssue[] = []
  const title = draft.title.trim()

  if (limits.existing >= CUSTOM_CALENDAR_ENTRY_LIMIT) return [{ field: 'title', code: 'entry-limit-reached' }]
  if (!title) issues.push({ field: 'title', code: 'title-required' })
  else if (title.length > CUSTOM_ENTRY_TITLE_MAX) issues.push({ field: 'title', code: 'title-too-long' })

  issues.push(...validateDates(draft, limits))

  if (draft.note.trim().length > CUSTOM_ENTRY_NOTE_MAX) issues.push({ field: 'note', code: 'note-too-long' })

  return issues
}

function validateDates(draft: CustomCalendarEntryDraft, limits: CustomEntryLimits): CustomEntryIssue[] {
  if (!isCalendarDate(draft.startDate) || !isCalendarDate(draft.endDate)) {
    return [{ field: 'dates', code: 'invalid-date' }]
  }
  if (draft.endDate < draft.startDate) return [{ field: 'dates', code: 'end-before-start' }]
  if (dayCount(draft.startDate, draft.endDate) > CUSTOM_ENTRY_RANGE_MAX_DAYS) {
    return [{ field: 'dates', code: 'range-too-long' }]
  }
  if (Number(draft.startDate.slice(0, 4)) < limits.firstYear || Number(draft.endDate.slice(0, 4)) > limits.lastYear) {
    return [{ field: 'dates', code: 'date-out-of-range' }]
  }

  return []
}

/**
 * Whether an entry already in this shape still obeys the reviewed rules. An
 * imported file goes through the same question the form asks: an entry outside
 * the covered years, or longer than the limits, would be stored but unreachable
 * in a grid that only draws those years.
 */
export function isEntryWithinRules(entry: CustomCalendarEntry, coverage: { firstYear: number, lastYear: number }): boolean {
  return validateEntryDraft(entry, { ...coverage, existing: 0 }).length === 0
}

export function createEntry(
  draft: CustomCalendarEntryDraft,
  options: { id: string, now: Date },
): CustomCalendarEntry {
  return {
    id: options.id,
    startDate: draft.startDate,
    endDate: draft.endDate,
    mark: draft.mark,
    title: draft.title.trim(),
    note: draft.note.trim(),
    updatedAt: options.now.toISOString(),
  }
}

/** An edit keeps the entry's identity; only what the form holds is rewritten. */
export function updateEntry(
  entry: CustomCalendarEntry,
  draft: CustomCalendarEntryDraft,
  now: Date,
): CustomCalendarEntry {
  return createEntry(draft, { id: entry.id, now })
}

export function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1
}

/**
 * The days one entry covers, clipped to the window being drawn. A month view
 * never expands a year-long entry into a year of dates just to find the two days
 * of it that are on screen.
 */
export function entryDates(entry: CustomCalendarEntry, from?: string, to?: string): string[] {
  const start = from && from > entry.startDate ? from : entry.startDate
  const end = to && to < entry.endDate ? to : entry.endDate
  if (end < start) return []

  const dates: string[] = []
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date)

  return dates
}

/** Every entry touching a window, in the order a list should read them. */
export function entriesInRange(entries: CustomCalendarEntry[], from: string, to: string): CustomCalendarEntry[] {
  return entries.filter(entry => entry.startDate <= to && entry.endDate >= from).sort(byDateThenTitle)
}

export function sortEntries(entries: CustomCalendarEntry[]): CustomCalendarEntry[] {
  return [...entries].sort(byDateThenTitle)
}

function byDateThenTitle(left: CustomCalendarEntry, right: CustomCalendarEntry): number {
  return left.startDate.localeCompare(right.startDate)
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id)
}

/**
 * Lays the saved entries over the days a page is about to draw. The official day
 * travels through untouched, so nothing downstream can mistake one layer for the
 * other, and the cost is the days on screen plus the entries that reach them.
 *
 * Two entries can disagree about one day. Rather than pick a rule a visitor
 * cannot see, the day says so and follows the entry edited last, which is the
 * one they were looking at when they made the change.
 */
export function applyCustomEntries(days: CalendarDay[], entries: CustomCalendarEntry[]): CustomCalendarDay[] {
  const first = days[0]?.date
  const last = days[days.length - 1]?.date
  const byDate = new Map<string, CustomCalendarEntry[]>()

  if (first && last) {
    for (const entry of sortEntries(entries)) {
      for (const date of entryDates(entry, first, last)) {
        const owned = byDate.get(date)
        if (owned) owned.push(entry)
        else byDate.set(date, [entry])
      }
    }
  }

  return days.map((day) => {
    const owned = byDate.get(day.date) ?? []
    const overriding = owned.filter(entry => entry.mark !== 'note')
    const decisive = overriding.reduce<CustomCalendarEntry | undefined>(
      (latest, entry) => !latest || entry.updatedAt >= latest.updatedAt ? entry : latest,
      undefined,
    )
    const override = decisive ? decisive.mark as CustomDayOverride : null

    return {
      day,
      entries: owned,
      override,
      conflict: overriding.some(entry => entry.mark !== overriding[0]!.mark),
      changed: override !== null && (override === 'workday') !== isOfficialWorking(day),
    }
  })
}

/** Whether the office calendar expects work on this day, which an override answers against. */
export function isOfficialWorking(day: CalendarDay): boolean {
  return day.official.kind === 'workday' || day.official.kind === 'makeup-workday'
}
