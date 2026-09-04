<script setup lang="ts">
import { computed } from 'vue'
import { copy, publishedToolCategories, toolsByCategory, type LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{
  locale: LocaleCode
  /** Lets a host page nest the grid under its own section heading without skipping a level. */
  headingLevel?: 2 | 3
}>()
const headingTag = computed(() => `h${props.headingLevel ?? 2}`)
</script>

<template>
  <div class="category-grid">
    <section v-for="category in publishedToolCategories" :key="category.id" class="category-panel">
      <header class="category-panel__header">
        <component :is="headingTag">{{ copy(category.name, locale) }}</component>
        <p>{{ copy(category.description, locale) }}</p>
      </header>
      <div class="category-panel__tools">
        <ToolCard v-for="tool in toolsByCategory(category.id)" :key="tool.slug" :tool="tool" :locale="locale" />
      </div>
    </section>
  </div>
</template>
