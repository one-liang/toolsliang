<script setup lang="ts">
import { computed } from 'vue'
import { getBmiDemo } from '@/features/landing/demos'
import type { LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode }>()
const bmi = computed(() => getBmiDemo(props.locale))
const text = computed(() => props.locale === 'en'
  ? {
      standard: 'Taiwan’s adult categories (Health Promotion Administration)',
      scale: `The four adult BMI categories, with ${bmi.value.display} marked in ${bmi.value.categoryName}`,
    }
  : {
      standard: '國民健康署成人健康體位標準',
      scale: `成人 BMI 四個分級，標出 ${bmi.value.display} 落在「${bmi.value.categoryName}」`,
    })
</script>

<template>
  <div class="nb-bmi" data-demo="bmi">
    <p class="nb-bmi__standard">{{ text.standard }}</p>
    <div class="nb-bmi__scale" role="img" :aria-label="text.scale">
      <div class="nb-bmi__bar">
        <span
          v-for="band in bmi.bands"
          :key="band.id"
          :class="['nb-bmi__band', `nb-bmi__band--${band.id}`]"
          :style="{ width: `${(band.to - band.from) * 100}%` }"
        />
      </div>
      <span class="nb-bmi__marker" :style="{ '--pos': bmi.position }" data-bmi-marker>
        <span class="nb-bmi__pin">{{ bmi.display }}</span>
      </span>
    </div>
    <ul class="nb-bmi__legend">
      <li v-for="band in bmi.bands" :key="band.id" :class="{ 'is-current': band.current }">
        <span :class="['nb-bmi__swatch', `nb-bmi__band--${band.id}`]" aria-hidden="true" />
        <span class="nb-bmi__name">{{ band.name }}</span>
        <span class="nb-bmi__range">{{ band.range }}</span>
      </li>
    </ul>
  </div>
</template>
