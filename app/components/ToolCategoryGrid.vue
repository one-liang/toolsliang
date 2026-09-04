<script setup lang="ts">
import { computed } from 'vue'
import {
  categoriesForTools,
  copy,
  publishedTools,
  type LocaleCode,
  type PublishedToolDefinition,
} from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode; tools?: PublishedToolDefinition[] }>()
const displayedTools = computed(() => props.tools ?? publishedTools)
const displayedCategories = computed(() => categoriesForTools(displayedTools.value))
const toolsForCategory = (categoryId: string) => displayedTools.value.filter(tool => tool.category === categoryId)
</script>

<template>
  <div class="category-grid">
    <section v-for="category in displayedCategories" :key="category.id" class="category-panel">
      <header class="category-panel__header">
        <h2>{{ copy(category.name, locale) }}</h2>
        <p>{{ copy(category.description, locale) }}</p>
      </header>
      <div class="category-panel__tools">
        <ToolCard v-for="tool in toolsForCategory(category.id)" :key="tool.slug" :tool="tool" :locale="locale" />
      </div>
    </section>
  </div>
</template>
