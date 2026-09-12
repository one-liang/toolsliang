<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { getVisibleStatus, type LocaleCode, type ToolStatus, type ToolStatusMetadata } from '@/features/tools/catalog'

const props = defineProps<{ status: ToolStatusMetadata; locale: LocaleCode }>()

/**
 * Every public surface is prerendered, so a status that follows a clock must
 * not be decided while building: the HTML would carry the build machine's date
 * and hydration the visitor device's, and the two disagree across the
 * registered window. The device date arrives only once mounted, and until then
 * `getVisibleStatus` leaves such a status out; the labels no date can change
 * stay in the prerendered HTML.
 */
const deviceNow = ref<Date>()
onMounted(() => { deviceNow.value = new Date() })

const visibleStatus = computed(() => getVisibleStatus(props.status, deviceNow.value))

const labels: Record<ToolStatus, Record<LocaleCode, string>> = {
  new: { 'zh-tw': 'NEW', en: 'NEW' },
  pro: { 'zh-tw': 'PRO', en: 'PRO' },
  hot: { 'zh-tw': '熱門', en: 'HOT' },
}
</script>

<template>
  <Badge v-if="visibleStatus" :variant="visibleStatus">{{ labels[visibleStatus][props.locale] }}</Badge>
</template>
