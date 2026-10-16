<script setup lang="ts">
import { useOnline } from '@vueuse/core'
import { computed } from 'vue'
import { describeOfflineReadiness, resolveOfflineReadiness } from '@/features/pwa/offline-assets'
import type { LocaleCode, PublishedToolDefinition } from '@/features/tools/catalog'

const props = defineProps<{
  tool: Pick<PublishedToolDefinition, 'offlineMode' | 'offlineAssets'>
  locale: LocaleCode
}>()

const online = useOnline()
/**
 * Only read here, never fetched: the workspace gets these files ready when a
 * visitor starts working, and this note just reports whether they are on the
 * device. Reading the shared entries keeps both answers in step.
 */
const assets = (props.tool.offlineAssets ?? []).map(asset => useOfflineAsset(asset))
const readiness = computed(() => resolveOfflineReadiness(props.tool, {
  cachedAssetKeys: assets.map(asset => asset.cachedKey.value).filter((key): key is string => Boolean(key)),
  online: online.value,
}))
</script>

<template>
  <div class="tool-offline" :data-tool-offline="readiness">
    <p class="tool-offline__summary">{{ describeOfflineReadiness(readiness, locale) }}</p>
  </div>
</template>
