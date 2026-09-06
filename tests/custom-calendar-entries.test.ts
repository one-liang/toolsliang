import { describe, expect, it } from 'vitest'
import {
  applyCustomEntries,
  createEntry,
  CUSTOM_CALENDAR_ENTRY_LIMIT,
  CUSTOM_ENTRY_NOTE_MAX,
  CUSTOM_ENTRY_TITLE_MAX,
  entriesInRange,
  entryDates,
  updateEntry,
  validateEntryDraft,
  type CustomCalendarEntry,
  type CustomCalendarEntryDraft,
} from '@/features/tools/custom-calendar/domain/entries'
import { buildCalendarYear, getMonthDays } from '@/features/tools/taiwan-calendar/domain/calendar'
import dataset2026 from '@/features/tools/taiwan-calendar/data/2026.json'

const coverage = { firstYear: 2020, lastYear: 2027 }
const year = buildCalendarYear(dataset2026 as never)

function draft(patch: Partial<CustomCalendarEntryDraft> = {}): CustomCalendarEntryDraft {
  return { startDate: '2026-09-18', endDate: '2026-09-18', mark: 'day-off', title: '公司特休', note: '', ...patch }
}

function limits(patch: Partial<{ firstYear: number, lastYear: number, existing: number }> = {}) {
  return { ...coverage, existing: 0, ...patch }
}

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

describe('validating what a visitor may save', () => {
  it('accepts an ordinary one-day entry', () => {
    expect(validateEntryDraft(draft(), limits())).toEqual([])
  })

  it('requires a title that is not only whitespace', () => {
    expect(validateEntryDraft(draft({ title: '   ' }), limits())).toEqual([{ field: 'title', code: 'title-required' }])
  })

  it('refuses a title or note longer than the reviewed limit', () => {
    expect(validateEntryDraft(draft({ title: 'a'.repeat(CUSTOM_ENTRY_TITLE_MAX + 1) }), limits()))
      .toEqual([{ field: 'title', code: 'title-too-long' }])
    expect(validateEntryDraft(draft({ note: 'a'.repeat(CUSTOM_ENTRY_NOTE_MAX + 1) }), limits()))
      .toEqual([{ field: 'note', code: 'note-too-long' }])
  })

  it('refuses a date the browser cannot read as a real day', () => {
    expect(validateEntryDraft(draft({ startDate: '2026-02-30', endDate: '2026-02-30' }), limits()))
      .toEqual([{ field: 'dates', code: 'invalid-date' }])
    expect(validateEntryDraft(draft({ startDate: '', endDate: '' }), limits()))
      .toEqual([{ field: 'dates', code: 'invalid-date' }])
  })

  it('refuses a range that ends before it starts, and one longer than a year', () => {
    expect(validateEntryDraft(draft({ startDate: '2026-09-18', endDate: '2026-09-17' }), limits()))
      .toEqual([{ field: 'dates', code: 'end-before-start' }])
    expect(validateEntryDraft(draft({ startDate: '2026-01-01', endDate: '2027-01-02' }), limits()))
      .toEqual([{ field: 'dates', code: 'range-too-long' }])
    expect(validateEntryDraft(draft({ startDate: '2026-01-01', endDate: '2026-12-31' }), limits())).toEqual([])
  })

  it('refuses a date outside the years the official calendar covers, so an entry can never be invisible', () => {
    expect(validateEntryDraft(draft({ startDate: '2019-12-31', endDate: '2020-01-01' }), limits()))
      .toEqual([{ field: 'dates', code: 'date-out-of-range' }])
    expect(validateEntryDraft(draft({ startDate: '2027-12-31', endDate: '2028-01-01' }), limits()))
      .toEqual([{ field: 'dates', code: 'date-out-of-range' }])
  })

  it('refuses one more entry once the device holds the reviewed maximum', () => {
    expect(validateEntryDraft(draft(), limits({ existing: CUSTOM_CALENDAR_ENTRY_LIMIT })))
      .toEqual([{ field: 'title', code: 'entry-limit-reached' }])
    expect(validateEntryDraft(draft(), limits({ existing: CUSTOM_CALENDAR_ENTRY_LIMIT - 1 }))).toEqual([])
  })

  it('reports every field a visitor has to fix, not only the first', () => {
    const issues = validateEntryDraft(draft({ title: '', startDate: '2026-09-18', endDate: '2026-09-01' }), limits())

    expect(issues).toEqual([
      { field: 'title', code: 'title-required' },
      { field: 'dates', code: 'end-before-start' },
    ])
  })
})

describe('creating and editing an entry', () => {
  it('trims what it stores and stamps when the device last wrote it', () => {
    const created = createEntry(draft({ title: '  公司特休  ', note: '  下午半天  ' }), {
      id: 'entry-9',
      now: new Date('2026-09-07T02:00:00Z'),
    })

    expect(created).toEqual({
      id: 'entry-9',
      startDate: '2026-09-18',
      endDate: '2026-09-18',
      mark: 'day-off',
      title: '公司特休',
      note: '下午半天',
      updatedAt: '2026-09-07T02:00:00.000Z',
    })
  })

  it('keeps the identity of an edited entry and moves only its own fields', () => {
    const edited = updateEntry(
      entry(),
      draft({ title: '公司特休（改期）', startDate: '2026-09-21', endDate: '2026-09-22', mark: 'note' }),
      new Date('2026-09-08T03:00:00Z'),
    )

    expect(edited).toMatchObject({
      id: 'entry-1',
      title: '公司特休（改期）',
      startDate: '2026-09-21',
      endDate: '2026-09-22',
      mark: 'note',
      updatedAt: '2026-09-08T03:00:00.000Z',
    })
  })
})

describe('reading a range of days', () => {
  it('expands a range into its own days, clipped to the window that is being drawn', () => {
    const spanning = entry({ startDate: '2026-08-30', endDate: '2026-09-02' })

    expect(entryDates(spanning)).toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'])
    expect(entryDates(spanning, '2026-09-01', '2026-09-30')).toEqual(['2026-09-01', '2026-09-02'])
  })

  it('lists the entries touching a month in a stable order, including one that started earlier', () => {
    const entries = [
      entry({ id: 'b', startDate: '2026-09-20', endDate: '2026-09-20', title: '排班' }),
      entry({ id: 'a', startDate: '2026-08-30', endDate: '2026-09-02', title: '公司連假' }),
      entry({ id: 'c', startDate: '2026-10-01', endDate: '2026-10-01', title: '下個月' }),
    ]

    expect(entriesInRange(entries, '2026-09-01', '2026-09-30').map(item => item.id)).toEqual(['a', 'b'])
  })
})

describe('laying custom days over the official calendar', () => {
  const september = getMonthDays(year, 9)

  function dayOn(days: ReturnType<typeof applyCustomEntries>, date: string) {
    return days.find(item => item.day.date === date)!
  }

  it('leaves the official day untouched and reports the visitor\'s own override beside it', () => {
    const days = applyCustomEntries(september, [entry({ startDate: '2026-09-18', endDate: '2026-09-18' })])
    const overridden = dayOn(days, '2026-09-18')

    expect(overridden.day.official.kind, '官方日別不得被自訂項目改寫').toBe('workday')
    expect(overridden.override).toBe('day-off')
    expect(overridden.changed, '自訂放假與辦公日曆表不同，必須說得出來').toBe(true)
    expect(overridden.entries.map(item => item.id)).toEqual(['entry-1'])
  })

  it('marks a note without changing whether the day is a workday', () => {
    const days = applyCustomEntries(september, [entry({ mark: 'note' })])

    expect(dayOn(days, '2026-09-18').override).toBeNull()
    expect(dayOn(days, '2026-09-18').changed).toBe(false)
    expect(dayOn(days, '2026-09-18').entries).toHaveLength(1)
  })

  it('reports a day where two entries claim the opposite, and settles it on the newer one', () => {
    const days = applyCustomEntries(september, [
      entry({ id: 'older', mark: 'day-off', updatedAt: '2026-09-07T02:00:00.000Z' }),
      entry({ id: 'newer', mark: 'workday', updatedAt: '2026-09-08T02:00:00.000Z' }),
    ])

    expect(dayOn(days, '2026-09-18').conflict).toBe(true)
    expect(dayOn(days, '2026-09-18').override).toBe('workday')
  })

  it('does not call an override a change when it agrees with the office calendar', () => {
    const days = applyCustomEntries(september, [entry({ startDate: '2026-09-19', endDate: '2026-09-19', mark: 'day-off' })])

    expect(dayOn(days, '2026-09-19').day.official.kind).toBe('weekend')
    expect(dayOn(days, '2026-09-19').changed).toBe(false)
    expect(dayOn(days, '2026-09-19').override).toBe('day-off')
  })

  it('covers every day of a range and nothing outside it', () => {
    const days = applyCustomEntries(september, [entry({ startDate: '2026-08-28', endDate: '2026-09-02' })])

    expect(days.filter(item => item.entries.length).map(item => item.day.date))
      .toEqual(['2026-09-01', '2026-09-02'])
  })

  it('stays linear in the days it draws, so a year-long entry costs a month of work', () => {
    const wide = Array.from({ length: 200 }, (_, index) => entry({
      id: `entry-${index}`,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    }))

    const started = performance.now()
    const days = applyCustomEntries(september, wide)
    expect(performance.now() - started).toBeLessThan(100)
    expect(days.every(item => item.entries.length === 200)).toBe(true)
  })
})
