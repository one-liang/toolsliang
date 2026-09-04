<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'
import type { LocaleCode } from '@/features/tools/catalog'

defineProps<{ locale: LocaleCode }>()
</script>

<template>
  <p class="saved-storage-notice" role="status">
    <TriangleAlert :size="17" aria-hidden="true" />
    <span>{{ locale === 'en'
      ? 'This browser will not keep saved tools — private browsing or a storage limit is blocking it, so the list disappears when you close the tab.'
      : '這個瀏覽器無法保存常用工具，可能是無痕模式或儲存空間受限；關閉分頁後清單就會消失。' }}</span>
  </p>
</template>
