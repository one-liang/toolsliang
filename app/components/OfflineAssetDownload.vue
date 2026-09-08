<script setup lang="ts">
import { Download, RotateCcw, X } from '@lucide/vue'
import { useOnline } from '@vueuse/core'
import { computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { formatAssetSize } from '@/features/pwa/offline-assets'
import { copy, type LocaleCode, type ToolOfflineAsset } from '@/features/tools/catalog'

const props = defineProps<{ asset: ToolOfflineAsset, locale: LocaleCode }>()
const emit = defineEmits<{ 'update:cached': [key: string | null] }>()

const { cachedKey, cancel, download, progress, state } = useOfflineAsset(props.asset)
const percent = computed(() => Math.round(progress.value * 100))
/** A blocked attempt leaves its phase behind; reconnecting has to make the button usable again. */
const online = useOnline()

watch(cachedKey, key => emit('update:cached', key), { immediate: true })

const statusText = computed(() => {
  const en = props.locale === 'en'
  // Being offline is the condition, not a phase a past attempt left behind, so
  // it is answered before anything the visitor did earlier.
  if (!online.value && state.value.phase !== 'cached') {
    return en
      ? 'You are offline, so this resource cannot be downloaded yet.'
      : '目前離線，還無法下載這個資源。'
  }
  switch (state.value.phase) {
    case 'cached':
      return en ? 'Downloaded and ready to use offline.' : '已下載，可離線使用。'
    case 'downloading':
      // The percentage lives on the progress bar: a live region must not
      // announce every tick, only that the phase changed.
      return en ? 'Downloading…' : '下載中…'
    case 'failed':
      if (state.value.failureReason === 'digest-mismatch') {
        return en
          ? 'The downloaded file did not match the published fingerprint, so it was discarded. Try again.'
          : '下載到的檔案與公布的指紋不符，已捨棄不使用。請重新下載。'
      }
      return en
        ? 'The download did not finish. Nothing was kept, so you can try again.'
        : '下載未完成，已清除未完成的內容，可以重新嘗試。'
    default:
      return en
        ? 'Not downloaded yet. Downloading is optional and can be cancelled at any time.'
        : '尚未下載。下載為選用，過程中隨時可以取消。'
  }
})
</script>

<template>
  <div class="offline-asset" :data-offline-asset="asset.id" :data-offline-asset-phase="state.phase">
    <div class="offline-asset__copy">
      <strong>{{ copy(asset.label, locale) }}</strong>
      <span class="offline-asset__meta">
        {{ formatAssetSize(asset.bytes, locale) }} ·
        {{ locale === 'en' ? 'version' : '版本' }} {{ asset.version }}
      </span>
      <p class="offline-asset__status" role="status">{{ statusText }}</p>
    </div>

    <div
      v-if="state.phase === 'downloading'"
      class="offline-asset__progress"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="locale === 'en' ? 'Download progress' : '下載進度'"
    >
      <span :style="{ inlineSize: `${percent}%` }" />
    </div>
    <p v-if="state.phase === 'downloading'" class="offline-asset__percent">{{ percent }}%</p>

    <div class="offline-asset__actions">
      <Button v-if="state.phase === 'downloading'" variant="outline" @click="cancel">
        <X :size="18" aria-hidden="true" />
        {{ locale === 'en' ? 'Cancel' : '取消下載' }}
      </Button>
      <Button
        v-else-if="state.phase !== 'cached'"
        :disabled="!online"
        @click="download"
      >
        <RotateCcw v-if="state.phase === 'failed'" :size="18" aria-hidden="true" />
        <Download v-else :size="18" aria-hidden="true" />
        {{ state.phase === 'failed'
          ? (locale === 'en' ? 'Try again' : '重新下載')
          : (locale === 'en' ? 'Download' : '下載資源') }}
      </Button>
    </div>
  </div>
</template>
