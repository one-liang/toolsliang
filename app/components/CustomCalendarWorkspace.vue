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
  weekdayFullNames,
  weekdayNames,
} from '@/features/tools/taiwan-calendar/content'
import { availableYears } from '@/features/tools/taiwan-calendar/domain/years'

/**
 * The custom calendar draws two layers and never confuses them. The office
 * calendar comes from the shared month view and is read-only here; the
 * visitor's own entries come from this device's browser database and are the
 * only thing this workspace writes. Every day says what each layer claims, so
 * an override can be seen for what it is: a note this person made, not an
 * announcement.
 *
 * Nothing about the visit leaves the tab. The year is component state rather
 * than a URL, the year modules are static assets of this build, and an entry is
 * only ever written to the device or to a file the visitor asked to download.
 */

const { locale } = useAppLocale()
const text = computed(() => getCustomCalendarCopy(locale.value))
const officialText = computed(() => getTaiwanCalendarCopy(locale.value))
const status = computed(() => customCalendarStatus(locale.value))
const caveats = computed(() => getCustomCalendarCaveats(locale.value))

const region = ref<ComponentPublicInstance | null>(null)

/** Scoped to this workspace, so one instance never moves focus inside another. */
function withinWorkspace(): ParentNode {
  const root = region.value?.$el
  return root instanceof HTMLElement ? root : document
}

const {
  year, month, calendar, refusalMessage, loading, today, selectedDate, days: officialDays,
  weeks: officialWeeks, monthLabel, state: monthState, canGoBack, canGoForward,
  readToday, showYear, showToday, stepMonth, selectDate, moveFocus, isTabStop,
} = useCalendarMonth({
  locale,
  years: availableYears,
  scope: withinWorkspace,
  onNavigate: () => closeForm(),
})

const {
  entries, record, usage, documentStatus, rawDocument, error, fileError, busy, ready,
  saveEntry, removeEntry, clearAll, exportFile, exportRaw, importFile,
} = useCustomCalendar({ defaultName: () => text.value.assetName })

const editing = ref<'closed' | 'new' | string>('closed')
const issues = ref<CustomEntryIssue[]>([])
const announcement = ref('')
const pendingDelete = ref<string | null>(null)
const pendingClear = ref(false)
const statusRegion = ref<HTMLElement | null>(null)

const monthStart = computed(() => officialDays.value[0]?.date ?? '')
const monthEnd = computed(() => officialDays.value[officialDays.value.length - 1]?.date ?? '')
const days = computed(() => applyCustomEntries(officialDays.value, entries.value))
/** The official grid, with each day carrying whatever this device says about it. */
const weeks = computed<Array<Array<CustomCalendarDay | null>>>(() => {
  const byDate = new Map(days.value.map(day => [day.day.date, day]))
  return officialWeeks.value.map(week => week.map(day => day ? byDate.get(day.date) ?? null : null))
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
/** The device has to be read before the workspace can promise anything about it. */
const state = computed(() => ready.value ? monthState.value : 'loading')

onMounted(readToday)

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
  const editingId = editing.value === 'new' || editing.value === 'closed' ? undefined : editing.value
  const outcome = await saveEntry(draft, editingId)
  issues.value = outcome.ok ? [] : outcome.issues
  if (!outcome.ok) return

  closeForm()
  selectDate(outcome.entry.startDate)
  await announce(editingId ? status.value.updated(outcome.entry.title) : status.value.saved(outcome.entry.title))
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

/**
 * What this device says about a day, in the cell itself. A day carrying only
 * notes still gets a word, so the tinted border is never the only sign that
 * something was saved there.
 */
function customDayMark(day: CustomCalendarDay) {
  if (day.override) return customEntryMarkLabels[day.override][locale.value]

  return day.entries.length ? customEntryMarkLabels.note[locale.value] : ''
}

function dayLabel(day: CustomCalendarDay) {
  const parts = [
    describeCivilDate(day.day.date, day.day.rocYear, locale.value),
    weekdayFullNames[locale.value][day.day.isoWeekday % 7]!,
    describeOfficialDay(day.day.official, locale.value),
    day.entries.length ? `${text.value.customLayerLabel}：${customDayMark(day)}` : '',
    day.changed ? text.value.changedLabel : '',
    day.entries.map(entry => entry.title).join(locale.value === 'en' ? ', ' : '、'),
    day.day.date === today.value ? officialText.value.todayBadge : '',
  ]

  return parts.filter(Boolean).join(locale.value === 'en' ? ', ' : '，')
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
                :tabindex="isTabStop(day.day.date) ? 0 : -1"
                :aria-label="dayLabel(day)"
                :aria-pressed="day.day.date === selectedDate"
                :aria-current="day.day.date === today ? 'date' : undefined"
                @click="selectDate(day.day.date)"
                @keydown.left.right.up.down.prevent="moveFocus(day.day.date, ($event as KeyboardEvent).key)"
              >
                <span class="calendar-day__number">{{ day.day.dayOfMonth }}</span>
                <span class="calendar-day__lunar">{{ dayFootnote(day) }}</span>
                <span v-if="describeDayMark(day.day.official, locale)" class="calendar-day__mark">
                  {{ describeDayMark(day.day.official, locale) }}
                </span>
                <span v-if="customDayMark(day)" class="calendar-day__custom">{{ customDayMark(day) }}</span>
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
        <div
          class="custom-calendar-storage__action custom-calendar-storage__import"
          :class="{ 'custom-calendar-storage__import--disabled': documentStatus !== 'ready' }"
        >
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
