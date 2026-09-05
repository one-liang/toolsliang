import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { NtdGoldenVector, NtdRejectionVector } from '@/features/tools/ntd-uppercase/domain/reference'

/**
 * The NTD uppercase decision record is the single source the domain modules
 * answer to. The reference test reads the tables from here so a rule can never
 * be changed in the document without the module failing, or the other way
 * round.
 */
export const ntdDecisionRecord = readFileSync(
  resolve(process.cwd(), 'docs/research/002-ntd-uppercase-rules-and-sources.md'),
  'utf8',
)

/**
 * The document parsed here is the specification, so a table that moved, was
 * renamed or stopped matching has to fail loudly. Every reader below is scoped
 * to one heading and throws when it finds no rows: a silently empty list would
 * turn the comparisons in the reference test into assertions about nothing.
 */
function sectionBody(heading: string) {
  const start = ntdDecisionRecord.indexOf(`\n${heading}\n`)
  if (start === -1) throw new Error(`Decision record has no section "${heading}"`)

  const body = ntdDecisionRecord.slice(start + heading.length + 2)
  const nextHeading = body.search(/^#{2,3} /m)

  return nextHeading === -1 ? body : body.slice(0, nextHeading)
}

function tableRows(heading: string, pattern: RegExp) {
  const rows = [...sectionBody(heading).matchAll(pattern)]
  if (rows.length === 0) throw new Error(`Section "${heading}" has no row matching ${pattern}`)

  return rows
}

/**
 * Inputs are written as JSON strings in the document so an empty field and a
 * whitespace-only field stay distinguishable in a Markdown table.
 */
function parseInput(cell: string) {
  return JSON.parse(cell) as string
}

/** Purpose and key columns stay strings: comparing them is the point. */
export interface DocumentedWordingVector extends Omit<NtdGoldenVector, 'purpose'> {
  purpose: string
}

export interface DocumentedRejectionVector extends Omit<NtdRejectionVector, 'purpose' | 'code'> {
  purpose: string
  code: string
}

export function parseWordingVectors(): DocumentedWordingVector[] {
  const pattern = /^\| `("(?:[^"\\]|\\.)*")` \| `([a-z]+)` \| `([^`]*)` \| ([^|]+?) \|/gm

  return tableRows('### 6.1 大寫結果向量', pattern).map(([, input, purpose, normalized, wording]) => ({
    input: parseInput(input!),
    purpose: purpose!,
    normalized: normalized!,
    wording: wording!.trim(),
  }))
}

export function parseRejectionVectors(): DocumentedRejectionVector[] {
  const pattern = /^\| `("(?:[^"\\]|\\.)*")` \| `([a-z]+)` \| `([a-z-]+)` \|/gm

  return tableRows('### 6.2 拒絕向量', pattern).map(([, input, purpose, code]) => ({
    input: parseInput(input!),
    purpose: purpose!,
    code: code!,
  }))
}

/** Error keys in the order the document lists them, which is the check order. */
export function parseErrorCodes(): string[] {
  return tableRows('### 5.5 錯誤情境', /^\| `([a-z-]+)` \|/gm).map(([, code]) => code!)
}

export function parseCaveatKeys(): string[] {
  return tableRows('### 7.1 必須同時呈現的免責內容', /^\| `([a-z-]+)` \|/gm).map(([, key]) => key!)
}
