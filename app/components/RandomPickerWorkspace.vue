<script setup lang="ts">
import { Dices, Plus, RotateCcw, SkipForward } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  duplicatePolicyLabels,
  getRandomPickerCaveats,
  getRandomPickerCopy,
  getRandomPickerMethod,
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
import { randomPickerContentReview, randomPickerReferenceVersion } from '@/features/tools/random-picker/domain/sources'
import { canPresentWheel, nextWheelRotation, wheelLabelStyle, wheelSlices, wheelViewBox } from '@/features/tools/random-picker/domain/wheel'

/**
 * The workspace never decides anything about fairness: it reads the plan, calls
 * the draw once, and then only presents what came back. The wheel is started
 * with a result already in hand, which is why skipping, cancelling or turning
 * off animation cannot change it.
 */
const SPIN_TURNS = 5
const SPIN_DURATION_MS = 2_600
const PROGRESS_TICK_MS = 100

const { locale } = useAppLocale()
const text = computed(() => getRandomPickerCopy(locale.value))
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
const caveats = computed(() => getRandomPickerCaveats(
  locale.value,
  duplicates.value === 'keep' && list.value.hasDuplicates,
))
const method = computed(() => getRandomPickerMethod(locale.value))
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
const slices = computed(() => wheelSlices(list.value.entries))
const wheelLabel = computed(() => `${text.value.wheelCaption}（${slices.value.length}）`)
const wheelFontSize = computed(() => wheelLabelStyle(slices.value.length).fontSize)
const wonIndex = computed(() => (spinning.value ? undefined : picks.value[0]?.index))
const canDraw = computed(() => outcome.value.state === 'ready' && !spinning.value && !drawFailed.value)
const listDescribedBy = computed(() => ['picker-list-help', pending.value ? 'picker-pending' : '', error.value && !countError.value ? 'picker-error' : '']
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
  const spins = showWheel.value && !prefersReducedMotion() ? SPIN_TURNS : 0
  rotation.value = nextWheelRotation(rotation.value, drawn[0]!.index, plan.list.entries.length, spins)

  if (spins) startSpin(drawn)
  else settle(drawn)
}

function startSpin(drawn: RandomPickerPick[]) {
  spinningPicks = drawn
  picks.value = []
  spinning.value = true
  spinProgress.value = 0
  spinStartedAt = Date.now()
  progressTimer = setInterval(() => {
    spinProgress.value = Math.min(100, Math.round(((Date.now() - spinStartedAt) / SPIN_DURATION_MS) * 100))
  }, PROGRESS_TICK_MS)
  settleTimer = setTimeout(() => settle(drawn), SPIN_DURATION_MS)
}

/** Skipping and cancelling are the same act: show the result that was already drawn. */
function skipAnimation() {
  if (spinning.value) settle(spinningPicks)
}

function settle(drawn: RandomPickerPick[]) {
  clearTimers()
  spinning.value = false
  spinProgress.value = 100
  picks.value = drawn
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
  rotation.value = 0
  drawFailed.value = false
  touched.value = false
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
</script>

<template>
  <Card class="tool-workspace picker-workspace">
    <div class="tool-workspace__grid picker-grid">
      <div class="field-group picker-inputs">
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
        <p v-if="error" id="picker-error" class="field-error picker-error" role="alert">{{ error }}</p>

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

        <p class="picker-summary__title">{{ text.summaryLabel }}</p>
        <ul class="picker-summary">
          <li v-for="item in summary" :key="item.key">{{ item.text }}</li>
        </ul>

        <fieldset class="picker-options">
          <legend>{{ text.duplicatesLegend }}</legend>
          <p id="picker-duplicates-help" class="field-help">{{ text.duplicatesHint }}</p>
          <div class="picker-options__row">
            <label v-for="option in duplicateOptions" :key="option.id" class="picker-option">
              <input
                v-model="duplicates"
                type="radio"
                name="picker-duplicates"
                :value="option.id"
                aria-describedby="picker-duplicates-help"
              >
              <span>{{ option.label }}</span>
            </label>
          </div>
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
        </div>

        <fieldset class="picker-options">
          <legend>{{ text.presentationLegend }}</legend>
          <p id="picker-presentation-help" class="field-help">{{ text.presentationHint }}</p>
          <div class="picker-options__row">
            <label v-for="option in presentationOptions" :key="option.id" class="picker-option">
              <input
                v-model="presentation"
                type="radio"
                name="picker-presentation"
                :value="option.id"
                aria-describedby="picker-presentation-help"
              >
              <span>{{ option.label }}</span>
            </label>
          </div>
          <p v-if="presentation === 'wheel' && !wheelReadable" class="picker-wheel-note">{{ text.wheelUnavailable }}</p>
        </fieldset>
      </div>

      <div class="picker-stage">
        <div v-if="showWheel" class="picker-wheel">
          <!-- The frame clips the rotated square box of the disc; the circle inside never reaches its edge. -->
          <div class="picker-wheel__frame">
            <span class="picker-wheel__pointer" aria-hidden="true" />
            <svg
              class="picker-wheel__disc"
              :viewBox="wheelViewBox"
              role="img"
              :aria-label="wheelLabel"
              :style="{ transform: `rotate(${rotation}deg)`, transitionDuration: spinning ? `${SPIN_DURATION_MS}ms` : '0ms' }"
            >
              <g v-for="slice in slices" :key="slice.index">
                <path
                  :d="slice.path"
                  class="picker-wheel__slice"
                  :class="{
                    'picker-wheel__slice--odd': slice.index % 2 === 1,
                    'picker-wheel__slice--won': slice.index === wonIndex,
                  }"
                />
                <text
                  class="picker-wheel__label"
                  :font-size="wheelFontSize"
                  :transform="slice.labelTransform"
                >{{ slice.label }}</text>
              </g>
            </svg>
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
          <ol class="picker-candidates">
            <li v-for="slice in slices" :key="slice.index">{{ slice.label }}</li>
          </ol>
        </div>

        <div
          class="result-panel picker-result"
          role="status"
          aria-live="polite"
          :aria-busy="spinning"
        >
          <span class="result-panel__label">{{ text.resultLabel }}</span>
          <p v-if="spinning" class="picker-result__spinning">{{ text.spinningLabel }}</p>
          <ol v-else-if="picks.length" class="picker-result__list">
            <li v-for="pick in picks" :key="pick.index" class="picker-result__item">{{ pick.entry }}</li>
          </ol>
          <span v-else class="picker-result__pending">{{ text.resultEmpty }}</span>
        </div>
      </div>
    </div>

    <div class="tool-workspace__actions">
      <Button class="tool-workspace__copy picker-draw" :disabled="!canDraw" @click="draw">
        <Dices :size="18" aria-hidden="true" />
        {{ picks.length ? text.drawAgainLabel : text.drawLabel }}
      </Button>
      <Button v-if="spinning" variant="outline" class="picker-skip" @click="skipAnimation">
        <SkipForward :size="18" aria-hidden="true" />
        {{ text.skipLabel }}
      </Button>
      <Button variant="outline" class="picker-reset" @click="reset">
        <RotateCcw :size="18" aria-hidden="true" />
        {{ text.resetLabel }}
      </Button>
    </div>

    <section class="picker-caveats" :aria-label="text.caveatsTitle">
      <h2 class="picker-caveats__title">{{ text.caveatsTitle }}</h2>
      <ul>
        <li v-for="caveat in caveats" :key="caveat.key">{{ caveat.text }}</li>
      </ul>
      <p class="picker-source">
        {{ text.sourceLabel }}：
        <a
          v-for="source in randomPickerContentReview.sources"
          :key="source.url"
          :href="source.url"
          target="_blank"
          rel="noopener noreferrer"
        >{{ source.title[locale] }}</a>
        （{{ text.ruleVersionLabel }} {{ randomPickerReferenceVersion }}）
      </p>
    </section>
  </Card>

  <details class="tool-reference picker-method" aria-labelledby="picker-method-title">
    <summary class="tool-contract__summary"><h2 id="picker-method-title">{{ text.methodTitle }}</h2></summary>
    <div class="tool-contract__body">
      <p>{{ text.methodIntro }}</p>
      <ol class="picker-method__steps">
        <li v-for="step in method" :key="step.title">
          <strong>{{ step.title }}</strong>
          <span>{{ step.body }}</span>
        </li>
      </ol>
    </div>
  </details>
</template>
