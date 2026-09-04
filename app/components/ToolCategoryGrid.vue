<script setup lang="ts">
import { computed } from 'vue'
import {
  categoriesForTools,
  copy,
  publishedTools,
  type LocaleCode,
  type PublishedToolDefinition,
} from '@/features/tools/catalog'

const props = defineProps<{
  locale: LocaleCode
  tools?: PublishedToolDefinition[]
  /** Lets a host page nest the grid under its own section heading without skipping a level. */
  headingLevel?: 2 | 3
}>()
const displayedTools = computed(() => props.tools ?? publishedTools)
const displayedCategories = computed(() => categoriesForTools(displayedTools.value))
const headingTag = computed(() => `h${props.headingLevel ?? 2}`)
const toolsForCategory = (categoryId: string) => displayedTools.value.filter(tool => tool.category === categoryId)
</script>

<template>
  <div class="category-grid">
    <section v-for="category in displayedCategories" :key="category.id" class="category-panel">
      <header class="category-panel__header">
        <component :is="headingTag">{{ copy(category.name, locale) }}</component>
        <p>{{ copy(category.description, locale) }}</p>
      </header>
      <div class="category-panel__tools">
        <ToolCard v-for="tool in toolsForCategory(category.id)" :key="tool.slug" :tool="tool" :locale="locale" />
      </div>
    </section>
  </div>
</template>
