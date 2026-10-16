<script setup lang="ts">
import { computed } from 'vue'
import RandomPickerWheel from '@/components/RandomPickerWheel.vue'
import { getPickerDemo } from '@/features/landing/demos'
import type { LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode }>()

const demo = computed(() => getPickerDemo(props.locale))
const text = computed(() => props.locale === 'en'
  ? { art: `Illustration: a wheel of ${demo.value.slices.length} names stopping on ${demo.value.winner}`, result: `Drawn: ${demo.value.winner}` }
  : { art: `示意圖：${demo.value.slices.length} 個名字的輪盤停在${demo.value.winner}`, result: `抽中：${demo.value.winner}` })
</script>

<template>
  <div class="nb-wheel" data-demo="wheel">
    <!-- The picker's own wheel (#106), at rest where the picker would stop it. -->
    <RandomPickerWheel
      class="nb-wheel__art"
      :slices="demo.slices"
      :rotation="demo.rotation"
      :won-index="demo.winnerIndex"
      :label="text.art"
    />
    <p class="nb-wheel__result" data-wheel-result>{{ text.result }}</p>
  </div>
</template>
