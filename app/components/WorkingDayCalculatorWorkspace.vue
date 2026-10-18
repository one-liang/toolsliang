<script setup lang="ts">
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  describeEditionYears,
  describeRefusal,
  describeSkippedDay,
  describeSpan,
  describeStep,
  describeWeekendDays,
  formatWorkingDayDate,
  getWorkingDayCaveats,
  getWorkingDayCopy,
  workingDayCountErrorMessage,
  workingDayModeLabel,
  workingDayModes,
  type WorkingDayMode,
} from '@/features/tools/working-day-calculator/content'
import {
  countWorkingDays,
  isIsoDate,
  parseWorkingDayCount,
  stepWorkingDays,
  type WorkingDayBreakdown,
} from '@/features/tools/working-day-calculator/domain/count'
import { loadOfficeCalendar, type LoadedOfficeCalendar } from '@/features/tools/working-day-calculator/domain/load'
import { taiwanCalendarDatasets } from '@/features/tools/taiwan-calendar/domain/sources'

const { locale, withLocale } = useAppLocale()
const text = computed(() => getWorkingDayCopy(locale.value))
const en = computed(() => locale.value === 'en')

/**
 * The workspace only mounts on the visitor's device, behind the capability
 * gate, so "today" is their clock and their date, never the build machine's.
 */
function deviceToday() {
  const now = new Date()
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part, index) => String(part).padStart(index ? 2 : 4, '0'))
    .join('-')
}

const mode = ref<WorkingDayMode>('forward')
/** Shared by every mode, so switching keeps the date the visitor already picked. */
const start = ref(deviceToday())
const end = ref('')
const count = ref('')

const loaded = shallowRef<LoadedOfficeCalendar>()
const controller = new AbortController()
onMounted(async () => {
  const result = await loadOfficeCalendar({ signal: controller.signal })
  if (!('cancelled' in result)) loaded.value = result
})
onBeforeUnmount(() => controller.abort())

const countInput = computed(() => parseWorkingDayCount(count.value))
const countError = computed(() => mode.value !== 'between' && countInput.value.state === 'error'
  ? workingDayCountErrorMessage(countInput.value.code, locale.value)
  : '')

const outcome = computed(() => {
  const office = loaded.value?.calendar
  if (!office || !isIsoDate(start.value)) return undefined

  if (mode.value === 'between') {
    return isIsoDate(end.value) ? countWorkingDays(office, start.value, end.value) : undefined
  }
  if (countInput.value.state !== 'ready') return undefined
  return stepWorkingDays(office, start.value, countInput.value.count, mode.value)
})

const answer = computed(() => {
  const result = outcome.value
  if (!result) return undefined
  if (!result.ok) return { refusal: describeRefusal(result.refusal, mode.value, locale.value) }
  if ('workingDays' in result) return { ...describeSpan(result, locale.value), roc: '', note: '', breakdown: result.breakdown }
  return { ...describeStep(result, locale.value), breakdown: result.breakdown }
})

const breakdown = computed(() => {
  const details: WorkingDayBreakdown | undefined = answer.value && 'breakdown' in answer.value ? answer.value.breakdown : undefined
  if (!details) return undefined
  return {
    skipped: details.skipped.map(day => ({ date: day.date, text: describeSkippedDay(day, locale.value) })),
    weekends: describeWeekendDays(details.weekendDays, locale.value),
    makeup: details.makeupWorkdays,
  }
})

const pendingText = computed(() => mode.value === 'between' ? text.value.resultEmptyBetween : text.value.resultEmpty)
const startLabel = computed(() => mode.value === 'between' ? text.value.fromLabel : text.value.startLabel)
const startHint = computed(() => mode.value === 'between' ? text.value.betweenHint : text.value.startHint)
const countDescribedBy = computed(() => ['working-day-count-help', countError.value ? 'working-day-count-error' : ''].filter(Boolean).join(' '))

const officeDataset = taiwanCalendarDatasets.find(dataset => dataset.id === 'dgpa-office-calendar')!
const editionYears = computed(() => describeEditionYears(loaded.value?.editions ?? [], locale.value))
const caveats = computed(() => getWorkingDayCaveats(locale.value))
</script>

<template>
  <div class="working-day" :data-working-day-state="loaded ? 'ready' : 'loading'">
    <Card class="tool-workspace working-day__workspace">
      <fieldset class="working-day__modes">
        <legend>{{ text.modeLegend }}</legend>
        <div class="choice-group">
          <label v-for="option in workingDayModes" :key="option" class="choice-option">
            <input v-model="mode" type="radio" name="working-day-mode" :value="option">
            <span>{{ workingDayModeLabel(option, locale) }}</span>
          </label>
        </div>
      </fieldset>

      <div class="working-day__fields">
        <div class="field-group">
          <label for="working-day-start">{{ startLabel }}</label>
          <Input id="working-day-start" v-model="start" type="date" aria-describedby="working-day-start-help" />
          <p id="working-day-start-help" class="field-help">{{ startHint }}</p>
        </div>

        <div v-if="mode === 'between'" class="field-group">
          <label for="working-day-end">{{ text.toLabel }}</label>
          <Input id="working-day-end" v-model="end" type="date" />
        </div>

        <div v-else class="field-group">
          <label for="working-day-count">{{ text.countLabel }}</label>
          <Input
            id="working-day-count"
            v-model="count"
            inputmode="numeric"
            autocomplete="off"
            enterkeyhint="done"
            :aria-describedby="countDescribedBy"
            :aria-invalid="Boolean(countError)"
          />
          <p id="working-day-count-help" class="field-help">{{ text.countHint }}</p>
          <p v-if="countError" id="working-day-count-error" class="field-error" role="alert">{{ countError }}</p>
        </div>
      </div>

      <div class="result-panel working-day__result" aria-live="polite">
        <span class="result-panel__label">{{ text.resultLabel }}</span>
        <span v-if="!loaded" class="working-day__pending">{{ text.loadingLabel }}</span>
        <template v-else-if="answer && 'refusal' in answer">
          <span class="working-day__refusal" data-refusal>{{ answer.refusal }}</span>
        </template>
        <template v-else-if="answer">
          <strong class="working-day__headline">{{ answer.headline }}</strong>
          <span v-if="answer.roc" class="working-day__roc">{{ answer.roc }}</span>
          <span class="working-day__rule">{{ answer.rule }}</span>
          <span v-if="answer.note" class="working-day__note" data-makeup-note>{{ answer.note }}</span>
        </template>
        <span v-else class="working-day__pending">{{ pendingText }}</span>
      </div>
      <p class="working-day__coverage">{{ text.coverageHint }}</p>

      <details v-if="breakdown" class="working-day__breakdown">
        <summary>{{ text.breakdownSummary }}</summary>
        <h2 class="calendar-detail__title">{{ text.skippedTitle }}</h2>
        <ul v-if="breakdown.skipped.length" class="working-day__list" data-skipped>
          <li v-for="day in breakdown.skipped" :key="day.date">{{ day.text }}</li>
        </ul>
        <p v-else class="working-day__muted">{{ text.skippedNone }}</p>
        <p v-if="breakdown.weekends" class="working-day__muted" data-weekends>{{ breakdown.weekends }}</p>
        <template v-if="breakdown.makeup.length">
          <h2 class="calendar-detail__title">{{ text.makeupTitle }}</h2>
          <ul class="working-day__list" data-makeup>
            <li v-for="date in breakdown.makeup" :key="date">{{ formatWorkingDayDate(date, locale) }}</li>
          </ul>
        </template>
      </details>

      <footer v-if="loaded" class="calendar-edition working-day__edition">
        <p class="calendar-edition__line" data-edition>
          {{ text.dataVersionLabel }}{{ en ? ': ' : '：' }}{{ officeDataset.publisher[locale] }}{{ en ? ', “' : '「' }}<a
            :href="officeDataset.url"
            target="_blank"
            rel="noopener noreferrer"
          >{{ officeDataset.name[locale] }}</a>{{ en ? '”, ' : '」' }}{{ editionYears }}{{ en ? '. ' : '。' }}{{ text.licencePrefix }}<a
            :href="officeDataset.licenceUrl"
            target="_blank"
            rel="noopener noreferrer"
          >{{ officeDataset.licence[locale] }}</a>{{ text.licenceSuffix }}
        </p>
        <p class="working-day__calendar-link">
          {{ text.calendarLinkPrefix }}<NuxtLink :to="withLocale('/tools/taiwan-calendar/')">{{ text.calendarLinkText }}</NuxtLink>{{ text.calendarLinkSuffix }}
        </p>

        <details class="calendar-edition__details">
          <summary>{{ text.editionDetailsLabel }}</summary>

          <section class="calendar-caveats" :aria-label="text.caveatsTitle">
            <h2 class="calendar-detail__title">{{ text.caveatsTitle }}</h2>
            <ul>
              <li v-for="caveat in caveats" :key="caveat.key" :data-caveat="caveat.key">{{ caveat.text }}</li>
            </ul>
          </section>

          <section class="calendar-sources" :aria-label="text.editionsTitle">
            <h2 class="calendar-detail__title">{{ text.editionsTitle }}</h2>
            <ul class="working-day__editions">
              <li v-for="entry in loaded.editions" :key="entry.year" class="calendar-sources__edition">
                {{ entry.edition.edition }}
                ・{{ text.publishedAtLabel }} <time :datetime="entry.edition.publishedAt">{{ entry.edition.publishedAt }}</time>
                ・{{ text.retrievedAtLabel }} <time :datetime="entry.edition.retrievedAt">{{ entry.edition.retrievedAt }}</time>
              </li>
            </ul>
          </section>
        </details>
      </footer>
    </Card>
  </div>
</template>

<style scoped>
.working-day__modes { margin: 0; padding: 0; border: 0; }
.working-day__modes legend { margin-bottom: 8px; padding: 0; font-size: .86rem; font-weight: 700; }
/* Three short choices share one row, so a phone still sees the answer without scrolling. */
.working-day__modes .choice-group { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.working-day__modes .choice-option { justify-content: center; gap: 6px; padding: 8px 10px; white-space: nowrap; }
.working-day__fields { display: grid; gap: 12px; margin-top: 16px; }
.working-day__fields :deep(.ui-input) { font-family: var(--font-mono); font-size: 1.1rem; font-variant-numeric: tabular-nums; }
.working-day__result { min-height: 0; margin-top: 16px; padding: 16px 20px; justify-content: flex-start; }
.working-day__result .result-panel__label { margin-bottom: 6px; }
.working-day__headline { font-variant-numeric: tabular-nums; }
.working-day__roc { margin-top: 4px; font-size: .92rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.working-day__rule { margin-top: 6px; font-size: .86rem; font-variant-numeric: tabular-nums; }
.working-day__note { margin-top: 6px; font-size: .84rem; font-weight: 700; }
.working-day__refusal { font-size: .92rem; font-weight: 700; line-height: 1.6; }
.working-day__pending { color: var(--color-muted-foreground); font-size: .9rem; }
.working-day__coverage { margin: 8px 0 0; color: var(--color-muted-foreground); font-size: .82rem; font-weight: 700; }
.working-day__breakdown { margin-top: 12px; font-size: .86rem; }
.working-day__breakdown > summary { display: inline-flex; min-height: 44px; align-items: center; font-weight: 700; cursor: pointer; }
.working-day__breakdown .calendar-detail__title { margin-top: 8px; }
.working-day__list { display: grid; gap: 4px; margin: 0; padding-left: 20px; font-variant-numeric: tabular-nums; }
.working-day__muted { margin: 6px 0 0; color: var(--color-muted-foreground); }
.working-day__calendar-link { margin: 4px 0 0; overflow-wrap: anywhere; }
.working-day__editions { display: grid; gap: 4px; margin: 0; padding-left: 20px; }

@media (min-width: 768px) {
  .working-day__fields { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}
</style>
