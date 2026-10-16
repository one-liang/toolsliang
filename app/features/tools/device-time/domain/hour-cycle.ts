import type { LocaleCode } from '@/features/tools/catalog'
import { readStoredValue, writeStoredValue, type DeviceStorage } from '@/features/shell/device-storage'

export type HourCycle = 'h12' | 'h23'

/**
 * 12- or 24-hour display is an interface preference, like the theme (ADR-0016): it
 * stays on this device, is written only after the visitor switches, and never holds
 * a reading of the clock.
 */
export const HOUR_CYCLE_STORAGE_KEY = 'toolsliang-device-time-hour-cycle'

/** What `Intl.DateTimeFormat(...).resolvedOptions()` reports about a locale's clock. */
export interface ClockConvention {
  locale: string
  hourCycle?: string
  hour12?: boolean
}

export function normalizeHourCycle(value: unknown): HourCycle | null {
  return value === 'h12' || value === 'h23' ? value : null
}

export function readStoredHourCycle(storage: DeviceStorage | null | undefined): HourCycle | null {
  return normalizeHourCycle(readStoredValue(storage, HOUR_CYCLE_STORAGE_KEY))
}

export function persistHourCycle(storage: DeviceStorage | null | undefined, hourCycle: HourCycle): boolean {
  return writeStoredValue(storage, HOUR_CYCLE_STORAGE_KEY, hourCycle)
}

/**
 * The device's own convention wins when it speaks the page's language: an en-GB
 * device reads the English page in 24-hour, and a browser that honours the system
 * 24-hour switch carries it here. Otherwise the page language decides, so the
 * Chinese page on an en-US device still reads 上午／下午 the way zh-TW writes time.
 */
export function defaultHourCycle(locale: LocaleCode, conventionOf: (tag?: string) => ClockConvention | undefined = readConvention): HourCycle {
  const device = conventionOf()
  const language = locale === 'en' ? 'en' : 'zh'
  const fromDevice = device?.locale.split('-')[0]?.toLowerCase() === language ? toHourCycle(device) : null
  if (fromDevice) return fromDevice
  const page = conventionOf(locale === 'en' ? 'en-US' : 'zh-TW')
  return (page && toHourCycle(page)) ?? 'h23'
}

function readConvention(tag?: string): ClockConvention | undefined {
  try {
    return new Intl.DateTimeFormat(tag, { hour: 'numeric' }).resolvedOptions()
  }
  catch {
    return undefined
  }
}

function toHourCycle(convention: ClockConvention): HourCycle | null {
  if (convention.hourCycle === 'h11' || convention.hourCycle === 'h12') return 'h12'
  if (convention.hourCycle === 'h23' || convention.hourCycle === 'h24') return 'h23'
  if (typeof convention.hour12 === 'boolean') return convention.hour12 ? 'h12' : 'h23'
  return null
}
