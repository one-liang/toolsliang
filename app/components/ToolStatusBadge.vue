<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import type { LocaleCode, ToolStatus } from '@/features/tools/catalog'

const props = defineProps<{ status: ToolStatus; locale: LocaleCode }>()

const labels: Record<ToolStatus, Record<LocaleCode, string>> = {
  new: { 'zh-tw': 'NEW', en: 'NEW' },
  pro: { 'zh-tw': 'PRO', en: 'PRO' },
  hot: { 'zh-tw': '熱門', en: 'HOT' },
  saved: { 'zh-tw': '常用', en: 'SAVED' },
}
</script>

<template>
  <Badge :variant="props.status">{{ labels[props.status][props.locale] }}</Badge>
</template>
