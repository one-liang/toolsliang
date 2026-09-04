import { readStoredValue, writeStoredValue, type DeviceStorage } from './device-storage'

export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'toolsliang-theme'
export const DEFAULT_THEME: ThemeMode = 'light'
export const DARK_CLASS = 'dark'

export function normalizeStoredTheme(value: unknown): ThemeMode | null {
  return value === 'light' || value === 'dark' ? value : null
}

export function nextTheme(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark'
}

export function readStoredTheme(storage: DeviceStorage | null | undefined): ThemeMode | null {
  return normalizeStoredTheme(readStoredValue(storage, THEME_STORAGE_KEY))
}

export function persistTheme(storage: DeviceStorage | null | undefined, mode: ThemeMode): boolean {
  return writeStoredValue(storage, THEME_STORAGE_KEY, mode)
}

export function applyThemeClass(root: HTMLElement, mode: ThemeMode) {
  root.classList.toggle(DARK_CLASS, mode === 'dark')
  root.style.colorScheme = mode
}

/**
 * Runs before first paint so a saved preference never flashes the default theme.
 * It only reads storage: a visitor who never toggles keeps an empty preference.
 */
export const themeBootstrapScript = `try{var m=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=m==='dark';document.documentElement.classList.toggle(${JSON.stringify(DARK_CLASS)},d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}`
