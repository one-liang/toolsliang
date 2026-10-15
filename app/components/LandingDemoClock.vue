<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatDeviceTime } from '@/features/tools/device-time/domain/format'
import type { LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode }>()

/**
 * The clock reads the device only after mounting: the prerendered page has no
 * device, so it carries a placeholder of the same width instead of the build
 * machine's time.
 */
const now = ref<number>()
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  now.value = Date.now()
  timer = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))

const reading = computed(() => {
  if (now.value === undefined) return null
  const result = formatDeviceTime({
    instant: now.value,
    locale: props.locale,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    offsetMinutes: -new Date(now.value).getTimezoneOffset(),
    showSeconds: true,
  })
  return result.ok ? result : null
})

const label = computed(() => props.locale === 'en' ? 'This device, right now' : '這台裝置現在的時間')
</script>

<template>
  <div class="nb-clock" data-demo="clock">
    <p class="nb-clock__label">{{ label }}</p>
    <time class="nb-clock__time" :datetime="reading?.datetime">{{ reading?.time ?? '--:--:--' }}</time>
    <p class="nb-clock__meta">
      <span>{{ reading?.date ?? '—' }}</span><br>
      <span>{{ reading ? [reading.timeZone, reading.offset].filter(Boolean).join(' · ') : '—' }}</span>
    </p>
  </div>
</template>
