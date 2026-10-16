<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getUnavailableCapabilities, type LocaleCode, type ToolCapability } from '@/features/tools/catalog'

const props = defineProps<{ requirements: ToolCapability[]; locale: LocaleCode }>()
const checked = ref(false)
const unavailable = ref<ToolCapability[]>([])
const capabilityNames: Record<ToolCapability, Record<LocaleCode, string>> = {
  javascript: { 'zh-tw': 'JavaScript', en: 'JavaScript' },
  'web-worker': { 'zh-tw': '背景處理', en: 'background processing' },
  wasm: { 'zh-tw': '高效能運算', en: 'high-performance computing' },
  webgl: { 'zh-tw': '繪圖加速', en: 'graphics acceleration' },
  webgpu: { 'zh-tw': '顯示卡運算', en: 'graphics-card computing' },
}
const unavailableNames = computed(() => unavailable.value.map(capability => capabilityNames[capability][props.locale]).join('、'))

onMounted(() => {
  const canvas = document.createElement('canvas')
  const available: Record<ToolCapability, boolean> = {
    javascript: true,
    'web-worker': typeof Worker !== 'undefined',
    wasm: typeof WebAssembly !== 'undefined',
    webgl: Boolean(canvas.getContext('webgl')),
    webgpu: 'gpu' in navigator,
  }
  unavailable.value = getUnavailableCapabilities(props.requirements, available)
  checked.value = true
})
</script>

<template>
  <div data-capability-gate :data-capability-ready="checked && unavailable.length === 0">
    <div v-if="!checked" class="capability-checking" role="status">
      {{ locale === 'en' ? 'Checking browser support…' : '正在檢查瀏覽器支援…' }}
    </div>
    <div v-else-if="unavailable.length" class="capability-warning" role="alert">
      {{ locale === 'en'
        ? `This browser is missing: ${unavailableNames}. Try an up-to-date browser or another device.`
        : `這個瀏覽器缺少：${unavailableNames}。請改用最新版瀏覽器或其他裝置。` }}
    </div>
    <slot v-else />
  </div>
</template>
