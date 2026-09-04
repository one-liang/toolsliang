import {
  readStoredValue,
  removeStoredValue,
  writeStoredValue,
  type DeviceStorage,
} from './device-storage'

export const SAVED_TOOLS_STORAGE_KEY = 'toolsliang-saved-tools'
/** The first App Shell release saved a bare slug array here; it is read once, then superseded. */
export const LEGACY_SAVED_TOOLS_STORAGE_KEY = 'toolsliang-common-tools'
export const SAVED_TOOLS_SCHEMA_VERSION = 1

/**
 * Answers which published tool a saved slug still points at, or nothing when
 * the tool was withdrawn. The catalog owns that answer; this module only needs
 * the question answered so a stale device list can never produce a dead link.
 */
export type SavedToolResolver = (slug: string) => string | undefined

export interface SavedToolsRecord {
  version: number
  slugs: string[]
}

/**
 * Accepts every shape this key has held: the unversioned array the first
 * release wrote, the current versioned record, and a record from a later
 * release. A stable tool id is the one thing every version agrees on, so a
 * newer record is read for its slugs and anything else it carries is left
 * behind — a device that moves between releases keeps its saved tools instead
 * of starting over.
 */
export function parseSavedTools(raw: string | null | undefined): string[] {
  if (!raw) return []

  let value: unknown
  try {
    value = JSON.parse(raw)
  }
  catch {
    return []
  }

  // Before SAVED_TOOLS_SCHEMA_VERSION existed the record was the slug list itself.
  if (Array.isArray(value)) return value.filter(isSlug)
  if (!isRecordObject(value)) return []

  const { version, slugs } = value
  if (typeof version !== 'number' || version < SAVED_TOOLS_SCHEMA_VERSION) return []

  return Array.isArray(slugs) ? slugs.filter(isSlug) : []
}

export function serializeSavedTools(slugs: string[]): string {
  return JSON.stringify({ version: SAVED_TOOLS_SCHEMA_VERSION, slugs: [...slugs] } satisfies SavedToolsRecord)
}

/** Keeps the visitor's order, follows renamed tools, and drops what no longer exists. */
export function reconcileSavedTools(slugs: string[], resolveSlug: SavedToolResolver): string[] {
  const reconciled: string[] = []

  for (const slug of slugs) {
    const resolved = resolveSlug(slug)
    if (!resolved || reconciled.includes(resolved)) continue
    reconciled.push(resolved)
  }

  return reconciled
}

export function addSavedTool(slugs: string[], slug: string): string[] {
  return slugs.includes(slug) ? [...slugs] : [...slugs, slug]
}

export function removeSavedTool(slugs: string[], slug: string): string[] {
  return slugs.filter(saved => saved !== slug)
}

export function toggleSavedTool(slugs: string[], slug: string): string[] {
  return slugs.includes(slug) ? removeSavedTool(slugs, slug) : addSavedTool(slugs, slug)
}

/** Moves one position at a time, which is what a keyboard or touch control can express. */
export function moveSavedTool(slugs: string[], slug: string, offset: -1 | 1): string[] {
  const index = slugs.indexOf(slug)
  const target = index + offset
  if (index === -1 || target < 0 || target >= slugs.length) return [...slugs]

  const reordered = [...slugs]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(target, 0, moved!)
  return reordered
}

export function readSavedTools(
  storage: DeviceStorage | null | undefined,
  resolveSlug: SavedToolResolver,
): string[] {
  const current = readStoredValue(storage, SAVED_TOOLS_STORAGE_KEY)
  const raw = current ?? readStoredValue(storage, LEGACY_SAVED_TOOLS_STORAGE_KEY)

  return reconcileSavedTools(parseSavedTools(raw), resolveSlug)
}

/**
 * Runs only for an explicit visitor action, so a device that never saved a tool
 * keeps an empty storage namespace. The superseded key is swept once the
 * current record is safely written.
 */
export function persistSavedTools(storage: DeviceStorage | null | undefined, slugs: string[]): boolean {
  const written = writeStoredValue(storage, SAVED_TOOLS_STORAGE_KEY, serializeSavedTools(slugs))
  if (written) removeStoredValue(storage, LEGACY_SAVED_TOOLS_STORAGE_KEY)

  return written
}

function isRecordObject(value: unknown): value is Partial<SavedToolsRecord> {
  return typeof value === 'object' && value !== null
}

function isSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
