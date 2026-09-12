<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { getVisibleStatus, isDateDerivedStatus, type LocaleCode, type ToolStatus, type ToolStatusMetadata } from '@/features/tools/catalog'

const props = defineProps<{ status: ToolStatusMetadata; locale: LocaleCode }>()

/**
 * Every public surface is prerendered, so a status derived from the current
 * date must not be decided while building: the HTML would carry the build
 * machine's date and hydration the visitor device's, and the two disagree
 * across the registered window. The device date arrives only after mount, so
 * a date-derived status stays out of the markup until then; the rest are
 * fixed conclusions and stay in the prerendered HTML.
 */
const deviceNow = ref<Date>()
onMounted(() => { deviceNow.value = new Date() })

const visibleStatus = computed(() => {
  if (!isDateDerivedStatus(props.status)) return getVisibleStatus(props.status)
  return deviceNow.value ? getVisibleStatus(props.status, deviceNow.value) : undefined
})

const labels: Record<ToolStatus, Record<LocaleCode, string>> = {
  new: { 'zh-tw': 'NEW', en: 'NEW' },
  pro: { 'zh-tw': 'PRO', en: 'PRO' },
  hot: { 'zh-tw': '熱門', en: 'HOT' },
}
</script>

<template>
  <Badge v-if="visibleStatus" :variant="visibleStatus">{{ labels[visibleStatus][props.locale] }}</Badge>
</template>
