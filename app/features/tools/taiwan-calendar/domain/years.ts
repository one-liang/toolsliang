import { buildCalendarYear, type CalendarYear } from './calendar'
import { isCalendarYearDataset, validateCalendarYearDataset, type CalendarYearDataset } from './dataset'
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

  if (!isCalendarYearDataset(dataset) || dataset.year !== year) {
    // A year that cannot be read is a year this device does not have. Saying so
    // beats rendering a grid with holes where the source had none.
    return { ok: false, refusal: { code: 'year-not-downloaded', year } }
  }

  return { ok: true, calendar: buildCalendarYear(dataset) }
}

/** Reads a dataset that is already in hand, for tests and for prerendering. */
export function readCalendarYear(dataset: unknown): CalendarYear {
  const issues = validateCalendarYearDataset(dataset)
  if (issues.length) throw new Error(`Invalid calendar year dataset:\n${issues.join('\n')}`)

  return buildCalendarYear(dataset as CalendarYearDataset)
}
