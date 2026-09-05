import type { LocaleCode } from '@/features/tools/catalog'

export interface DeviceTimeInput {
  instant: number
  locale: LocaleCode
  timeZone?: string
  /** Minutes east of UTC, sampled from the same instant for reduced capability mode. */
  offsetMinutes: number
  showSeconds: boolean
}

export function formatDeviceTime(input: DeviceTimeInput) {
  if (!Number.isFinite(new Date(input.instant).getTime())
    || !Number.isInteger(input.offsetMinutes) || Math.abs(input.offsetMinutes) > 1440
    || !Number.isFinite(new Date(input.instant + input.offsetMinutes * 60_000).getTime())) {
    return { ok: false as const, error: 'invalid-time' as const }
  }
  if (!input.timeZone) return reducedTime(input)
  try {
    const locale = input.locale === 'en' ? 'en-US' : 'zh-TW'
    const date = new Date(input.instant)
    const options = { timeZone: input.timeZone, calendar: 'gregory', numberingSystem: 'latn' }
    const offset = new Intl.DateTimeFormat('en-US', {
      ...options, timeZoneName: 'longOffset',
    }).formatToParts(date).find(part => part.type === 'timeZoneName')!.value
    return {
      ok: true as const,
      date: new Intl.DateTimeFormat(locale, { ...options, year: 'numeric', month: 'long', day: 'numeric' }).format(date),
      time: new Intl.DateTimeFormat(locale, {
        ...options, hour: '2-digit', minute: '2-digit',
        second: input.showSeconds ? '2-digit' : undefined, hourCycle: 'h23',
      }).format(date),
      timeZone: input.timeZone,
      offset: offset === 'GMT' ? 'UTC+00:00' : offset.replace('GMT', 'UTC'),
      datetime: date.toISOString(),
      reduced: false,
    }
  }
  catch {
    return reducedTime(input)
  }
}

function reducedTime(input: DeviceTimeInput) {
  const local = new Date(input.instant + input.offsetMinutes * 60_000).toISOString()
  const absolute = Math.abs(input.offsetMinutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  const minutes = String(absolute % 60).padStart(2, '0')
  return {
    ok: true as const,
    date: local.slice(0, 10),
    time: local.slice(11, input.showSeconds ? 19 : 16),
    timeZone: undefined,
    offset: `UTC${input.offsetMinutes < 0 ? '-' : '+'}${hours}:${minutes}`,
    datetime: new Date(input.instant).toISOString(),
    reduced: true,
  }
}
