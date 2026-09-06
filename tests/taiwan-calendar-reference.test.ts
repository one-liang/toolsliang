import { describe, expect, it } from 'vitest'
import {
  calendarDataStatuses,
  dgpaHolidayFlags,
  lunarDayRange,
  lunarMonthRange,
  officialDayKinds,
  officialHolidayIds,
  rocEpochOffset,
  rocFirstGregorianYear,
  solarTermNames,
  taiwanCalendarEditionDiffVectors,
  taiwanCalendarIngestionErrorCodes,
  taiwanCalendarLayers,
  taiwanCalendarLunarVectors,
  taiwanCalendarNoteLabels,
  taiwanCalendarOfficialDayVectors,
  taiwanCalendarRocVectors,
  taiwanCalendarSolarTermVectors,
  taiwanCalendarTimeZone,
  taiwanCalendarUtcOffsetMinutes,
  taiwanCalendarViewErrorCodes,
  type OfficialDayKind,
  type OfficialHolidayId,
} from '@/features/tools/taiwan-calendar/domain/reference'
import {
  taiwanCalendarCaveatKeys,
  taiwanCalendarContentReview,
  taiwanCalendarCoverage,
  taiwanCalendarDatasets,
  taiwanCalendarPublishableYears,
  taiwanCalendarReferenceVersion,
} from '@/features/tools/taiwan-calendar/domain/sources'
import {
  parseCaveatKeys,
  parseDatasetCoverage,
  parseDayKinds,
  parseEditionDiffVectors,
  parseIngestionErrorCodes,
  parseLayerKeys,
  parseLunarVectors,
  parseNoteLabels,
  parseOfficialDayVectors,
  parseRocVectors,
  parseSolarTermVectors,
  parseStatusKeys,
  parseViewErrorCodes,
  taiwanCalendarDecisionRecord as decisionRecord,
} from './support/taiwan-calendar-decision-record'

/** The kinds a day carries because the source annotated it, not because of its weekday. */
const annotatedKinds: OfficialDayKind[] = [
  'national-holiday',
  'substitute-holiday',
  'bridge-holiday',
  'makeup-workday',
]

function labelFor(label: string) {
  const entry = taiwanCalendarNoteLabels.find(candidate => candidate.label === label)
  if (!entry) throw new Error(`No whitelisted 備註 label ${JSON.stringify(label)}`)

  return entry
}

function isoWeekday(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()

  return day === 0 ? 7 : day
}

function shiftDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)

  return shifted.toISOString().slice(0, 10)
}

function lunarVectorFor(date: string) {
  return taiwanCalendarLunarVectors.find(vector => vector.date === date)
}

function officialVectorsWithHoliday(holiday: OfficialHolidayId) {
  return taiwanCalendarOfficialDayVectors.filter(vector => vector.holidays.includes(holiday))
}

describe('civil layer', () => {
  it('lists the four layers the decision record separates', () => {
    expect([...taiwanCalendarLayers]).toEqual(['civil', 'lunar', 'solar-term', 'official'])
    expect(parseLayerKeys()).toEqual([...taiwanCalendarLayers])
  })

  it('converts the ROC year by subtracting the epoch offset', () => {
    expect(rocEpochOffset).toBe(1911)
    expect(rocFirstGregorianYear).toBe(rocEpochOffset + 1)
  })

  it('matches the decision record row for row', () => {
    const documented = parseRocVectors()

    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual(taiwanCalendarRocVectors.map(vector => ({ ...vector })))
  })

  it('numbers the weekday with Monday as 1 and Sunday as 7, where Date.getDay() says 0', () => {
    taiwanCalendarRocVectors.forEach((vector) => {
      expect(vector.isoWeekday).toBe(isoWeekday(vector.date))
      expect(vector.isoWeekday).toBeGreaterThanOrEqual(1)
      expect(vector.isoWeekday).toBeLessThanOrEqual(7)
    })

    const sundays = taiwanCalendarRocVectors.filter(vector => vector.isoWeekday === 7)

    expect(sundays.length).toBeGreaterThan(0)
    sundays.forEach((vector) => {
      expect(new Date(`${vector.date}T00:00:00Z`).getUTCDay()).toBe(0)
    })
  })

  it('carries a week across the Gregorian year boundary without restarting the weekday count', () => {
    const lastDay = taiwanCalendarRocVectors.find(vector => vector.date === '2026-12-31')
    const nextDay = taiwanCalendarRocVectors.find(vector => vector.date === '2027-01-01')

    expect(lastDay?.isoWeekday).toBe(4)
    expect(nextDay?.isoWeekday).toBe(5)
    expect(lastDay?.rocYear).not.toBe(nextDay?.rocYear)
  })

  it('gives no ROC year before the calendar era begins, rather than a zero or negative year', () => {
    taiwanCalendarRocVectors.forEach((vector) => {
      const gregorianYear = Number(vector.date.slice(0, 4))

      if (gregorianYear < rocFirstGregorianYear) {
        expect(vector.rocYear).toBeNull()
        return
      }

      expect(vector.rocYear).toBe(gregorianYear - rocEpochOffset)
      expect(vector.rocYear).toBeGreaterThan(0)
    })
  })

  it('reads every date in Taiwan time, which is a fixed offset with no daylight saving', () => {
    expect(taiwanCalendarTimeZone).toBe('Asia/Taipei')
    expect(taiwanCalendarUtcOffsetMinutes).toBe(8 * 60)
  })
})

describe('official day contract', () => {
  it('publishes the same day kinds as the decision record, in the same order', () => {
    expect([...officialDayKinds]).toEqual([
      'workday',
      'weekend',
      'national-holiday',
      'substitute-holiday',
      'bridge-holiday',
      'makeup-workday',
    ])
    expect(parseDayKinds()).toEqual([...officialDayKinds])
  })

  it('accepts only the two flag values the source publishes', () => {
    expect(dgpaHolidayFlags).toEqual({ workday: '0', holiday: '2' })
  })

  it('matches the whitelist in the decision record row for row', () => {
    const documented = parseNoteLabels()

    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual(taiwanCalendarNoteLabels.map(({ label, kind, holidays }) => ({
      label,
      kind,
      holidays: [...holidays],
    })))
  })

  it('whitelists a label only for a kind the source actually annotates', () => {
    taiwanCalendarNoteLabels.forEach((entry) => {
      expect(annotatedKinds).toContain(entry.kind)
    })
  })

  it('attaches holidays to national holidays only, and never an empty list there', () => {
    taiwanCalendarNoteLabels.forEach((entry) => {
      expect(entry.holidays.length > 0).toBe(entry.kind === 'national-holiday')
      entry.holidays.forEach(holiday => expect(officialHolidayIds).toContain(holiday))
    })
  })

  it('reaches every published holiday id from at least one label', () => {
    officialHolidayIds.forEach((holiday) => {
      expect(taiwanCalendarNoteLabels.some(entry => entry.holidays.includes(holiday))).toBe(true)
    })
  })

  it('never whitelists the same label twice, so a lookup cannot be ambiguous', () => {
    const labels = taiwanCalendarNoteLabels.map(entry => entry.label)

    expect(new Set(labels).size).toBe(labels.length)
  })

  it('keeps more than one wording for the same holiday, because the source is not consistent', () => {
    const teachersDay = taiwanCalendarNoteLabels.filter(entry => entry.holidays.includes('teachers-day'))
    const tombSweeping = taiwanCalendarNoteLabels.filter(entry => entry.holidays.includes('tomb-sweeping-day'))

    expect(teachersDay.map(entry => entry.label)).toEqual(['孔子誕辰紀念日/教師節', '孔子誕辰紀念日'])
    expect(tombSweeping.length).toBeGreaterThan(1)
  })

  it('lets one day carry two holidays, as the source does when 兒童節 falls on 清明', () => {
    expect(labelFor('兒童節及民族掃墓節').holidays).toEqual(['childrens-day', 'tomb-sweeping-day'])
  })

  it('matches the day vectors in the decision record row for row', () => {
    const documented = parseOfficialDayVectors()

    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual(taiwanCalendarOfficialDayVectors.map(({ date, kind, holidays, label }) => ({
      date,
      kind,
      holidays: [...holidays],
      label,
    })))
  })

  it('derives every annotated vector from the whitelist rather than from its own kind', () => {
    taiwanCalendarOfficialDayVectors
      .filter(vector => vector.label !== '')
      .forEach((vector) => {
        const entry = labelFor(vector.label)

        expect(vector.kind).toBe(entry.kind)
        expect([...vector.holidays]).toEqual([...entry.holidays])
      })
  })

  it('classifies an unannotated day by its weekday alone, covering both a weekday and a weekend', () => {
    const unannotated = taiwanCalendarOfficialDayVectors.filter(vector => vector.label === '')

    expect(unannotated.map(vector => vector.kind).sort()).toEqual(['weekend', 'workday'])
    unannotated.forEach((vector) => {
      const weekend = isoWeekday(vector.date) >= 6

      expect(vector.kind).toBe(weekend ? 'weekend' : 'workday')
      expect(vector.holidays).toEqual([])
    })
  })

  it('makes the makeup workday the only annotated kind that is still a working day', () => {
    const stillWorking = taiwanCalendarOfficialDayVectors
      .filter(vector => vector.label !== '' && labelFor(vector.label).kind === 'makeup-workday')

    expect(stillWorking.length).toBeGreaterThan(0)
    stillWorking.forEach(vector => expect(isoWeekday(vector.date)).toBe(6))

    const otherAnnotated = taiwanCalendarOfficialDayVectors
      .filter(vector => vector.label !== '' && vector.kind !== 'makeup-workday')

    expect(otherAnnotated.length).toBeGreaterThan(0)
    otherAnnotated.forEach(vector => expect(annotatedKinds).toContain(vector.kind))
    expect(otherAnnotated.some(vector => vector.kind === 'workday')).toBe(false)
  })

  it('carries a substitute holiday for a holiday in the next year, which no single rule derives', () => {
    const crossYear = taiwanCalendarOfficialDayVectors.find(vector => vector.date === '2027-12-31')

    expect(crossYear).toMatchObject({ kind: 'substitute-holiday', label: '補假' })
    expect(isoWeekday('2028-01-01')).toBe(6)
  })

  it('resolves 兒童節 landing on 清明 in both directions, so neither one can be hard-coded', () => {
    const thursday = taiwanCalendarOfficialDayVectors.find(vector => vector.date === '2024-04-05')
    const friday = taiwanCalendarOfficialDayVectors.find(vector => vector.date === '2025-04-03')

    expect(thursday?.kind).toBe('substitute-holiday')
    expect(friday?.kind).toBe('substitute-holiday')
    expect(isoWeekday('2024-04-04')).toBe(4)
    expect(isoWeekday('2025-04-04')).toBe(5)
  })

  it('places every substitute and bridge holiday on a Monday-to-Friday date', () => {
    const restored = taiwanCalendarOfficialDayVectors
      .filter(vector => vector.kind === 'substitute-holiday' || vector.kind === 'bridge-holiday')

    expect(restored.length).toBeGreaterThan(0)
    restored.forEach(vector => expect(isoWeekday(vector.date)).toBeLessThanOrEqual(5))
  })

  it('exercises every day kind at least once', () => {
    officialDayKinds.forEach((kind) => {
      expect(taiwanCalendarOfficialDayVectors.some(vector => vector.kind === kind)).toBe(true)
    })
  })
})

describe('lunar layer', () => {
  it('matches the decision record row for row', () => {
    const documented = parseLunarVectors()

    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual(taiwanCalendarLunarVectors.map(vector => ({ ...vector })))
  })

  it('keeps every lunar month and day inside the range the source publishes', () => {
    expect(lunarMonthRange).toEqual({ min: 1, max: 12 })
    expect(lunarDayRange).toEqual({ min: 1, max: 30 })
    taiwanCalendarLunarVectors.forEach((vector) => {
      expect(vector.month).toBeGreaterThanOrEqual(lunarMonthRange.min)
      expect(vector.month).toBeLessThanOrEqual(lunarMonthRange.max)
      expect(vector.day).toBeGreaterThanOrEqual(lunarDayRange.min)
      expect(vector.day).toBeLessThanOrEqual(lunarDayRange.max)
    })
  })

  it('gives a leap month the same number as the ordinary month it repeats', () => {
    const leapVectors = taiwanCalendarLunarVectors.filter(vector => vector.leapMonth)

    expect(leapVectors.length).toBeGreaterThan(0)
    leapVectors.forEach((leap) => {
      const ordinary = taiwanCalendarLunarVectors.find(vector =>
        !vector.leapMonth
        && vector.month === leap.month
        && vector.sexagenaryYear === leap.sexagenaryYear
        && vector.date < leap.date)

      expect(ordinary, `no ordinary month ${leap.month} before ${leap.date}`).toBeDefined()
    })
  })

  it('starts the lunar year on the first day of the first month, not on 1 January', () => {
    const newYearsDay = lunarVectorFor('2026-01-01')
    const springFestival = lunarVectorFor('2026-02-17')

    expect(newYearsDay).toMatchObject({ sexagenaryYear: '乙巳', month: 11 })
    expect(springFestival).toMatchObject({ sexagenaryYear: '丙午', month: 1, day: 1 })
  })

  it('spans the first three days of the first lunar month for 春節, not just its first day', () => {
    const springFestival = officialVectorsWithHoliday('spring-festival')
      .map(vector => lunarVectorFor(vector.date))
      .filter(lunar => lunar !== undefined)

    expect(springFestival.length).toBeGreaterThan(1)
    springFestival.forEach((lunar) => {
      expect(lunar).toMatchObject({ month: 1, leapMonth: false })
      expect(lunar!.day).toBeGreaterThanOrEqual(1)
      expect(lunar!.day).toBeLessThanOrEqual(3)
    })
    expect(new Set(springFestival.map(lunar => lunar!.day)).size).toBeGreaterThan(1)
  })

  it('puts 農曆除夕 on the day before the first lunar month, whether it is the 29th or the 30th', () => {
    const eves = officialVectorsWithHoliday('lunar-new-years-eve')
      .map(vector => ({ vector, lunar: lunarVectorFor(vector.date) }))
      .filter(entry => entry.lunar)

    expect(eves.length).toBeGreaterThan(0)
    eves.forEach(({ vector, lunar }) => {
      expect(lunar!.month).toBe(12)
      expect([29, 30]).toContain(lunar!.day)

      const nextDay = lunarVectorFor(shiftDate(vector.date, 1))
      if (nextDay) expect(nextDay).toMatchObject({ month: 1, day: 1 })
    })
  })

  it('covers a 29-day and a 30-day final lunar month, so the eve is never assumed to be the 30th', () => {
    const eveDays = officialVectorsWithHoliday('lunar-new-years-eve')
      .map(vector => lunarVectorFor(vector.date)?.day)
      .filter((day): day is number => day !== undefined)

    expect(new Set(eveDays)).toEqual(new Set([29, 30]))
  })
})

describe('solar term layer', () => {
  it('names the twenty-four terms in the order the source tabulates them', () => {
    expect(solarTermNames).toHaveLength(24)
    expect(solarTermNames[0]).toBe('小寒')
    expect(solarTermNames[23]).toBe('冬至')
    expect(new Set(solarTermNames).size).toBe(24)
  })

  it('matches the decision record row for row', () => {
    const documented = parseSolarTermVectors()

    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual(taiwanCalendarSolarTermVectors.map(vector => ({ ...vector })))
  })

  it('only uses published term names', () => {
    taiwanCalendarSolarTermVectors.forEach((vector) => {
      expect(solarTermNames).toContain(vector.name)
    })
  })

  it('tabulates a whole year of terms once each, in the published order', () => {
    const year2026 = taiwanCalendarSolarTermVectors.filter(vector => vector.date.startsWith('2026-'))

    expect(year2026.map(vector => vector.name)).toEqual([...solarTermNames])
    expect([...year2026].sort((a, b) => a.date.localeCompare(b.date))).toEqual(year2026)
  })

  it('derives the UTC date from the Taiwan time, so the offset cannot be fudged', () => {
    taiwanCalendarSolarTermVectors.forEach((vector) => {
      const taipei = Date.parse(`${vector.date}T${vector.time}:00Z`)
      const utc = new Date(taipei - taiwanCalendarUtcOffsetMinutes * 60_000)

      expect(vector.utcDate).toBe(utc.toISOString().slice(0, 10))
    })
  })

  it('keeps terms whose UTC date falls a day earlier, which is what proves the time zone matters', () => {
    const shifted = taiwanCalendarSolarTermVectors.filter(vector => vector.utcDate !== vector.date)

    expect(shifted.map(vector => vector.name)).toContain('清明')
    shifted.forEach((vector) => {
      expect(vector.utcDate).toBe(shiftDate(vector.date, -1))
      expect(Number(vector.time.slice(0, 2))).toBeLessThan(8)
    })
  })

  it('dates 民族掃墓節 on the 清明 term of the same year, which is why the term is not decoration', () => {
    const tombSweeping = officialVectorsWithHoliday('tomb-sweeping-day')

    expect(tombSweeping.length).toBeGreaterThan(0)
    tombSweeping.forEach((vector) => {
      const term = taiwanCalendarSolarTermVectors
        .find(candidate => candidate.name === '清明' && candidate.date.startsWith(vector.date.slice(0, 4)))

      expect(term?.date, `no 清明 vector for ${vector.date}`).toBe(vector.date)
    })
  })
})

describe('year status, coverage and errors', () => {
  it('publishes the same year statuses as the decision record', () => {
    expect(parseStatusKeys()).toEqual([...calendarDataStatuses])
  })

  it('publishes the ingestion and view error keys in the documented check order', () => {
    expect(parseIngestionErrorCodes()).toEqual([...taiwanCalendarIngestionErrorCodes])
    expect(parseViewErrorCodes()).toEqual([...taiwanCalendarViewErrorCodes])
  })

  it('keeps the two error vocabularies apart, because one is read by a maintainer and one by a visitor', () => {
    taiwanCalendarViewErrorCodes.forEach((code) => {
      expect(taiwanCalendarIngestionErrorCodes).not.toContain(code)
    })
  })

  it('takes each layer coverage from the dataset that supplies it', () => {
    Object.values(taiwanCalendarCoverage).forEach((coverage) => {
      const dataset = taiwanCalendarDatasets.find(candidate => candidate.id === coverage.datasetId)

      expect(dataset).toBeDefined()
      expect(coverage.firstYear).toBe(dataset!.coverage.firstYear)
      expect(coverage.lastYear).toBe(dataset!.coverage.lastYear)
      expect(coverage.firstYear).toBeLessThanOrEqual(coverage.lastYear)
    })
  })

  it('publishes a year only where every sourced layer covers it', () => {
    const ranges = Object.values(taiwanCalendarCoverage)

    expect(taiwanCalendarPublishableYears.firstYear).toBe(Math.max(...ranges.map(range => range.firstYear)))
    expect(taiwanCalendarPublishableYears.lastYear).toBe(Math.min(...ranges.map(range => range.lastYear)))
  })

  it('leaves the years one layer already covers and the other has not announced', () => {
    expect(taiwanCalendarCoverage.astronomical.lastYear)
      .toBeGreaterThan(taiwanCalendarCoverage.official.lastYear)
    expect(taiwanCalendarPublishableYears.lastYear).toBe(taiwanCalendarCoverage.official.lastYear)
  })

  it('keeps every official day vector inside the years that layer was confirmed to cover', () => {
    expect(taiwanCalendarOfficialDayVectors.length).toBeGreaterThan(0)
    taiwanCalendarOfficialDayVectors.forEach((vector) => {
      const year = Number(vector.date.slice(0, 4))

      expect(year).toBeGreaterThanOrEqual(taiwanCalendarCoverage.official.firstYear)
      expect(year).toBeLessThanOrEqual(taiwanCalendarCoverage.official.lastYear)
    })
  })

  it('cross-checks the lunar layer only inside the window the second opinion covers', () => {
    const secondOpinion = taiwanCalendarDatasets.find(dataset => dataset.id === 'hko-lunar-calendar')!

    expect(secondOpinion.coverage.firstYear).toBeGreaterThan(taiwanCalendarCoverage.astronomical.firstYear)
    expect(decisionRecord).toContain('這個第二意見有窗口')
  })
})

describe('edition changes', () => {
  it('matches the decision record row for row', () => {
    const documented = parseEditionDiffVectors()

    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual(taiwanCalendarEditionDiffVectors.map(({ date, before, after }) => ({
      date,
      before: { ...before },
      after: { ...after },
    })))
  })

  it('records a real change on every row, so the diff table cannot fill up with noise', () => {
    taiwanCalendarEditionDiffVectors.forEach((vector) => {
      expect(vector.before).not.toEqual(vector.after)
    })
  })

  it('classifies both sides of a change with the same whitelist the ingestion uses', () => {
    taiwanCalendarEditionDiffVectors.forEach((vector) => {
      [vector.before, vector.after].forEach((side) => {
        if (side.label === '') {
          expect(['workday', 'weekend']).toContain(side.kind)
          return
        }

        expect(side.kind).toBe(labelFor(side.label).kind)
      })
    })
  })

  it('shows a year gaining holidays after it was already published, which is why an edition is displayed', () => {
    const gained = taiwanCalendarEditionDiffVectors
      .filter(vector => vector.after.kind === 'national-holiday' && vector.before.kind !== 'national-holiday')

    expect(gained.length).toBeGreaterThan(0)
    gained.forEach(vector => expect(vector.date.startsWith('2025-')).toBe(true))
  })

  it('carries the later edition into the day vectors, not the superseded one', () => {
    taiwanCalendarEditionDiffVectors.forEach((vector) => {
      const published = taiwanCalendarOfficialDayVectors.find(candidate => candidate.date === vector.date)

      expect(published, `${vector.date} changed between editions but has no day vector`).toBeDefined()
      expect(published!.kind).toBe(vector.after.kind)
      expect(published!.label).toBe(vector.after.label)
    })
  })
})

describe('datasets, sources and caveats', () => {
  it('names the reviewed reference version in the decision record, dated by its review', () => {
    expect(decisionRecord).toContain(taiwanCalendarReferenceVersion)
    expect(taiwanCalendarReferenceVersion).toContain(taiwanCalendarContentReview.reviewedAt)
  })

  it('lists the same dataset ids and reviewed coverage as the decision record, in the same order', () => {
    expect(parseDatasetCoverage()).toEqual(taiwanCalendarDatasets.map(dataset => ({
      datasetId: dataset.id,
      firstYear: dataset.coverage.firstYear,
      lastYear: dataset.coverage.lastYear,
    })))
  })

  it('records the licence, cadence and reviewed coverage of every dataset', () => {
    expect(taiwanCalendarDatasets.length).toBeGreaterThan(0)
    taiwanCalendarDatasets.forEach((dataset) => {
      expect(dataset.url.startsWith('https://')).toBe(true)
      expect(dataset.licenceUrl.startsWith('https://')).toBe(true)
      expect(decisionRecord).toContain(dataset.url)
      expect(dataset.name['zh-tw'].length).toBeGreaterThan(0)
      expect(dataset.name.en.length).toBeGreaterThan(0)
      expect(dataset.publisher['zh-tw'].length).toBeGreaterThan(0)
      expect(dataset.cadence['zh-tw'].length).toBeGreaterThan(0)
      expect(dataset.cadence.en.length).toBeGreaterThan(0)
      expect(dataset.coverage.firstYear).toBeLessThanOrEqual(dataset.coverage.lastYear)
    })
  })

  it('bakes every dataset at build time, so a calendar view makes no third-party request', () => {
    taiwanCalendarDatasets.forEach(dataset => expect(dataset.ingestion).toBe('build-time'))
  })

  it('dates the review and the newest edition it cites', () => {
    expect(taiwanCalendarContentReview.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(taiwanCalendarContentReview.sourceEffectiveAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(taiwanCalendarContentReview.reviewedAt >= taiwanCalendarContentReview.sourceEffectiveAt).toBe(true)
  })

  it('cites every source the tool page will link', () => {
    expect(taiwanCalendarContentReview.sources.length).toBeGreaterThan(0)
    taiwanCalendarContentReview.sources.forEach((source) => {
      expect(source.url.startsWith('https://')).toBe(true)
      expect(decisionRecord).toContain(source.url)
      expect(source.title['zh-tw'].length).toBeGreaterThan(0)
      expect(source.title.en.length).toBeGreaterThan(0)
    })
  })

  it('links every dataset from the citations the page shows', () => {
    const cited = taiwanCalendarContentReview.sources.map(source => source.url)

    taiwanCalendarDatasets.forEach((dataset) => {
      expect(cited).toContain(dataset.url)
    })
  })

  it('publishes the same caveat keys as the decision record', () => {
    expect(parseCaveatKeys()).toEqual([...taiwanCalendarCaveatKeys])
  })
})
