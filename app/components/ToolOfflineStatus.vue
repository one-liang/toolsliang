<script setup lang="ts">
import { useOnline } from '@vueuse/core'
import { computed, ref } from 'vue'
import { describeOfflineReadiness, resolveOfflineReadiness } from '@/features/pwa/offline-assets'
import type { LocaleCode, PublishedToolDefinition } from '@/features/tools/catalog'

const props = defineProps<{
  tool: Pick<PublishedToolDefinition, 'offlineMode' | 'offlineAssets'>
  locale: LocaleCode
}>()

const online = useOnline()
const cachedAssetIds = ref<Record<string, string>>({})
const assets = computed(() => props.tool.offlineAssets ?? [])
const readiness = computed(() => resolveOfflineReadiness(props.tool, {
  cachedAssetIds: Object.values(cachedAssetIds.value),
  online: online.value,
}))

function recordCached(assetId: string, key: string | null) {
  cachedAssetIds.value = Object.fromEntries(
    Object.entries({ ...cachedAssetIds.value, [assetId]: key })
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  )
}
</script>

<template>
  <div class="tool-offline" :data-tool-offline="readiness">
    <p class="tool-offline__summary">{{ describeOfflineReadiness(readiness, locale) }}</p>
    <OfflineAssetDownload
      v-for="asset in assets"
      :key="asset.id"
      :asset="asset"
      :locale="locale"
      @update:cached="key => recordCached(asset.id, key)"
    />
  </div>
</template>
