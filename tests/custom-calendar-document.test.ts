import { describe, expect, it } from 'vitest'
import {
  CUSTOM_CALENDAR_ENTRY_LIMIT,
  type CustomCalendarEntry,
} from '@/features/tools/custom-calendar/domain/entries'
import {
  CUSTOM_CALENDAR_DOCUMENT_VERSION,
  CUSTOM_CALENDAR_FORMAT,
  customCalendarFileName,
  mergeImportedEntries,
  parseCustomCalendarFile,
  readCustomCalendarDocument,
  serializeCustomCalendar,
} from '@/features/tools/custom-calendar/domain/document'

const now = new Date('2026-09-07T02:00:00Z')
const coverage = { firstYear: 2020, lastYear: 2027 }

function entry(patch: Partial<CustomCalendarEntry> = {}): CustomCalendarEntry {
  return {
    id: 'entry-1',
    startDate: '2026-09-18',
    endDate: '2026-09-18',
    mark: 'day-off',
    title: '公司特休',
    note: '全公司',
    updatedAt: '2026-09-07T02:00:00.000Z',
    ...patch,
  }
}

function document(patch: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: CUSTOM_CALENDAR_FORMAT,
    version: CUSTOM_CALENDAR_DOCUMENT_VERSION,
    updatedAt: '2026-09-07T02:00:00.000Z',
    entries: [entry()],
    ...patch,
  })
}

describe('writing and reading the document this device holds', () => {
  it('reads back exactly what it wrote', () => {
    const reading = readCustomCalendarDocument(serializeCustomCalendar([entry()], now))

    expect(reading).toEqual({ status: 'ready', entries: [entry()] })
  })

  it('names the export file by date only, so a download shelf never shows an entry', () => {
    const fileName = customCalendarFileName(now)

    expect(fileName).toBe('toolsliang-custom-calendar-2026-09-07.json')
    expect(fileName).not.toContain('公司特休')
  })

  it('reports a document written by a newer release instead of rewriting it', () => {
    expect(readCustomCalendarDocument(document({ version: CUSTOM_CALENDAR_DOCUMENT_VERSION + 1 })))
      .toEqual({ status: 'unsupported-version' })
  })

  it('reads an older document and reports that this build rewrote its shape', () => {
    const older = readCustomCalendarDocument(document({ version: 0 }))

    expect(older.status).toBe('upgraded')
    expect(older.status === 'upgraded' && older.entries).toEqual([entry()])
  })

  it('reports damaged content rather than throwing, so the recovery controls stay reachable', () => {
    expect(readCustomCalendarDocument('{ not json').status).toBe('corrupt')
    expect(readCustomCalendarDocument(document({ format: 'something-else' })).status).toBe('corrupt')
    expect(readCustomCalendarDocument(document({ entries: 'nope' })).status).toBe('corrupt')
    expect(readCustomCalendarDocument(document({ entries: [{ ...entry(), startDate: 'yesterday' }] })).status).toBe('corrupt')
    expect(readCustomCalendarDocument(document({ entries: [{ ...entry(), mark: 'maybe' }] })).status).toBe('corrupt')
  })

  it('reads an empty document as an empty calendar, which is a legitimate state', () => {
    expect(readCustomCalendarDocument(document({ entries: [] }))).toEqual({ status: 'ready', entries: [] })
  })
})

describe('the size the product promises to carry', () => {
  const many = Array.from({ length: CUSTOM_CALENDAR_ENTRY_LIMIT }, (_, index) => entry({
    id: `entry-${index}`,
    startDate: `2026-${String((index % 12) + 1).padStart(2, '0')}-01`,
    endDate: `2026-${String((index % 12) + 1).padStart(2, '0')}-01`,
    title: `項目 ${index}`,
  }))

  it('writes and reads back the full 5,000 entries this tool accepts, inside the budget', () => {
    const written = serializeCustomCalendar(many, now)

    const started = performance.now()
    const reading = readCustomCalendarDocument(written)
    const elapsed = performance.now() - started

    expect(reading.status).toBe('ready')
    expect(reading.status === 'ready' && reading.entries).toHaveLength(CUSTOM_CALENDAR_ENTRY_LIMIT)
    expect(elapsed, '規格要求 5,000 筆本機紀錄在 500ms 內開啟').toBeLessThan(500)
  })

  it('serializes a full calendar fast enough for a save to feel immediate', () => {
    const started = performance.now()
    serializeCustomCalendar(many, now)

    expect(performance.now() - started, '每次儲存都會重寫整份文件，必須遠低於 100ms 的回饋預算').toBeLessThan(100)
  })
})

describe('taking a file back in', () => {
  it('accepts a file this tool wrote', () => {
    expect(parseCustomCalendarFile(serializeCustomCalendar([entry()], now), coverage)).toEqual({ ok: true, entries: [entry()] })
  })

  it('refuses a file that is not a custom calendar, naming what is wrong', () => {
    expect(parseCustomCalendarFile('{ not json', coverage)).toEqual({ ok: false, code: 'invalid-file' })
    expect(parseCustomCalendarFile(JSON.stringify({ format: 'toolsliang.local-assets', version: 1, assets: [] }), coverage))
      .toEqual({ ok: false, code: 'invalid-file' })
    expect(parseCustomCalendarFile(document({ version: CUSTOM_CALENDAR_DOCUMENT_VERSION + 1 }), coverage))
      .toEqual({ ok: false, code: 'unsupported-file-version' })
    expect(parseCustomCalendarFile(document({ entries: [] }), coverage)).toEqual({ ok: false, code: 'empty-file' })
  })

  it('refuses the whole file when one entry is unreadable, so an import never lands half a backup', () => {
    const half = document({ entries: [entry(), { ...entry({ id: 'entry-2' }), endDate: 'someday' }] })

    expect(parseCustomCalendarFile(half, coverage)).toEqual({ ok: false, code: 'invalid-file' })
  })

  it('refuses a file holding an entry the reviewed rules would not accept', () => {
    const outOfRange = document({ entries: [entry({ startDate: '2099-01-01', endDate: '2099-01-01' })] })
    const oversized = document({ entries: [entry({ title: 'a'.repeat(61) })] })

    expect(parseCustomCalendarFile(outOfRange, coverage), '匯入不得寫入畫不出來的年度').toEqual({ ok: false, code: 'refused-entry' })
    expect(parseCustomCalendarFile(oversized, coverage)).toEqual({ ok: false, code: 'refused-entry' })
  })

  it('refuses an entry whose timestamp is not an instant, because it settles conflicts', () => {
    expect(readCustomCalendarDocument(document({ entries: [entry({ updatedAt: 'yesterday' })] })).status).toBe('corrupt')
    expect(parseCustomCalendarFile(document({ entries: [entry({ updatedAt: '' })] }), coverage))
      .toEqual({ ok: false, code: 'invalid-file' })
  })

  it('merges by identity and says what the device is about to gain and replace', () => {
    const existing = [entry({ id: 'entry-1', title: '舊的' }), entry({ id: 'entry-2' })]
    const incoming = [entry({ id: 'entry-1', title: '新的' }), entry({ id: 'entry-3' })]

    const merged = mergeImportedEntries(existing, incoming)

    expect(merged).toMatchObject({ added: 1, replaced: 1 })
    expect(merged.entries.map(item => item.id).sort()).toEqual(['entry-1', 'entry-2', 'entry-3'])
    expect(merged.entries.find(item => item.id === 'entry-1')!.title).toBe('新的')
  })

  it('counts a file that names one entry twice as the one entry the device ends up with', () => {
    const merged = mergeImportedEntries([], [entry({ id: 'entry-1', title: '第一次' }), entry({ id: 'entry-1', title: '第二次' })])

    expect(merged, '同一個識別碼出現兩次不得謊報覆蓋了裝置上的項目').toMatchObject({ added: 1, replaced: 0 })
    expect(merged.entries).toHaveLength(1)
    expect(merged.entries[0]!.title).toBe('第二次')
  })
})
