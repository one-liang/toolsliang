<script setup lang="ts">
import { Minimize } from '@lucide/vue'
import {
  DialogContent, DialogDescription, DialogOverlay,
  DialogPortal, DialogTitle, injectDialogRootContext,
} from 'reka-ui'
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { Button } from '@/components/ui/button'
import type { LocaleCode } from '@/features/tools/catalog'
import type { DeviceTimePart } from '@/features/tools/device-time/domain/format'

/**
 * The same reading as the workspace, as large as the screen allows. The dialog is
 * always a fixed layer over the page; where the browser offers the Fullscreen API
 * the layer is also lifted into real full screen. iPhone Safari has no element
 * full screen, so there the layer alone fills the viewport.
 */
const props = defineProps<{
  locale: LocaleCode
  date: string
  timeParts: DeviceTimePart[]
  datetime: string
  zone: string
}>()

const dialog = injectDialogRootContext()
let presented: HTMLElement | undefined
let wakeLock: WakeLockSentinel | undefined

/** Font size is the width in em of the widest line: monospace digits plus the 上午／PM marker. */
const clockWidth = computed(() => props.timeParts.reduce((width, part) =>
  width + (part.type === 'clock' ? part.value.length * 0.62 : part.type === 'dayPeriod' ? 0.9 : 0), 0))

function present(event: Event) {
  const element = event.target as HTMLElement
  void keepScreenAwake()
  if (!document.fullscreenEnabled || typeof element.requestFullscreen !== 'function') return
  presented = element
  element.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
    if (presented === element) presented = undefined
  })
}

/**
 * Leave real full screen before the layer closes. While an element is full screen the
 * browser keeps the rest of the page unfocusable, so focus could not return to the
 * button if the layer closed first.
 */
async function close() {
  const element = presented
  presented = undefined
  if (element && document.fullscreenElement === element) await document.exitFullscreen().catch(() => {})
  dialog.onOpenChange(false)
}

function onEscapeKeyDown(event: KeyboardEvent) {
  event.preventDefault()
  void close()
}

/** However the layer went away: no full screen or wake lock outlives it. */
function dismiss() {
  const element = presented
  presented = undefined
  if (element && document.fullscreenElement === element) document.exitFullscreen().catch(() => {})
  void wakeLock?.release().catch(() => {})
  wakeLock = undefined
}

/** A browser may take Esc itself to leave real full screen; leaving it by any route closes the layer too. */
function onFullscreenChange() {
  if (presented && document.fullscreenElement !== presented) {
    presented = undefined
    dialog.onOpenChange(false)
  }
}

/** Optional: a wall clock should not dim. Unsupported or refused requests change nothing. */
async function keepScreenAwake() {
  if (!dialog.open.value || wakeLock || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
  try {
    const sentinel = await navigator.wakeLock.request('screen')
    if (dialog.open.value) {
      wakeLock = sentinel
      sentinel.addEventListener('release', () => { if (wakeLock === sentinel) wakeLock = undefined })
    }
    else void sentinel.release().catch(() => {})
  }
  catch { /* The page stays usable without a wake lock. */ }
}

watch(dialog.open, (open) => { if (!open) dismiss() })
onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('visibilitychange', keepScreenAwake)
})
onBeforeUnmount(() => {
  dismiss()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('visibilitychange', keepScreenAwake)
})
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="device-time-fullscreen__overlay" />
    <DialogContent data-device-clock-fullscreen class="device-time-fullscreen" @open-auto-focus="present" @escape-key-down="onEscapeKeyDown">
      <header class="device-time-fullscreen__header">
        <div class="device-time-fullscreen__label">
          <DialogTitle class="device-time-fullscreen__title">{{ locale === 'en' ? 'Device time' : '裝置時間' }}</DialogTitle>
          <DialogDescription class="device-time-fullscreen__note">
            {{ locale === 'en' ? 'Follows your device settings. Not network-corrected time.' : '依據你的裝置設定顯示，未經網路校時。' }}
          </DialogDescription>
        </div>
        <Button variant="outline" data-fullscreen-exit @click="close">
          <Minimize :size="18" aria-hidden="true" />
          {{ locale === 'en' ? 'Exit full screen' : '離開全螢幕' }}
        </Button>
      </header>
      <div class="device-time-fullscreen__reading" aria-live="off">
        <p class="device-time-fullscreen__date">{{ date }}</p>
        <time class="device-time-fullscreen__time" :datetime="datetime" :style="{ '--clock-width': clockWidth }">
          <span v-for="(part, index) in timeParts" :key="index" :class="{ 'device-time-fullscreen__period': part.type !== 'clock' }">{{ part.value }}</span>
        </time>
        <p class="device-time-fullscreen__zone">{{ zone }}</p>
      </div>
    </DialogContent>
  </DialogPortal>
</template>

<style scoped>
.device-time-fullscreen__overlay { position: fixed; z-index: 70; inset: 0; background: var(--color-background); }
.device-time-fullscreen {
  position: fixed;
  z-index: 71;
  inset: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  overflow: hidden;
  background: var(--color-background);
  color: var(--color-foreground);
  container-type: size;
}
.device-time-fullscreen:focus { outline: none; }
.device-time-fullscreen__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px 16px; }
.device-time-fullscreen__label { min-width: 0; }
.device-time-fullscreen__title { margin: 0; font-size: 1rem; font-weight: 800; line-height: 1.3; }
.device-time-fullscreen__note { margin: 2px 0 0; color: var(--color-muted-foreground); font-size: .8rem; line-height: 1.4; }
.device-time-fullscreen__header > .ui-button { flex: none; }
.device-time-fullscreen__reading {
  min-height: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: min(3cqh, 24px);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.device-time-fullscreen__date, .device-time-fullscreen__zone {
  max-width: 100%;
  margin: 0;
  font-size: clamp(1rem, min(4.5cqw, 7cqh), 3rem);
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.device-time-fullscreen__zone { color: var(--color-muted-foreground); }
/* Width-bound by the widest line, height-bound so date and zone keep their rows. */
.device-time-fullscreen__time {
  display: block;
  font-family: var(--font-mono);
  font-size: min(calc(92vw / var(--clock-width)), 34vh);
  font-size: min(calc(96cqw / var(--clock-width)), 48cqh);
  font-weight: var(--device-clock-font-weight);
  line-height: 1;
  white-space: nowrap;
}
.device-time-fullscreen__period { font-family: var(--font-zh); font-size: .3em; }
.device-time-fullscreen__period:first-child { margin-inline-end: .4em; }
</style>
