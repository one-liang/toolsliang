import { describe, expect, it } from 'vitest'
import { taiwanCalendarCaveats } from '@/features/tools/taiwan-calendar/content'
import {
  describeEditionYears,
  describeRefusal,
  describeSkippedDay,
  formatRocDate,
  formatWorkingDayDate,
  getWorkingDayCaveats,
  validateWorkingDayContent,
  workingDayCaveats,
  workingDayCopy,
  workingDayCopyKeys,
  workingDayCountErrorMessage,
  workingDayFaq,
  workingDayModes,
  type WorkingDayMode,
} from '@/features/tools/working-day-calculator/content'
import type { WorkingDayCountErrorCode, WorkingDayRefusalReason } from '@/features/tools/working-day-calculator/domain/count'
import { workingDayCaveatKeys, workingDayContentReview } from '@/features/tools/working-day-calculator/domain/sources'
import { getTool, supportedLocales } from '@/features/tools/catalog'

const codes: WorkingDayCountErrorCode[] = ['empty', 'not-a-number', 'not-whole', 'below-one']
const reasons: WorkingDayRefusalReason[] = ['not-announced', 'out-of-range', 'not-downloaded']

function everyVisibleString() {
  const tool = getTool('working-day-calculator')!
  return supportedLocales.flatMap(locale => [
    ...workingDayCopyKeys.map(key => workingDayCopy[key][locale]),
    ...workingDayCaveatKeys.map(key => workingDayCaveats[key][locale]),
    ...workingDayFaq.flatMap(entry => [entry.heading[locale], entry.body[locale]]),
    ...codes.map(code => workingDayCountErrorMessage(code, locale)),
    ...reasons.flatMap(reason => workingDayModes.map((mode: WorkingDayMode) =>
      describeRefusal({ reason, blockedAt: '2028-01-01', reached: 2, lastCounted: '2027-12-30' }, mode, locale))),
    tool.name[locale], tool.description[locale], tool.acceptedInput[locale], tool.localProcessingStatement[locale],
    tool.seo.title[locale], tool.seo.description[locale], tool.seo.answer[locale],
    tool.contentReview!.sourceEdition[locale], ...tool.contentReview!.sources.map(source => source.title[locale]),
  ])
}

describe('working day calculator content', () => {
  it('passes its own validation', () => {
    expect(validateWorkingDayContent()).toEqual([])
  })

  it('says 工作天, never the words CONTEXT.md avoids', () => {
    for (const value of everyVisibleString()) {
      expect(value, value).not.toMatch(/營業日|工作日|銀行營業日/)
    }
  })

  it('writes a date with its weekday, and its ROC date for forms', () => {
    expect(formatWorkingDayDate('2026-02-25', 'zh-tw')).toBe('2026-02-25（三）')
    expect(formatWorkingDayDate('2026-02-25', 'en')).toBe('Wed 25 Feb 2026')
    expect(formatRocDate('2026-02-25', 'zh-tw')).toBe('民國 115 年 2 月 25 日')
    expect(formatRocDate('2026-02-25', 'en')).toBe('ROC year 115, 2/25')
  })

  it('names a skipped day by its holiday, or by the kind of day off it is', () => {
    expect(describeSkippedDay({ date: '2026-02-16', kind: 'national-holiday', holidays: ['lunar-new-years-eve'] }, 'zh-tw')).toBe('2026-02-16（一）農曆除夕')
    expect(describeSkippedDay({ date: '2026-02-20', kind: 'substitute-holiday', holidays: [] }, 'zh-tw')).toBe('2026-02-20（五）補假')
  })

  it('refuses in words that name the year and never a guessed date', () => {
    expect(describeRefusal({ reason: 'not-announced', blockedAt: '2028-01-01', reached: 2, lastCounted: '2027-12-30' }, 'forward', 'zh-tw'))
      .toBe('數到 2027-12-30（四）是第 2 個工作天；第 3 個要用到 2028 年。2028 年的辦公日曆表主管機關尚未公告，這裡不會先猜。')
    expect(describeRefusal({ reason: 'out-of-range', blockedAt: '2019-12-31', reached: 0 }, 'backward', 'zh-tw'))
      .toBe('第 1 個工作天要用到 2019 年。這裡只提供 2020 至 2027 年的辦公日曆表。')
    expect(describeRefusal({ reason: 'not-announced', blockedAt: '2028-01-01' }, 'between', 'zh-tw'))
      .toContain('這段期間包含 2028 年')
  })

  it('explains every refused number in both locales, and stays quiet for an empty field', () => {
    for (const locale of supportedLocales) {
      expect(workingDayCountErrorMessage('empty', locale), '空白不是錯誤').toBe('')
      for (const code of codes.filter(item => item !== 'empty')) expect(workingDayCountErrorMessage(code, locale).trim()).not.toBe('')
    }
  })

  it('reuses the Taiwan Calendar caveats about the data word for word', () => {
    for (const key of ['government-agency-scope', 'edition-may-change', 'offline-may-be-outdated'] as const) {
      expect(workingDayCaveats[key]).toEqual(taiwanCalendarCaveats[key])
    }
    expect(getWorkingDayCaveats('zh-tw').map(caveat => caveat.key)).toEqual([...workingDayCaveatKeys])
    expect(workingDayCaveats['not-a-statutory-period']['zh-tw']).toContain('不是法定期間')
  })

  it('names the reissued years in the edition line', () => {
    const edition = (year: number, status: 'published' | 'revised') => ({
      year,
      edition: { status, datasetId: 'dgpa-office-calendar' as const, edition: `${year}`, publishedAt: '2026-07-15', retrievedAt: '2026-09-06', checksum: 'sha256-x' },
    })
    expect(describeEditionYears([edition(2024, 'published'), edition(2025, 'revised'), edition(2026, 'published')], 'zh-tw'))
      .toBe('民國 113 至 115 年（114 年為修正版）')
    expect(describeEditionYears([edition(2026, 'published')], 'en')).toBe('ROC years 115')
  })

  it('answers the seven questions the spec lists', () => {
    expect(workingDayFaq.map(entry => entry.heading['zh-tw'])).toEqual([
      '工作天怎麼算？',
      '補班日算不算工作天？',
      '民間公司或學校可以用這個結果嗎？',
      '可以拿來算法定期間或訴訟期限嗎？',
      '為什麼算不到還沒公告的年份？',
      '春節連假、補假會自動跳過嗎？',
      '我輸入的日期會被送出嗎？',
    ])
  })

  it('cites government sources only, over HTTPS', () => {
    for (const source of workingDayContentReview.sources) {
      const url = new URL(source.url)
      expect(url.protocol).toBe('https:')
      expect(url.hostname, `${url.hostname} 必須是政府網域`).toMatch(/\.gov\.tw$/)
    }
  })

  it('keeps technical vocabulary off the page', () => {
    const technical = /JavaScript|API|Intl|Date\(|algorithm|演算法|程式|localStorage|ECMAScript|parse|JSON/i
    for (const value of everyVisibleString()) expect(value).not.toMatch(technical)
  })
})
