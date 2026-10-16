<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import DeviceTimeReading from '@/components/DeviceTimeReading.vue'
import { getDeviceStorage } from '@/features/shell/device-storage'
import type { LocaleCode } from '@/features/tools/catalog'
import { formatDeviceTime } from '@/features/tools/device-time/domain/format'
import { defaultHourCycle, readStoredHourCycle, type HourCycle } from '@/features/tools/device-time/domain/hour-cycle'

const props = defineProps<{ locale: LocaleCode }>()

/**
 * The tool's own reading (#92), in the 12- or 24-hour clock the tool would open
 * with on this device. The clock reads the device only after mounting: the
 * prerendered page has no device, so it carries dashes instead of the build
 * machine's time.
 */
const now = ref<number>()
const storedHourCycle = ref<HourCycle | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  storedHourCycle.value = readStoredHourCycle(getDeviceStorage())
  now.value = Date.now()
  timer = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))

const reading = computed(() => {
  if (now.value === undefined) return null
  let timeZone: string | undefined
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone }
  catch { /* The formatter can still show a basic local clock. */ }
  const result = formatDeviceTime({
    instant: now.value,
    locale: props.locale,
    timeZone,
    offsetMinutes: -new Date(now.value).getTimezoneOffset(),
    showSeconds: true,
    hourCycle: storedHourCycle.value ?? defaultHourCycle(props.locale),
  })
  return result.ok ? result : null
})
</script>

<template>
  <div class="ui-card nb-snap nb-clock" data-demo="clock">
    <DeviceTimeReading :reading="reading" :locale="locale" />
  </div>
</template>
