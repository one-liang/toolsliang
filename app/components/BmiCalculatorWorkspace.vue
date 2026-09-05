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
  evaluateBmi,
  type BmiFieldId,
  type BmiMeasure,
  type BmiUnitSystem,
} from '@/features/tools/bmi-calculator/domain/calculate'
import { bmiCategories } from '@/features/tools/bmi-calculator/domain/reference'

const { locale } = useAppLocale()
const text = computed(() => getBmiCopy(locale.value))
const caveats = computed(() => getBmiCaveats(locale.value))
const categoryRows = computed(() => bmiCategories.map(category => ({
  id: category.id,
  name: category.name[locale.value],
  range: bmiCategoryRangeText(category),
})))

const unitSystem = ref<BmiUnitSystem>('metric')
const values = ref<Record<BmiFieldId, string>>({
  'height-centimetres': '',
  'weight-kilograms': '',
  'height-feet': '',
  'height-inches': '',
  'weight-pounds': '',
})

const activeFields = computed(() => bmiFieldsByUnitSystem[unitSystem.value] as readonly BmiFieldId[])
const evaluation = computed(() => evaluateBmi({ unitSystem: unitSystem.value, values: values.value }))
const errors = computed(() => evaluation.value.state === 'invalid' ? evaluation.value.errors : [])
const result = computed(() => evaluation.value.state === 'ready' ? evaluation.value : undefined)

/**
 * A blank field is not a mistake, so it never becomes an alert: the result
 * panel simply names what it is still waiting for, while a value that cannot be
 * used is reported on the measurement that has to change.
 */
const pendingMeasurements = computed(() => errors.value
  .filter(error => error.code === 'missing')
  .map(error => bmiFieldErrorMessage(error, locale.value)))

function measureError(measure: BmiMeasure) {
  const error = errors.value.find(item => item.measure === measure && item.code !== 'missing')
  return error && { field: error.field, message: bmiFieldErrorMessage(error, locale.value) }
}

const heightError = computed(() => measureError('height'))
const weightError = computed(() => measureError('weight'))

function describedBy(field: BmiFieldId, measure: BmiMeasure) {
  const error = measure === 'height' ? heightError.value : weightError.value
  return [`bmi-${field}-help`, error ? `bmi-${measure}-error` : ''].filter(Boolean).join(' ')
}

function isInvalid(field: BmiFieldId, measure: BmiMeasure) {
  const error = measure === 'height' ? heightError.value : weightError.value
  return String(error?.field === field)
}

// A waiting application update must ask before it discards measurements in progress.
useWorkspaceDirty('bmi-calculator', computed(() => activeFields.value.some(field => values.value[field].trim())))

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
          :id="`bmi-unit-${option}`"
          v-model="unitSystem"
          type="radio"
          name="bmi-unit-system"
          :value="option"
        >
        <span>{{ option === 'metric' ? text.unitMetric : text.unitImperial }}</span>
      </label>
    </fieldset>

    <div class="tool-workspace__grid">
      <div class="bmi-fields">
        <template v-if="unitSystem === 'metric'">
          <div class="field-group">
            <label for="bmi-height-centimetres">{{ text.heightCentimetresLabel }}</label>
            <Input
              id="bmi-height-centimetres"
              v-model="values['height-centimetres']"
              inputmode="decimal"
              autocomplete="off"
              :aria-describedby="describedBy('height-centimetres', 'height')"
              :aria-invalid="isInvalid('height-centimetres', 'height')"
              placeholder="170"
            />
            <p id="bmi-height-centimetres-help" class="field-help">{{ text.heightCentimetresHint }}</p>
            <p v-if="heightError" id="bmi-height-error" class="field-error" role="alert">{{ heightError.message }}</p>
          </div>

          <div class="field-group">
            <label for="bmi-weight-kilograms">{{ text.weightKilogramsLabel }}</label>
            <Input
              id="bmi-weight-kilograms"
              v-model="values['weight-kilograms']"
              inputmode="decimal"
              autocomplete="off"
              :aria-describedby="describedBy('weight-kilograms', 'weight')"
              :aria-invalid="isInvalid('weight-kilograms', 'weight')"
              placeholder="65"
            />
            <p id="bmi-weight-kilograms-help" class="field-help">{{ text.weightKilogramsHint }}</p>
            <p v-if="weightError" id="bmi-weight-error" class="field-error" role="alert">{{ weightError.message }}</p>
          </div>
        </template>

        <template v-else>
          <div class="field-group">
            <div class="bmi-fields__pair">
              <div>
                <label for="bmi-height-feet">{{ text.heightFeetLabel }}</label>
                <Input
                  id="bmi-height-feet"
                  v-model="values['height-feet']"
                  inputmode="numeric"
                  autocomplete="off"
                  :aria-describedby="describedBy('height-feet', 'height')"
                  :aria-invalid="isInvalid('height-feet', 'height')"
                  placeholder="5"
                />
              </div>
              <div>
                <label for="bmi-height-inches">{{ text.heightInchesLabel }}</label>
                <Input
                  id="bmi-height-inches"
                  v-model="values['height-inches']"
                  inputmode="decimal"
                  autocomplete="off"
                  :aria-describedby="describedBy('height-inches', 'height')"
                  :aria-invalid="isInvalid('height-inches', 'height')"
                  placeholder="9"
                />
              </div>
            </div>
            <p id="bmi-height-feet-help" class="field-help">{{ text.heightFeetHint }}</p>
            <p id="bmi-height-inches-help" class="sr-only">{{ text.heightFeetHint }}</p>
            <p v-if="heightError" id="bmi-height-error" class="field-error" role="alert">{{ heightError.message }}</p>
          </div>

          <div class="field-group">
            <label for="bmi-weight-pounds">{{ text.weightPoundsLabel }}</label>
            <Input
              id="bmi-weight-pounds"
              v-model="values['weight-pounds']"
              inputmode="decimal"
              autocomplete="off"
              :aria-describedby="describedBy('weight-pounds', 'weight')"
              :aria-invalid="isInvalid('weight-pounds', 'weight')"
              placeholder="160"
            />
            <p id="bmi-weight-pounds-help" class="field-help">{{ text.weightPoundsHint }}</p>
            <p v-if="weightError" id="bmi-weight-error" class="field-error" role="alert">{{ weightError.message }}</p>
          </div>
        </template>
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
        <template v-else>
          <span class="bmi-result__pending">
            {{ pendingMeasurements.length ? pendingMeasurements.join(' ') : text.resultEmpty }}
          </span>
        </template>
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
