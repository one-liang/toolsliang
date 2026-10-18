import { describe, expect, it } from 'vitest'
import { buildCalendarYear, type CalendarYear } from '@/features/tools/taiwan-calendar/domain/calendar'
import type { CalendarYearDataset } from '@/features/tools/taiwan-calendar/domain/dataset'
import { taiwanCalendarPublishableYears } from '@/features/tools/taiwan-calendar/domain/sources'
import { availableYears } from '@/features/tools/taiwan-calendar/domain/years'
import {
  buildOfficeCalendar,
  countWorkingDays,
  parseWorkingDayCount,
  stepWorkingDays,
} from '@/features/tools/working-day-calculator/domain/count'
import { loadOfficeCalendar } from '@/features/tools/working-day-calculator/domain/load'
import { workingDayCoverage } from '@/features/tools/working-day-calculator/domain/sources'

/**
 * Every vector here is read off the office calendars the site actually ships,
 * so a reissued year that moves a day off fails these tests instead of quietly
 * changing an answer.
 */
const modules = import.meta.glob<{ default: CalendarYearDataset }>(
  '../app/features/tools/taiwan-calendar/data/*.json',
  { eager: true },
)
const years: CalendarYear[] = Object.values(modules)
  .map(module => buildCalendarYear(module.default))
  .sort((left, right) => left.year - right.year)
const calendar = buildOfficeCalendar(years)

describe('working day coverage', () => {
  it('spans the years the site ships, the same years the Taiwan Calendar publishes', () => {
    expect(workingDayCoverage).toEqual({ firstYear: 2020, lastYear: 2027 })
    expect(workingDayCoverage).toEqual(taiwanCalendarPublishableYears)
    expect([availableYears[0], availableYears.at(-1)], 'the shipped files span the same years').toEqual([2020, 2027])
  })

  it('loads every covered year at once, with the edition each one is built from', async () => {
    const loaded = await loadOfficeCalendar()
    if ('cancelled' in loaded) throw new Error('nothing cancelled this load')

    expect(loaded.editions.map(entry => entry.year)).toEqual(availableYears)
    expect(loaded.editions.find(entry => entry.year === 2025)?.edition.status).toBe('revised')
    expect(stepWorkingDays(loaded.calendar, '2026-02-13', 3, 'forward')).toMatchObject({ ok: true, date: '2026-02-25' })
  })
})

describe('counting forward', () => {
  it('skips the 2026 Lunar New Year break and its substitute day without counting the start', () => {
    const result = stepWorkingDays(calendar, '2026-02-13', 3, 'forward')

    expect(result).toMatchObject({ ok: true, date: '2026-02-25', landsOnMakeupWorkday: false })
    if (!result.ok) return
    expect(result.breakdown.skipped).toEqual([
      { date: '2026-02-15', kind: 'national-holiday', holidays: ['minor-new-years-eve'] },
      { date: '2026-02-16', kind: 'national-holiday', holidays: ['lunar-new-years-eve'] },
      { date: '2026-02-17', kind: 'national-holiday', holidays: ['spring-festival'] },
      { date: '2026-02-18', kind: 'national-holiday', holidays: ['spring-festival'] },
      { date: '2026-02-19', kind: 'national-holiday', holidays: ['spring-festival'] },
      { date: '2026-02-20', kind: 'substitute-holiday', holidays: [] },
    ])
    expect(result.breakdown.weekendDays, '2/15 is a Sunday but counts as the holiday it is').toBe(3)
    expect(result.breakdown.makeupWorkdays).toEqual([])
  })

  it('counts a makeup workday as a working day and says the answer lands on one', () => {
    const result = stepWorkingDays(calendar, '2025-02-07', 1, 'forward')

    expect(result).toMatchObject({ ok: true, date: '2025-02-08', landsOnMakeupWorkday: true })
    if (!result.ok) return
    expect(result.breakdown.makeupWorkdays).toEqual(['2025-02-08'])
  })

  it('stops at an unannounced year and says how far it got', () => {
    const result = stepWorkingDays(calendar, '2027-12-28', 3, 'forward')

    expect(result).toEqual({
      ok: false,
      start: '2027-12-28',
      direction: 'forward',
      count: 3,
      refusal: { reason: 'not-announced', blockedAt: '2028-01-01', reached: 2, lastCounted: '2027-12-30' },
    })
  })
})

describe('counting backward', () => {
  it('skips Peace Memorial Day and its substitute day', () => {
    const result = stepWorkingDays(calendar, '2026-03-02', 3, 'backward')

    expect(result).toMatchObject({ ok: true, date: '2026-02-24' })
    if (!result.ok) return
    expect(result.breakdown.skipped, 'listed in date order').toEqual([
      { date: '2026-02-27', kind: 'substitute-holiday', holidays: [] },
      { date: '2026-02-28', kind: 'national-holiday', holidays: ['peace-memorial-day'] },
    ])
    expect(result.breakdown.weekendDays).toBe(1)
  })

  it('answers from a start date in an unannounced year, because the start is never judged', () => {
    const result = stepWorkingDays(calendar, '2028-01-01', 3, 'backward')

    expect(result).toMatchObject({ ok: true, date: '2027-12-28' })
    if (!result.ok) return
    expect(result.breakdown.skipped).toEqual([{ date: '2027-12-31', kind: 'substitute-holiday', holidays: [] }])
  })

  it('refuses when the first day it has to judge is in an unannounced year', () => {
    const result = stepWorkingDays(calendar, '2028-01-02', 3, 'backward')

    expect(result).toMatchObject({
      ok: false,
      refusal: { reason: 'not-announced', blockedAt: '2028-01-01', reached: 0 },
    })
    if (result.ok) return
    expect(result.refusal.lastCounted).toBeUndefined()
  })

  it('refuses a day before the years it covers as out of range', () => {
    const result = stepWorkingDays(calendar, '2020-01-02', 2, 'backward')

    expect(result).toMatchObject({
      ok: false,
      refusal: { reason: 'out-of-range', blockedAt: '2019-12-31', reached: 0 },
    })
  })
})

describe('counting the working days between two dates', () => {
  it('counts both ends and skips the Children’s Day and Tomb Sweeping Day break', () => {
    const result = countWorkingDays(calendar, '2026-04-01', '2026-04-10')

    expect(result).toMatchObject({ ok: true, from: '2026-04-01', to: '2026-04-10', workingDays: 6, calendarDays: 10 })
    if (!result.ok) return
    expect(result.breakdown.skipped).toEqual([
      { date: '2026-04-03', kind: 'substitute-holiday', holidays: [] },
      { date: '2026-04-04', kind: 'national-holiday', holidays: ['childrens-day'] },
      { date: '2026-04-05', kind: 'national-holiday', holidays: ['tomb-sweeping-day'] },
      { date: '2026-04-06', kind: 'substitute-holiday', holidays: [] },
    ])
    expect(result.breakdown.weekendDays).toBe(0)
  })

  it('gives the same answer whichever date comes first', () => {
    const forward = countWorkingDays(calendar, '2026-04-01', '2026-04-10')
    const reversed = countWorkingDays(calendar, '2026-04-10', '2026-04-01')

    expect(reversed).toEqual(forward)
  })

  it('counts a single day off as no working days', () => {
    expect(countWorkingDays(calendar, '2026-04-04', '2026-04-04')).toMatchObject({ ok: true, workingDays: 0, calendarDays: 1 })
  })

  it('counts makeup workdays inside the range', () => {
    const result = countWorkingDays(calendar, '2025-02-03', '2025-02-09')

    expect(result).toMatchObject({ ok: true, workingDays: 6 })
    if (!result.ok) return
    expect(result.breakdown.makeupWorkdays).toEqual(['2025-02-08'])
  })

  it('refuses a range that starts before the years it covers', () => {
    expect(countWorkingDays(calendar, '2019-12-30', '2020-01-03')).toMatchObject({
      ok: false,
      refusal: { reason: 'out-of-range', blockedAt: '2019-12-30' },
    })
  })

  it('refuses a range that runs into an unannounced year', () => {
    expect(countWorkingDays(calendar, '2027-12-30', '2028-01-03')).toMatchObject({
      ok: false,
      refusal: { reason: 'not-announced', blockedAt: '2028-01-01' },
    })
  })
})

describe('a year this device has not downloaded', () => {
  it('stops where the missing year begins instead of skipping it', () => {
    const partial = buildOfficeCalendar(years.filter(year => year.year !== 2026))
    const result = stepWorkingDays(partial, '2025-12-30', 5, 'forward')

    expect(result).toMatchObject({
      ok: false,
      refusal: { reason: 'not-downloaded', blockedAt: '2026-01-01', reached: 1, lastCounted: '2025-12-31' },
    })
  })
})

describe('reading how many working days to count', () => {
  it('accepts whole numbers from 1 up, in half-width or full-width digits', () => {
    expect(parseWorkingDayCount('3')).toEqual({ state: 'ready', count: 3 })
    expect(parseWorkingDayCount(' 12 ')).toEqual({ state: 'ready', count: 12 })
    expect(parseWorkingDayCount('１０')).toEqual({ state: 'ready', count: 10 })
    expect(parseWorkingDayCount('2.0')).toEqual({ state: 'ready', count: 2 })
  })

  it('names what to change, and treats an empty field as not yet filled in', () => {
    expect(parseWorkingDayCount('')).toEqual({ state: 'error', code: 'empty' })
    expect(parseWorkingDayCount('abc')).toEqual({ state: 'error', code: 'not-a-number' })
    expect(parseWorkingDayCount('1.5')).toEqual({ state: 'error', code: 'not-whole' })
    expect(parseWorkingDayCount('0')).toEqual({ state: 'error', code: 'below-one' })
    expect(parseWorkingDayCount('-2')).toEqual({ state: 'error', code: 'below-one' })
  })
})
