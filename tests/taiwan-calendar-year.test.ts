import { describe, expect, it } from 'vitest'
import {
  addDays,
  buildCalendarYear,
  citedEditions,
  findDay,
  getMonthDays,
  getMonthGrid,
  isPublishableYear,
  isoWeekdayOf,
  rocYearOf,
  sexagenaryYearOf,
} from '@/features/tools/taiwan-calendar/domain/calendar'
import { validateCalendarYearDataset, type CalendarYearDataset } from '@/features/tools/taiwan-calendar/domain/dataset'
import {
  officialHolidayIds,
  solarTermNames,
  taiwanCalendarLunarVectors,
  taiwanCalendarNoteLabels,
  taiwanCalendarOfficialDayVectors,
  taiwanCalendarRocVectors,
  taiwanCalendarSolarTermVectors,
  taiwanCalendarUtcOffsetMinutes,
} from '@/features/tools/taiwan-calendar/domain/reference'
import { taiwanCalendarCoverage, taiwanCalendarPublishableYears } from '@/features/tools/taiwan-calendar/domain/sources'
import { availableYears, loadCalendarYear, resolveYearRequest } from '@/features/tools/taiwan-calendar/domain/years'

const modules = import.meta.glob<{ default: CalendarYearDataset }>(
  '../app/features/tools/taiwan-calendar/data/*.json',
  { eager: true },
)
const datasets = Object.values(modules)
  .map(module => module.default)
  .sort((left, right) => left.year - right.year)
const calendars = new Map(datasets.map(dataset => [dataset.year, buildCalendarYear(dataset)]))

/** Only the vectors inside the published window can be asserted against shipped data. */
function published(date: string) {
  return calendars.has(Number(date.slice(0, 4)))
}

function dayOn(date: string) {
  const calendar = calendars.get(Number(date.slice(0, 4)))
  expect(calendar, `${date} is outside the published years`).toBeDefined()
  const day = findDay(calendar!, date)
  expect(day, `${date} is missing from its year`).toBeDefined()
  return day!
}

describe('the arithmetic layer', () => {
  it('converts every documented date to its ROC year and ISO weekday', () => {
    taiwanCalendarRocVectors.forEach((vector) => {
      expect(rocYearOf(vector.date), vector.date).toBe(vector.rocYear)
      expect(isoWeekdayOf(vector.date), vector.date).toBe(vector.isoWeekday)
    })
  })

  it('returns no ROC year before the era begins rather than a zero or negative one', () => {
    expect(rocYearOf('1911-12-31')).toBeNull()
    expect(rocYearOf('1912-01-01')).toBe(1)
  })

  it('numbers Sunday 7, where a Date.getDay() implementation would be off by one', () => {
    expect(isoWeekdayOf('2026-01-04')).toBe(7)
    expect(new Date('2026-01-04T00:00:00Z').getUTCDay()).toBe(0)
  })

  it('does not restart the weekday count at a Gregorian year boundary', () => {
    expect(isoWeekdayOf('2026-12-31')).toBe(4)
    expect(isoWeekdayOf('2027-01-01')).toBe(5)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('turns the sexagenary year on lunar new year, not on 1 January', () => {
    expect(sexagenaryYearOf('2026-01-01', '2026-02-17')).toEqual({ sexagenaryYear: '乙巳', zodiac: '蛇' })
    expect(sexagenaryYearOf('2026-02-16', '2026-02-17')).toEqual({ sexagenaryYear: '乙巳', zodiac: '蛇' })
    expect(sexagenaryYearOf('2026-02-17', '2026-02-17')).toEqual({ sexagenaryYear: '丙午', zodiac: '馬' })
  })
})

describe('the baked years', () => {
  it('ships exactly the years both sourced layers cover', () => {
    const { firstYear, lastYear } = taiwanCalendarPublishableYears
    const expected = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)

    expect(availableYears).toEqual(expected)
    expect(datasets.map(dataset => dataset.year)).toEqual(expected)
  })

  it('reads as a valid dataset, with every layer carrying a status, edition and date', () => {
    datasets.forEach((dataset) => {
      expect(validateCalendarYearDataset(dataset), String(dataset.year)).toEqual([])
      expect(dataset.rocYear).toBe(dataset.year - 1911)
      expect(isPublishableYear(dataset.layers)).toBe(true)
    })
  })

  it('covers every day of every year exactly once', () => {
    calendars.forEach((calendar, year) => {
      const days = calendar.days.map(day => day.date)
      const expected = new Date(Date.UTC(year, 11, 31)).getUTCFullYear() === year
        ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365)
        : 0

      expect(days.length, String(year)).toBe(expected)
      expect(new Set(days).size).toBe(expected)
      expect(days[0]).toBe(`${year}-01-01`)
      expect(days.at(-1)).toBe(`${year}-12-31`)
      expect([...days].sort()).toEqual(days)
    })
  })

  it('names the edition and retrieval date a visitor would need to find the same file', () => {
    calendars.forEach((calendar) => {
      const cited = citedEditions(calendar.layers)

      expect(cited.length).toBeGreaterThan(0)
      cited.forEach((edition) => {
        expect(edition.edition).not.toBe('')
        expect(edition.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(edition.checksum).toMatch(/^sha256-[0-9a-f]{64}$/)
      })
    })
  })

  it('marks the year the authority reissued as revised, and the rest as published', () => {
    const revised = datasets.filter(dataset => dataset.layers.official.status === 'revised')

    expect(revised.map(dataset => dataset.year)).toEqual([2025])
    expect(revised[0]!.layers.official.edition).toContain('1141020')
  })
})

describe('the lunar layer', () => {
  it('matches every documented lunar vector inside the published years', () => {
    const inRange = taiwanCalendarLunarVectors.filter(vector => published(vector.date))
    expect(inRange.length).toBeGreaterThan(10)

    inRange.forEach((vector) => {
      expect(dayOn(vector.date).lunar, vector.date).toEqual({
        sexagenaryYear: vector.sexagenaryYear,
        zodiac: vector.zodiac,
        month: vector.month,
        leapMonth: vector.leapMonth,
        day: vector.day,
      })
    })
  })

  it('keeps a leap month under the number of the ordinary month before it', () => {
    expect(dayOn('2025-07-24').lunar).toMatchObject({ month: 6, leapMonth: false, day: 30 })
    expect(dayOn('2025-07-25').lunar).toMatchObject({ month: 6, leapMonth: true, day: 1 })
    expect(dayOn('2025-08-23').lunar).toMatchObject({ month: 7, leapMonth: false, day: 1 })
  })

  it('advances one lunar day per calendar day and never past the thirtieth', () => {
    calendars.forEach((calendar, year) => {
      calendar.days.forEach((day, index) => {
        expect(day.lunar.day, day.date).toBeGreaterThanOrEqual(1)
        expect(day.lunar.day, day.date).toBeLessThanOrEqual(30)

        const previous = calendar.days[index - 1]
        if (!previous) return
        const sameMonth = previous.lunar.month === day.lunar.month && previous.lunar.leapMonth === day.lunar.leapMonth
        expect(sameMonth ? day.lunar.day - previous.lunar.day : day.lunar.day, `${year} ${day.date}`).toBe(1)
      })
    })
  })

  it('carries the lunar month across the Gregorian year boundary', () => {
    expect(dayOn('2025-12-31').lunar).toMatchObject({ month: 11, day: 12 })
    expect(dayOn('2026-01-01').lunar).toMatchObject({ month: 11, day: 13 })
  })
})

describe('the solar-term layer', () => {
  it('matches every documented solar-term vector inside the published years', () => {
    const inRange = taiwanCalendarSolarTermVectors.filter(vector => published(vector.date))
    expect(inRange.length).toBeGreaterThan(20)

    inRange.forEach((vector) => {
      expect(dayOn(vector.date).solarTerm, `${vector.name} ${vector.date}`)
        .toEqual({ name: vector.name, time: vector.time })
    })
  })

  it('reads the calendar day in Taiwan time, where a UTC reading would slip a day', () => {
    const shifted = taiwanCalendarSolarTermVectors.filter(vector => vector.utcDate !== vector.date)
    expect(shifted.length).toBeGreaterThan(0)

    shifted.forEach((vector) => {
      const taiwan = Date.parse(`${vector.date}T${vector.time}:00Z`)
      const utc = new Date(taiwan - taiwanCalendarUtcOffsetMinutes * 60 * 1000)
      expect(utc.toISOString().slice(0, 10), vector.name).toBe(vector.utcDate)
      if (published(vector.date)) expect(dayOn(vector.date).solarTerm?.name).toBe(vector.name)
    })
  })

  it('gives every year all twenty-four terms once, in order, on distinct days', () => {
    calendars.forEach((calendar, year) => {
      const terms = calendar.days.filter(day => day.solarTerm)

      expect(terms.map(day => day.solarTerm!.name), String(year)).toEqual([...solarTermNames])
      expect(new Set(terms.map(day => day.date)).size).toBe(solarTermNames.length)
    })
  })
})

describe('the official layer', () => {
  it('matches every documented official-day vector inside the published years', () => {
    const inRange = taiwanCalendarOfficialDayVectors.filter(vector => published(vector.date))
    expect(inRange.length).toBeGreaterThan(20)

    inRange.forEach((vector) => {
      expect(dayOn(vector.date).official, vector.date).toEqual({
        kind: vector.kind,
        holidays: [...vector.holidays],
        label: vector.label,
      })
    })
  })

  it('reads an unannotated day off the weekday and nothing else', () => {
    expect(dayOn('2026-01-02').official).toEqual({ kind: 'workday', holidays: [], label: '' })
    expect(dayOn('2026-01-03').official).toEqual({ kind: 'weekend', holidays: [], label: '' })

    calendars.forEach((calendar) => {
      calendar.days.filter(day => !day.official.label).forEach((day) => {
        expect(day.official.kind, day.date).toBe(day.isoWeekday >= 6 ? 'weekend' : 'workday')
      })
    })
  })

  it('takes every annotation from the reviewed whitelist', () => {
    const reviewed = new Map(taiwanCalendarNoteLabels.map(label => [label.label, label]))

    calendars.forEach((calendar) => {
      calendar.days.filter(day => day.official.label).forEach((day) => {
        const label = reviewed.get(day.official.label)

        expect(label, `${day.date} ${day.official.label}`).toBeDefined()
        expect(day.official.kind).toBe(label!.kind)
        expect(day.official.holidays).toEqual([...label!.holidays])
      })
    })
  })

  it('puts makeup workdays on Saturdays and adjusted holidays on weekdays', () => {
    calendars.forEach((calendar) => {
      calendar.days.forEach((day) => {
        if (day.official.kind === 'makeup-workday') expect(day.isoWeekday, day.date).toBe(6)
        if (day.official.kind === 'substitute-holiday' || day.official.kind === 'bridge-holiday') {
          expect(day.isoWeekday, day.date).toBeLessThan(6)
        }
      })
    })
  })

  it('hangs a holiday id only on a national holiday, and uses every published id', () => {
    const used = new Set<string>()

    calendars.forEach((calendar) => {
      calendar.days.forEach((day) => {
        if (day.official.holidays.length) expect(day.official.kind, day.date).toBe('national-holiday')
        day.official.holidays.forEach(holiday => used.add(holiday))
      })
    })

    expect([...used].sort()).toEqual([...officialHolidayIds].sort())
  })

  it('drops the makeup workday in the years the directions deleted it, and keeps it where it existed', () => {
    const makeupYears = [...calendars.entries()]
      .filter(([, calendar]) => calendar.days.some(day => day.official.kind === 'makeup-workday'))
      .map(([year]) => year)

    expect(makeupYears).toContain(2024)
    expect(makeupYears).toContain(2025)
    expect(makeupYears).not.toContain(2026)
    expect(makeupYears).not.toContain(2027)
  })
})

describe('cross-layer agreement', () => {
  it('puts Tomb Sweeping Day on the Qingming solar term rather than a fixed date', () => {
    const dates = new Set<string>()

    calendars.forEach((calendar) => {
      const qingming = calendar.days.find(day => day.solarTerm?.name === '清明')!
      calendar.days
        .filter(day => day.official.holidays.includes('tomb-sweeping-day'))
        .forEach(day => expect(day.date, calendar.year.toString()).toBe(qingming.date))
      dates.add(qingming.date.slice(5))
    })

    // Both 4 and 5 April occur, which is why the date cannot be hard-coded.
    expect(dates.size).toBeGreaterThan(1)
  })

  it('puts Spring Festival on the first three days of the first lunar month', () => {
    calendars.forEach((calendar) => {
      calendar.days
        .filter(day => day.official.holidays.includes('spring-festival'))
        .forEach((day) => {
          expect(day.lunar, day.date).toMatchObject({ month: 1, leapMonth: false })
          expect(day.lunar.day, day.date).toBeLessThanOrEqual(3)
        })
    })
  })

  it('puts Lunar New Year\'s Eve on the day before the first, on the 29th or the 30th', () => {
    const days = [...calendars.values()].flatMap(calendar =>
      calendar.days.filter(day => day.official.holidays.includes('lunar-new-years-eve')))
    expect(days.length).toBeGreaterThan(1)

    days.forEach((day) => {
      expect(day.lunar.month, day.date).toBe(12)
      expect([29, 30], day.date).toContain(day.lunar.day)
    })
    // Both lengths occur, so neither can be assumed.
    expect(new Set(days.map(day => day.lunar.day)).size).toBe(2)
  })
})

describe('the month grid', () => {
  it('lays a month out as whole weeks starting on Sunday', () => {
    const calendar = calendars.get(2026)!
    const grid = getMonthGrid(calendar, 1)

    expect(grid.every(week => week.length === 7)).toBe(true)
    expect(grid[0]!.slice(0, 4)).toEqual([null, null, null, null])
    expect(grid[0]![4]!.date).toBe('2026-01-01')
    expect(grid.flat().filter(Boolean).map(day => day!.date)).toEqual(getMonthDays(calendar, 1).map(day => day.date))
  })

  it('leaves the neighbouring months blank rather than borrowing days this year does not cover', () => {
    const grid = getMonthGrid(calendars.get(2026)!, 12)
    const days = grid.flat()

    expect(days.filter(Boolean).every(day => day!.date.startsWith('2026-12'))).toBe(true)
    expect(days.at(-1)).toBeNull()
  })

  it('gives every month of every year a grid that holds all of its days', () => {
    calendars.forEach((calendar) => {
      for (let month = 1; month <= 12; month += 1) {
        const grid = getMonthGrid(calendar, month)
        expect(grid.flat().filter(Boolean).length, `${calendar.year}-${month}`).toBe(getMonthDays(calendar, month).length)
      }
    })
  })
})

describe('which year a visitor may ask for', () => {
  it('refuses a year that is not a whole number before looking at the range', () => {
    expect(resolveYearRequest(Number.NaN)).toEqual({ ok: false, refusal: { code: 'invalid-year', year: Number.NaN } })
    expect(resolveYearRequest(2026.5).ok).toBe(false)
  })

  it('accepts every published year', () => {
    availableYears.forEach(year => expect(resolveYearRequest(year), String(year)).toEqual({ ok: true, year }))
  })

  it('calls a year the authority has not decided unannounced, not out of range', () => {
    const unannounced = taiwanCalendarCoverage.official.lastYear + 1

    expect(unannounced).toBeLessThanOrEqual(taiwanCalendarCoverage.astronomical.lastYear)
    expect(resolveYearRequest(unannounced)).toEqual({
      ok: false,
      refusal: { code: 'year-not-announced', year: unannounced },
    })
  })

  it('calls a year no layer covers out of range', () => {
    expect(resolveYearRequest(1911).ok).toBe(false)
    expect(resolveYearRequest(taiwanCalendarPublishableYears.firstYear - 1))
      .toMatchObject({ refusal: { code: 'year-out-of-range' } })
    expect(resolveYearRequest(taiwanCalendarCoverage.astronomical.lastYear + 1))
      .toMatchObject({ refusal: { code: 'year-out-of-range' } })
  })
})

describe('bringing a year onto the device', () => {
  it('builds the calendar when the year module loads', async () => {
    const load = await loadCalendarYear(2026)

    expect(load).toMatchObject({ ok: true })
    expect(load.ok && findDay(load.calendar, '2026-02-17')?.official.holidays).toEqual(['spring-festival'])
  })

  it('says a year is not downloaded when its module cannot be fetched, rather than showing holes', async () => {
    const load = await loadCalendarYear(2026, { load: () => Promise.reject(new Error('offline')) })

    expect(load).toEqual({ ok: false, refusal: { code: 'year-not-downloaded', year: 2026 } })
  })

  it('treats a year with no module at all as one the authority has not announced', async () => {
    const load = await loadCalendarYear(2026, { load: () => undefined })

    expect(load).toEqual({ ok: false, refusal: { code: 'year-not-announced', year: 2026 } })
  })

  it('refuses a malformed year rather than rendering a partly readable one', async () => {
    const load = await loadCalendarYear(2026, { load: () => Promise.resolve({ default: { year: 2026 } }) })

    expect(load).toEqual({ ok: false, refusal: { code: 'year-not-downloaded', year: 2026 } })
  })

  it('reports a load the caller has already moved on from instead of painting it', async () => {
    const controller = new AbortController()
    controller.abort()

    expect(await loadCalendarYear(2026, { signal: controller.signal })).toEqual({ ok: false, cancelled: true })
  })

  it('refuses an out-of-range year before it opens any module', async () => {
    const load = await loadCalendarYear(1911, { load: () => { throw new Error('must not be called') } })

    expect(load).toEqual({ ok: false, refusal: { code: 'year-out-of-range', year: 1911 } })
  })
})
