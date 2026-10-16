<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Check, Clipboard, LoaderCircle, Maximize, TriangleAlert } from '@lucide/vue'
import { DialogRoot, DialogTrigger } from 'reka-ui'
import DeviceTimeFullscreen from '@/components/DeviceTimeFullscreen.vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getDeviceStorage } from '@/features/shell/device-storage'
import { formatDeviceTime } from '@/features/tools/device-time/domain/format'
import { defaultHourCycle, persistHourCycle, readStoredHourCycle, type HourCycle } from '@/features/tools/device-time/domain/hour-cycle'

const { locale } = useAppLocale()
const reading = shallowRef<ReturnType<typeof formatDeviceTime>>()
const showSeconds = ref(true)
/** The device decides the default, so nothing is chosen until it has mounted. */
const deviceReady = ref(false)
const storedHourCycle = ref<HourCycle | null>(null)
const hourCycle = computed(() => deviceReady.value ? storedHourCycle.value ?? defaultHourCycle(locale.value) : undefined)
const fullscreen = ref(false)
const copyState = ref<'idle' | 'copying' | 'copied' | 'failed'>('idle')
const message = computed(() => {
  if (copyState.value === 'copying') return locale.value === 'en' ? 'Copying time information…' : '正在複製時間資訊…'
  if (copyState.value === 'copied') return locale.value === 'en' ? 'Time information copied.' : '已複製時間資訊。'
  if (copyState.value === 'failed') return locale.value === 'en' ? 'Could not copy. Allow clipboard access and try again, or select the time information to copy manually.' : '無法複製。請允許剪貼簿存取後重試，或選取時間資訊手動複製。'
  return ''
})
let timer: ReturnType<typeof setTimeout> | undefined
let disposed = false

function selectHourCycle(value: HourCycle) {
  storedHourCycle.value = value
  persistHourCycle(getDeviceStorage(), value)
}

async function copyTime() {
  if (!reading.value?.ok || copyState.value === 'copying') return
  const snapshot = reading.value
  copyState.value = 'copying'
  await nextTick()
  try {
    await navigator.clipboard.writeText([
      snapshot.date, snapshot.time,
      `${snapshot.timeZone ?? (locale.value === 'en' ? 'Time zone unavailable' : '無法取得時區名稱')} · ${snapshot.offset}`,
      locale.value === 'en' ? 'Device time; not network-corrected.' : '裝置時間；未經網路校時。',
    ].join('\n'))
    if (!disposed) copyState.value = 'copied'
  }
  catch {
    if (!disposed) copyState.value = 'failed'
  }
}

function update() {
  clearTimeout(timer)
  if (document.visibilityState === 'hidden') return
  const now = new Date()
  let timeZone: string | undefined
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone }
  catch { /* The formatter can still show a basic local clock. */ }
  reading.value = formatDeviceTime({ instant: now.getTime(), locale: locale.value, timeZone, offsetMinutes: -now.getTimezoneOffset(), showSeconds: showSeconds.value, hourCycle: hourCycle.value })
  const period = showSeconds.value ? 1000 : 60_000
  timer = setTimeout(update, period - ((Date.now() % period + period) % period))
}

watch([showSeconds, locale, hourCycle], update)
onMounted(() => {
  storedHourCycle.value = readStoredHourCycle(getDeviceStorage())
  deviceReady.value = true
  update()
  document.addEventListener('visibilitychange', update)
})
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(timer)
  document.removeEventListener('visibilitychange', update)
})
</script>

<template>
  <Card class="tool-workspace device-time">
    <div v-if="reading?.ok" data-device-clock class="device-time__reading" aria-live="off">
      <p class="device-time__date">{{ reading.date }}</p>
      <time class="device-time__clock" :datetime="reading.datetime">
        <span v-for="(part, index) in reading.timeParts" :key="index" :class="{ 'device-time__period': part.type !== 'clock' }">{{ part.value }}</span>
      </time>
      <dl class="device-time__zone">
        <div>
          <dt>{{ locale === 'en' ? 'Time zone' : '時區' }}</dt>
          <dd>{{ reading.timeZone ?? (locale === 'en' ? 'Time zone unavailable' : '無法取得時區名稱') }}</dd>
        </div>
        <div>
          <dt>{{ locale === 'en' ? 'UTC offset' : 'UTC 時差' }}</dt>
          <dd>{{ reading.offset }}</dd>
        </div>
      </dl>
    </div>
    <p class="field-help">{{ locale === 'en' ? 'Follows your device settings. Not network-corrected time.' : '依據你的裝置設定顯示，未經網路校時。' }}</p>
    <p v-if="reading?.ok && reading.reduced" data-clock-capability class="field-help">
      {{ locale === 'en' ? 'Full time zone formatting is unavailable. Showing basic local time and UTC offset from this device.' : '瀏覽器無法提供完整時區格式，目前顯示基本本機時間與此裝置的 UTC 時差。' }}
    </p>
    <p v-if="reading && !reading.ok" role="alert" class="field-error">
      {{ locale === 'en' ? 'Could not read the device clock. Check your device settings and reload.' : '無法讀取裝置時鐘。請檢查裝置設定後重新載入。' }}
    </p>
    <fieldset class="device-time__hour-cycle">
      <legend>{{ locale === 'en' ? 'Time format' : '時間格式' }}</legend>
      <div class="choice-group">
        <label v-for="option in (['h12', 'h23'] as const)" :key="option" class="choice-option">
          <input type="radio" name="device-time-hour-cycle" :value="option" :checked="hourCycle === option" :data-hour-cycle="option" @change="selectHourCycle(option)">
          <span>{{ option === 'h12' ? (locale === 'en' ? '12-hour' : '12 小時制') : (locale === 'en' ? '24-hour' : '24 小時制') }}</span>
        </label>
      </div>
    </fieldset>
    <DialogRoot v-model:open="fullscreen">
      <!-- #91: the primary action leads, as in the other tools, so it stays on a phone's first screen when the row wraps. -->
      <div class="tool-workspace__actions">
        <Button data-copy-time class="tool-workspace__copy" :disabled="!reading?.ok" :aria-disabled="copyState === 'copying'" :aria-busy="copyState === 'copying'" @click="copyTime">
          <Clipboard :size="18" aria-hidden="true" />
          {{ locale === 'en' ? 'Copy time information' : '複製時間資訊' }}
        </Button>
        <DialogTrigger as-child>
          <Button variant="outline" data-fullscreen-open :disabled="!reading?.ok">
            <Maximize :size="18" aria-hidden="true" />
            {{ locale === 'en' ? 'Full screen' : '全螢幕顯示' }}
          </Button>
        </DialogTrigger>
        <Button variant="outline" data-seconds-toggle :aria-pressed="showSeconds" @click="showSeconds = !showSeconds">
          {{ locale === 'en' ? 'Show seconds' : '顯示秒數' }}
          <span aria-hidden="true">{{ showSeconds ? (locale === 'en' ? 'On' : '開') : (locale === 'en' ? 'Off' : '關') }}</span>
        </Button>
      </div>
      <DeviceTimeFullscreen
        v-if="reading?.ok"
        :locale="locale"
        :date="reading.date"
        :time-parts="reading.timeParts"
        :datetime="reading.datetime"
        :zone="`${reading.timeZone ?? (locale === 'en' ? 'Time zone unavailable' : '無法取得時區名稱')} · ${reading.offset}`"
      />
    </DialogRoot>
    <p role="status" class="device-time__status" :class="{ 'device-time__status--visible': message, 'device-time__status--success': copyState === 'copied', 'device-time__status--error': copyState === 'failed' }">
      <LoaderCircle v-if="copyState === 'copying'" :size="18" aria-hidden="true" />
      <Check v-else-if="copyState === 'copied'" :size="18" aria-hidden="true" />
      <TriangleAlert v-else-if="copyState === 'failed'" :size="18" aria-hidden="true" />
      <span>{{ message }}</span>
    </p>
  </Card>
</template>

<style scoped>
.device-time__reading { font-variant-numeric: tabular-nums; }
.device-time__date { margin-bottom: 8px; font-size: 1.125rem; }
.device-time__clock { display: block; color: var(--color-foreground); font-family: var(--font-mono); font-size: var(--device-clock-font-size); font-weight: var(--device-clock-font-weight); line-height: var(--device-clock-line-height); }
.device-time__period { font-family: var(--font-zh); font-size: .4em; }
.device-time__period:first-child { margin-inline-end: .3em; }
.device-time__zone { display: flex; flex-wrap: wrap; gap: 16px 32px; margin: 24px 0; }
.device-time__zone dt { color: var(--color-muted-foreground); font-size: .875rem; }
.device-time__zone dd { margin: 4px 0 0; overflow-wrap: anywhere; }
.device-time__zone > div { min-width: 0; }
.device-time__hour-cycle { min-width: 0; margin: 20px 0 0; padding: 0; border: 0; }
.device-time__hour-cycle legend { margin-bottom: 8px; padding: 0; font-size: .86rem; font-weight: 700; }
.device-time__status { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: .875rem; }
.device-time__status--visible { margin-top: 16px; padding: 12px 16px; border: 1px solid var(--color-muted-foreground); border-radius: var(--radius-sm); }
.device-time__status--success { color: var(--color-success); background: var(--color-success-surface); border-color: var(--color-success); }
.device-time__status--error { color: var(--color-destructive); background: var(--color-destructive-surface); border-color: var(--color-destructive); }
</style>
