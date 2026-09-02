<script setup lang="ts">
import type { MockTool } from '~/data/tools'

defineProps<{ tool: MockTool; index?: number }>()
const { favorites, locale, t, toggleFavorite } = usePrototype()
</script>

<template>
  <article class="tool-card" :class="`tool-card--${tool.accent}`">
    <div class="tool-card__top">
      <span class="tool-card__index">{{ String((index ?? 0) + 1).padStart(2, '0') }}</span>
      <button
        class="favorite-button"
        type="button"
        :aria-pressed="favorites.includes(tool.slug)"
        :aria-label="t(`切換 ${tool.name} 常用狀態`, `Toggle ${tool.nameEn} favorite`)"
        @click="toggleFavorite(tool.slug)"
      >
        <UiIcon name="heart" :filled="favorites.includes(tool.slug)" />
      </button>
    </div>
    <div>
      <p class="tool-card__category">{{ tool.category }}</p>
      <h3>{{ locale === 'zh-tw' ? tool.name : tool.nameEn }}</h3>
      <p>{{ locale === 'zh-tw' ? tool.description : tool.descriptionEn }}</p>
    </div>
    <button class="tool-card__action" type="button">
      {{ t('開啟工具', 'Open tool') }} <UiIcon name="arrow-right" />
    </button>
  </article>
</template>
