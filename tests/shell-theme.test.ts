import { describe, expect, it } from 'vitest'
import {
  applyThemeClass,
  DARK_CLASS,
  DEFAULT_THEME,
  nextTheme,
  normalizeStoredTheme,
  persistTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
  themeBootstrapScript,
} from '@/features/shell/theme'

describe('shell theme preference', () => {
  it('defaults to the light theme', () => {
    expect(DEFAULT_THEME).toBe('light')
  })

  it('only accepts known modes from storage', () => {
    expect(normalizeStoredTheme('light')).toBe('light')
    expect(normalizeStoredTheme('dark')).toBe('dark')
    expect(normalizeStoredTheme('system')).toBeNull()
    expect(normalizeStoredTheme(null)).toBeNull()
    expect(normalizeStoredTheme(undefined)).toBeNull()
  })

  it('toggles between light and dark', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })

  it('reads without writing a preference', () => {
    expect(readStoredTheme(localStorage)).toBeNull()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('persists only when a preference is explicitly saved', () => {
    expect(persistTheme(localStorage, 'dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(readStoredTheme(localStorage)).toBe('dark')
  })

  it('stays usable when storage is unavailable', () => {
    const blocked = {
      getItem() { throw new Error('storage blocked') },
      setItem() { throw new Error('storage blocked') },
    }

    expect(readStoredTheme(blocked)).toBeNull()
    expect(persistTheme(blocked, 'dark')).toBe(false)
    expect(readStoredTheme(null)).toBeNull()
  })

  it('applies the mode as a root class', () => {
    applyThemeClass(document.documentElement, 'dark')
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true)

    applyThemeClass(document.documentElement, 'light')
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false)
  })

  it('bootstraps a saved dark preference before paint', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    new Function(themeBootstrapScript)()

    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true)
  })

  it('bootstraps light without saving a preference for a first visit', () => {
    new Function(themeBootstrapScript)()

    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('ignores an unusable saved value instead of throwing', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system')

    expect(() => new Function(themeBootstrapScript)()).not.toThrow()
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false)
  })
})
