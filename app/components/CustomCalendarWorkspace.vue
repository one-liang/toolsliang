<script setup lang="ts">
import {
  CalendarCheck, ChevronLeft, ChevronRight, Download, HardDrive, Plus, ShieldCheck, Trash2, TriangleAlert, Upload,
} from '@lucide/vue'
import type { ComponentPublicInstance } from 'vue'
import CustomCalendarEntryForm from '@/components/CustomCalendarEntryForm.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { localAssetErrorMessage } from '@/features/shell/local-assets/content'
import { formatStoredSize } from '@/features/shell/local-assets/usage'
import {
  customCalendarFileErrorMessage,
  customCalendarStateMessage,
  customCalendarStatus,
  customEntryMarkLabels,
  describeEntry,
  describeEntryDates,
  getCustomCalendarCaveats,
  getCustomCalendarCopy,
} from '@/features/tools/custom-calendar/content'
import {
  applyCustomEntries,
  entriesInRange,
  type CustomCalendarDay,
  type CustomCalendarEntry,
  type CustomCalendarEntryDraft,
  type CustomEntryIssue,
} from '@/features/tools/custom-calendar/domain/entries'
import {
  describeCivilDate,
  describeDayMark,
  describeLunarDate,
  describeLunarDayMark,
  describeOfficialDay,
  describeSolarTerm,
  describeYearOption,
  getTaiwanCalendarCopy,
  taiwanCalendarViewErrorMessage,
  weekdayFullNames,
  weekdayNames,
} from '@/features/tools/taiwan-calendar/content'
import type { CalendarYear } from '@/features/tools/taiwan-calendar/domain/calendar'
import { taiwanCalendarContentReview } from '@/features/tools/taiwan-calendar/domain/sources'
import {
  availableYears,
  clampToPublishedYear,
  loadCalendarYear,
  type YearRefusal,
} from '@/features/tools/taiwan-calendar/domain/years'

/**
 * The custom calendar draws two layers and never confuses them. The office
 * calendar comes from the Taiwan calendar's baked year modules and is read-only
 * here; the visitor's own entries come from this device's browser database and
 * are the only thing this workspace writes. Every day says what each layer
 * claims, so an override can be seen for what it is: a note this person made,
 * not an announcement.
 *
 * Nothing about the visit leaves the tab. The year is component state rather
 * than a URL, the year modules are static assets of this build, and an entry is
 * only ever written to the device or to a file the visitor asked to download.
 */

/** Prerendering has no device clock, so the reviewed year is what a first paint shows. */
const REVIEWED_YEAR = clampToPublishedYear(Number(taiwanCalendarContentReview.reviewedAt.slice(0, 4)))

const { locale } = useAppLocale()
const {
  entries, record, usage, documentStatus, rawDocument, error, fileError, busy, ready,
  saveEntry, removeEntry, clearAll, exportFile, exportRaw, importFile,
} = useCustomCalendar()

const text = computed(() => getCustomCalendarCopy(locale.value))
const officialText = computed(() => getTaiwanCalendarCopy(locale.value))
const status = computed(() => customCalendarStatus(locale.value))
const caveats = computed(() => getCustomCalendarCaveats(locale.value))

const year = ref(REVIEWED_YEAR)
const month = ref(1)
const calendar = shallowRef<CalendarYear>()
const refusal = ref<YearRefusal>()
const loading = ref(false)
/** Resolved on the client only: the page is prerendered, the device clock is not. */
const today = ref('')
const selectedDate = ref('')
const focusedDate = ref('')

const editing = ref<'closed' | 'new' | string>('closed')
const issues = ref<CustomEntryIssue[]>([])
const announcement = ref('')
const pendingDelete = ref<string | null>(null)
const pendingClear = ref(false)
const statusRegion = ref<HTMLElement | null>(null)
const region = ref<ComponentPublicInstance | null>(null)

/** Scoped to this workspace, so one instance never moves focus inside another. */
function withinWorkspace() {
  const root = region.value?.$el
  return root instanceof HTMLElement ? root : document
}

let pending: AbortController | undefined
/** A day the grid should focus once it renders, which can be after a year loads. */
let focusRequest = ''

const monthStart = computed(() => `${year.value}-${pad(month.value)}-01`)
const monthEnd = computed(() => `${year.value}-${pad(month.value)}-${pad(daysInMonth(year.value, month.value))}`)
const officialDays = computed(() => calendar.value?.days.filter(day => day.month === month.value) ?? [])
const days = computed(() => applyCustomEntries(officialDays.value, entries.value))
const weeks = computed<Array<Array<CustomCalendarDay | null>>>(() => {
  const cells = days.value
  if (!cells.length) return []

  const leading = cells[0]!.day.isoWeekday % 7
  const padded: Array<CustomCalendarDay | null> = [...Array.from({ length: leading }, () => null), ...cells]
  while (padded.length % 7) padded.push(null)

  return Array.from({ length: padded.length / 7 }, (_, week) => padded.slice(week * 7, week * 7 + 7))
})
const selectedDay = computed(() => days.value.find(day => day.day.date === selectedDate.value))
const monthEntries = computed(() => entriesInRange(entries.value, monthStart.value, monthEnd.value))
const editingEntry = computed(() => entries.value.find(entry => entry.id === editing.value))
const failure = computed(() => error.value ? localAssetErrorMessage(error.value, locale.value) : null)
const fileFailure = computed(() => fileError.value ? customCalendarFileErrorMessage(fileError.value, locale.value) : null)
const documentFailure = computed(() => documentStatus.value === 'ready'
  ? null
  : customCalendarStateMessage(documentStatus.value, locale.value))
const savedSize = computed(() => record.value ? formatStoredSize(record.value.bytes, locale.value) : '')
const savedAt = computed(() => record.value
  ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en' : 'zh-TW', { dateStyle: 'medium', timeStyle: 'short' })
      .format(new Date(record.value.updatedAt))
  : '')
const monthLabel = computed(() => locale.value === 'en'
  ? `${new Date(Date.UTC(year.value, month.value - 1, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' })} ${year.value}`
  : `${year.value} 年 ${month.value} 月`)
/** What the workspace is doing, so a test and an end-to-end run wait on the same signal. */
const state = computed(() => loading.value || !ready.value ? 'loading' : calendar.value ? 'ready' : 'unavailable')
const canGoBack = computed(() => monthExists(year.value, month.value, -1))
const canGoForward = computed(() => monthExists(year.value, month.value, 1))
const refusalMessage = computed(() => refusal.value
  ? taiwanCalendarViewErrorMessage(refusal.value.code, refusal.value.year, locale.value)
  : '')

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
  if (controller.signal.aborted || !load.ok && 'cancelled' in load) return

  loading.value = false
  if (load.ok) {
    calendar.value = load.calendar
    refusal.value = undefined
    return
  }

  calendar.value = undefined
  refusal.value = load.refusal
}

function showYear(next: number) {
  if (next === year.value) return

  year.value = next
  month.value = 1
  closeForm()
  selectedDate.value = ''
  focusedDate.value = ''
}

function showToday() {
  if (!today.value) return

  const target = clampToPublishedYear(Number(today.value.slice(0, 4)))
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
  closeForm()
  focusedDate.value = ''
}

function monthExists(fromYear: number, fromMonth: number, step: number) {
  const next = fromMonth + step
  if (next >= 1 && next <= 12) return true

  return availableYears.includes(fromYear + step)
}

function selectDay(day: CustomCalendarDay) {
  selectDate(day.day.date)
}

/** Opening an entry from the month list moves the grid to the day it starts on. */
function selectDate(date: string) {
  const targetYear = Number(date.slice(0, 4))
  if (!availableYears.includes(targetYear)) return

  if (targetYear !== year.value) year.value = targetYear
  month.value = Number(date.slice(5, 7))
  selectedDate.value = date
  focusedDate.value = date
  closeForm()
}

/**
 * One day holds the tab stop and the arrow keys move it, so Tab always leaves
 * the grid instead of walking through a month one day at a time.
 */
function moveFocus(from: CustomCalendarDay, key: string) {
  const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
  const step = steps[key]
  if (step === undefined) return

  const target = shiftDate(from.day.date, step)
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

  const cell = withinWorkspace().querySelector<HTMLButtonElement>(`.calendar-day[data-date="${focusRequest}"]`)
  if (!cell) return

  focusRequest = ''
  cell.focus()
}

/** The one day the grid keeps in the tab order: the focused day, else the first. */
function isTabStop(day: CustomCalendarDay) {
  return day.day.date === (focusedDate.value || days.value[0]?.day.date)
}

function openNew() {
  if (!selectedDate.value) return

  issues.value = []
  editing.value = 'new'
  focusField('#custom-entry-title')
}

function openEdit(entry: CustomCalendarEntry) {
  issues.value = []
  pendingDelete.value = null
  editing.value = entry.id
  focusField('#custom-entry-title')
}

function closeForm() {
  editing.value = 'closed'
  issues.value = []
}

async function focusField(selector: string) {
  await nextTick()
  withinWorkspace().querySelector<HTMLElement>(selector)?.focus()
}

/** A destructive control asks first, and the answer is where the keyboard lands. */
async function askDelete(id: string) {
  pendingClear.value = false
  pendingDelete.value = id
  await focusField('[data-entry-action="confirm-delete"]')
}

async function askClear() {
  pendingDelete.value = null
  pendingClear.value = true
  await focusField('[data-calendar-action="confirm-clear"]')
}

function cancelPending() {
  pendingDelete.value = null
  pendingClear.value = false
}

/** After a row disappears the focus has nowhere to return to, so it moves to what changed. */
async function announce(message: string) {
  announcement.value = message
  await nextTick()
  statusRegion.value?.focus()
}

async function submitEntry(draft: CustomCalendarEntryDraft) {
  const id = editing.value === 'new' ? undefined : editing.value
  const outcome = await saveEntry(draft, id === 'closed' ? undefined : id)
  issues.value = outcome.ok ? [] : outcome.issues
  if (!outcome.ok) return

  closeForm()
  selectedDate.value = outcome.entry.startDate
  await announce(id ? status.value.updated(outcome.entry.title) : status.value.saved(outcome.entry.title))
}

async function confirmDelete(entry: CustomCalendarEntry) {
  pendingDelete.value = null
  if (await removeEntry(entry.id)) await announce(status.value.deleted(entry.title))
}

async function confirmClear() {
  pendingClear.value = false
  if (await clearAll()) await announce(status.value.cleared)
}

function runExport() {
  const fileName = exportFile()
  if (fileName) void announce(status.value.exported(fileName))
}

async function runImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const outcome = await importFile(file)
  // The same file can be chosen again after a failure only if the input is cleared.
  input.value = ''
  if (outcome) await announce(status.value.imported(outcome.added, outcome.replaced))
}

/** The short line under a day number: the solar term when there is one, else the lunar day. */
function dayFootnote(day: CustomCalendarDay) {
  return day.day.solarTerm ? day.day.solarTerm.name : describeLunarDayMark(day.day.lunar, locale.value)
}

function dayLabel(day: CustomCalendarDay) {
  const custom = day.entries.map(entry => entry.title)
  const parts = [
    describeCivilDate(day.day.date, day.day.rocYear, locale.value),
    weekdayFullNames[locale.value][day.day.isoWeekday % 7]!,
    describeOfficialDay(day.day.official, locale.value),
    day.override ? `${text.value.customLayerLabel}：${customEntryMarkLabels[day.override][locale.value]}` : '',
    day.changed ? text.value.changedLabel : '',
    custom.join(locale.value === 'en' ? ', ' : '、'),
    day.day.date === today.value ? officialText.value.todayBadge : '',
  ]

  return parts.filter(Boolean).join(locale.value === 'en' ? ', ' : '，')
}

function daysInMonth(fromYear: number, fromMonth: number) {
  return new Date(Date.UTC(fromYear, fromMonth, 0)).getUTCDate()
}

function shiftDate(date: string, days_: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days_ * 86_400_000).toISOString().slice(0, 10)
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}
</script>

<template>
  <Card
    ref="region"
    class="tool-workspace custom-calendar-workspace"
    :data-calendar-state="state"
    :data-document-state="documentStatus"
    :aria-busy="busy ? 'true' : 'false'"
  >
    <p class="custom-calendar-boundary">
      <ShieldCheck :size="18" aria-hidden="true" />
      <span>{{ text.boundaryNote }}</span>
    </p>

    <div v-if="documentFailure" class="custom-calendar-error" role="alert">
      <TriangleAlert :size="18" aria-hidden="true" />
      <div>
        <p class="custom-calendar-error__title">{{ documentFailure.title }}</p>
        <p>{{ documentFailure.recovery }}</p>
        <div class="custom-calendar-error__actions">
          <Button v-if="rawDocument" variant="outline" data-calendar-action="download-raw" @click="exportRaw()">
            <Download :size="17" aria-hidden="true" />
            {{ text.downloadRaw }}
          </Button>
          <Button v-if="documentStatus === 'corrupt'" variant="destructive" data-calendar-action="rebuild" @click="askClear">
            <Trash2 :size="17" aria-hidden="true" />
            {{ text.rebuildAction }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="failure" class="custom-calendar-error" role="alert">
      <TriangleAlert :size="18" aria-hidden="true" />
      <div>
        <p class="custom-calendar-error__title">{{ failure.title }}</p>
        <p>{{ failure.recovery }}</p>
      </div>
    </div>

    <div v-if="fileFailure" class="custom-calendar-error" role="alert">
      <TriangleAlert :size="18" aria-hidden="true" />
      <div>
        <p class="custom-calendar-error__title">{{ fileFailure.title }}</p>
        <p>{{ fileFailure.recovery }}</p>
      </div>
    </div>

    <div class="calendar-toolbar">
      <div class="calendar-toolbar__year">
        <label for="custom-calendar-year">{{ officialText.yearLabel }}</label>
        <select
          id="custom-calendar-year"
          class="ui-input calendar-year"
          :value="year"
          @change="showYear(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in availableYears" :key="option" :value="option">
            {{ describeYearOption(option, locale) }}
          </option>
        </select>
      </div>

      <div class="calendar-toolbar__months">
        <Button
          variant="outline"
          class="calendar-prev-month"
          :disabled="!canGoBack"
          :aria-label="officialText.previousMonth"
          @click="stepMonth(-1)"
        >
          <ChevronLeft :size="18" aria-hidden="true" />
        </Button>
        <p class="calendar-month-label" aria-live="polite">{{ monthLabel }}</p>
        <Button
          variant="outline"
          class="calendar-next-month"
          :disabled="!canGoForward"
          :aria-label="officialText.nextMonth"
          @click="stepMonth(1)"
        >
          <ChevronRight :size="18" aria-hidden="true" />
        </Button>
      </div>

      <Button v-if="today" class="calendar-today" @click="showToday">
        <CalendarCheck :size="18" aria-hidden="true" />
        {{ officialText.todayLabel }}
      </Button>
    </div>

    <p class="calendar-status" role="status">
      <span v-if="loading">{{ officialText.loadingLabel }}</span>
      <span v-else-if="refusalMessage" class="calendar-refusal">{{ refusalMessage }}</span>
    </p>

    <div v-if="calendar" class="calendar-body">
      <table class="calendar-grid" :data-month="month">
        <caption>
          {{ monthLabel }}・{{ officialText.gridLabel }}
          <span class="calendar-grid__hint">{{ officialText.gridHint }}</span>
        </caption>
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
                  'calendar-day--today': day.day.date === today,
                  'calendar-day--selected': day.day.date === selectedDate,
                }"
                :data-date="day.day.date"
                :data-kind="day.day.official.kind"
                :data-custom="day.override ?? (day.entries.length ? 'note' : undefined)"
                :data-changed="day.changed ? 'true' : undefined"
                :tabindex="isTabStop(day) ? 0 : -1"
                :aria-label="dayLabel(day)"
                :aria-pressed="day.day.date === selectedDate"
                :aria-current="day.day.date === today ? 'date' : undefined"
                @click="selectDay(day)"
                @keydown.left.right.up.down.prevent="moveFocus(day, ($event as KeyboardEvent).key)"
              >
                <span class="calendar-day__number">{{ day.day.dayOfMonth }}</span>
                <span class="calendar-day__lunar">{{ dayFootnote(day) }}</span>
                <span v-if="describeDayMark(day.day.official, locale)" class="calendar-day__mark">
                  {{ describeDayMark(day.day.official, locale) }}
                </span>
                <span v-if="day.override" class="calendar-day__custom">
                  {{ customEntryMarkLabels[day.override][locale] }}
                </span>
                <span v-for="entry in day.entries" :key="entry.id" class="calendar-day__entry">{{ entry.title }}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="calendar-side">
        <section class="custom-calendar-day" :aria-label="text.dayPanelLabel">
          <h2 class="calendar-detail__title">{{ text.dayPanelLabel }}</h2>
          <p v-if="!selectedDay" class="calendar-detail__empty">{{ text.daySelectPrompt }}</p>
          <template v-else>
            <dl class="custom-calendar-layers">
              <div>
                <dt>{{ text.officialLayerLabel }}</dt>
                <dd class="custom-calendar-layers__official">
                  {{ describeCivilDate(selectedDay.day.date, selectedDay.day.rocYear, locale) }}・
                  {{ weekdayFullNames[locale][selectedDay.day.isoWeekday % 7] }}・
                  {{ describeOfficialDay(selectedDay.day.official, locale) }}
                  <span class="custom-calendar-layers__lunar">
                    {{ describeLunarDate(selectedDay.day.lunar, locale) }}
                    <template v-if="selectedDay.day.solarTerm">・{{ describeSolarTerm(selectedDay.day.solarTerm, locale) }}</template>
                  </span>
                </dd>
              </div>
              <div>
                <dt>{{ text.customLayerLabel }}</dt>
                <dd class="custom-calendar-layers__custom">
                  <template v-if="selectedDay.override">{{ customEntryMarkLabels[selectedDay.override][locale] }}</template>
                  <template v-else>{{ text.dayEntriesEmpty }}</template>
                  <span v-if="selectedDay.changed" class="custom-calendar-changed">{{ text.changedLabel }}</span>
                  <span v-if="selectedDay.conflict" class="custom-calendar-conflict">{{ text.conflictLabel }}</span>
                </dd>
              </div>
            </dl>

            <h3 class="custom-calendar-day__title">{{ text.dayEntriesLabel }}</h3>
            <ul v-if="selectedDay.entries.length" class="custom-calendar-entries">
              <li
                v-for="entry in selectedDay.entries"
                :key="entry.id"
                class="custom-calendar-entry"
                :data-entry-id="entry.id"
                :data-entry-mark="entry.mark"
              >
                <p class="custom-calendar-entry__title">{{ entry.title }}</p>
                <p class="custom-calendar-entry__meta">
                  {{ customEntryMarkLabels[entry.mark][locale] }}・{{ describeEntryDates(entry, locale) }}
                </p>
                <p v-if="entry.note" class="custom-calendar-entry__note">{{ entry.note }}</p>
                <div class="custom-calendar-entry__actions">
                  <Button
                    variant="outline"
                    data-entry-action="edit"
                    :aria-label="`${text.editEntry}：${describeEntry(entry, locale)}`"
                    @click="openEdit(entry)"
                  >{{ text.editEntry }}</Button>
                  <Button
                    variant="outline"
                    data-entry-action="delete"
                    :aria-label="`${text.deleteEntry}：${describeEntry(entry, locale)}`"
                    @click="askDelete(entry.id)"
                  >{{ text.deleteEntry }}</Button>
                </div>
                <div v-if="pendingDelete === entry.id" class="custom-calendar-entry__confirm">
                  <p>{{ text.deleteEntryPrompt }}</p>
                  <Button variant="destructive" data-entry-action="confirm-delete" @click="confirmDelete(entry)">
                    {{ text.deleteConfirm }}
                  </Button>
                  <Button variant="outline" data-entry-action="cancel-delete" @click="cancelPending">
                    {{ text.deleteCancel }}
                  </Button>
                </div>
              </li>
            </ul>
            <p v-else class="calendar-detail__empty">{{ text.dayEntriesEmpty }}</p>

            <Button
              v-if="editing === 'closed' && documentStatus === 'ready'"
              data-entry-action="add"
              @click="openNew"
            >
              <Plus :size="17" aria-hidden="true" />
              {{ text.addEntry }}
            </Button>

            <CustomCalendarEntryForm
              v-else
              :locale="locale"
              :date="selectedDate"
              :entry="editingEntry"
              :issues="issues"
              :busy="busy"
              @submit="submitEntry"
              @cancel="closeForm"
            />
          </template>
        </section>

        <section class="custom-calendar-agenda-panel" :aria-label="text.monthEntriesLabel">
          <h2 class="calendar-detail__title">{{ text.monthEntriesLabel }}</h2>
          <p v-if="!monthEntries.length" class="calendar-detail__empty">{{ text.monthEntriesEmpty }}</p>
          <ul v-else class="custom-calendar-agenda">
            <li v-for="entry in monthEntries" :key="entry.id" class="custom-calendar-agenda__item" :data-entry-id="entry.id">
              <button type="button" class="custom-calendar-agenda__button" @click="selectDate(entry.startDate)">
                <span class="custom-calendar-agenda__date">{{ describeEntryDates(entry, locale) }}</span>
                <span class="custom-calendar-agenda__text">
                  {{ entry.title }}・{{ customEntryMarkLabels[entry.mark][locale] }}
                </span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <p ref="statusRegion" class="custom-calendar-status" role="status" tabindex="-1">{{ announcement }}</p>

    <section class="custom-calendar-storage" :aria-label="text.storageTitle">
      <h2 class="calendar-detail__title">{{ text.storageTitle }}</h2>
      <p class="custom-calendar-storage__total">
        <HardDrive :size="18" aria-hidden="true" />
        <span v-if="record">
          {{ status.entriesSummary(entries.length) }}・{{ text.sizeLabel }} {{ savedSize }}・{{ text.updatedLabel }} {{ savedAt }}
        </span>
        <span v-else-if="ready">{{ text.storageEmpty }}</span>
      </p>
      <p v-if="usage.quotaBytes === null || usage.deviceUsedBytes === null" class="field-help">{{ text.storageNoEstimate }}</p>
      <p v-else class="field-help">
        {{ formatStoredSize(usage.deviceUsedBytes, locale) }} / {{ formatStoredSize(usage.quotaBytes, locale) }}
      </p>

      <div class="custom-calendar-storage__actions">
        <div v-if="entries.length" class="custom-calendar-storage__action">
          <Button variant="outline" data-calendar-action="export" @click="runExport">
            <Download :size="17" aria-hidden="true" />
            {{ text.exportAction }}
          </Button>
          <p class="field-help">{{ text.exportHint }}</p>
        </div>
        <div class="custom-calendar-storage__action custom-calendar-storage__import">
          <label for="custom-calendar-import">
            <Upload :size="17" aria-hidden="true" />
            {{ text.importAction }}
          </label>
          <input
            id="custom-calendar-import"
            type="file"
            accept="application/json,.json"
            :disabled="documentStatus !== 'ready'"
            @change="runImport"
          >
          <p class="field-help">{{ text.importHint }}</p>
        </div>
        <div v-if="record" class="custom-calendar-storage__action">
          <Button variant="destructive" data-calendar-action="clear" @click="askClear">
            <Trash2 :size="17" aria-hidden="true" />
            {{ text.clearAction }}
          </Button>
        </div>
      </div>

      <div v-if="pendingClear" class="custom-calendar-confirm">
        <p>{{ documentStatus === 'ready' ? text.clearPrompt : text.rebuildPrompt }}</p>
        <div class="custom-calendar-confirm__actions">
          <Button variant="destructive" data-calendar-action="confirm-clear" @click="confirmClear">
            {{ documentStatus === 'ready' ? text.clearConfirm : text.rebuildConfirm }}
          </Button>
          <Button variant="outline" data-calendar-action="cancel-clear" @click="cancelPending">{{ text.deleteCancel }}</Button>
        </div>
      </div>
    </section>

    <section class="custom-calendar-caveats" :aria-label="text.caveatsTitle">
      <h2 class="calendar-detail__title">{{ text.caveatsTitle }}</h2>
      <ul>
        <li v-for="caveat in caveats" :key="caveat.key">{{ caveat.text }}</li>
      </ul>
    </section>
  </Card>
</template>
