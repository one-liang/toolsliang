<script setup lang="ts">
import { ChevronRight, LayoutGrid, PanelLeftClose, Star } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { copy, publishedToolCategories, toolsByCategory } from '@/features/tools/catalog'

const props = defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const { locale, withLocale } = useAppLocale()
const { savedTools } = useSavedTools()
const { savedViewPath, showingSaved } = useSavedToolsView()
const route = useRoute()
const toolsIndexPath = computed(() => withLocale('/tools/').replace(/\/$/, ''))
const onToolsIndex = computed(() => route.path.replace(/\/$/, '') === toolsIndexPath.value)
const toggleLabel = computed(() => props.collapsed
  ? (locale.value === 'en' ? 'Expand sidebar' : '展開側邊欄')
  : (locale.value === 'en' ? 'Collapse sidebar' : '收合側邊欄'))
</script>

<template>
  <aside :class="['app-sidebar', { 'app-sidebar--collapsed': props.collapsed }]">
    <div class="app-sidebar__brand">
      <BrandMark :compact="props.collapsed" />
      <Button
        variant="ghost"
        size="icon"
        :aria-label="toggleLabel"
        :title="toggleLabel"
        :aria-expanded="!props.collapsed"
        aria-controls="app-sidebar-nav"
        @click="emit('toggle')"
      >
        <PanelLeftClose v-if="!props.collapsed" :size="20" aria-hidden="true" />
        <ChevronRight v-else :size="20" aria-hidden="true" />
      </Button>
    </div>

    <nav id="app-sidebar-nav" class="app-sidebar__nav" :aria-label="locale === 'en' ? 'Tool navigation' : '工具導覽'">
      <div class="sidebar-main-links">
        <NuxtLink
          :class="['sidebar-primary-link', { 'sidebar-primary-link--active': onToolsIndex && !showingSaved }]"
          :to="withLocale('/tools/')"
          :title="props.collapsed ? (locale === 'en' ? 'All tools' : '全部工具') : undefined"
        >
          <LayoutGrid :size="20" aria-hidden="true" />
          <span :class="{ 'sr-only': props.collapsed }">{{ locale === 'en' ? 'All tools' : '全部工具' }}</span>
        </NuxtLink>
        <NuxtLink
          :class="['sidebar-primary-link', 'sidebar-primary-link--saved', { 'sidebar-primary-link--active': showingSaved }]"
          :to="savedViewPath"
          :title="props.collapsed ? (locale === 'en' ? 'Saved' : '常用工具') : undefined"
        >
          <Star :size="20" aria-hidden="true" />
          <span :class="{ 'sr-only': props.collapsed }">{{ locale === 'en' ? 'Saved' : '常用工具' }}</span>
        </NuxtLink>
      </div>

      <section class="sidebar-saved" :aria-label="locale === 'en' ? 'Saved tools' : '常用工具'">
        <h2 :class="['sidebar-saved__title', { 'sr-only': props.collapsed }]">{{ locale === 'en' ? 'Saved' : '常用工具' }}</h2>
        <NuxtLink
          v-for="tool in savedTools"
          :key="tool.slug"
          class="sidebar-tool-link sidebar-saved__link"
          :to="withLocale(`/tools/${tool.slug}/`)"
          :title="props.collapsed ? copy(tool.name, locale) : undefined"
        >
          <ToolIcon :name="tool.icon" :size="17" />
          <span :class="{ 'sr-only': props.collapsed }">{{ copy(tool.name, locale) }}</span>
        </NuxtLink>
        <p v-if="!savedTools.length && !props.collapsed" class="sidebar-saved__empty">
          {{ locale === 'en' ? 'Save a tool to open it from here.' : '在工具頁加入常用，就能從這裡開啟。' }}
        </p>
      </section>

      <section v-for="category in publishedToolCategories" :key="category.id" class="sidebar-group">
        <h2 :class="['sidebar-group__title', { 'sr-only': props.collapsed }]">{{ copy(category.name, locale) }}</h2>
        <NuxtLink
          v-for="tool in toolsByCategory(category.id)"
          :key="tool.slug"
          class="sidebar-tool-link"
          :to="withLocale(`/tools/${tool.slug}/`)"
          :title="props.collapsed ? copy(tool.name, locale) : undefined"
        >
          <ToolIcon :name="tool.icon" :size="17" />
          <span :class="{ 'sr-only': props.collapsed }">{{ copy(tool.name, locale) }}</span>
          <ToolStatusBadge v-if="tool.status && !props.collapsed" :status="tool.status" :locale="locale" />
        </NuxtLink>
      </section>
    </nav>
  </aside>
</template>
