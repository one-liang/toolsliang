import type { LocaleCode } from '@/features/tools/catalog'
import type { HourCycle } from './hour-cycle'

export interface DeviceTimeInput {
  instant: number
  locale: LocaleCode
  timeZone?: string
  /** Minutes east of UTC, sampled from the same instant for reduced capability mode. */
  offsetMinutes: number
  showSeconds: boolean
  /** Omitted means 24-hour, the clock every caller showed before the choice existed. */
  hourCycle?: HourCycle
}

/**
 * The displayed time in reading order. The digits and the 上午／下午 or AM／PM
 * marker are separate so a view can size them apart; joined, they are `time`.
 */
export interface DeviceTimePart {
  type: 'clock' | 'dayPeriod' | 'literal'
  value: string
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
    const hourCycle = input.hourCycle ?? 'h23'
    const date = new Date(input.instant)
    const options = { timeZone: input.timeZone, calendar: 'gregory', numberingSystem: 'latn' }
    const offset = new Intl.DateTimeFormat('en-US', {
      ...options, timeZoneName: 'longOffset',
    }).formatToParts(date).find(part => part.type === 'timeZoneName')!.value
    const parts = new Intl.DateTimeFormat(locale, {
      ...options, hour: hourCycle === 'h12' ? 'numeric' : '2-digit', minute: '2-digit',
      second: input.showSeconds ? '2-digit' : undefined, hourCycle,
    }).formatToParts(date)
    const period = parts.findIndex(part => part.type === 'dayPeriod')
    const clock = parts.filter(part => part.type !== 'dayPeriod' && (part.type !== 'literal' || part.value === ':'))
      .map(part => part.value).join('')
    const timeParts = arrange(input.locale, clock, period < 0 ? undefined : {
      value: parts[period]!.value,
      first: period < parts.findIndex(part => part.type === 'hour'),
    })
    return {
      ok: true as const,
      date: new Intl.DateTimeFormat(locale, { ...options, year: 'numeric', month: 'long', day: 'numeric' }).format(date),
      time: timeParts.map(part => part.value).join(''),
      timeParts,
      hourCycle,
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

/**
 * Chinese writes the marker before the digits with no space (下午5:10); English
 * writes it after a plain space (5:10 PM). Intl sometimes separates English with a
 * narrow no-break space, which copies badly, so the spacing is ours.
 */
function arrange(locale: LocaleCode, clock: string, period?: { value: string, first: boolean }): DeviceTimePart[] {
  const digits: DeviceTimePart = { type: 'clock', value: clock }
  if (!period) return [digits]
  const marker: DeviceTimePart = { type: 'dayPeriod', value: period.value }
  if (period.first) return [marker, digits]
  return locale === 'en' ? [digits, { type: 'literal', value: ' ' }, marker] : [digits, marker]
}

function reducedTime(input: DeviceTimeInput) {
  const local = new Date(input.instant + input.offsetMinutes * 60_000).toISOString()
  const absolute = Math.abs(input.offsetMinutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  const minutes = String(absolute % 60).padStart(2, '0')
  const hourCycle = input.hourCycle ?? 'h23'
  const rest = local.slice(13, input.showSeconds ? 19 : 16)
  const hour = Number(local.slice(11, 13))
  const timeParts = hourCycle === 'h23'
    ? arrange(input.locale, `${local.slice(11, 13)}${rest}`)
    : arrange(input.locale, `${hour % 12 || 12}${rest}`, {
        value: input.locale === 'en' ? (hour < 12 ? 'AM' : 'PM') : (hour < 12 ? '上午' : '下午'),
        first: input.locale !== 'en',
      })
  return {
    ok: true as const,
    date: local.slice(0, 10),
    time: timeParts.map(part => part.value).join(''),
    timeParts,
    hourCycle,
    timeZone: undefined,
    offset: `UTC${input.offsetMinutes < 0 ? '-' : '+'}${hours}:${minutes}`,
    datetime: new Date(input.instant).toISOString(),
    reduced: true,
  }
}
