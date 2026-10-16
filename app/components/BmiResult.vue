<script setup lang="ts">
import { computed } from 'vue'
import { bmiCategoryRangeText, getBmiCopy } from '@/features/tools/bmi-calculator/content'
import type { BmiEvaluation } from '@/features/tools/bmi-calculator/domain/calculate'
import type { LocaleCode } from '@/features/tools/catalog'

/** The result panel, shared by the calculator and its landing demo (#92) so both read the same. */
const props = defineProps<{ result?: Extract<BmiEvaluation, { state: 'ready' }>, locale: LocaleCode }>()
const text = computed(() => getBmiCopy(props.locale))
</script>

<template>
  <div class="result-panel bmi-result">
    <span class="result-panel__label">{{ text.resultLabel }}</span>
    <template v-if="result">
      <strong class="bmi-result__value">{{ result.display }}</strong>
      <span class="bmi-result__category">
        {{ locale === 'en'
          ? `${text.resultCategoryLabel}: ${result.category.name.en} (${bmiCategoryRangeText(result.category)})`
          : `${text.resultCategoryLabel}：${result.category.name['zh-tw']}（${bmiCategoryRangeText(result.category)}）` }}
      </span>
      <span class="result-panel__amount">{{ text.resultSummary }}</span>
    </template>
    <span v-else class="bmi-result__pending">{{ text.resultEmpty }}</span>
  </div>
</template>
