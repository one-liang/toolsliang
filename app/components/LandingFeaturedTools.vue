<script setup lang="ts">
import { computed } from 'vue'
import { getFeaturedTools } from '@/features/landing/content'
import type { LocaleCode } from '@/features/tools/catalog'

defineProps<{ locale: LocaleCode }>()
const featuredTools = computed(() => getFeaturedTools())
</script>

<template>
  <div class="landing-featured__grid">
    <ToolCard v-for="tool in featuredTools" :key="tool.slug" :tool="tool" :locale="locale" />
  </div>
</template>
