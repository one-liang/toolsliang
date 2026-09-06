<script setup lang="ts">
import { CalendarCheck, ChevronLeft, ChevronRight } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  describeCivilDate,
  describeDayMark,
  describeLunarDate,
  describeLunarDayMark,
  describeOfficialDay,
  describeSolarTerm,
  getTaiwanCalendarCaveats,
  getTaiwanCalendarCopy,
  officialDayKindLabels,
  taiwanCalendarViewErrorMessage,
  weekdayFullNames,
  weekdayNames,
} from '@/features/tools/taiwan-calendar/content'
import {
  addDays,
  citedEditions,
  findDay,
  getMonthGrid,
  type CalendarDay,
  type CalendarYear,
} from '@/features/tools/taiwan-calendar/domain/calendar'
import { officialDayKinds } from '@/features/tools/taiwan-calendar/domain/reference'
import {
  taiwanCalendarContentReview,
  taiwanCalendarCoverage,
  taiwanCalendarDatasets,
  taiwanCalendarPublishableYears,
  taiwanCalendarReferenceVersion,
} from '@/features/tools/taiwan-calendar/domain/sources'
import {
  availableYears,
  loadCalendarYear,
  type YearRefusal,
} from '@/features/tools/taiwan-calendar/domain/years'

/**
 * The calendar reads a baked year and shows it. It decides nothing about dates:
 * every kind, lunar date and solar term on screen came out of the year module,
 * and a year the module cannot supply is refused in the reviewed words rather
 * than drawn as an empty grid.
 *
 * Nothing about the visit leaves the tab. The year is component state, never a
 * URL, and the year modules are static assets of this build, so opening a year
 * makes no request that could say which year someone is looking at.
 */

/** Prerendering has no device clock, so the reviewed year is what a first paint shows. */
const REVIEWED_YEAR = clampYear(Number(taiwanCalendarContentReview.reviewedAt.slice(0, 4)))
/** One year past the office calendar exists only to answer "what about next year?". */
const selectableYears = [
  ...availableYears,
  ...taiwanCalendarPublishableYears.lastYear < taiwanCalendarCoverage.astronomical.lastYear
    ? [taiwanCalendarPublishableYears.lastYear + 1]
    : [],
]

const { locale } = useAppLocale()
const text = computed(() => getTaiwanCalendarCopy(locale.value))
const year = ref(REVIEWED_YEAR)
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

const weeks = computed(() => calendar.value ? getMonthGrid(calendar.value, month.value) : [])
const monthDays = computed(() => weeks.value.flat().filter((day): day is CalendarDay => Boolean(day)))
const selectedDay = computed(() => calendar.value && selectedDate.value
  ? findDay(calendar.value, selectedDate.value)
  : undefined)
/** The agenda is the same month read as a list: holidays, adjusted days and terms. */
const markedDays = computed(() => monthDays.value.filter(day =>
  day.solarTerm || (day.official.kind !== 'workday' && day.official.kind !== 'weekend')))
const revised = computed(() => Object.values(calendar.value?.layers ?? {}).some(layer => layer.status === 'revised'))
const caveats = computed(() => getTaiwanCalendarCaveats(locale.value, { revised: revised.value }))
const editions = computed(() => calendar.value ? citedEditions(calendar.value.layers) : [])
const legend = computed(() => officialDayKinds.map(kind => ({ kind, label: officialDayKindLabels[kind][locale.value] })))
const refusalMessage = computed(() => refusal.value
  ? taiwanCalendarViewErrorMessage(refusal.value.code, refusal.value.year, locale.value)
  : '')
const monthLabel = computed(() => locale.value === 'en'
  ? `${new Date(Date.UTC(year.value, month.value - 1, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' })} ${year.value}`
  : `${year.value} 年 ${month.value} 月`)
const gridCaption = computed(() => `${monthLabel.value}・${text.value.gridLabel}`)
/** What the workspace is doing, so a test and an end-to-end run wait on the same signal. */
const state = computed(() => loading.value ? 'loading' : calendar.value ? 'ready' : 'unavailable')
const canGoBack = computed(() => monthExists(year.value, month.value, -1))
const canGoForward = computed(() => monthExists(year.value, month.value, 1))

onMounted(() => {
  const now = new Date()
  today.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  showToday()
})

onBeforeUnmount(() => pending?.abort())

watch(year, loadYear, { immediate: true })
watch(weeks, () => nextTick(applyFocusRequest), { flush: 'post' })

/**
 * Only one year is ever in flight: switching year abandons the previous load so
 * a slow module cannot paint over the year that is on screen now.
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
    if (!findDay(load.calendar, focusedDate.value)) focusedDate.value = `${year.value}-${pad(month.value)}-01`
    return
  }

  calendar.value = undefined
  refusal.value = load.refusal
}

function showYear(next: number) {
  if (next === year.value) return
  year.value = next
  month.value = 1
  selectedDate.value = ''
  focusedDate.value = ''
}

function showToday() {
  if (!today.value) return

  const target = clampYear(Number(today.value.slice(0, 4)))
  if (String(target) !== today.value.slice(0, 4)) return

  year.value = target
  month.value = Number(today.value.slice(5, 7))
  selectedDate.value = today.value
  focusedDate.value = today.value
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
}

function monthExists(fromYear: number, fromMonth: number, step: number) {
  const next = fromMonth + step
  if (next >= 1 && next <= 12) return true

  return availableYears.includes(fromYear + step)
}

function selectDay(day: CalendarDay) {
  selectedDate.value = day.date
  focusedDate.value = day.date
}

/**
 * One day holds the tab stop and the arrow keys move it, so Tab always leaves
 * the grid instead of walking through a month one day at a time.
 */
function moveFocus(from: CalendarDay, key: string) {
  const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
  const step = steps[key]
  if (step === undefined) return

  const target = addDays(from.date, step)
  const targetYear = Number(target.slice(0, 4))
  if (!availableYears.includes(targetYear)) return

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

  const cell = document.querySelector<HTMLButtonElement>(`.calendar-day[data-date="${focusRequest}"]`)
  if (!cell) return

  focusRequest = ''
  cell.focus()
}

/** The one day the grid keeps in the tab order: the focused day, else the first. */
function isTabStop(day: CalendarDay) {
  return day.date === (focusedDate.value || monthDays.value[0]?.date)
}

function dayLabel(day: CalendarDay) {
  const parts = [
    describeCivilDate(day.date, day.rocYear, locale.value),
    weekdayFullNames[locale.value][day.isoWeekday % 7]!,
    describeLunarDate(day.lunar, locale.value),
    day.solarTerm ? describeSolarTerm(day.solarTerm, locale.value) : '',
    describeOfficialDay(day.official, locale.value),
    day.date === today.value ? text.value.todayBadge : '',
  ]

  return parts.filter(Boolean).join(locale.value === 'en' ? ', ' : '，')
}

/**
 * The short line under a day number. A solar term takes the space when there is
 * one: it is the rarer fact, and the lunar date is one row away in the detail.
 */
function dayFootnote(day: CalendarDay) {
  return day.solarTerm ? day.solarTerm.name : describeLunarDayMark(day.lunar, locale.value)
}

function dayMark(day: CalendarDay) {
  return describeDayMark(day.official, locale.value)
}

function clampYear(value: number) {
  const { firstYear, lastYear } = taiwanCalendarPublishableYears
  return Math.min(Math.max(value, firstYear), lastYear)
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}
</script>

<template>
  <Card class="tool-workspace calendar-workspace" :data-calendar-state="state">
    <div class="calendar-toolbar">
      <div class="calendar-toolbar__year">
        <label for="calendar-year">{{ text.yearLabel }}</label>
        <!-- The native control keeps its own height in some engines, so the
             appearance is replaced to guarantee a 44px touch target. The chevron
             is painted by the stylesheet rather than overlaid as an element,
             which would obscure part of that target. -->
        <select
          id="calendar-year"
          class="ui-input calendar-year"
          :value="year"
          aria-describedby="calendar-year-help"
          @change="showYear(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in selectableYears" :key="option" :value="option">
            {{ locale === 'en' ? option : `${option}（民國 ${option - 1911} 年）` }}
          </option>
        </select>
      </div>

      <div class="calendar-toolbar__months">
        <Button
          variant="outline"
          class="calendar-prev-month"
          :disabled="!canGoBack"
          :aria-label="text.previousMonth"
          @click="stepMonth(-1)"
        >
          <ChevronLeft :size="18" aria-hidden="true" />
        </Button>
        <p class="calendar-month-label" aria-live="polite">{{ monthLabel }}</p>
        <Button
          variant="outline"
          class="calendar-next-month"
          :disabled="!canGoForward"
          :aria-label="text.nextMonth"
          @click="stepMonth(1)"
        >
          <ChevronRight :size="18" aria-hidden="true" />
        </Button>
      </div>

      <Button v-if="today" class="calendar-today" @click="showToday">
        <CalendarCheck :size="18" aria-hidden="true" />
        {{ text.todayLabel }}
      </Button>
    </div>
    <p id="calendar-year-help" class="field-help calendar-year-help">{{ text.yearHint }}</p>

    <p class="calendar-status" role="status">
      <span v-if="loading">{{ text.loadingLabel }}</span>
      <span v-else-if="refusalMessage" class="calendar-refusal">{{ refusalMessage }}</span>
    </p>

    <div v-if="calendar" class="calendar-body">
      <table class="calendar-grid" :data-month="month">
        <caption>{{ gridCaption }}<span class="calendar-grid__hint">{{ text.gridHint }}</span></caption>
        <thead>
          <tr>
            <th v-for="(name, index) in weekdayNames[locale]" :key="name" scope="col">
              <abbr :title="weekdayFullNames[locale][index]">{{ name }}</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(week, index) in weeks" :key="index">
            <td v-for="(day, position) in week" :key="position">
              <button
                v-if="day"
                type="button"
                class="calendar-day"
                :class="{
                  'calendar-day--today': day.date === today,
                  'calendar-day--selected': day.date === selectedDate,
                }"
                :data-date="day.date"
                :data-kind="day.official.kind"
                :tabindex="isTabStop(day) ? 0 : -1"
                :aria-label="dayLabel(day)"
                :aria-pressed="day.date === selectedDate"
                :aria-current="day.date === today ? 'date' : undefined"
                @click="selectDay(day)"
                @keydown.left.right.up.down.prevent="moveFocus(day, ($event as KeyboardEvent).key)"
              >
                <span class="calendar-day__number">{{ day.dayOfMonth }}</span>
                <span class="calendar-day__lunar">{{ dayFootnote(day) }}</span>
                <span v-if="dayMark(day)" class="calendar-day__mark">{{ dayMark(day) }}</span>
                <span v-if="day.date === today" class="calendar-day__today">{{ text.todayBadge }}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="calendar-side">
        <section class="calendar-detail" :aria-label="text.detailLabel">
          <h2 class="calendar-detail__title">{{ text.detailLabel }}</h2>
          <p v-if="!selectedDay" class="calendar-detail__empty">{{ text.detailEmpty }}</p>
          <dl v-else>
            <div>
              <dt>{{ text.dateLabel }}</dt>
              <dd>{{ describeCivilDate(selectedDay.date, selectedDay.rocYear, locale) }}</dd>
            </div>
            <div>
              <dt>{{ text.weekdayLabel }}</dt>
              <dd>{{ weekdayFullNames[locale][selectedDay.isoWeekday % 7] }}</dd>
            </div>
            <div>
              <dt>{{ text.lunarLabel }}</dt>
              <dd>{{ describeLunarDate(selectedDay.lunar, locale) }}</dd>
            </div>
            <div v-if="selectedDay.solarTerm">
              <dt>{{ text.solarTermLabel }}</dt>
              <dd>{{ describeSolarTerm(selectedDay.solarTerm, locale) }}</dd>
            </div>
            <div>
              <dt>{{ text.officialLabel }}</dt>
              <dd>{{ describeOfficialDay(selectedDay.official, locale) }}</dd>
            </div>
            <div v-if="selectedDay.official.label">
              <dt>{{ text.sourceNoteLabel }}</dt>
              <dd class="calendar-detail__note">{{ selectedDay.official.label }}</dd>
            </div>
          </dl>
        </section>

        <section class="calendar-agenda-panel" :aria-label="text.agendaLabel">
          <h2 class="calendar-detail__title">{{ text.agendaLabel }}</h2>
          <p v-if="!markedDays.length" class="calendar-detail__empty">{{ text.agendaEmpty }}</p>
          <ul v-else class="calendar-agenda">
            <li v-for="day in markedDays" :key="day.date" class="calendar-agenda__item" :data-date="day.date">
              <button type="button" class="calendar-agenda__button" @click="selectDay(day)">
                <span class="calendar-agenda__date">{{ day.month }}/{{ day.dayOfMonth }}</span>
                <span class="calendar-agenda__text">
                  <template v-if="day.solarTerm">{{ describeSolarTerm(day.solarTerm, locale) }}</template>
                  <template v-if="day.solarTerm && dayMark(day)">・</template>
                  <template v-if="dayMark(day)">{{ dayMark(day) }}</template>
                </span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <section v-if="calendar" class="calendar-legend" :aria-label="text.legendLabel">
      <h2 class="calendar-detail__title">{{ text.legendLabel }}</h2>
      <ul>
        <li v-for="item in legend" :key="item.kind" :data-kind="item.kind">
          <span class="calendar-legend__swatch" aria-hidden="true" />
          {{ item.label }}
        </li>
      </ul>
    </section>

    <section class="calendar-caveats" :aria-label="text.caveatsTitle">
      <h2 class="calendar-detail__title">{{ text.caveatsTitle }}</h2>
      <p v-if="revised" class="calendar-revised">{{ text.revisedLabel }}</p>
      <ul>
        <li v-for="caveat in caveats" :key="caveat.key">{{ caveat.text }}</li>
      </ul>
    </section>

    <section v-if="calendar" class="calendar-sources" :aria-label="text.sourcesTitle">
      <h2 class="calendar-detail__title">{{ text.sourcesTitle }}</h2>
      <dl>
        <div v-for="edition in editions" :key="edition.checksum + edition.datasetId">
          <dt>{{ taiwanCalendarDatasets.find(dataset => dataset.id === edition.datasetId)?.publisher[locale] }}</dt>
          <dd>
            <a
              :href="taiwanCalendarDatasets.find(dataset => dataset.id === edition.datasetId)?.url"
              target="_blank"
              rel="noopener noreferrer"
            >{{ taiwanCalendarDatasets.find(dataset => dataset.id === edition.datasetId)?.name[locale] }}</a>
            <span class="calendar-sources__edition">{{ text.dataVersionLabel }}：{{ edition.edition }}</span>
            <span>{{ text.publishedAtLabel }}：<time :datetime="edition.publishedAt">{{ edition.publishedAt }}</time></span>
            <span>{{ text.retrievedAtLabel }}：<time :datetime="edition.retrievedAt">{{ edition.retrievedAt }}</time></span>
            <span>
              {{ text.licenceLabel }}：
              <a
                :href="taiwanCalendarDatasets.find(dataset => dataset.id === edition.datasetId)?.licenceUrl"
                target="_blank"
                rel="noopener noreferrer"
              >{{ taiwanCalendarDatasets.find(dataset => dataset.id === edition.datasetId)?.licence[locale] }}</a>
            </span>
          </dd>
        </div>
      </dl>
      <p class="calendar-sources__contract">{{ text.dataContractLabel }}：{{ taiwanCalendarReferenceVersion }}</p>
    </section>
  </Card>
</template>
