<script setup lang="ts">
import { Check, Clipboard, RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatReviewDate } from '@/features/tools/catalog'
import {
  getNtdCaveats,
  getNtdCopy,
  getNtdPurposeSummary,
  ntdComparisonExamples,
  ntdErrorMessage,
} from '@/features/tools/ntd-uppercase/content'
import { convertNtd } from '@/features/tools/ntd-uppercase/domain/convert'
import { ntdDigits, ntdPurposes, type NtdPurpose } from '@/features/tools/ntd-uppercase/domain/reference'
import { ntdContentReview, ntdReferenceVersion } from '@/features/tools/ntd-uppercase/domain/sources'

const { locale } = useAppLocale()
const text = computed(() => getNtdCopy(locale.value))
/** Two columns of five, so the ten numerals stay readable on a phone. */
const digitReference = ntdDigits.map((numeral, value) => ({ value: String(value), numeral }))
const digitRows = digitReference.slice(0, 5).map((left, index) => ({ left, right: digitReference[index + 5]! }))
/** The rule the wording follows is cited where the result is read. */
const primarySource = ntdContentReview.sources[0]!

const purpose = ref<NtdPurpose>('accounting')
const amount = ref('')
const touched = ref(false)
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')

const outcome = computed(() => convertNtd(amount.value, purpose.value))
const conversion = computed(() => outcome.value.state === 'ready' ? outcome.value.conversion : undefined)
/**
 * An empty field is not a mistake, so it never becomes an alert: it asks calmly
 * for an amount, while an amount that cannot be written is reported as an error
 * on the field that has to change.
 */
const pending = computed(() => touched.value && outcome.value.state === 'error' && outcome.value.code === 'empty'
  ? ntdErrorMessage('empty', purpose.value, locale.value)
  : '')
const error = computed(() => outcome.value.state === 'error' && outcome.value.code !== 'empty'
  ? ntdErrorMessage(outcome.value.code, purpose.value, locale.value)
  : '')
const caveats = computed(() => getNtdCaveats(locale.value, purpose.value))
const summary = computed(() => getNtdPurposeSummary(purpose.value, locale.value))
const purposeOptions = computed(() => ntdPurposes.map(option => ({
  id: option,
  label: getNtdPurposeSummary(option, locale.value).label,
})))
const exampleRows = computed(() => ntdComparisonExamples.map(example => ({
  input: example.normalized,
  wordings: ntdPurposes.map(option => ({ purpose: option, wording: example.wordings[option] })),
})))
const copyStatus = computed(() => {
  if (copyState.value === 'copied') return text.value.copiedLabel
  return copyState.value === 'failed' ? text.value.copyFailedLabel : ''
})
const describedBy = computed(() => ['ntd-help', pending.value ? 'ntd-pending' : '', error.value ? 'ntd-error' : '']
  .filter(Boolean)
  .join(' '))

// A waiting application update must ask before it discards an amount in progress.
useWorkspaceDirty('ntd-uppercase', computed(() => amount.value.trim().length > 0))

watch([amount, purpose], () => {
  touched.value = true
  copyState.value = 'idle'
})

/**
 * The clipboard can be missing or refused, and a visitor who believes a copy
 * happened would paste the previous amount onto a document. Both outcomes are
 * announced.
 */
async function copyResult() {
  const wording = conversion.value?.wording
  if (!wording) return

  try {
    await navigator.clipboard.writeText(wording)
    copyState.value = 'copied'
  }
  catch {
    copyState.value = 'failed'
  }
}

/** Clearing empties the amount; the purpose is a choice about the document, not content. */
function clear() {
  amount.value = ''
  touched.value = false
  copyState.value = 'idle'
}
</script>

<template>
  <Card class="tool-workspace ntd-workspace" :aria-busy="false">
    <fieldset class="ntd-purposes">
      <legend>{{ text.purposeLegend }}</legend>
      <p id="ntd-purpose-help" class="field-help">{{ text.purposeHint }}</p>
      <div class="ntd-purposes__options">
        <label v-for="option in purposeOptions" :key="option.id" class="ntd-purposes__option">
          <input
            v-model="purpose"
            type="radio"
            name="ntd-purpose"
            :value="option.id"
            aria-describedby="ntd-purpose-help"
          >
          <span>{{ option.label }}</span>
        </label>
      </div>
    </fieldset>

    <div class="tool-workspace__grid">
      <div class="field-group">
        <label for="ntd-amount">{{ text.amountLabel }}</label>
        <Input
          id="ntd-amount"
          v-model="amount"
          inputmode="decimal"
          autocomplete="off"
          :aria-describedby="describedBy"
          :aria-invalid="Boolean(error)"
          :placeholder="text.amountPlaceholder"
        />
        <p id="ntd-help" class="field-help">{{ text.amountHint }}</p>
        <p v-if="pending" id="ntd-pending" class="field-pending">{{ pending }}</p>
        <p v-if="error" id="ntd-error" class="field-error" role="alert">{{ error }}</p>

        <dl class="ntd-rules">
          <div>
            <dt>{{ text.limitLabel }}</dt>
            <dd>{{ summary.limit }} {{ '元' }}</dd>
          </div>
          <div>
            <dt>{{ text.fractionLabel }}</dt>
            <dd>{{ summary.fraction }}</dd>
          </div>
          <div>
            <dt>{{ text.internalZeroLabel }}</dt>
            <dd>{{ summary.internalZero }}</dd>
          </div>
          <div>
            <dt>{{ text.endingLabel }}</dt>
            <dd>{{ summary.ending }}</dd>
          </div>
        </dl>
      </div>

      <div class="result-panel ntd-result" aria-live="polite">
        <span class="result-panel__label">{{ text.resultLabel }}（{{ summary.label }}）</span>
        <template v-if="conversion">
          <strong class="ntd-result__wording">{{ conversion.wording }}</strong>
          <span class="result-panel__amount">
            {{ text.normalizedLabel }}：NT$ {{ conversion.normalized }}
          </span>
          <span v-if="conversion.roundedFrom" class="ntd-result__rounded">
            {{ text.roundedLabel }}：NT$ {{ conversion.roundedFrom }} → NT$ {{ conversion.normalized }}
          </span>
        </template>
        <span v-else class="ntd-result__pending">{{ text.resultEmpty }}</span>
      </div>
    </div>

    <div class="tool-workspace__actions">
      <Button class="tool-workspace__copy" :disabled="!conversion" @click="copyResult">
        <Check v-if="copyState === 'copied'" :size="18" aria-hidden="true" />
        <Clipboard v-else :size="18" aria-hidden="true" />
        {{ text.copyLabel }}
      </Button>
      <Button variant="outline" class="ntd-clear" @click="clear">
        <RotateCcw :size="18" aria-hidden="true" />
        {{ text.clearLabel }}
      </Button>
    </div>
    <p class="ntd-copy-status" :class="{ 'ntd-copy-status--failed': copyState === 'failed' }" role="status">{{ copyStatus }}</p>

    <section class="ntd-caveats" :aria-label="text.caveatsTitle">
      <h2 class="ntd-caveats__title">{{ text.caveatsTitle }}</h2>
      <ul>
        <li v-for="caveat in caveats" :key="caveat.key">{{ caveat.text }}</li>
      </ul>
      <p class="ntd-source">
        {{ text.sourceLabel }}：<a :href="primarySource.url" target="_blank" rel="noopener noreferrer">{{ primarySource.title[locale] }}</a>
        （{{ text.sourceUpdatedLabel }}
        <time :datetime="ntdContentReview.sourceEffectiveAt">{{ formatReviewDate(ntdContentReview.sourceEffectiveAt, locale) }}</time>
        ・{{ text.ruleVersionLabel }} {{ ntdReferenceVersion }}）
      </p>
    </section>
  </Card>

  <section class="tool-reference" aria-labelledby="ntd-purpose-examples">
    <div class="tool-section-heading">
      <p class="eyebrow">{{ text.examplesEyebrow }}</p>
      <h2 id="ntd-purpose-examples">{{ text.examplesTitle }}</h2>
      <p>{{ text.examplesIntro }}</p>
    </div>

    <div class="tool-reference__table ntd-examples__scroll">
      <table class="ntd-examples">
        <caption class="sr-only">{{ text.examplesCaption }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ text.examplesAmountColumn }}</th>
            <th v-for="option in purposeOptions" :key="option.id" scope="col">{{ option.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in exampleRows" :key="row.input">
            <th scope="row">NT$ {{ row.input }}</th>
            <td v-for="cell in row.wordings" :key="cell.purpose">{{ cell.wording }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="tool-reference" aria-labelledby="ntd-digit-reference">
    <div class="tool-section-heading">
      <p class="eyebrow">{{ text.digitReferenceEyebrow }}</p>
      <h2 id="ntd-digit-reference">{{ text.digitReferenceTitle }}</h2>
      <p>{{ text.digitReferenceIntro }}</p>
    </div>

    <div class="tool-reference__table">
      <table class="ntd-digits">
        <caption class="sr-only">{{ text.digitReferenceCaption }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ text.numberColumn }}</th>
            <th scope="col">{{ text.numeralColumn }}</th>
            <th scope="col">{{ text.numberColumn }}</th>
            <th scope="col">{{ text.numeralColumn }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in digitRows" :key="row.left.value">
            <td>{{ row.left.value }}</td>
            <td>{{ row.left.numeral }}</td>
            <td>{{ row.right.value }}</td>
            <td>{{ row.right.numeral }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
