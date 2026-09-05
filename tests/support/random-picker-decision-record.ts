import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { DuplicatePolicy } from '@/features/tools/random-picker/domain/reference'

/**
 * The random-picker decision record is the single source the domain modules
 * answer to. The reference test reads the tables from here so a rule can never
 * be changed in the document without the module failing, or the other way
 * round.
 */
export const randomPickerDecisionRecord = readFileSync(
  resolve(process.cwd(), 'docs/research/003-random-picker-fairness-and-sources.md'),
  'utf8',
)

/**
 * The document parsed here is the specification, so a table that moved, was
 * renamed or stopped matching has to fail loudly. Every reader below is scoped
 * to one heading and throws when it finds no rows: a silently empty list would
 * turn the comparisons in the reference test into assertions about nothing.
 */
function sectionBody(heading: string) {
  const start = randomPickerDecisionRecord.indexOf(`\n${heading}\n`)
  if (start === -1) throw new Error(`Decision record has no section "${heading}"`)

  const body = randomPickerDecisionRecord.slice(start + heading.length + 2)
  const nextHeading = body.search(/^#{2,3} /m)

  return nextHeading === -1 ? body : body.slice(0, nextHeading)
}

function tableRows(heading: string, pattern: RegExp) {
  const rows = [...sectionBody(heading).matchAll(pattern)]
  if (rows.length === 0) throw new Error(`Section "${heading}" has no row matching ${pattern}`)

  return rows
}

/**
 * List text and entries are written as JSON in the document so that whitespace,
 * line breaks and an empty field all stay visible in a Markdown table.
 */
function parseJsonCell<T>(cell: string) {
  return JSON.parse(cell) as T
}

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
  return tableRows('### 5.2 錯誤情境', /^\| `([a-z-]+)` \|/gm).map(([, code]) => code!)
}

export function parseCaveatKeys(): string[] {
  return tableRows('### 7.1 必須同時呈現的免責內容', /^\| `([a-z-]+)` \|/gm).map(([, key]) => key!)
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
  return tableRows('### 4.3 重複項目策略', /^\| `([a-z]+)` \|/gm).map(([, key]) => key! as DuplicatePolicy)
}
