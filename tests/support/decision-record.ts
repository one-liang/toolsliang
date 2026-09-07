import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Each research decision record is the single source its domain modules answer
 * to. The reference tests read the record's tables through this reader so a
 * rule can never change in the document without the module failing, or the
 * other way round.
 *
 * The document being parsed is the specification, so a table that moved, was
 * renamed or stopped matching has to fail loudly: every reader below throws
 * rather than returning nothing, because a silently empty list would turn the
 * comparisons in a reference test into assertions about nothing.
 */
export interface DecisionRecordReader {
  /** The record verbatim, for asserting on ids and URLs it has to contain. */
  record: string
  /** One section's body, from its heading to the next heading of any depth. */
  sectionBody: (heading: string) => string
  /** Every row of one section matching `pattern`; throws when there are none. */
  tableRows: (heading: string, pattern: RegExp) => RegExpExecArray[]
  /** The leading backticked key of every row under one heading. */
  parseKeyColumn: (heading: string, pattern?: RegExp) => string[]
  /**
   * A keyed table whose last two columns are the same sentence in both locales.
   * `leadingColumns` counts the columns between the key and the Chinese one.
   */
  parseBilingualRows: (heading: string, leadingColumns?: number) => DocumentedSentence[]
  /** Every wording a 禁止用語 section forbids, Chinese and English alike. */
  parseForbiddenWording: (heading: string) => string[]
  /**
   * The questions an AEO section approves as the only source of both the
   * visible FAQ and the FAQPage markup. The citation column is what tells a
   * data row apart from the table's own heading.
   */
  parseFaqQuestions: (heading: string) => LocalizedSentence[]
}

/** One sentence a record fixes in both locales, addressed by its key. */
export interface DocumentedSentence extends LocalizedSentence {
  key: string
}

export interface LocalizedSentence {
  'zh-tw': string
  en: string
}

/** Cells written as JSON keep whitespace, empty strings and lists unambiguous in a Markdown table. */
export function parseJsonCell<T>(cell: string) {
  return JSON.parse(cell) as T
}

const keyColumnPattern = /^\| `([a-z0-9-]+)` \|/gm

export function createDecisionRecordReader(relativePath: string): DecisionRecordReader {
  const record = readFileSync(resolve(process.cwd(), relativePath), 'utf8')

  function sectionBody(heading: string) {
    const start = record.indexOf(`\n${heading}\n`)
    if (start === -1) throw new Error(`${relativePath} has no section "${heading}"`)

    const body = record.slice(start + heading.length + 2)
    const nextHeading = body.search(/^#{2,6} /m)

    return nextHeading === -1 ? body : body.slice(0, nextHeading)
  }

  function tableRows(heading: string, pattern: RegExp) {
    const rows = [...sectionBody(heading).matchAll(pattern)]
    if (rows.length === 0) throw new Error(`Section "${heading}" has no row matching ${pattern}`)

    return rows
  }

  function parseBilingualRows(heading: string, leadingColumns = 0) {
    const skipped = ' [^|]+ \\|'.repeat(leadingColumns)
    const pattern = new RegExp(`^\\| \`([a-z-]+)\` \\|${skipped} (.+?) \\| (.+?) \\|$`, 'gm')

    return tableRows(heading, pattern).map(([, key, zh, en]) => ({
      key: key!,
      'zh-tw': zh!.trim(),
      en: en!.trim(),
    }))
  }

  function parseForbiddenWording(heading: string) {
    const body = sectionBody(heading)
    const listed = body.slice(0, body.indexOf('。', body.indexOf('不得出現')))

    return listed
      .replace(/^[\s\S]*?不得出現：/, '')
      .split(/[、，,]|以及/)
      .map(term => term.replace(/等對應說法$/, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  }

  function parseFaqQuestions(heading: string) {
    const pattern = /^\| ([^|]+?) \| ([^|]+?) \| ((?:§|ADR)[^|]*) \|$/gm

    return tableRows(heading, pattern).map(([, zh, en]) => ({
      'zh-tw': zh!.trim(),
      en: en!.trim(),
    }))
  }

  return {
    record,
    sectionBody,
    tableRows,
    parseKeyColumn: (heading, pattern = keyColumnPattern) =>
      tableRows(heading, pattern).map(([, key]) => key!),
    parseBilingualRows,
    parseForbiddenWording,
    parseFaqQuestions,
  }
}
