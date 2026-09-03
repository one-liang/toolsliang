<script setup lang="ts">
import { copy, toolCategories, toolsByCategory, type LocaleCode } from '@/features/tools/catalog'

defineProps<{ locale: LocaleCode }>()
</script>

<template>
  <div class="category-grid">
    <section v-for="category in toolCategories" :key="category.id" class="category-panel">
      <header class="category-panel__header">
        <span class="category-panel__icon"><ToolIcon :name="category.icon" :size="22" /></span>
        <div>
          <h2>{{ copy(category.name, locale) }}</h2>
          <p>{{ copy(category.description, locale) }}</p>
        </div>
      </header>
      <div class="category-panel__tools">
        <ToolCard v-for="tool in toolsByCategory(category.id)" :key="tool.slug" :tool="tool" :locale="locale" />
      </div>
    </section>
  </div>
</template>
