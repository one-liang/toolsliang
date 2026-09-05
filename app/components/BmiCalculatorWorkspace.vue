<script setup lang="ts">
import { RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  bmiCategoryRangeText,
  bmiFieldErrorMessage,
  getBmiCaveats,
  getBmiCopy,
} from '@/features/tools/bmi-calculator/content'
import {
  bmiFieldsByUnitSystem,
  convertBmiValues,
  evaluateBmi,
  type BmiFieldId,
  type BmiMeasure,
  type BmiUnitSystem,
} from '@/features/tools/bmi-calculator/domain/calculate'
import { bmiCategories } from '@/features/tools/bmi-calculator/domain/reference'
import { bmiContentReview } from '@/features/tools/bmi-calculator/domain/sources'
import { formatReviewDate } from '@/features/tools/catalog'

const { locale } = useAppLocale()
const text = computed(() => getBmiCopy(locale.value))
const caveats = computed(() => getBmiCaveats(locale.value))
const categoryRows = computed(() => bmiCategories.map(category => ({
  id: category.id,
  name: category.name[locale.value],
  range: bmiCategoryRangeText(category),
})))
/** The standard the categories come from, cited where the result is read. */
const primarySource = bmiContentReview.sources[0]!

const unitSystem = ref<BmiUnitSystem>('metric')
const values = ref<Record<BmiFieldId, string>>({
  'height-centimetres': '',
  'weight-kilograms': '',
  'height-feet': '',
  'height-inches': '',
  'weight-pounds': '',
})

/**
 * One entry per measurement, so the two unit systems describe themselves from
 * the same shape instead of repeating a field block each. Feet and inches are
 * one measurement in two boxes: they share a hint and a message.
 */
const measurementGroups = computed(() => unitSystem.value === 'metric'
  ? [
      {
        measure: 'height' as const,
        hint: text.value.heightCentimetresHint,
        fields: [{ id: 'height-centimetres' as const, label: text.value.heightCentimetresLabel, inputmode: 'decimal', placeholder: '170' }],
      },
      {
        measure: 'weight' as const,
        hint: text.value.weightKilogramsHint,
        fields: [{ id: 'weight-kilograms' as const, label: text.value.weightKilogramsLabel, inputmode: 'decimal', placeholder: '65' }],
      },
    ]
  : [
      {
        measure: 'height' as const,
        hint: text.value.heightImperialHint,
        fields: [
          { id: 'height-feet' as const, label: text.value.heightFeetLabel, inputmode: 'numeric', placeholder: '5' },
          { id: 'height-inches' as const, label: text.value.heightInchesLabel, inputmode: 'decimal', placeholder: '9' },
        ],
      },
      {
        measure: 'weight' as const,
        hint: text.value.weightPoundsHint,
        fields: [{ id: 'weight-pounds' as const, label: text.value.weightPoundsLabel, inputmode: 'decimal', placeholder: '160' }],
      },
    ])

const evaluation = computed(() => evaluateBmi({ unitSystem: unitSystem.value, values: values.value }))
const errors = computed(() => evaluation.value.state === 'invalid' ? evaluation.value.errors : [])
const result = computed(() => evaluation.value.state === 'ready' ? evaluation.value : undefined)

/**
 * A blank field is not a mistake, so it never becomes an alert: the measurement
 * says calmly that it is still waiting, while a value that cannot be used is
 * reported as an error on the measurement that has to change.
 */
function pendingMessage(measure: BmiMeasure) {
  const pending = errors.value.find(error => error.measure === measure && error.code === 'missing')
  return pending && bmiFieldErrorMessage(pending, locale.value)
}

function errorFor(measure: BmiMeasure) {
  const error = errors.value.find(item => item.measure === measure && item.code !== 'missing')
  return error && { field: error.field, message: bmiFieldErrorMessage(error, locale.value) }
}

function describedBy(measure: BmiMeasure) {
  return [
    `bmi-${measure}-help`,
    pendingMessage(measure) ? `bmi-${measure}-pending` : '',
    errorFor(measure) ? `bmi-${measure}-error` : '',
  ].filter(Boolean).join(' ')
}

function ariaInvalid(field: BmiFieldId, measure: BmiMeasure) {
  return errorFor(measure)?.field === field
}

/** Switching units keeps the measurement rather than emptying the form. */
function selectUnitSystem(next: BmiUnitSystem) {
  if (next === unitSystem.value) return
  values.value = { ...values.value, ...convertBmiValues(unitSystem.value, next, values.value) }
  unitSystem.value = next
}

// A waiting application update must ask before it discards measurements in progress.
useWorkspaceDirty('bmi-calculator', computed(() =>
  bmiFieldsByUnitSystem[unitSystem.value].some(field => values.value[field].trim())))

function reset() {
  for (const field of Object.keys(values.value) as BmiFieldId[]) values.value[field] = ''
}
</script>

<template>
  <Card class="tool-workspace bmi-workspace" :aria-busy="false">
    <fieldset class="bmi-units">
      <legend>{{ text.unitLegend }}</legend>
      <label v-for="option in (['metric', 'imperial'] as const)" :key="option" class="bmi-units__option">
        <input
          type="radio"
          name="bmi-unit-system"
          :value="option"
          :checked="unitSystem === option"
          @change="selectUnitSystem(option)"
        >
        <span>{{ option === 'metric' ? text.unitMetric : text.unitImperial }}</span>
      </label>
    </fieldset>

    <div class="tool-workspace__grid">
      <div class="bmi-fields">
        <div v-for="group in measurementGroups" :key="group.measure" class="field-group">
          <div :class="{ 'bmi-fields__pair': group.fields.length > 1 }">
            <div v-for="field in group.fields" :key="field.id">
              <label :for="`bmi-${field.id}`">{{ field.label }}</label>
              <Input
                :id="`bmi-${field.id}`"
                v-model="values[field.id]"
                :inputmode="field.inputmode"
                autocomplete="off"
                :aria-describedby="describedBy(group.measure)"
                :aria-invalid="ariaInvalid(field.id, group.measure)"
                :placeholder="field.placeholder"
              />
            </div>
          </div>
          <p :id="`bmi-${group.measure}-help`" class="field-help">{{ group.hint }}</p>
          <p v-if="pendingMessage(group.measure)" :id="`bmi-${group.measure}-pending`" class="field-pending">
            {{ pendingMessage(group.measure) }}
          </p>
          <p v-if="errorFor(group.measure)" :id="`bmi-${group.measure}-error`" class="field-error" role="alert">
            {{ errorFor(group.measure)!.message }}
          </p>
        </div>
      </div>

      <div class="result-panel bmi-result" aria-live="polite">
        <span class="result-panel__label">{{ text.resultLabel }}</span>
        <template v-if="result">
          <strong class="bmi-result__value">{{ result.display }}</strong>
          <span class="bmi-result__category">
            {{ text.resultCategoryLabel }}：{{ result.category.name[locale] }}（{{ bmiCategoryRangeText(result.category) }}）
          </span>
          <span class="result-panel__amount">{{ text.resultSummary }}</span>
        </template>
        <span v-else class="bmi-result__pending">{{ text.resultEmpty }}</span>
      </div>
    </div>

    <div class="tool-workspace__actions">
      <Button variant="outline" class="bmi-reset" @click="reset">
        <RotateCcw :size="18" aria-hidden="true" />
        {{ text.resetLabel }}
      </Button>
    </div>

    <section class="bmi-caveats" :aria-label="text.caveatsTitle">
      <h2 class="bmi-caveats__title">{{ text.caveatsTitle }}</h2>
      <ul>
        <li v-for="caveat in caveats" :key="caveat.key">{{ caveat.text }}</li>
      </ul>
      <p class="bmi-source">
        {{ text.sourceLabel }}：<a :href="primarySource.url" target="_blank" rel="noopener noreferrer">{{ primarySource.title[locale] }}</a>
        （{{ text.sourceUpdatedLabel }}
        <time :datetime="bmiContentReview.sourceEffectiveAt">{{ formatReviewDate(bmiContentReview.sourceEffectiveAt, locale) }}</time>）
      </p>
    </section>
  </Card>

  <section class="tool-reference" aria-labelledby="bmi-category-reference">
    <div class="tool-section-heading">
      <p class="eyebrow">{{ text.formulaTitle }}</p>
      <h2 id="bmi-category-reference">{{ text.categoryTableTitle }}</h2>
      <p><code class="bmi-formula">{{ text.formula }}</code></p>
      <p>{{ text.formulaNote }}</p>
    </div>

    <div class="tool-reference__table bmi-category-table__scroll">
      <table class="bmi-category-table">
        <caption class="sr-only">{{ text.categoryTableCaption }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ text.categoryColumn }}</th>
            <th scope="col">{{ text.rangeColumn }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in categoryRows" :key="row.id">
            <td>{{ row.name }}</td>
            <td>{{ row.range }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
