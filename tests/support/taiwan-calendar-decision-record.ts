import type {
  CalendarEditionDiffVector,
  LunarDateVector,
  OfficialDayVector,
  RocConversionVector,
  SolarTermVector,
  TaiwanCalendarNoteLabel,
} from '@/features/tools/taiwan-calendar/domain/reference'
import { createDecisionRecordReader, parseJsonCell } from './decision-record'

const reader = createDecisionRecordReader('docs/research/004-taiwan-calendar-sources-and-data-contract.md')

/** The record verbatim, for asserting on the ids and URLs the page has to carry. */
export const taiwanCalendarDecisionRecord = reader.record

const { parseKeyColumn, tableRows } = reader

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

export interface DocumentedDatasetCoverage {
  datasetId: string
  firstYear: number
  lastYear: number
}

export function parseLayerKeys(): string[] {
  return parseKeyColumn('### 4.1 資料層')
}

export function parseDayKinds(): string[] {
  return parseKeyColumn('### 4.5 日別')
}

export function parseStatusKeys(): string[] {
  return parseKeyColumn('### 4.4 年度資料狀態')
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
  return parseKeyColumn('### 5.5 擷取錯誤')
}

export function parseViewErrorCodes(): string[] {
  return parseKeyColumn('### 5.6 檢視錯誤')
}

export function parseRocVectors(): RocConversionVector[] {
  const pattern = /^\| `(\d{4}-\d{2}-\d{2})` \| `(\d+|null)` \| `([1-7])` \|/gm

  return tableRows('### 6.1 民國與星期換算向量', pattern).map(([, date, rocYear, isoWeekday]) => ({
    date: date!,
    rocYear: rocYear === 'null' ? null : Number(rocYear),
    isoWeekday: Number(isoWeekday),
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
    name: name as SolarTermVector['name'],
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
  return parseKeyColumn('### 7.1 必須同時呈現的免責內容')
}

/** Dataset ids and the year range this review confirmed for each, in table order. */
export function parseDatasetCoverage(): DocumentedDatasetCoverage[] {
  const pattern = /^\| `([a-z0-9-]+)` \|(?:[^|]*\|){4} `(\d{4})–(\d{4})` \|/gm

  return tableRows('### 8.1 資料集', pattern).map(([, datasetId, firstYear, lastYear]) => ({
    datasetId: datasetId!,
    firstYear: Number(firstYear),
    lastYear: Number(lastYear),
  }))
}
