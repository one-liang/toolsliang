<script setup lang="ts">
import {
  Banknote, Braces, CaseSensitive, Crop, FileText, Image, TableProperties, Type,
} from '@lucide/vue'
import type { ToolIcon } from '@/features/tools/catalog'

defineProps<{ name: ToolIcon; size?: number }>()

const iconMap = {
  banknote: Banknote,
  braces: Braces,
  'case-sensitive': CaseSensitive,
  crop: Crop,
  'file-text': FileText,
  image: Image,
  table: TableProperties,
  type: Type,
}
</script>

<template>
  <component :is="iconMap[name]" :size="size ?? 20" :stroke-width="1.8" aria-hidden="true" />
</template>
