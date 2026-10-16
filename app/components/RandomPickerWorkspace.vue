<script setup lang="ts">
import { Dices, Plus, RotateCcw, SkipForward } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import RandomPickerWheel from '@/components/RandomPickerWheel.vue'
import {
  duplicatePolicyLabels,
  getRandomPickerCopy,
  getRandomPickerSummary,
  presentationLabels,
  randomPickerErrorMessage,
} from '@/features/tools/random-picker/content'
import {
  drawRandomPicks,
  planRandomPicker,
  secureRandomWords,
  type RandomPickerPick,
  type RandomWords,
} from '@/features/tools/random-picker/domain/draw'
import {
  duplicatePolicies,
  randomPickerLimits,
  randomPickerPresentations,
  type DuplicatePolicy,
  type RandomPickerPresentation,
} from '@/features/tools/random-picker/domain/reference'
import { canPresentWheel, nextWheelRotation, wheelSlices } from '@/features/tools/random-picker/domain/wheel'

/**
 * The workspace never decides anything about fairness: it reads the plan, calls
 * the draw once, and then only presents what came back. The wheel is started
 * with a result already in hand, which is why skipping, cancelling or turning
 * off animation cannot change it.
 *
 * Since #83 the result, the way it is shown and the buttons that act on it form
 * one stage beside the list (a dock above the bottom navigation on a phone), so
 * a visitor can draw, draw again and reset without leaving the result.
 */
const SPIN_TURNS = 5
const SPIN_DURATION_MS = 2_600
const PROGRESS_TICK_MS = 100
const DOCK_CLEARANCE_PX = 12

const { locale } = useAppLocale()
const text = computed(() => getRandomPickerCopy(locale.value))
const stage = ref<HTMLElement>()
const listText = ref('')
const newEntry = ref('')
const duplicates = ref<DuplicatePolicy>('keep')
const drawCountInput = ref<string | number>('1')
const presentation = ref<RandomPickerPresentation>('list')
const touched = ref(false)
/** Resolved on the client only: the page is prerendered, the browser is not. */
const randomWords = shallowRef<RandomWords>()
const secureRandomChecked = ref(false)
const picks = ref<RandomPickerPick[]>([])
/** Counts settled draws, so a repeat of the same name still arrives as a new result. */
const drawSerial = ref(0)
const hasDrawn = ref(false)
const spinning = ref(false)
const spinProgress = ref(0)
const rotation = ref(0)
const drawFailed = ref(false)

let settleTimer: ReturnType<typeof setTimeout> | undefined
let progressTimer: ReturnType<typeof setInterval> | undefined
let spinStartedAt = 0
let spinningPicks: RandomPickerPick[] = []

/** A number input hands back a number once it parses, and the raw string until then. */
const drawCount = computed(() => {
  const value = drawCountInput.value
  if (typeof value === 'number') return value

  return value.trim() ? Number(value) : Number.NaN
})
const outcome = computed(() => planRandomPicker({
  text: listText.value,
  duplicates: duplicates.value,
  drawCount: drawCount.value,
  hasSecureRandom: !secureRandomChecked.value || Boolean(randomWords.value),
}))
const list = computed(() => outcome.value.list)
const summary = computed(() => getRandomPickerSummary(list.value, locale.value))
/** The one boundary that depends on the list: shown only while a repeat really holds two chances. */
const sharedDuplicates = computed(() => duplicates.value === 'keep' && list.value.hasDuplicates)
const duplicateOptions = computed(() => duplicatePolicies.map(policy => ({
  id: policy,
  label: duplicatePolicyLabels[policy][locale.value],
})))
const presentationOptions = computed(() => randomPickerPresentations.map(option => ({
  id: option,
  label: presentationLabels[option][locale.value],
})))

/**
 * An empty field is not a mistake, so it never becomes an alert: it asks calmly
 * for a list, while a list that cannot be drawn from is reported as an error on
 * the field that has to change.
 */
const pending = computed(() => touched.value && outcome.value.state === 'error' && outcome.value.code === 'empty'
  ? randomPickerErrorMessage('empty', {}, locale.value)
  : '')
const error = computed(() => {
  if (drawFailed.value) return randomPickerErrorMessage('randomness-unavailable', {}, locale.value)
  if (outcome.value.state !== 'error' || outcome.value.code === 'empty') return ''

  return randomPickerErrorMessage(outcome.value.code, outcome.value.values, locale.value)
})
/** Only a count problem belongs on the count field; a list problem belongs on the list. */
const countError = computed(() => outcome.value.state === 'error' && outcome.value.code.startsWith('draw-count'))
const wheelReadable = computed(() => canPresentWheel(list.value.entries.length, drawCount.value))
const showWheel = computed(() => presentation.value === 'wheel' && wheelReadable.value)
/** Laid out for where the wheel rests or is heading, so the names read the right way up once it stops. */
const slices = computed(() => wheelSlices(list.value.entries, rotation.value))
const wheelLabel = computed(() => `${text.value.wheelCaption}（${slices.value.length}）`)
const wonIndex = computed(() => (spinning.value ? undefined : picks.value[0]?.index))
const canDraw = computed(() => outcome.value.state === 'ready' && !spinning.value && !drawFailed.value)
const listDescribedBy = computed(() => ['picker-list-help', pending.value ? 'picker-pending' : '', error.value && !countError.value ? 'picker-error' : '']
  .filter(Boolean)
  .join(' '))
const duplicatesDescribedBy = computed(() => ['picker-duplicates-help', sharedDuplicates.value ? 'picker-duplicates-note' : '']
  .filter(Boolean)
  .join(' '))
const countDescribedBy = computed(() => ['picker-count-help', countError.value ? 'picker-error' : ''].filter(Boolean).join(' '))

// A waiting application update must ask before it discards a list in progress.
useWorkspaceDirty('random-picker', computed(() => listText.value.trim().length > 0))

onMounted(() => {
  randomWords.value = secureRandomWords(globalThis.crypto)
  secureRandomChecked.value = true
})

onBeforeUnmount(stopSpin)

watch([listText, duplicates, drawCountInput, presentation], () => {
  touched.value = true
  drawFailed.value = false
  stopSpin()
  // The wheel and its adjacent name list follow the parsed list, so an edit
  // mid-spin cannot leave the old names on screen beside a new entry count.
  picks.value = []
  hasDrawn.value = false
})

function addEntry() {
  const entry = newEntry.value.trim()
  if (!entry) return

  const current = listText.value
  listText.value = !current || current.endsWith('\n') ? `${current}${entry}` : `${current}\n${entry}`
  newEntry.value = ''
}

/**
 * The result is drawn here, once, before anything moves on screen. Everything
 * after this point is presentation.
 */
function draw() {
  const plan = outcome.value
  if (plan.state !== 'ready' || !randomWords.value) return

  stopSpin()
  let drawn: RandomPickerPick[]
  try {
    drawn = drawRandomPicks(plan.list.entries, plan.drawCount, randomWords.value)
  }
  catch {
    // A source that cannot produce uniform words must not silently produce a winner.
    drawFailed.value = true
    picks.value = []
    return
  }

  drawFailed.value = false
  hasDrawn.value = true
  const spins = showWheel.value && !prefersReducedMotion() ? SPIN_TURNS : 0
  rotation.value = nextWheelRotation(rotation.value, drawn[0]!.index, plan.list.entries.length, spins)

  if (spins) startSpin(drawn)
  else settle(drawn)
}

function startSpin(drawn: RandomPickerPick[]) {
  // The draw button is disabled for the spin; the skip button beside it takes the focus it had.
  const handOver = isFocused('.picker-draw')
  spinningPicks = drawn
  picks.value = []
  spinning.value = true
  spinProgress.value = 0
  spinStartedAt = Date.now()
  progressTimer = setInterval(() => {
    spinProgress.value = Math.min(100, Math.round(((Date.now() - spinStartedAt) / SPIN_DURATION_MS) * 100))
  }, PROGRESS_TICK_MS)
  settleTimer = setTimeout(() => settle(drawn), SPIN_DURATION_MS)
  if (handOver) focusInStage('.picker-skip')
}

/** Skipping and cancelling are the same act: show the result that was already drawn. */
function skipAnimation() {
  if (spinning.value) settle(spinningPicks)
}

function settle(drawn: RandomPickerPick[]) {
  // The skip button leaves with the spin; its focus goes back to the button that draws again.
  const handBack = isFocused('.picker-skip')
  clearTimers()
  spinning.value = false
  spinProgress.value = 100
  picks.value = drawn
  drawSerial.value += 1
  if (handBack) focusInStage('.picker-draw')
}

function stopSpin() {
  clearTimers()
  spinning.value = false
  spinProgress.value = 0
  spinningPicks = []
}

function clearTimers() {
  if (settleTimer) clearTimeout(settleTimer)
  if (progressTimer) clearInterval(progressTimer)
  settleTimer = undefined
  progressTimer = undefined
}

function reset() {
  stopSpin()
  listText.value = ''
  newEntry.value = ''
  drawCountInput.value = '1'
  picks.value = []
  hasDrawn.value = false
  rotation.value = 0
  drawFailed.value = false
  touched.value = false
}

function isFocused(selector: string) {
  return typeof document !== 'undefined' && Boolean(document.activeElement?.matches(selector))
}

/** Keeps the keyboard in the stage when the button it was on goes away; never scrolls. */
function focusInStage(selector: string) {
  nextTick(() => stage.value?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }))
}

/**
 * While the stage is docked over the bottom of the screen, a field that takes
 * focus underneath it is lifted clear. A scroll padding cannot do this: it
 * would also apply to the docked buttons themselves and scroll the page each
 * time one of them is focused.
 */
function keepFocusClearOfStage(event: FocusEvent) {
  const dock = stage.value
  const field = event.target
  if (!dock || !(field instanceof HTMLElement) || getComputedStyle(dock).position !== 'sticky') return

  const overlap = field.getBoundingClientRect().bottom - dock.getBoundingClientRect().top + DOCK_CLEARANCE_PX
  // Instant, like the browser's own scroll to a focused field, so the page is already still when typing starts.
  if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'instant' })
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
</script>

<template>
  <Card class="tool-workspace picker-workspace">
    <div class="picker-grid">
      <div class="field-group picker-inputs" @focusin="keepFocusClearOfStage">
        <label for="picker-list">{{ text.listLabel }}</label>
        <textarea
          id="picker-list"
          v-model="listText"
          class="ui-input picker-list"
          rows="8"
          autocomplete="off"
          spellcheck="false"
          :placeholder="text.listPlaceholder"
          :aria-describedby="listDescribedBy"
          :aria-invalid="Boolean(error) && !countError"
        />
        <p id="picker-list-help" class="field-help">{{ text.listHint }}</p>
        <p v-if="pending" id="picker-pending" class="field-pending picker-pending">{{ pending }}</p>
        <p v-if="error && !countError" id="picker-error" class="field-error picker-error" role="alert">{{ error }}</p>
        <ul class="picker-summary" :aria-label="text.summaryLabel">
          <li v-for="item in summary" :key="item.key">{{ item.text }}</li>
        </ul>

        <div class="picker-add">
          <label for="picker-new-entry">{{ text.addLabel }}</label>
          <div class="picker-add__row">
            <Input
              id="picker-new-entry"
              v-model="newEntry"
              autocomplete="off"
              :placeholder="text.addPlaceholder"
              @keydown.enter.prevent="addEntry"
            />
            <Button variant="outline" class="picker-add__button" @click="addEntry">
              <Plus :size="18" aria-hidden="true" />
              {{ text.addButton }}
            </Button>
          </div>
        </div>

        <fieldset class="picker-options">
          <legend>{{ text.duplicatesLegend }}</legend>
          <p id="picker-duplicates-help" class="field-help">{{ text.duplicatesHint }}</p>
          <div class="choice-group picker-options__row">
            <label v-for="option in duplicateOptions" :key="option.id" class="choice-option picker-option">
              <input
                v-model="duplicates"
                type="radio"
                name="picker-duplicates"
                :value="option.id"
                :aria-describedby="duplicatesDescribedBy"
              >
              <span>{{ option.label }}</span>
            </label>
          </div>
          <p v-if="sharedDuplicates" id="picker-duplicates-note" class="picker-note picker-duplicates-note">{{ text.duplicatesShared }}</p>
        </fieldset>

        <div class="picker-count">
          <label for="picker-count">{{ text.countLabel }}</label>
          <Input
            id="picker-count"
            v-model="drawCountInput"
            type="number"
            inputmode="numeric"
            min="1"
            :max="randomPickerLimits.maxEntries"
            :aria-describedby="countDescribedBy"
            :aria-invalid="countError"
          />
          <p id="picker-count-help" class="field-help">{{ text.countHint }}</p>
          <!-- A count the list cannot satisfy is explained under the count, where it was typed. -->
          <p v-if="error && countError" id="picker-error" class="field-error picker-error" role="alert">{{ error }}</p>
        </div>
      </div>

      <!-- One column on a phone: the stage docks above the bottom navigation, the wheel's names follow it. -->
      <div class="picker-output">
        <section
          ref="stage"
          class="picker-stage"
          :class="{ 'picker-stage--wheel': showWheel }"
          aria-labelledby="picker-stage-title"
        >
          <div class="picker-stage__head">
            <h2 id="picker-stage-title" class="picker-stage__title">{{ text.resultLabel }}</h2>
            <fieldset class="picker-view">
              <legend class="sr-only">{{ text.presentationLegend }}</legend>
              <label v-for="option in presentationOptions" :key="option.id" class="choice-option picker-option picker-view__option">
                <input v-model="presentation" type="radio" name="picker-presentation" :value="option.id">
                <span>{{ option.label }}</span>
              </label>
            </fieldset>
          </div>

          <p v-if="presentation === 'wheel' && !wheelReadable" class="picker-note picker-wheel-note">{{ text.wheelUnavailable }}</p>

          <div class="picker-stage__body">
            <!-- The same wheel as the landing demo (#106). -->
            <RandomPickerWheel
              v-if="showWheel"
              :slices="slices"
              :rotation="rotation"
              :label="wheelLabel"
              :won-index="wonIndex"
              :spin-duration-ms="spinning ? SPIN_DURATION_MS : 0"
            />

            <div class="picker-readout">
              <div
                class="picker-result"
                :class="{ 'picker-result--several': picks.length > 1 }"
                role="status"
                aria-live="polite"
                :aria-busy="spinning"
              >
                <p v-if="spinning" class="picker-result__spinning">{{ text.spinningLabel }}</p>
                <!-- Keyed by the draw, so drawing the same name again still arrives, and is announced, as a new result. -->
                <ol
                  v-else-if="picks.length"
                  :key="drawSerial"
                  class="picker-result__list"
                  :tabindex="picks.length > 1 ? 0 : undefined"
                  :aria-label="picks.length > 1 ? text.resultLabel : undefined"
                >
                  <li v-for="pick in picks" :key="pick.index" class="picker-result__item">{{ pick.entry }}</li>
                </ol>
                <p v-else class="picker-result__pending">{{ text.resultEmpty }}</p>
              </div>
              <div
                v-if="spinning"
                class="picker-progress"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="spinProgress"
                :aria-label="text.progressLabel"
              >
                <span :style="{ width: `${spinProgress}%` }" />
              </div>
            </div>
          </div>

          <div class="picker-stage__actions">
            <Button class="tool-workspace__copy picker-draw" :disabled="!canDraw" @click="draw">
              <Dices :size="18" aria-hidden="true" />
              {{ hasDrawn ? text.drawAgainLabel : text.drawLabel }}
            </Button>
            <Button v-if="spinning" variant="outline" class="picker-skip" @click="skipAnimation">
              <SkipForward :size="18" aria-hidden="true" />
              {{ text.skipLabel }}
            </Button>
            <Button v-else variant="outline" class="picker-reset" @click="reset">
              <RotateCcw :size="18" aria-hidden="true" />
              {{ text.resetLabel }}
            </Button>
          </div>
        </section>

        <div v-if="showWheel" class="picker-candidates-block">
          <p id="picker-candidates-title" class="picker-candidates__title">{{ text.candidatesLabel }}（{{ slices.length }}）</p>
          <ol class="picker-candidates" aria-labelledby="picker-candidates-title">
            <li v-for="slice in slices" :key="slice.index">{{ list.entries[slice.index] }}</li>
          </ol>
        </div>
      </div>
    </div>
  </Card>
</template>
