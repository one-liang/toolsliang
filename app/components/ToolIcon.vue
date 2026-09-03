<script setup lang="ts">
import {
  Banknote, Braces, Calculator, CalendarDays, CaseSensitive, Crop, Dices,
  FileText, Image, ShoppingBag, TableProperties, Type,
} from '@lucide/vue'
import type { ToolIcon } from '@/features/tools/catalog'

defineProps<{ name: ToolIcon; size?: number }>()

const iconMap = {
  banknote: Banknote,
  braces: Braces,
  calculator: Calculator,
  'calendar-days': CalendarDays,
  'case-sensitive': CaseSensitive,
  crop: Crop,
  dices: Dices,
  'file-text': FileText,
  image: Image,
  'shopping-bag': ShoppingBag,
  table: TableProperties,
  type: Type,
}
</script>

<template>
  <component :is="iconMap[name]" :size="size ?? 20" :stroke-width="1.8" aria-hidden="true" />
</template>
