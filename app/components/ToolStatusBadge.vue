<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { getVisibleStatus, type LocaleCode, type ToolStatus, type ToolStatusMetadata } from '@/features/tools/catalog'

const props = defineProps<{ status: ToolStatusMetadata; locale: LocaleCode }>()
const visibleStatus = computed(() => getVisibleStatus(props.status))

const labels: Record<ToolStatus, Record<LocaleCode, string>> = {
  new: { 'zh-tw': 'NEW', en: 'NEW' },
  pro: { 'zh-tw': 'PRO', en: 'PRO' },
  hot: { 'zh-tw': '熱門', en: 'HOT' },
}
</script>

<template>
  <Badge v-if="visibleStatus" :variant="visibleStatus">{{ labels[visibleStatus][props.locale] }}</Badge>
</template>
