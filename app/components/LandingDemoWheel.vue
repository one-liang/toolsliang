<script setup lang="ts">
import { computed } from 'vue'
import { pickerDemoNames, pickerDemoWinnerIndex, wheelLabelPlacements } from '@/features/landing/demos'
import type { LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode }>()

const RADIUS = 100
const LABEL_RADIUS = 68
const FILLS = ['#fff', '#ff9ed8', '#86bbff', '#63dca8', '#ff7f5c', '#fff']

const names = computed(() => pickerDemoNames[props.locale])
const placement = computed(() => wheelLabelPlacements(names.value.length, pickerDemoWinnerIndex, LABEL_RADIUS))

const segments = computed(() => names.value.map((name, index) => {
  const label = placement.value.labels[index]!
  const point = (angle: number) => {
    const radians = angle * Math.PI / 180
    return `${(RADIUS * Math.cos(radians)).toFixed(2)} ${(RADIUS * Math.sin(radians)).toFixed(2)}`
  }
  return {
    name,
    fill: FILLS[index % FILLS.length],
    path: `M0 0 L ${point(label.start)} A ${RADIUS} ${RADIUS} 0 0 1 ${point(label.end)} Z`,
    label: label.transform,
  }
}))

const winner = computed(() => names.value[pickerDemoWinnerIndex]!)
const text = computed(() => props.locale === 'en'
  ? { art: `Illustration: a wheel of ${names.value.length} names stopping on ${winner.value}`, result: `Drawn: ${winner.value}` }
  : { art: `示意圖：${names.value.length} 個名字的輪盤停在${winner.value}`, result: `抽中：${winner.value}` })
</script>

<template>
  <div class="nb-wheel" data-demo="wheel">
    <svg class="nb-wheel__art" viewBox="-124 -124 248 248" role="img" :aria-label="text.art">
      <g data-wheel :transform="`rotate(${placement.restingRotation})`">
        <g v-for="segment in segments" :key="segment.name">
          <path :d="segment.path" :fill="segment.fill" stroke="#0b0b0b" stroke-width="2.5" stroke-linejoin="round" />
          <text :transform="segment.label" text-anchor="middle" dominant-baseline="central" fill="#0b0b0b" font-size="15" font-weight="800">{{ segment.name }}</text>
        </g>
      </g>
      <circle r="17" fill="#0b0b0b" />
      <circle r="6" fill="#ffd23f" />
      <path d="M-12 -121 H 12 L 0 -97 Z" fill="#0b0b0b" stroke="#0b0b0b" stroke-width="2" stroke-linejoin="round" />
    </svg>
    <p class="nb-wheel__result" data-wheel-result>{{ text.result }}</p>
  </div>
</template>
