<script setup lang="ts">
import { computed } from 'vue'
import BmiResult from '@/components/BmiResult.vue'
import { bmiDemoInput, getBmiDemo } from '@/features/landing/demos'
import { getBmiCopy } from '@/features/tools/bmi-calculator/content'
import type { LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode }>()
const bmi = computed(() => getBmiDemo(props.locale))
const text = computed(() => getBmiCopy(props.locale))
</script>

<template>
  <!-- The calculator's own result panel (#92), for the measurements written above it with the calculator's field names. -->
  <div class="nb-bmi" data-demo="bmi">
    <dl class="nb-bmi__input">
      <div>
        <dt>{{ text.heightCentimetresLabel }}</dt>
        <dd>{{ bmiDemoInput.heightCentimetres }}</dd>
      </div>
      <div>
        <dt>{{ text.weightKilogramsLabel }}</dt>
        <dd>{{ bmiDemoInput.weightKilograms }}</dd>
      </div>
    </dl>
    <BmiResult :result="bmi.result" :locale="locale" />
  </div>
</template>
