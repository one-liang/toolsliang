import { describe, expect, it } from 'vitest'
import {
  customCalendarCaveatKeys,
  customCalendarCaveats,
  customCalendarCopy,
  customCalendarCopyKeys,
  customCalendarFaq,
  customCalendarFileErrorMessage,
  customCalendarStateMessage,
  customEntryIssueMessage,
  customEntryMarkLabels,
  describeEntryDates,
  getCustomCalendarCaveats,
  getCustomCalendarCopy,
  validateCustomCalendarContent,
} from '@/features/tools/custom-calendar/content'
import { customCalendarFileErrorCodes } from '@/features/tools/custom-calendar/domain/document'
import {
  CUSTOM_CALENDAR_ENTRY_LIMIT,
  CUSTOM_ENTRY_TITLE_MAX,
  customEntryIssueCodes,
  customEntryMarks,
  type CustomCalendarEntry,
  type CustomEntryIssueCode,
} from '@/features/tools/custom-calendar/domain/entries'
import { supportedLocales } from '@/features/tools/catalog'

const issueFields = {
  'title-required': 'title',
  'title-too-long': 'title',
  'note-too-long': 'note',
  'invalid-date': 'dates',
  'end-before-start': 'dates',
  'range-too-long': 'dates',
  'date-out-of-range': 'dates',
  'entry-limit-reached': 'title',
} as const satisfies Record<CustomEntryIssueCode, string>

function entry(patch: Partial<CustomCalendarEntry> = {}): CustomCalendarEntry {
  return {
    id: 'entry-1',
    startDate: '2026-09-18',
    endDate: '2026-09-18',
    mark: 'day-off',
    title: '公司特休',
    note: '',
    updatedAt: '2026-09-07T02:00:00.000Z',
    ...patch,
  }
}

describe('what the custom calendar says', () => {
  it('registers no wording that is missing a language', () => {
    expect(validateCustomCalendarContent()).toEqual([])
  })

  it('writes every interface string, mark, caveat and question in both languages', () => {
    for (const locale of supportedLocales) {
      const copy = getCustomCalendarCopy(locale)
      for (const key of customCalendarCopyKeys) {
        expect(copy[key].length, `${key} 缺少 ${locale} 文案`).toBeGreaterThan(0)
      }
      for (const mark of customEntryMarks) {
        expect(customEntryMarkLabels[mark][locale].length, `${mark} 缺少 ${locale} 名稱`).toBeGreaterThan(0)
      }
      expect(getCustomCalendarCaveats(locale)).toHaveLength(customCalendarCaveatKeys.length)
      for (const question of customCalendarFaq) {
        expect(question.heading[locale].length).toBeGreaterThan(0)
        expect(question.body[locale].length).toBeGreaterThan(0)
      }
    }
  })

  it('explains every rejected field and unreadable file in both languages', () => {
    for (const locale of supportedLocales) {
      for (const code of customEntryIssueCodes) {
        const message = customEntryIssueMessage({ field: issueFields[code], code }, locale)
        expect(message.length, `${code} 缺少 ${locale} 訊息`).toBeGreaterThan(0)
      }
      for (const code of customCalendarFileErrorCodes) {
        const message = customCalendarFileErrorMessage(code, locale)
        expect(message.title.length, `${code} 缺少 ${locale} 標題`).toBeGreaterThan(0)
        expect(message.recovery.length, `${code} 缺少 ${locale} 可恢復做法`).toBeGreaterThan(0)
      }
      for (const state of ['corrupt', 'unsupported-version'] as const) {
        expect(customCalendarStateMessage(state, locale).recovery.length).toBeGreaterThan(0)
      }
    }
  })

  it('names the limits it enforces, so a refusal is never a surprise', () => {
    expect(customEntryIssueMessage({ field: 'title', code: 'title-too-long' }, 'zh-tw')).toContain(String(CUSTOM_ENTRY_TITLE_MAX))
    expect(customEntryIssueMessage({ field: 'title', code: 'entry-limit-reached' }, 'en')).toContain(String(CUSTOM_CALENDAR_ENTRY_LIMIT))
  })

  it('states the device boundary and the ways saved data can disappear', () => {
    const zh = getCustomCalendarCaveats('zh-tw').map(caveat => caveat.text).join('\n')
    const en = getCustomCalendarCaveats('en').map(caveat => caveat.text).join('\n').toLowerCase()

    expect(zh).toContain('這台裝置')
    expect(zh).toContain('無痕')
    expect(zh, '必須說明不會跨裝置同步').toContain('同步')
    expect(zh, '必須說明官方層不會被自訂項目改寫').toContain('辦公日曆表')
    expect(en).toContain('this device')
    expect(en).toContain('private browsing')
    expect(en).toContain('sync')
  })

  it('does not claim to be a labour-law or school schedule, which CONTEXT.md rules out', () => {
    const everything = [
      ...customCalendarCopyKeys.map(key => customCalendarCopy[key]),
      ...customCalendarCaveatKeys.map(key => customCalendarCaveats[key]),
      ...customCalendarFaq.flatMap(question => [question.heading, question.body]),
    ]
      .flatMap(copy => [copy['zh-tw'], copy.en])
      .join('\n')

    for (const forbidden of ['勞工行事曆', '學校行事曆', '雲端行事曆', '團隊行事曆']) {
      expect(everything, `不得使用 ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('writes a one-day entry as one date and a range as a span', () => {
    expect(describeEntryDates(entry(), 'zh-tw')).toBe('2026 年 9 月 18 日')
    expect(describeEntryDates(entry({ endDate: '2026-09-20' }), 'zh-tw')).toContain('2026 年 9 月 20 日')
    expect(describeEntryDates(entry({ endDate: '2026-09-20' }), 'en')).toContain('20 September 2026')
  })
})
