<script setup lang="ts">
import type { LocaleCode } from '@/features/tools/catalog'
import type { formatDeviceTime } from '@/features/tools/device-time/domain/format'

export type DeviceTimeReadingValue = Extract<ReturnType<typeof formatDeviceTime>, { ok: true }>

/**
 * The reading itself: date, clock and zone. The tool and the landing demo (#92)
 * both show it through this component, so the two never drift apart. Without a
 * reading yet, the prerendered page holds dashes of the same shape instead of
 * the build machine's time.
 */
defineProps<{ reading: DeviceTimeReadingValue | null, locale: LocaleCode }>()
</script>

<template>
  <div class="device-time__reading">
    <p class="device-time__date">{{ reading?.date ?? '—' }}</p>
    <time class="device-time__clock" :datetime="reading?.datetime">
      <template v-if="reading">
        <span v-for="(part, index) in reading.timeParts" :key="index" :class="{ 'device-time__period': part.type !== 'clock' }">{{ part.value }}</span>
      </template>
      <span v-else>--:--:--</span>
    </time>
    <dl class="device-time__zone">
      <div>
        <dt>{{ locale === 'en' ? 'Time zone' : '時區' }}</dt>
        <dd>{{ reading ? reading.timeZone ?? (locale === 'en' ? 'Time zone unavailable' : '無法取得時區名稱') : '—' }}</dd>
      </div>
      <div>
        <dt>{{ locale === 'en' ? 'UTC offset' : 'UTC 時差' }}</dt>
        <dd>{{ reading?.offset ?? '—' }}</dd>
      </div>
    </dl>
  </div>
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
</style>
