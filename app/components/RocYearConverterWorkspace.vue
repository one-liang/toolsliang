<script setup lang="ts">
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  describeCurrentYear,
  describeOutsideTable,
  describeRocYearPair,
  describeTableRange,
  describeTableRow,
  getRocYearCopy,
  rocYearErrorMessage,
} from '@/features/tools/roc-year-converter/content'
import {
  gregorianToRoc,
  lookUpYear,
  rocYearTableRows,
  type RocYearDirection,
} from '@/features/tools/roc-year-converter/domain/convert'

const { locale } = useAppLocale()
const text = computed(() => getRocYearCopy(locale.value))

/**
 * The workspace only mounts on the visitor's device, behind the capability
 * gate, so this is their clock rather than the build machine's: "this year" and
 * the end of the table follow the device the page is open on.
 */
const currentYear = new Date().getFullYear()
const currentPair = { gregorian: currentYear, roc: gregorianToRoc(currentYear) }
const rows = rocYearTableRows(currentYear)
const tableRows = computed(() => rows.map(row => ({ gregorian: row.gregorian, labels: describeTableRow(row, locale.value) })))

const direction = ref<RocYearDirection>('roc-to-gregorian')
const year = ref('')
const inputId = 'roc-year-input'

const lookup = computed(() => lookUpYear(year.value, direction.value))
const pair = computed(() => lookup.value.state === 'ready' ? lookup.value.pair : undefined)
const result = computed(() => pair.value && describeRocYearPair(pair.value, direction.value, locale.value))
const error = computed(() => lookup.value.state === 'error'
  ? rocYearErrorMessage(lookup.value.code, direction.value, locale.value)
  : '')
const matchedYear = computed(() => {
  const gregorian = pair.value?.gregorian
  return rows.some(row => row.gregorian === gregorian) ? gregorian : undefined
})
const outsideTable = computed(() => pair.value && matchedYear.value === undefined
  ? describeOutsideTable(pair.value, direction.value, locale.value)
  : '')
const tableRange = computed(() => describeTableRange(rows, locale.value))
const currentYearText = computed(() => describeCurrentYear(currentPair, locale.value))
const describedBy = computed(() => ['roc-year-help', error.value ? 'roc-year-error' : ''].filter(Boolean).join(' '))
const inputLabel = computed(() => direction.value === 'roc-to-gregorian' ? text.value.rocInputLabel : text.value.gregorianInputLabel)
const inputHint = computed(() => direction.value === 'roc-to-gregorian' ? text.value.rocInputHint : text.value.gregorianInputHint)

/**
 * Switching direction keeps the year rather than its digits: ROC year 115
 * becomes 2026, not the Gregorian year 115. A year before the ROC era has no
 * ROC number to carry, and text that is not a year yet stays as typed.
 */
function selectDirection(next: RocYearDirection) {
  if (next === direction.value) return
  const current = pair.value
  if (current) {
    year.value = next === 'gregorian-to-roc'
      ? String(current.gregorian)
      : current.roc.era === 'roc' ? String(current.roc.year) : ''
  }
  direction.value = next
}

const tableScroller = ref<HTMLElement>()

/**
 * Scrolls the table's own box, never the page, so the field keeps its place
 * under the visitor's finger while the matching row comes into view.
 */
function scrollToRow(gregorian: number, behavior: ScrollBehavior) {
  const scroller = tableScroller.value
  const row = scroller?.querySelector<HTMLElement>(`[data-gregorian="${gregorian}"]`)
  if (!scroller || !row) return

  const rowTop = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
  const header = scroller.querySelector('thead')?.getBoundingClientRect().height ?? 0
  const visible = scroller.clientHeight - header
  scroller.scrollTo({ top: Math.max(0, rowTop - header - (visible - row.offsetHeight) / 2), behavior })
}

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

watch(matchedYear, async (gregorian) => {
  if (gregorian === undefined) return
  await nextTick()
  scrollToRow(gregorian, preferredScrollBehavior())
})

onMounted(() => scrollToRow(currentYear, 'auto'))
</script>

<template>
  <div class="roc-year">
    <Card class="tool-workspace roc-year__workspace">
      <fieldset class="roc-year__directions">
        <legend>{{ text.directionLegend }}</legend>
        <div class="choice-group">
          <label v-for="option in (['roc-to-gregorian', 'gregorian-to-roc'] as const)" :key="option" class="choice-option roc-year__direction">
            <input
              type="radio"
              name="roc-year-direction"
              :value="option"
              :checked="direction === option"
              @change="selectDirection(option)"
            >
            <span>{{ option === 'roc-to-gregorian' ? text.directionRoc : text.directionGregorian }}</span>
          </label>
        </div>
      </fieldset>

      <div class="field-group roc-year__field">
        <label :for="inputId">{{ inputLabel }}</label>
        <Input
          :id="inputId"
          v-model="year"
          inputmode="numeric"
          autocomplete="off"
          enterkeyhint="done"
          :aria-describedby="describedBy"
          :aria-invalid="Boolean(error)"
        />
        <p id="roc-year-help" class="field-help">{{ inputHint }}</p>
        <p v-if="error" id="roc-year-error" class="field-error" role="alert">{{ error }}</p>
      </div>

      <div class="result-panel roc-year__result" aria-live="polite">
        <span class="result-panel__label">{{ text.resultLabel }}</span>
        <template v-if="result">
          <strong class="roc-year__headline">{{ result.headline }}</strong>
          <span class="roc-year__equation">{{ result.equation }}</span>
          <span v-if="result.note" class="roc-year__note">{{ result.note }}</span>
        </template>
        <span v-else class="roc-year__pending">{{ text.resultEmpty }}</span>
        <span class="roc-year__today" data-current-year>{{ currentYearText }}</span>
      </div>
    </Card>

    <section class="roc-year__table" aria-labelledby="roc-year-table-title">
      <h2 id="roc-year-table-title" class="roc-year__table-title">{{ text.tableTitle }}</h2>
      <p class="roc-year__table-range">{{ tableRange }}</p>
      <p class="roc-year__formula">{{ text.tableFormula }}</p>
      <p v-if="outsideTable" class="roc-year__outside" data-outside-table>{{ outsideTable }}</p>
      <div class="roc-year__frame">
        <div
          ref="tableScroller"
          class="roc-year__scroll"
          tabindex="0"
          role="region"
          aria-labelledby="roc-year-table-title"
        >
          <table>
            <caption class="sr-only">{{ text.tableTitle }}：{{ tableRange }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ text.rocColumn }}</th>
                <th scope="col">{{ text.gregorianColumn }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in tableRows"
                :key="row.gregorian"
                :data-gregorian="row.gregorian"
                :data-match="row.gregorian === matchedYear || undefined"
                :aria-current="row.gregorian === currentYear ? 'date' : undefined"
                :class="{
                  'roc-year__row--current': row.gregorian === currentYear,
                  'roc-year__row--match': row.gregorian === matchedYear,
                }"
              >
                <th scope="row">
                  <span class="roc-year__cell-year">{{ row.labels.roc }}</span>
                  <span v-if="row.gregorian === currentYear" class="roc-year__tag roc-year__tag--current">{{ text.currentYearBadge }}</span>
                  <span v-if="row.gregorian === matchedYear" class="roc-year__tag roc-year__tag--match">{{ text.matchBadge }}</span>
                </th>
                <td>{{ row.labels.gregorian }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.roc-year { display: grid; gap: 16px; }
.roc-year__directions { margin: 0; padding: 0; border: 0; }
.roc-year__directions legend { margin-bottom: 8px; padding: 0; font-size: .86rem; font-weight: 700; }
.roc-year__field { margin-top: 16px; }
.roc-year__field :deep(.ui-input) { font-family: var(--font-mono); font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.roc-year__result { min-height: 0; margin-top: 16px; padding: 16px 20px; justify-content: flex-start; }
.roc-year__result .result-panel__label { margin-bottom: 6px; }
.roc-year__headline { font-variant-numeric: tabular-nums; }
.roc-year__equation { margin-top: 4px; font-size: .92rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.roc-year__note { margin-top: 6px; color: var(--color-muted-foreground); font-size: .82rem; }
.roc-year__pending { color: var(--color-muted-foreground); font-size: .9rem; }
.roc-year__today { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--color-border-subtle); color: var(--color-muted-foreground); font-size: .82rem; font-weight: 700; font-variant-numeric: tabular-nums; }

.roc-year__table { display: flex; flex-direction: column; min-width: 0; padding: clamp(16px, 3vw, 24px); border: var(--rule) solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); }
.roc-year__table-title { margin: 0; font-size: clamp(1.05rem, 2.5vw, 1.25rem); line-height: 1.35; }
.roc-year__table-range { margin: 6px 0 0; color: var(--color-muted-foreground); font-size: .82rem; }
.roc-year__formula { margin: 8px 0 0; padding: 6px 10px; border-radius: var(--radius-sm); background: var(--color-surface-subtle); font-size: .84rem; font-weight: 700; }
.roc-year__outside { margin: 8px 0 0; color: var(--color-muted-foreground); font-size: .82rem; font-weight: 700; }
/* The scroller is taken out of flow so the table never sets the section's
   height: beside the workspace it fills whatever the workspace is tall, and
   stacked on a phone it keeps the minimum below. */
.roc-year__frame { position: relative; flex: 1 1 auto; min-height: 280px; margin-top: 12px; }
.roc-year__scroll { position: absolute; inset: 0; overflow-y: auto; overscroll-behavior: contain; border: var(--rule) solid var(--color-border); border-radius: var(--radius-md); }
.roc-year__scroll table { width: 100%; border-spacing: 0; font-variant-numeric: tabular-nums; }
.roc-year__scroll thead th { position: sticky; z-index: 1; top: 0; background: var(--color-surface-subtle); font-size: .75rem; }
.roc-year__scroll th, .roc-year__scroll td { width: 50%; padding: 8px 14px; border-bottom: 1px solid var(--color-border-subtle); text-align: left; }
.roc-year__scroll tbody th { font-weight: 700; }
.roc-year__scroll tbody tr:last-child > * { border-bottom: 0; }
.roc-year__cell-year { margin-right: 6px; }
.roc-year__row--current > * { background: var(--color-surface-subtle); }
.roc-year__row--match > * { background: var(--color-result-surface); }
.roc-year__tag { display: inline-block; margin: 2px 6px 2px 0; padding: 0 8px; border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: .7rem; font-weight: 800; line-height: 1.6; vertical-align: middle; white-space: nowrap; }
.roc-year__tag--current { background: var(--fill-time-calendar); border-color: var(--fill-ink); color: var(--fill-ink); }
.roc-year__tag--match { background: var(--color-primary); border-color: var(--fill-ink); color: var(--fill-ink); }

@media (min-width: 768px) {
  .roc-year { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: stretch; }
}
</style>
