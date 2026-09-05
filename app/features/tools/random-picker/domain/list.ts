import { randomPickerLimits, type DuplicatePolicy } from './reference'

/**
 * Turns what a visitor pasted into the entries a draw runs on. Splitting is
 * deliberately narrow — only a line break separates two entries — because a
 * name, a product or an address may legitimately contain a comma or a space,
 * and a wider separator would silently turn one candidate into two.
 *
 * The module reports what it skipped rather than fixing the list quietly:
 * removing an entry changes everyone else's chance, so the page has to be able
 * to say what happened before anything is drawn.
 */

export interface RandomPickerList {
  entries: string[]
  /** Lines that held nothing but whitespace, so the page can say what it skipped. */
  blankLines: number
  /** Entries removed because the visitor chose to merge duplicates. */
  mergedDuplicates: number
  /** Entries longer than the reviewed ceiling, counted but never quoted back. */
  overlongEntries: number
  /** Whether repeated text was present at all, whichever policy applied. */
  hasDuplicates: boolean
}

const LINE_BREAK = /\r\n|\r|\n/

export function parseRandomPickerList(text: string, duplicates: DuplicatePolicy): RandomPickerList {
  const lines = splitLines(text)
  const trimmed: string[] = []
  let blankLines = 0

  for (const line of lines) {
    // `trim` already covers the full-width space a Chinese keyboard produces.
    const entry = line.trim()
    if (entry) trimmed.push(entry)
    else blankLines += 1
  }

  const entries = duplicates === 'merge' ? [...new Set(trimmed)] : trimmed

  return {
    entries,
    blankLines,
    mergedDuplicates: trimmed.length - entries.length,
    overlongEntries: entries.filter(isOverlong).length,
    hasDuplicates: new Set(trimmed).size !== trimmed.length,
  }
}

/**
 * A trailing line break is how a paste ends, not a blank line the visitor left
 * behind, so it never becomes something the page reports as skipped.
 */
function splitLines(text: string) {
  if (!text) return []

  const lines = text.split(LINE_BREAK)
  if (lines.at(-1) === '') lines.pop()

  return lines
}

/** Counted in code points: an emoji or a rare character is one character to a reader. */
function isOverlong(entry: string) {
  return [...entry].length > randomPickerLimits.maxEntryLength
}
