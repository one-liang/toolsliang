import type { CalendarLayerEdition } from '../../taiwan-calendar/domain/dataset'
import { availableYears, loadCalendarYear, type LoadCalendarYearOptions } from '../../taiwan-calendar/domain/years'
import { buildOfficeCalendar, type OfficeCalendar } from './count'

/*
 * Kept apart from the counting so only the workspace reaches the year modules:
 * the tool registry is also read while Nuxt loads its configuration, where the
 * bundler's module listing does not exist.
 */

export interface LoadedOfficeCalendar {
  calendar: OfficeCalendar
  /** The office calendar edition of every year this device could load, in year order. */
  editions: Array<{ year: number, edition: CalendarLayerEdition }>
}

/**
 * Brings every covered year onto the device at once. A count crosses years
 * freely, so loading only the year a visitor starts in would leave an offline
 * device to discover a missing year halfway through; each year is a few KB.
 * A year that fails to load stays absent and answers as not downloaded.
 */
export async function loadOfficeCalendar(
  { signal, load }: LoadCalendarYearOptions = {},
): Promise<LoadedOfficeCalendar | { cancelled: true }> {
  const loads = await Promise.all(availableYears.map(year => loadCalendarYear(year, { signal, load })))
  if (signal?.aborted) return { cancelled: true }

  const years = loads.flatMap(result => result.ok ? [result.calendar] : [])
  return {
    calendar: buildOfficeCalendar(years),
    editions: years.map(year => ({ year: year.year, edition: year.layers.official })),
  }
}

