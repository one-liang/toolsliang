/**
 * One guarded accessor for every device-local preference. Storage can be
 * missing, blocked, or full in private and restricted browsing contexts, so a
 * preference that cannot be read or written degrades to its default instead of
 * taking the interface down with it.
 */
export interface DeviceStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem?: (key: string) => void
}

export function getDeviceStorage(): DeviceStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  }
  catch {
    return null
  }
}

export function readStoredValue(storage: DeviceStorage | null | undefined, key: string): string | null {
  if (!storage) return null

  try {
    return storage.getItem(key)
  }
  catch {
    return null
  }
}

export function writeStoredValue(storage: DeviceStorage | null | undefined, key: string, value: string): boolean {
  if (!storage) return false

  try {
    storage.setItem(key, value)
    return true
  }
  catch {
    return false
  }
}

export function removeStoredValue(storage: DeviceStorage | null | undefined, key: string): boolean {
  if (!storage?.removeItem) return false

  try {
    storage.removeItem(key)
    return true
  }
  catch {
    return false
  }
}
