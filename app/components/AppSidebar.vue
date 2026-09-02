<script setup lang="ts">
import { categories, mockTools } from '~/data/tools'

withDefaults(defineProps<{ tone?: 'plain' | 'ink' }>(), { tone: 'plain' })
const { favorites, locale, sidebarCollapsed, t } = usePrototype()
const categoryCount = (name: string) => mockTools.filter(tool => tool.category === name).length
</script>

<template>
  <aside
    class="app-sidebar"
    :class="[`app-sidebar--${tone}`, { 'app-sidebar--collapsed': sidebarCollapsed }]"
    :aria-label="t('工具側邊欄', 'Tools sidebar')"
  >
    <div class="app-sidebar__brand">
      <BrandMark />
      <button
        class="icon-button"
        type="button"
        :aria-expanded="!sidebarCollapsed"
        :aria-label="t(sidebarCollapsed ? '展開側邊欄' : '收合側邊欄', sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        <UiIcon :name="sidebarCollapsed ? 'menu' : 'chevron-left'" />
      </button>
    </div>

    <nav>
      <p class="app-sidebar__label">{{ t('工具分類', 'CATEGORIES') }}</p>
      <button v-for="(category, index) in categories" :key="category.name" type="button" :class="{ active: index === 0 }">
        <span class="category-dot" :class="`category-dot--${index}`" />
        <span>{{ locale === 'zh-tw' ? category.name : category.nameEn }}</span>
        <small>{{ categoryCount(category.name) }}</small>
      </button>
    </nav>

    <div class="app-sidebar__favorites">
      <p class="app-sidebar__label">{{ t('常用工具', 'FAVORITES') }}</p>
      <button type="button">
        <UiIcon name="heart" />
        <span>{{ t('我的常用工具', 'My favorites') }}</span>
        <small>{{ favorites.length }}</small>
      </button>
    </div>

    <div class="app-sidebar__local">
      <UiIcon name="shield" />
      <span>{{ t('本機處理中', 'Processing locally') }}</span>
    </div>
  </aside>
</template>
