import { describe, expect, it } from 'vitest'
import {
  getTaiwanCalendarCaveats,
  getTaiwanCalendarCopy,
  describeCivilDate,
  describeDayMark,
  describeLunarDate,
  describeLunarDayMark,
  describeOfficialDay,
  describeSolarTerm,
  officialDayKindLabels,
  officialHolidayLabels,
  solarTermLabels,
  taiwanCalendarCaveats,
  taiwanCalendarCopyKeys,
  taiwanCalendarFaq,
  taiwanCalendarViewErrorMessage,
  validateTaiwanCalendarContent,
} from '@/features/tools/taiwan-calendar/content'
import type { CalendarDay } from '@/features/tools/taiwan-calendar/domain/calendar'
import {
  officialDayKinds,
  officialHolidayIds,
  solarTermNames,
  taiwanCalendarViewErrorCodes,
} from '@/features/tools/taiwan-calendar/domain/reference'
import {
  taiwanCalendarCaveatKeys,
  taiwanCalendarPublishableYears,
} from '@/features/tools/taiwan-calendar/domain/sources'
import { supportedLocales, type LocaleCode } from '@/features/tools/catalog'
import {
  parseCaveatSentences,
  parseFaqQuestions,
  parseForbiddenWording,
  parseViewErrorSentences,
} from './support/taiwan-calendar-decision-record'

const locales: LocaleCode[] = [...supportedLocales]

function dayWith(overrides: Partial<CalendarDay>): CalendarDay {
  return {
    date: '2026-02-17',
    month: 2,
    dayOfMonth: 17,
    rocYear: 115,
    isoWeekday: 2,
    lunar: { sexagenaryYear: '丙午', zodiac: '馬', month: 1, leapMonth: false, day: 1 },
    solarTerm: null,
    official: { kind: 'national-holiday', holidays: ['spring-festival'], label: '春節' },
    ...overrides,
  }
}

describe('the reviewed wording', () => {
  it('passes its own completeness check', () => {
    expect(validateTaiwanCalendarContent()).toEqual([])
  })

  it('gives every interface string in both locales', () => {
    locales.forEach((locale) => {
      const copy = getTaiwanCalendarCopy(locale)

      expect(Object.keys(copy).sort()).toEqual([...taiwanCalendarCopyKeys].sort())
      Object.entries(copy).forEach(([key, value]) => expect(value.trim(), `${locale}:${key}`).not.toBe(''))
    })
  })

  it('names every day kind, holiday and solar term in both locales', () => {
    officialDayKinds.forEach(kind => locales.forEach(locale =>
      expect(officialDayKindLabels[kind][locale].trim(), `${kind}:${locale}`).not.toBe('')))
    officialHolidayIds.forEach(holiday => locales.forEach(locale =>
      expect(officialHolidayLabels[holiday][locale].trim(), `${holiday}:${locale}`).not.toBe('')))
    solarTermNames.forEach(term => locales.forEach(locale =>
      expect(solarTermLabels[term][locale].trim(), `${term}:${locale}`).not.toBe('')))
  })

  it('keeps the Chinese solar-term and holiday names in the English page, with a short gloss', () => {
    expect(solarTermLabels['清明'].en).toContain('清明')
    expect(officialHolidayLabels['tomb-sweeping-day'].en).toContain('Tomb Sweeping')
    expect(officialDayKindLabels['makeup-workday'].en).toContain('補班')
  })
})

describe('the disclaimers section 7.1 requires', () => {
  it('carries the record\'s sentence for every caveat, in both locales', () => {
    const documented = parseCaveatSentences()

    expect(documented.map(entry => entry.key)).toEqual([...taiwanCalendarCaveatKeys])
    documented.forEach((entry) => {
      expect(taiwanCalendarCaveats[entry.key as never]['zh-tw'], entry.key).toBe(entry['zh-tw'])
      expect(taiwanCalendarCaveats[entry.key as never].en, entry.key).toBe(entry.en)
    })
  })

  it('shows the five permanent caveats always, and the revision one only on a revised year', () => {
    const permanent = getTaiwanCalendarCaveats('zh-tw', { revised: false })
    const revised = getTaiwanCalendarCaveats('zh-tw', { revised: true })

    expect(permanent.map(caveat => caveat.key)).not.toContain('edition-may-change')
    expect(permanent).toHaveLength(taiwanCalendarCaveatKeys.length - 1)
    expect(revised.map(caveat => caveat.key)).toEqual([...taiwanCalendarCaveatKeys])
  })

  it('says the office calendar is not a company or school schedule', () => {
    expect(taiwanCalendarCaveats['government-agency-scope']['zh-tw']).toContain('學校、公司')
    expect(taiwanCalendarCaveats['no-personal-events']['zh-tw']).toContain('不需要也不儲存任何個人行程')
  })
})

describe('what a refused year is told', () => {
  it('uses the record\'s sentence for every view error, in both locales', () => {
    const documented = parseViewErrorSentences()

    expect(documented.map(entry => entry.key)).toEqual([...taiwanCalendarViewErrorCodes])
    documented.forEach((entry) => {
      locales.forEach((locale) => {
        const expected = entry[locale]
          .replace('{year}', '2035')
          .replace('{firstYear}', String(taiwanCalendarPublishableYears.firstYear))
          .replace('{lastYear}', String(taiwanCalendarPublishableYears.lastYear))

        expect(taiwanCalendarViewErrorMessage(entry.key as never, 2035, locale), `${entry.key}:${locale}`)
          .toBe(expected)
      })
    })
  })

  it('fills the published range from the coverage rather than from a typed-in year', () => {
    const message = taiwanCalendarViewErrorMessage('year-out-of-range', 2035, 'en')

    expect(message).toContain(String(taiwanCalendarPublishableYears.firstYear))
    expect(message).toContain(String(taiwanCalendarPublishableYears.lastYear))
    expect(message).toContain('2035')
    expect(message).not.toContain('{')
  })
})

describe('how one day reads', () => {
  it('writes a lunar date the way each locale writes it', () => {
    const day = dayWith({})

    expect(describeLunarDate(day.lunar, 'zh-tw')).toBe('丙午年（馬）正月初一')
    expect(describeLunarDate(day.lunar, 'en')).toContain('丙午')
    expect(describeLunarDate(day.lunar, 'en')).toContain('1st lunar month')
  })

  it('marks a leap month as a leap month rather than as another ordinary month', () => {
    const leap = { sexagenaryYear: '乙巳', zodiac: '蛇', month: 6, leapMonth: true, day: 1 }

    expect(describeLunarDate(leap, 'zh-tw')).toContain('閏六月')
    expect(describeLunarDate(leap, 'en')).toContain('leap')
  })

  it('names the holidays a day carries, not the raw source annotation', () => {
    expect(describeOfficialDay(dayWith({}).official, 'zh-tw')).toBe('春節（國定放假日）')
    expect(describeOfficialDay(dayWith({}).official, 'en')).toContain('Spring Festival')

    const both = { kind: 'national-holiday' as const, holidays: ['childrens-day', 'tomb-sweeping-day'] as const, label: '兒童節及民族掃墓節' }
    expect(describeOfficialDay({ ...both, holidays: [...both.holidays] }, 'zh-tw')).toContain('兒童節')
    expect(describeOfficialDay({ ...both, holidays: [...both.holidays] }, 'zh-tw')).toContain('民族掃墓節')
  })

  it('describes an adjusted day by what it is, with no holiday name attached', () => {
    const substitute = { kind: 'substitute-holiday' as const, holidays: [], label: '補假' }
    const makeup = { kind: 'makeup-workday' as const, holidays: [], label: '補行上班' }

    expect(describeOfficialDay(substitute, 'zh-tw')).toBe(officialDayKindLabels['substitute-holiday']['zh-tw'])
    expect(describeOfficialDay(makeup, 'en')).toBe(officialDayKindLabels['makeup-workday'].en)
  })

  it('writes a solar term without its time, because the source only fixes the day for us', () => {
    expect(describeSolarTerm({ name: '清明', time: '02:40' }, 'zh-tw')).toBe('清明')
    expect(describeSolarTerm({ name: '清明', time: '02:40' }, 'en')).toBe(solarTermLabels['清明'].en)
    expect(describeSolarTerm({ name: '清明', time: '02:40' }, 'en')).not.toContain('02:40')
  })
})

describe('the questions the page publishes', () => {
  it('asks exactly the questions section 7.4 approved, in order and in both locales', () => {
    const documented = parseFaqQuestions()

    expect(documented.length).toBeGreaterThan(5)
    expect(taiwanCalendarFaq.map(entry => entry.heading)).toEqual(documented)
  })

  it('answers each one in both locales, without repeating a question', () => {
    const asked = new Set<string>()

    taiwanCalendarFaq.forEach((entry) => {
      locales.forEach(locale => expect(entry.body[locale].trim(), entry.heading['zh-tw']).not.toBe(''))
      expect(asked.has(entry.heading['zh-tw'])).toBe(false)
      asked.add(entry.heading['zh-tw'])
    })
  })

  it('says where the holidays come from and that an announced year can still change', () => {
    const sources = taiwanCalendarFaq[0]!

    expect(sources.body['zh-tw']).toContain('人事行政總處')
    expect(taiwanCalendarFaq.some(entry => entry.body['zh-tw'].includes('114'))).toBe(true)
  })
})

describe('the wording section 7.3 forbids', () => {
  it('appears nowhere in the tool\'s copy', () => {
    const forbidden = parseForbiddenWording()
    const text = [
      ...Object.values(taiwanCalendarCaveats).flatMap(caveat => locales.map(locale => caveat[locale])),
      ...taiwanCalendarFaq.flatMap(entry => locales.flatMap(locale => [entry.heading[locale], entry.body[locale]])),
      ...locales.flatMap(locale => Object.values(getTaiwanCalendarCopy(locale))),
      ...taiwanCalendarViewErrorCodes.flatMap(code =>
        locales.map(locale => taiwanCalendarViewErrorMessage(code, 2035, locale))),
    ].join('\n')

    expect(forbidden.length).toBeGreaterThan(5)
    forbidden.forEach(term => expect(text.toLowerCase(), term).not.toContain(term.toLowerCase()))
  })

  it('names the tool permanently, never after one year', () => {
    locales.forEach((locale) => {
      const copy = getTaiwanCalendarCopy(locale)

      Object.entries(copy).forEach(([key, value]) => expect(value, `${locale}:${key}`).not.toMatch(/20\d\d\s*(行事曆|calendar)/i))
    })
  })
})

describe('what a day cell can fit', () => {
  it('writes the Gregorian date and its ROC year as one fact', () => {
    expect(describeCivilDate('2026-06-19', 115, 'zh-tw')).toBe('2026 年 6 月 19 日（民國 115 年）')
    expect(describeCivilDate('2026-06-19', 115, 'en')).toBe('19 June 2026 (ROC 115)')
  })

  it('leaves the ROC year out before the era begins rather than writing a zero', () => {
    expect(describeCivilDate('1911-12-31', null, 'zh-tw')).toBe('1911 年 12 月 31 日')
    expect(describeCivilDate('1911-12-31', null, 'en')).toBe('31 December 1911')
  })

  it('marks the lunar month on its first day and the lunar day on the rest', () => {
    const first = { sexagenaryYear: '丙午', zodiac: '馬', month: 1, leapMonth: false, day: 1 }
    const later = { ...first, day: 13 }

    expect(describeLunarDayMark(first, 'zh-tw')).toBe('正月')
    expect(describeLunarDayMark(later, 'zh-tw')).toBe('十三')
    expect(describeLunarDayMark({ ...first, month: 6, leapMonth: true }, 'zh-tw')).toBe('閏六月')
    expect(describeLunarDayMark({ ...first, month: 6, leapMonth: true }, 'en')).toBe('L6/1')
  })

  it('marks a day by its holidays, or by the kind of adjusted day it is', () => {
    expect(describeDayMark({ kind: 'workday', holidays: [], label: '' }, 'zh-tw')).toBe('')
    expect(describeDayMark({ kind: 'weekend', holidays: [], label: '' }, 'zh-tw')).toBe('')
    expect(describeDayMark({ kind: 'makeup-workday', holidays: [], label: '補行上班' }, 'zh-tw')).toBe('補班日')
    expect(describeDayMark({ kind: 'national-holiday', holidays: ['childrens-day', 'tomb-sweeping-day'], label: '兒童節及民族掃墓節' }, 'zh-tw'))
      .toBe('兒童節、民族掃墓節')
  })
})
