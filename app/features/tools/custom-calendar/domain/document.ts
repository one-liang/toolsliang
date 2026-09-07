import {
  isCalendarDate,
  isCustomEntryMark,
  isEntryWithinRules,
  sortEntries,
  type CustomCalendarEntry,
} from './entries'

/**
 * The one file this tool writes, and the only shape it reads back. The device
 * store and the export file hold exactly the same document, so the file a
 * visitor downloads is literally what their device holds — there is no second
 * format to explain, and an export cannot quietly contain more than the page
 * showed.
 *
 * Nothing here moves a document anywhere. Serializing produces a string the
 * visitor's own download hands to their own disk; parsing reads a file they
 * chose themselves.
 */
export const CUSTOM_CALENDAR_FORMAT = 'toolsliang.custom-calendar'
/** Bumped when the shape of a stored entry changes; it travels with the document. */
export const CUSTOM_CALENDAR_DOCUMENT_VERSION = 1

export interface CustomCalendarDocument {
  format: string
  version: number
  updatedAt: string
  entries: unknown[]
}

export type CustomCalendarReading =
  | { status: 'ready', entries: CustomCalendarEntry[] }
  /** Read from an older document shape; the next write stores the current one. */
  | { status: 'upgraded', entries: CustomCalendarEntry[] }
  /** Written by a newer release: this build must not rewrite it. */
  | { status: 'unsupported-version' }
  | { status: 'corrupt' }

export const customCalendarFileErrorCodes = ['invalid-file', 'unsupported-file-version', 'empty-file', 'refused-entry', 'too-many-entries'] as const
export type CustomCalendarFileErrorCode = typeof customCalendarFileErrorCodes[number]

export type CustomCalendarFileReading =
  | { ok: true, entries: CustomCalendarEntry[] }
  | { ok: false, code: CustomCalendarFileErrorCode }

export function serializeCustomCalendar(entries: CustomCalendarEntry[], now: Date): string {
  const document: CustomCalendarDocument = {
    format: CUSTOM_CALENDAR_FORMAT,
    version: CUSTOM_CALENDAR_DOCUMENT_VERSION,
    updatedAt: now.toISOString(),
    entries: sortEntries(entries),
  }

  return JSON.stringify(document, null, 2)
}

/** Dated only: a file name is visible in a download shelf, so it never carries a title. */
export function customCalendarFileName(now: Date): string {
  return `toolsliang-custom-calendar-${now.toISOString().slice(0, 10)}.json`
}

/**
 * Reads the document this device holds. Damage is reported rather than thrown:
 * the page that shows the failure is the same page holding the controls that
 * export, replace or delete it, so it has to keep rendering.
 */
export function readCustomCalendarDocument(raw: string): CustomCalendarReading {
  const document = parseDocument(raw)
  if (!document) return { status: 'corrupt' }
  if (document.version > CUSTOM_CALENDAR_DOCUMENT_VERSION) return { status: 'unsupported-version' }

  const entries = readEntries(document.entries)
  if (!entries) return { status: 'corrupt' }

  return {
    status: document.version === CUSTOM_CALENDAR_DOCUMENT_VERSION ? 'ready' : 'upgraded',
    entries,
  }
}

/**
 * All or nothing. One unreadable entry refuses the whole file, so an import can
 * never leave a device holding half of a backup the visitor believed in — and a
 * readable entry that breaks the reviewed rules is refused just as firmly,
 * because it would be saved into a year this tool never draws and could then
 * only be removed by clearing everything.
 */
export function parseCustomCalendarFile(
  raw: string,
  coverage: { firstYear: number, lastYear: number },
): CustomCalendarFileReading {
  const document = parseDocument(raw)
  if (!document) return { ok: false, code: 'invalid-file' }
  if (document.version > CUSTOM_CALENDAR_DOCUMENT_VERSION) return { ok: false, code: 'unsupported-file-version' }

  const entries = readEntries(document.entries)
  if (!entries) return { ok: false, code: 'invalid-file' }
  if (!entries.length) return { ok: false, code: 'empty-file' }
  if (entries.some(entry => !isEntryWithinRules(entry, coverage))) return { ok: false, code: 'refused-entry' }

  return { ok: true, entries }
}

export interface ImportMerge {
  entries: CustomCalendarEntry[]
  added: number
  replaced: number
}

/**
 * What an import does to this device: an entry it does not have is added, and
 * one sharing an identity replaces what is there. Nothing saved is deleted, so
 * importing an older backup never silently removes the work done since.
 */
export function mergeImportedEntries(
  existing: CustomCalendarEntry[],
  incoming: CustomCalendarEntry[],
): ImportMerge {
  const owned = new Set(existing.map(entry => entry.id))
  const merged = new Map(existing.map(entry => [entry.id, entry]))
  // A file that names one id twice describes one entry, so the counts follow
  // the ids the device ends up holding rather than the lines in the file.
  for (const entry of incoming) merged.set(entry.id, entry)

  const arriving = new Set(incoming.map(entry => entry.id))
  const replaced = [...arriving].filter(id => owned.has(id)).length

  return { entries: sortEntries([...merged.values()]), added: arriving.size - replaced, replaced }
}

/** A real instant: the conflict on a day is settled by whichever entry is newer. */
function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function parseDocument(raw: string): { version: number, entries: unknown[] } | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  }
  catch {
    return null
  }

  if (typeof value !== 'object' || value === null) return null

  const document = value as Partial<CustomCalendarDocument>
  if (document.format !== CUSTOM_CALENDAR_FORMAT) return null
  if (typeof document.version !== 'number') return null
  if (!Array.isArray(document.entries)) return null

  return { version: document.version, entries: document.entries }
}

/** Null when any entry is unreadable: a partial calendar is worse than a named failure. */
function readEntries(values: unknown[]): CustomCalendarEntry[] | null {
  const entries: CustomCalendarEntry[] = []

  for (const value of values) {
    const entry = readEntry(value)
    if (!entry) return null
    entries.push(entry)
  }

  return sortEntries(entries)
}

function readEntry(value: unknown): CustomCalendarEntry | null {
  if (typeof value !== 'object' || value === null) return null

  const entry = value as Partial<CustomCalendarEntry>
  if (typeof entry.id !== 'string' || !entry.id) return null
  if (!isCalendarDate(entry.startDate) || !isCalendarDate(entry.endDate)) return null
  if (entry.endDate < entry.startDate) return null
  if (!isCustomEntryMark(entry.mark)) return null
  if (typeof entry.title !== 'string' || !entry.title.trim()) return null
  if (typeof entry.note !== 'string') return null
  if (!isTimestamp(entry.updatedAt)) return null

  return {
    id: entry.id,
    startDate: entry.startDate,
    endDate: entry.endDate,
    mark: entry.mark,
    title: entry.title,
    note: entry.note,
    updatedAt: entry.updatedAt,
  }
}
