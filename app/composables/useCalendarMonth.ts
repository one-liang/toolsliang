import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import {
  addDays,
  findDay,
  getMonthDays,
  getMonthGrid,
  type CalendarYear,
} from '@/features/tools/taiwan-calendar/domain/calendar'
import { taiwanCalendarViewErrorMessage } from '@/features/tools/taiwan-calendar/content'
import { taiwanCalendarContentReview } from '@/features/tools/taiwan-calendar/domain/sources'
import {
  availableYears,
  clampToPublishedYear,
  loadCalendarYear,
  type YearRefusal,
} from '@/features/tools/taiwan-calendar/domain/years'
import type { LocaleCode } from '@/features/tools/catalog'

/**
 * One month of the official calendar, and the ways a visitor moves through it.
 * Both calendar tools show the same baked years in the same grid, so the year
 * loading, the month arithmetic and the roving tab stop are decided once here
 * rather than twice in two components that would drift apart.
 *
 * Nothing about the visit leaves the tab: the year is component state rather
 * than a URL, and the year modules are static assets of this build, so opening
 * a month makes no request that could say which one someone is reading.
 */

/** Prerendering has no device clock, so the reviewed year is what a first paint shows. */
export const REVIEWED_CALENDAR_YEAR = clampToPublishedYear(Number(taiwanCalendarContentReview.reviewedAt.slice(0, 4)))

export interface CalendarMonthOptions {
  locale: Ref<LocaleCode>
  /** The years this view may reach; a picker offering more must refuse the rest. */
  years?: number[]
  /** Where day cells are looked up, so one instance never moves focus inside another. */
  scope?: () => ParentNode
  /** The component's own cleanup when the view moves to another day, month or year. */
  onNavigate?: () => void
}

export function useCalendarMonth(options: CalendarMonthOptions) {
  const years = options.years ?? availableYears
  const scope = options.scope ?? (() => document)
  const year = ref(REVIEWED_CALENDAR_YEAR)
  const month = ref(1)
  const calendar = shallowRef<CalendarYear>()
  const refusal = ref<YearRefusal>()
  const loading = ref(false)
  /** Resolved on the client only: the page is prerendered, the device clock is not. */
  const today = ref('')
  const selectedDate = ref('')
  const focusedDate = ref('')

  let pending: AbortController | undefined
  /** A day the grid should focus once it renders, which can be after a year loads. */
  let focusRequest = ''

  const days = computed(() => calendar.value ? getMonthDays(calendar.value, month.value) : [])
  const weeks = computed(() => calendar.value ? getMonthGrid(calendar.value, month.value) : [])
  const selectedDay = computed(() => calendar.value && selectedDate.value
    ? findDay(calendar.value, selectedDate.value)
    : undefined)
  /** What the view is doing, so a test and an end-to-end run wait on the same signal. */
  const state = computed(() => loading.value ? 'loading' : calendar.value ? 'ready' : 'unavailable')
  const canGoBack = computed(() => monthExists(year.value, month.value, -1))
  const canGoForward = computed(() => monthExists(year.value, month.value, 1))
  const monthLabel = computed(() => options.locale.value === 'en'
    ? `${new Date(Date.UTC(year.value, month.value - 1, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' })} ${year.value}`
    : `${year.value} 年 ${month.value} 月`)
  const refusalMessage = computed(() => refusal.value
    ? taiwanCalendarViewErrorMessage(refusal.value.code, refusal.value.year, options.locale.value)
    : '')

  watch(year, loadYear, { immediate: true })
  watch(weeks, () => nextTick(applyFocusRequest), { flush: 'post' })
  onBeforeUnmount(() => pending?.abort())

  /**
   * Only one year is ever in flight: switching year abandons the previous load
   * so a slow module cannot paint over the year that is on screen now.
   */
  async function loadYear() {
    pending?.abort()
    const controller = new AbortController()
    pending = controller
    loading.value = true

    const load = await loadCalendarYear(year.value, { signal: controller.signal })
    // A newer year is already loading; it owns the loading flag and the screen.
    if (controller.signal.aborted || !load.ok && 'cancelled' in load) return

    loading.value = false
    if (load.ok) {
      calendar.value = load.calendar
      refusal.value = undefined
      if (!findDay(load.calendar, focusedDate.value)) focusedDate.value = ''
      return
    }

    calendar.value = undefined
    refusal.value = load.refusal
  }

  /** Reads the device clock once the component is on a device that has one. */
  function readToday() {
    const now = new Date()
    today.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    showToday()
  }

  function showYear(next: number) {
    if (next === year.value) return

    year.value = next
    month.value = 1
    selectedDate.value = ''
    focusedDate.value = ''
    options.onNavigate?.()
  }

  function showToday() {
    if (!today.value) return

    const target = clampToPublishedYear(Number(today.value.slice(0, 4)))
    if (String(target) !== today.value.slice(0, 4)) return

    selectDate(today.value, target)
    requestFocus(today.value)
  }

  function stepMonth(step: number) {
    if (!monthExists(year.value, month.value, step)) return

    const next = month.value + step
    if (next < 1 || next > 12) {
      year.value += step
      month.value = next < 1 ? 12 : 1
    }
    else {
      month.value = next
    }
    focusedDate.value = ''
    options.onNavigate?.()
  }

  function monthExists(fromYear: number, fromMonth: number, step: number) {
    const next = fromMonth + step
    if (next >= 1 && next <= 12) return true

    return years.includes(fromYear + step)
  }

  /** Opens a day, bringing the grid to the month that holds it. */
  function selectDate(date: string, targetYear = Number(date.slice(0, 4))) {
    if (!years.includes(targetYear)) return

    if (targetYear !== year.value) year.value = targetYear
    month.value = Number(date.slice(5, 7))
    selectedDate.value = date
    focusedDate.value = date
    options.onNavigate?.()
  }

  /**
   * One day holds the tab stop and the arrow keys move it, so Tab always leaves
   * the grid instead of walking through a month one day at a time.
   */
  function moveFocus(from: string, key: string) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    const step = steps[key]
    if (step === undefined) return

    const target = addDays(from, step)
    const targetYear = Number(target.slice(0, 4))
    if (!years.includes(targetYear)) return

    focusedDate.value = target
    if (targetYear !== year.value) year.value = targetYear
    month.value = Number(target.slice(5, 7))
    requestFocus(target)
  }

  /**
   * Focus is asked for, not taken: the day may belong to a year that is still
   * loading, so the request waits for the grid that will hold it.
   */
  function requestFocus(date: string) {
    focusRequest = date
    nextTick(applyFocusRequest)
  }

  function applyFocusRequest() {
    if (!focusRequest) return

    const cell = scope().querySelector<HTMLButtonElement>(`.calendar-day[data-date="${focusRequest}"]`)
    if (!cell) return

    focusRequest = ''
    cell.focus()
  }

  /** The one day the grid keeps in the tab order: the focused day, else the first. */
  function isTabStop(date: string) {
    return date === (focusedDate.value || days.value[0]?.date)
  }

  return {
    year,
    month,
    calendar,
    refusal,
    refusalMessage,
    loading,
    today,
    selectedDate,
    selectedDay,
    focusedDate,
    days,
    weeks,
    monthLabel,
    state,
    canGoBack,
    canGoForward,
    readToday,
    showYear,
    showToday,
    stepMonth,
    selectDate,
    moveFocus,
    requestFocus,
    isTabStop,
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}
