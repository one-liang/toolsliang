import { buildCalendarYear, type CalendarYear } from './calendar'
import type { CalendarYearDataset } from './dataset'
import type { TaiwanCalendarViewErrorCode } from './reference'
import { taiwanCalendarCoverage, taiwanCalendarPublishableYears } from './sources'

/**
 * Which year a visitor may ask for, and how one is brought onto the device.
 *
 * Each year is its own module, so opening a year fetches that year and nothing
 * else, and a year the device has never opened is genuinely absent when it is
 * offline — which is the honest answer, not a blank grid. The request never
 * carries the year anywhere: the module is a static asset of this build, so the
 * year a visitor is reading is not observable from outside their device.
 */

const yearModules = import.meta.glob<{ default: unknown }>('../data/*.json')

export interface YearRefusal {
  code: TaiwanCalendarViewErrorCode
  year: number
}

export type YearRequest =
  | { ok: true, year: number }
  | { ok: false, refusal: YearRefusal }

export const availableYears = Object.keys(yearModules)
  .map(path => Number(path.match(/(\d{4})\.json$/)?.[1]))
  .filter(year => Number.isInteger(year))
  .sort((left, right) => left - right)

/**
 * Every year worth offering: the published ones, plus the next one when the
 * astronomical layer already covers it — that year exists only so a visitor
 * asking "what about next year?" gets the reviewed answer instead of silence.
 */
export const selectableYears = [
  ...availableYears,
  ...taiwanCalendarPublishableYears.lastYear < taiwanCalendarCoverage.astronomical.lastYear
    ? [taiwanCalendarPublishableYears.lastYear + 1]
    : [],
]

/** The nearest published year, for a starting point that has to be one. */
export function clampToPublishedYear(year: number) {
  const { firstYear, lastYear } = taiwanCalendarPublishableYears
  return Math.min(Math.max(year, firstYear), lastYear)
}

/**
 * The section 5.6 order: format before range, range before announcement. A year
 * the astronomical layer already covers but the authority has not decided is
 * unannounced rather than out of range — going online will not reveal it.
 */
export function resolveYearRequest(year: number): YearRequest {
  if (!Number.isInteger(year)) return { ok: false, refusal: { code: 'invalid-year', year } }

  const { firstYear, lastYear } = taiwanCalendarPublishableYears
  if (year >= firstYear && year <= lastYear) return { ok: true, year }

  const unannounced = year > taiwanCalendarCoverage.official.lastYear
    && year <= taiwanCalendarCoverage.astronomical.lastYear

  return { ok: false, refusal: { code: unannounced ? 'year-not-announced' : 'year-out-of-range', year } }
}

export type YearLoad =
  | { ok: true, calendar: CalendarYear }
  | { ok: false, refusal: YearRefusal }
  | { ok: false, cancelled: true }

export interface LoadCalendarYearOptions {
  signal?: AbortSignal
  /** Swappable so the offline path can be exercised without a browser. */
  load?: (year: number) => Promise<{ default: unknown }> | undefined
}

function importYear(year: number) {
  return yearModules[`../data/${year}.json`]?.()
}

/**
 * Brings one year onto the device. A failed module load is a year this device
 * has not downloaded — the only reason a static asset of this build can be
 * missing — and an aborted load reports itself so a caller that has already
 * moved to another year does not paint a stale one.
 */
export async function loadCalendarYear(
  year: number,
  { signal, load = importYear }: LoadCalendarYearOptions = {},
): Promise<YearLoad> {
  const request = resolveYearRequest(year)
  if (!request.ok) return request

  const pending = load(year)
  if (!pending) return { ok: false, refusal: { code: 'year-not-announced', year } }

  let dataset: unknown
  try {
    dataset = (await pending).default
  }
  catch {
    return { ok: false, refusal: { code: 'year-not-downloaded', year } }
  }
  if (signal?.aborted) return { ok: false, cancelled: true }

  // The shape of a shipped year is settled where it can be fixed — the ingestion
  // refuses to write a year that fails a check, and a unit test validates every
  // file in the build. Re-litigating it here would only let a visitor be told
  // "you are offline" about a year that was published wrong.
  return { ok: true, calendar: buildCalendarYear(dataset as CalendarYearDataset) }
}
