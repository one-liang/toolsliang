import type { DuplicatePolicy } from '@/features/tools/random-picker/domain/reference'
import { createDecisionRecordReader, parseJsonCell } from './decision-record'

const reader = createDecisionRecordReader('docs/research/003-random-picker-fairness-and-sources.md')

/** The record verbatim, for asserting on the ids and URLs the page has to carry. */
export const randomPickerDecisionRecord = reader.record

const { parseKeyColumn, tableRows } = reader

export interface DocumentedListVector {
  input: string
  policy: string
  entries: string[]
  blankLines: number
  mergedDuplicates: number
}

export function parseListVectors(): DocumentedListVector[] {
  const pattern = /^\| `("(?:[^"\\]|\\.)*")` \| `([a-z]+)` \| `(\[[^\]]*\])` \| (\d+) \| (\d+) \|/gm

  return tableRows('### 6.1 名單解析向量', pattern).map(([, input, policy, entries, blank, merged]) => ({
    input: parseJsonCell<string>(input!),
    policy: policy!,
    entries: parseJsonCell<string[]>(entries!),
    blankLines: Number(blank),
    mergedDuplicates: Number(merged),
  }))
}

/** Error keys in the order the document lists them, which is the check order. */
export function parseErrorCodes(): string[] {
  return parseKeyColumn('### 5.2 錯誤情境')
}

export function parseCaveatKeys(): string[] {
  return parseKeyColumn('### 7.1 必須同時呈現的免責內容')
}

/** The documented ceilings, with the thousands separators the document reads with. */
export function parseLimits(): Record<string, number> {
  const rows = tableRows('### 4.4 規模上限', /^\| `([A-Za-z]+)` \| ([\d,]+) \|/gm)

  return Object.fromEntries(rows.map(([, key, value]) => [key!, Number(value!.replaceAll(',', ''))]))
}

/** The sources the document marks as shown on the page. */
export function parsePublishedSourceUrls(): string[] {
  const pattern = /^\|[^|]+\|[^|]+\|[^|]+\| 是 \| <(https:\/\/[^>]+)> \|/gm

  return tableRows('## 8. 來源清單', pattern).map(([, url]) => url!)
}

export function parseDuplicatePolicies(): DuplicatePolicy[] {
  return parseKeyColumn('### 4.3 重複項目策略') as DuplicatePolicy[]
}
