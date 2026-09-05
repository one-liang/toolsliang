import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

export interface DocumentedWordingVector {
  input: string
  purpose: string
  normalized: string
  wording: string
}

export interface DocumentedRejectionVector {
  input: string
  purpose: string
  code: string
}

/**
 * Inputs are written as JSON strings in the document so an empty field and a
 * whitespace-only field stay distinguishable in a Markdown table.
 */
function parseInput(cell: string) {
  return JSON.parse(cell) as string
}

/** Rows of the wording vector table (section 6.1): five columns. */
export function parseWordingVectors(): DocumentedWordingVector[] {
  const pattern = /^\| `("(?:[^"\\]|\\.)*")` \| `([a-z]+)` \| `([^`]*)` \| ([^|]+?) \| [^|]*\|$/gm

  return [...ntdDecisionRecord.matchAll(pattern)].map(([, input, purpose, normalized, wording]) => ({
    input: parseInput(input!),
    purpose: purpose!,
    normalized: normalized!,
    wording: wording!.trim(),
  }))
}

/** Rows of the rejection table (section 6.2): four columns. */
export function parseRejectionVectors(): DocumentedRejectionVector[] {
  const pattern = /^\| `("(?:[^"\\]|\\.)*")` \| `([a-z]+)` \| `([a-z-]+)` \| [^|]*\|$/gm

  return [...ntdDecisionRecord.matchAll(pattern)].map(([, input, purpose, code]) => ({
    input: parseInput(input!),
    purpose: purpose!,
    code: code!,
  }))
}

/** Error keys of the error table (section 5.5): four columns, key first. */
export function parseErrorCodes(): string[] {
  const pattern = /^\| `([a-z-]+)` \| [^|]+\| [^|]+\| [^|]*\|$/gm

  return [...ntdDecisionRecord.matchAll(pattern)].map(([, code]) => code!)
}

/** Caveat keys of the caveat table (section 7.1): three columns, key first. */
export function parseCaveatKeys(): string[] {
  const pattern = /^\| `([a-z-]+)` \| [^|]+\| [^|]*\|$/gm

  return [...ntdDecisionRecord.matchAll(pattern)].map(([, key]) => key!)
}
