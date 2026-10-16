<script setup lang="ts">
import { computed } from 'vue'
import RandomPickerWheel from '@/components/RandomPickerWheel.vue'
import { getPickerDemo } from '@/features/landing/demos'
import type { LocaleCode } from '@/features/tools/catalog'
import { getRandomPickerCopy } from '@/features/tools/random-picker/content'

const props = defineProps<{ locale: LocaleCode }>()

const demo = computed(() => getPickerDemo(props.locale))
const resultLabel = computed(() => getRandomPickerCopy(props.locale).resultLabel)
const art = computed(() => props.locale === 'en'
  ? `Illustration: a wheel of ${demo.value.slices.length} names stopping on ${demo.value.winner}`
  : `示意圖：${demo.value.slices.length} 個名字的輪盤停在${demo.value.winner}`)
</script>

<template>
  <!-- The picker's own result stage (#106, #92): its wheel at rest where the picker would stop it, then the name it drew. -->
  <div class="nb-wheel" data-demo="wheel">
    <p class="picker-stage__title">{{ resultLabel }}</p>
    <RandomPickerWheel
      class="nb-wheel__art"
      :slices="demo.slices"
      :rotation="demo.rotation"
      :won-index="demo.winnerIndex"
      :label="art"
    />
    <p class="picker-result__item" data-wheel-result>{{ demo.winner }}</p>
  </div>
</template>
