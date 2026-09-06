import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type {
  CalendarEditionDiffVector,
  LunarDateVector,
  OfficialDayVector,
  RocConversionVector,
  SolarTermVector,
  TaiwanCalendarNoteLabel,
} from '@/features/tools/taiwan-calendar/domain/reference'

/**
 * The Taiwan calendar decision record is the single source the domain modules
 * answer to. The reference test reads its tables from here so a source, a
 * status or a vector can never change in the document without the module
 * failing, or the other way round.
 */
export const taiwanCalendarDecisionRecord = readFileSync(
  resolve(process.cwd(), 'docs/research/004-taiwan-calendar-sources-and-data-contract.md'),
  'utf8',
)

/**
 * The document parsed here is the specification, so a table that moved, was
 * renamed or stopped matching has to fail loudly. Every reader below is scoped
 * to one heading and throws when it finds no rows: a silently empty list would
 * turn the comparisons in the reference test into assertions about nothing.
 */
function sectionBody(heading: string) {
  const start = taiwanCalendarDecisionRecord.indexOf(`\n${heading}\n`)
  if (start === -1) throw new Error(`Decision record has no section "${heading}"`)

  const body = taiwanCalendarDecisionRecord.slice(start + heading.length + 2)
  const nextHeading = body.search(/^#{2,4} /m)

  return nextHeading === -1 ? body : body.slice(0, nextHeading)
}

function tableRows(heading: string, pattern: RegExp) {
  const rows = [...sectionBody(heading).matchAll(pattern)]
  if (rows.length === 0) throw new Error(`Section "${heading}" has no row matching ${pattern}`)

  return rows
}

/**
 * Labels and holiday lists are written as JSON in the document so an empty
 * label and an empty holiday list stay distinguishable in a Markdown table,
 * and so a label containing a slash needs no escaping.
 */
function parseJsonCell<T>(cell: string) {
  return JSON.parse(cell) as T
}

/** Key columns stay strings: comparing them against the module is the point. */
export interface DocumentedNoteLabel extends Omit<TaiwanCalendarNoteLabel, 'kind' | 'holidays'> {
  kind: string
  holidays: string[]
}

export interface DocumentedOfficialDayVector extends Omit<OfficialDayVector, 'kind' | 'holidays'> {
  kind: string
  holidays: string[]
}

export interface DocumentedEditionDiffVector extends Omit<CalendarEditionDiffVector, 'before' | 'after'> {
  before: { kind: string, label: string }
  after: { kind: string, label: string }
}

export function parseLayerKeys(): string[] {
  return tableRows('### 4.1 資料層', /^\| `([a-z-]+)` \|/gm).map(([, key]) => key!)
}

export function parseStatusKeys(): string[] {
  return tableRows('### 4.4 年度資料狀態', /^\| `([a-z-]+)` \|/gm).map(([, key]) => key!)
}

export function parseNoteLabels(): DocumentedNoteLabel[] {
  const pattern = /^\| `("(?:[^"\\]|\\.)*")` \| `([a-z-]+)` \| `(\[[^\]]*\])` \|/gm

  return tableRows('### 5.3 備註標籤白名單', pattern).map(([, label, kind, holidays]) => ({
    label: parseJsonCell<string>(label!),
    kind: kind!,
    holidays: parseJsonCell<string[]>(holidays!),
  }))
}

export function parseIngestionErrorCodes(): string[] {
  return tableRows('### 5.5 擷取錯誤', /^\| `([a-z-]+)` \|/gm).map(([, code]) => code!)
}

export function parseViewErrorCodes(): string[] {
  return tableRows('### 5.6 檢視錯誤', /^\| `([a-z-]+)` \|/gm).map(([, code]) => code!)
}

export function parseRocVectors(): RocConversionVector[] {
  const pattern = /^\| `(\d{4}-\d{2}-\d{2})` \| `(\d+|null)` \|/gm

  return tableRows('### 6.1 民國換算向量', pattern).map(([, date, rocYear]) => ({
    date: date!,
    rocYear: rocYear === 'null' ? null : Number(rocYear),
  }))
}

export function parseLunarVectors(): LunarDateVector[] {
  const pattern = /^\| `(\d{4}-\d{2}-\d{2})` \| `(\S+)` \| `(\S+)` \| `(\d+)` \| `(true|false)` \| `(\d+)` \|/gm

  return tableRows('### 6.2 農曆向量', pattern)
    .map(([, date, sexagenaryYear, zodiac, month, leapMonth, day]) => ({
      date: date!,
      sexagenaryYear: sexagenaryYear!,
      zodiac: zodiac!,
      month: Number(month),
      leapMonth: leapMonth === 'true',
      day: Number(day),
    }))
}

export function parseSolarTermVectors(): SolarTermVector[] {
  const pattern = /^\| `(\S+)` \| `(\d{4}-\d{2}-\d{2})` \| `(\d{2}:\d{2})` \| `(\d{4}-\d{2}-\d{2})` \|/gm

  return tableRows('### 6.3 節氣向量', pattern).map(([, name, date, time, utcDate]) => ({
    name: name!,
    date: date!,
    time: time!,
    utcDate: utcDate!,
  }))
}

export function parseOfficialDayVectors(): DocumentedOfficialDayVector[] {
  const pattern = /^\| `(\d{4}-\d{2}-\d{2})` \| `([a-z-]+)` \| `(\[[^\]]*\])` \| `("(?:[^"\\]|\\.)*")` \|/gm

  return tableRows('### 6.4 官方日別向量', pattern).map(([, date, kind, holidays, label]) => ({
    date: date!,
    kind: kind!,
    holidays: parseJsonCell<string[]>(holidays!),
    label: parseJsonCell<string>(label!),
  }))
}

export function parseEditionDiffVectors(): DocumentedEditionDiffVector[] {
  const pattern = /^\| `(\d{4}-\d{2}-\d{2})` \| `([a-z-]+)` \| `("(?:[^"\\]|\\.)*")` \| `([a-z-]+)` \| `("(?:[^"\\]|\\.)*")` \|/gm

  return tableRows('### 6.5 版本差異向量', pattern)
    .map(([, date, beforeKind, beforeLabel, afterKind, afterLabel]) => ({
      date: date!,
      before: { kind: beforeKind!, label: parseJsonCell<string>(beforeLabel!) },
      after: { kind: afterKind!, label: parseJsonCell<string>(afterLabel!) },
    }))
}

export function parseCaveatKeys(): string[] {
  return tableRows('### 7.1 必須同時呈現的免責內容', /^\| `([a-z-]+)` \|/gm).map(([, key]) => key!)
}

/** Dataset ids in the order the source table lists them. */
export function parseDatasetIds(): string[] {
  return tableRows('### 8.1 資料集', /^\| `([a-z0-9-]+)` \|/gm).map(([, id]) => id!)
}
