import { describe, expect, it } from 'vitest'
import {
  addSavedTool,
  LEGACY_SAVED_TOOLS_STORAGE_KEY,
  moveSavedTool,
  parseSavedTools,
  persistSavedTools,
  readSavedTools,
  reconcileSavedTools,
  removeSavedTool,
  SAVED_TOOLS_SCHEMA_VERSION,
  SAVED_TOOLS_STORAGE_KEY,
  serializeSavedTools,
  toggleSavedTool,
} from '@/features/shell/saved-tools'

/** The catalog answers this in the application; a test only needs a stable set of known slugs. */
const known = ['alpha', 'beta', 'gamma']
const resolveSlug = (slug: string) => {
  if (known.includes(slug)) return slug
  return slug === 'legacy-alpha' ? 'alpha' : undefined
}

describe('saved tools storage record', () => {
  it('reads the versioned record it writes', () => {
    const serialized = serializeSavedTools(['alpha', 'beta'])

    expect(JSON.parse(serialized)).toEqual({ version: SAVED_TOOLS_SCHEMA_VERSION, slugs: ['alpha', 'beta'] })
    expect(parseSavedTools(serialized)).toEqual(['alpha', 'beta'])
  })

  it('upgrades the unversioned list an earlier release saved', () => {
    expect(parseSavedTools('["alpha","beta"]')).toEqual(['alpha', 'beta'])
  })

  it('keeps the slugs of a record written by a newer release', () => {
    const future = JSON.stringify({ version: SAVED_TOOLS_SCHEMA_VERSION + 1, slugs: ['beta'], pinned: true })

    expect(parseSavedTools(future)).toEqual(['beta'])
  })

  it('starts empty rather than guessing at a record it cannot read', () => {
    const unreadable = JSON.stringify({ version: SAVED_TOOLS_SCHEMA_VERSION + 1, tools: [{ id: 'beta' }] })

    expect(parseSavedTools(unreadable)).toEqual([])
    expect(parseSavedTools(JSON.stringify({ version: 0, slugs: ['beta'] }))).toEqual([])
  })

  it('ignores unreadable or wrongly shaped values instead of throwing', () => {
    expect(parseSavedTools(null)).toEqual([])
    expect(parseSavedTools('')).toEqual([])
    expect(parseSavedTools('not json')).toEqual([])
    expect(parseSavedTools('{"version":1}')).toEqual([])
    expect(parseSavedTools('{"version":1,"slugs":"alpha"}')).toEqual([])
    expect(parseSavedTools('[1,{"slug":"alpha"},"beta"]')).toEqual(['beta'])
  })
})

describe('saved tools reconciliation', () => {
  it('keeps the saved order of tools that are still published', () => {
    expect(reconcileSavedTools(['gamma', 'alpha'], resolveSlug)).toEqual(['gamma', 'alpha'])
  })

  it('drops a withdrawn or unknown tool instead of navigating to it', () => {
    expect(reconcileSavedTools(['alpha', 'withdrawn-tool', 'beta'], resolveSlug)).toEqual(['alpha', 'beta'])
  })

  it('follows a renamed slug to the tool it became', () => {
    expect(reconcileSavedTools(['legacy-alpha', 'beta'], resolveSlug)).toEqual(['alpha', 'beta'])
  })

  it('collapses a duplicate created by a rename or a stale write', () => {
    expect(reconcileSavedTools(['alpha', 'legacy-alpha', 'alpha'], resolveSlug)).toEqual(['alpha'])
  })
})

describe('saved tools list operations', () => {
  it('adds a tool at the end and never twice', () => {
    expect(addSavedTool(['alpha'], 'beta')).toEqual(['alpha', 'beta'])
    expect(addSavedTool(['alpha', 'beta'], 'alpha')).toEqual(['alpha', 'beta'])
  })

  it('removes only the requested tool', () => {
    expect(removeSavedTool(['alpha', 'beta'], 'alpha')).toEqual(['beta'])
    expect(removeSavedTool(['alpha'], 'gamma')).toEqual(['alpha'])
  })

  it('toggles a tool in and out of the list', () => {
    expect(toggleSavedTool([], 'alpha')).toEqual(['alpha'])
    expect(toggleSavedTool(['alpha'], 'alpha')).toEqual([])
  })

  it('moves a tool one position at a time', () => {
    expect(moveSavedTool(['alpha', 'beta', 'gamma'], 'gamma', -1)).toEqual(['alpha', 'gamma', 'beta'])
    expect(moveSavedTool(['alpha', 'beta', 'gamma'], 'alpha', 1)).toEqual(['beta', 'alpha', 'gamma'])
  })

  it('stays unchanged at the ends of the list and for an unsaved tool', () => {
    expect(moveSavedTool(['alpha', 'beta'], 'alpha', -1)).toEqual(['alpha', 'beta'])
    expect(moveSavedTool(['alpha', 'beta'], 'beta', 1)).toEqual(['alpha', 'beta'])
    expect(moveSavedTool(['alpha', 'beta'], 'gamma', -1)).toEqual(['alpha', 'beta'])
  })

  it('never mutates the list it was given', () => {
    const slugs = ['alpha', 'beta']

    addSavedTool(slugs, 'gamma')
    removeSavedTool(slugs, 'alpha')
    moveSavedTool(slugs, 'beta', -1)

    expect(slugs).toEqual(['alpha', 'beta'])
  })
})

describe('saved tools device storage', () => {
  it('stays empty and writes nothing for a first visit', () => {
    expect(readSavedTools(localStorage, resolveSlug)).toEqual([])
    expect(localStorage.length, '未主動收藏前不得寫入本機儲存').toBe(0)
  })

  it('persists an explicit change and reads it back', () => {
    expect(persistSavedTools(localStorage, ['beta', 'alpha'])).toBe(true)
    expect(readSavedTools(localStorage, resolveSlug)).toEqual(['beta', 'alpha'])
  })

  it('cleans a withdrawn tool out of what it reads back', () => {
    persistSavedTools(localStorage, ['alpha', 'withdrawn-tool'])

    expect(readSavedTools(localStorage, resolveSlug)).toEqual(['alpha'])
  })

  it('upgrades a legacy record and removes the superseded key once written', () => {
    localStorage.setItem(LEGACY_SAVED_TOOLS_STORAGE_KEY, '["legacy-alpha","beta"]')

    expect(readSavedTools(localStorage, resolveSlug)).toEqual(['alpha', 'beta'])
    expect(localStorage.getItem(LEGACY_SAVED_TOOLS_STORAGE_KEY), '升級前不得先刪除既有資料').not.toBeNull()

    persistSavedTools(localStorage, ['alpha', 'beta'])

    expect(JSON.parse(localStorage.getItem(SAVED_TOOLS_STORAGE_KEY)!)).toEqual({
      version: SAVED_TOOLS_SCHEMA_VERSION,
      slugs: ['alpha', 'beta'],
    })
    expect(localStorage.getItem(LEGACY_SAVED_TOOLS_STORAGE_KEY)).toBeNull()
  })

  it('prefers the current record over a stale legacy one', () => {
    localStorage.setItem(LEGACY_SAVED_TOOLS_STORAGE_KEY, '["gamma"]')
    persistSavedTools(localStorage, ['alpha'])

    expect(readSavedTools(localStorage, resolveSlug)).toEqual(['alpha'])
  })

  it('stays usable when storage is unavailable', () => {
    const blocked = {
      getItem() { throw new Error('storage blocked') },
      setItem() { throw new Error('storage blocked') },
      removeItem() { throw new Error('storage blocked') },
    }

    expect(readSavedTools(blocked, resolveSlug)).toEqual([])
    expect(persistSavedTools(blocked, ['alpha'])).toBe(false)
    expect(readSavedTools(null, resolveSlug)).toEqual([])
    expect(persistSavedTools(null, ['alpha'])).toBe(false)
  })

  it('only ever holds tool identity, never tool content', () => {
    persistSavedTools(localStorage, ['alpha'])

    const record = JSON.parse(localStorage.getItem(SAVED_TOOLS_STORAGE_KEY)!)
    expect(Object.keys(record).sort(), '本機紀錄只保存工具識別碼與排序').toEqual(['slugs', 'version'])
  })
})
