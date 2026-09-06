import { ref, shallowRef, onMounted } from 'vue'
import { openLocalAssetStore } from '@/features/shell/local-assets/indexeddb-store'
import {
  createLocalAssetRepository,
  type LocalAssetErrorCode,
  type LocalAssetListing,
  type LocalAssetResult,
  type LocalAssetStore,
} from '@/features/shell/local-assets/repository'
import type { LocalAssetRecord } from '@/features/shell/local-assets/schema'
import { summarizeLocalAssets, type LocalAssetUsage } from '@/features/shell/local-assets/usage'
import {
  customCalendarFileName,
  mergeImportedEntries,
  parseCustomCalendarFile,
  readCustomCalendarDocument,
  serializeCustomCalendar,
  type CustomCalendarFileErrorCode,
} from '@/features/tools/custom-calendar/domain/document'
import {
  createEntry,
  CUSTOM_CALENDAR_ENTRY_LIMIT,
  updateEntry,
  validateEntryDraft,
  type CustomCalendarEntry,
  type CustomCalendarEntryDraft,
  type CustomEntryIssue,
} from '@/features/tools/custom-calendar/domain/entries'
import { taiwanCalendarPublishableYears } from '@/features/tools/taiwan-calendar/domain/sources'

/**
 * The custom calendar this device holds. Every read and write goes to the
 * browser database of this device through the local asset repository: no
 * request is made, and the backup file is produced locally by an action the
 * visitor started.
 *
 * The tool owns exactly one document, addressed by a stable id so it can be
 * found again on the next visit. A document this build cannot read is never
 * written over: the interface reports what it found and offers the raw bytes
 * back, because content that might still be recoverable outranks the
 * convenience of starting again.
 */
export const CUSTOM_CALENDAR_ASSET_ID = 'custom-calendar'
/** Shown in the local assets list; a rename made there survives every later write. */
export const CUSTOM_CALENDAR_ASSET_NAME = '自訂行事曆 Custom Calendar'

export type CustomCalendarDocumentStatus = 'ready' | 'corrupt' | 'unsupported-version'

/** No issues on a refusal means the device itself said no; `error` then names why. */
export type SaveEntryOutcome =
  | { ok: true, entry: CustomCalendarEntry }
  | { ok: false, issues: CustomEntryIssue[] }

export function useCustomCalendar(openStore: () => Promise<LocalAssetStore> = openLocalAssetStore) {
  const repository = createLocalAssetRepository(openStore)
  const entries = ref<CustomCalendarEntry[]>([])
  const record = shallowRef<LocalAssetRecord | undefined>()
  const usage = ref<LocalAssetUsage>(summarizeLocalAssets([]))
  const documentStatus = ref<CustomCalendarDocumentStatus>('ready')
  /** Kept only so an unreadable document can be handed back to its owner. */
  const rawDocument = ref('')
  const error = ref<LocalAssetErrorCode | null>(null)
  const fileError = ref<CustomCalendarFileErrorCode | null>(null)
  const busy = ref(false)
  /** The device has been read once; before that the interface promises nothing. */
  const ready = ref(false)

  function now() {
    return new Date()
  }

  /**
   * A failed operation keeps whatever the interface already shows: losing the
   * list would take away the controls that recover from the failure.
   */
  async function run<T>(operation: () => Promise<LocalAssetResult<T>>): Promise<T | null> {
    busy.value = true
    try {
      const result = await operation()
      error.value = result.ok ? null : result.code
      return result.ok ? result.value : null
    }
    finally {
      busy.value = false
    }
  }

  function applyListing(listing: LocalAssetListing) {
    usage.value = listing.usage

    const unreadable = listing.unreadable.find(item => item.id === CUSTOM_CALENDAR_ASSET_ID)
    if (unreadable) {
      record.value = undefined
      entries.value = []
      rawDocument.value = ''
      documentStatus.value = unreadable.reason === 'corrupt' ? 'corrupt' : 'unsupported-version'
      return false
    }

    const stored = listing.records.find(item => item.id === CUSTOM_CALENDAR_ASSET_ID)
    record.value = stored
    if (!stored) {
      entries.value = []
      rawDocument.value = ''
      documentStatus.value = 'ready'
      return false
    }

    const contents = stored.payload.format === 'text' ? stored.payload.text : ''
    rawDocument.value = contents

    const reading = readCustomCalendarDocument(contents)
    if (reading.status === 'corrupt' || reading.status === 'unsupported-version') {
      entries.value = []
      documentStatus.value = reading.status
      return false
    }

    entries.value = reading.entries
    documentStatus.value = 'ready'

    // Storing the upgraded shape saves the next read from repeating the work.
    return reading.status === 'upgraded'
  }

  async function refresh() {
    const listing = await run(() => repository.list())
    if (listing && applyListing(listing)) await write(entries.value)
    ready.value = true
  }

  /** The whole calendar is rewritten as one document, so a write is all or nothing. */
  async function write(next: CustomCalendarEntry[]): Promise<boolean> {
    const listing = await run(() => repository.put(CUSTOM_CALENDAR_ASSET_ID, {
      kind: 'calendar',
      name: record.value?.name ?? CUSTOM_CALENDAR_ASSET_NAME,
      payload: {
        format: 'text',
        mediaType: 'application/json',
        text: serializeCustomCalendar(next, now()),
      },
    }))
    if (listing) applyListing(listing)

    return listing !== null
  }

  /** Nothing is written over a document this build could not read. */
  function writable() {
    return documentStatus.value === 'ready'
  }

  onMounted(refresh)

  return {
    entries,
    record,
    usage,
    documentStatus,
    rawDocument,
    error,
    fileError,
    busy,
    ready,
    refresh,

    /**
     * Validates before it writes, so the one path that reaches the device is
     * also the one that enforces the limits the copy promises.
     */
    async saveEntry(draft: CustomCalendarEntryDraft, id?: string): Promise<SaveEntryOutcome> {
      const existing = id ? entries.value.find(entry => entry.id === id) : undefined
      const issues = validateEntryDraft(draft, {
        ...taiwanCalendarPublishableYears,
        existing: entries.value.length - (existing ? 1 : 0),
      })
      if (issues.length) return { ok: false, issues }
      if (!writable()) return { ok: false, issues: [] }

      const entry = existing
        ? updateEntry(existing, draft, now())
        : createEntry(draft, { id: createEntryId(), now: now() })
      const next = existing
        ? entries.value.map(item => item.id === entry.id ? entry : item)
        : [...entries.value, entry]

      return await write(next) ? { ok: true, entry } : { ok: false, issues: [] }
    },

    removeEntry(id: string): Promise<boolean> {
      if (!writable()) return Promise.resolve(false)

      return write(entries.value.filter(entry => entry.id !== id))
    },

    /**
     * Removes the document itself, so a cleared device holds no leftover record.
     * It is also how an unreadable document is started again: the same delete,
     * asked for explicitly, after the visitor has been offered the raw bytes.
     */
    async clearAll(): Promise<boolean> {
      const listing = await run(() => repository.remove(CUSTOM_CALENDAR_ASSET_ID))
      if (listing) applyListing(listing)

      return listing !== null
    },

    /** Produces the backup file on this device and hands it to the browser's own download. */
    exportFile(): string | null {
      if (!entries.value.length) return null

      const stamp = now()
      return downloadLocally(serializeCustomCalendar(entries.value, stamp), customCalendarFileName(stamp))
    },

    /** Hands back the bytes this device holds, unchanged, when they cannot be read. */
    exportRaw(): string | null {
      if (!rawDocument.value) return null

      return downloadLocally(rawDocument.value, customCalendarFileName(now()))
    },

    /** Reads the chosen file in the browser; it is never sent anywhere. */
    async importFile(file: File): Promise<{ added: number, replaced: number } | null> {
      fileError.value = null
      if (!writable()) return null

      const reading = parseCustomCalendarFile(await file.text())
      if (!reading.ok) {
        fileError.value = reading.code
        return null
      }

      const merged = mergeImportedEntries(entries.value, reading.entries)
      if (merged.entries.length > CUSTOM_CALENDAR_ENTRY_LIMIT) {
        fileError.value = 'too-many-entries'
        return null
      }

      return await write(merged.entries) ? { added: merged.added, replaced: merged.replaced } : null
    },
  }
}

function createEntryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()

  return `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** The file is built in the tab and saved by the browser; nothing is uploaded. */
function downloadLocally(contents: string, fileName: string): string {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked on the next task: some browsers still need the URL when the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 0)

  return fileName
}
