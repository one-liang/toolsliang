<script setup lang="ts">
import { CircleDashed, LockKeyhole } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import type { LocaleCode, ToolDefinition } from '@/features/tools/catalog'

defineProps<{ tool: ToolDefinition; locale: LocaleCode }>()
</script>

<template>
  <Card class="tool-spec-notice">
    <span class="tool-spec-notice__icon"><CircleDashed :size="24" aria-hidden="true" /></span>
    <div>
      <h2>{{ locale === 'en' ? 'Workspace specification in progress' : '工具工作區規格準備中' }}</h2>
      <p>
        {{ locale === 'en'
          ? 'This permanent tool page is ready. The processing workflow will be implemented in its own module.'
          : '這個工具已有固定網址；處理流程將在獨立 module 完成規格後實作。' }}
      </p>
      <p class="local-note"><LockKeyhole :size="16" aria-hidden="true" />
        {{ locale === 'en' ? 'Its content will remain on this device.' : '未來的工具內容仍只會留在此裝置。' }}
      </p>
    </div>
  </Card>
</template>
