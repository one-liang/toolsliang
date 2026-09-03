<script setup lang="ts">
import { ChevronRight, LayoutGrid, PanelLeftClose, Star } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { copy, toolCategories, toolsByCategory } from '@/features/tools/catalog'

const props = defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const { locale, withLocale } = useAppLocale()
const route = useRoute()
const toolsIndexPath = computed(() => withLocale('/tools/').replace(/\/$/, ''))
const onToolsIndex = computed(() => route.path.replace(/\/$/, '') === toolsIndexPath.value)
const showingSaved = computed(() => route.query.saved === 'true')
</script>

<template>
  <aside :class="['app-sidebar', { 'app-sidebar--collapsed': props.collapsed }]">
    <div class="app-sidebar__brand">
      <BrandMark :compact="props.collapsed" />
      <Button
        variant="ghost"
        size="icon"
        :aria-label="locale === 'en' ? 'Collapse sidebar' : '收合側邊欄'"
        :aria-expanded="!props.collapsed"
        @click="emit('toggle')"
      >
        <PanelLeftClose v-if="!props.collapsed" :size="20" aria-hidden="true" />
        <ChevronRight v-else :size="20" aria-hidden="true" />
      </Button>
    </div>

    <nav class="app-sidebar__nav" :aria-label="locale === 'en' ? 'Tool navigation' : '工具導覽'">
      <div class="sidebar-main-links">
        <NuxtLink :class="['sidebar-primary-link', { 'sidebar-primary-link--active': onToolsIndex && !showingSaved }]" :to="withLocale('/tools/')">
          <LayoutGrid :size="20" aria-hidden="true" />
          <span v-if="!props.collapsed">{{ locale === 'en' ? 'All tools' : '全部工具' }}</span>
        </NuxtLink>
        <NuxtLink :class="['sidebar-primary-link', { 'sidebar-primary-link--active': showingSaved }]" :to="withLocale('/tools/?saved=true')">
          <Star :size="20" aria-hidden="true" />
          <span v-if="!props.collapsed">{{ locale === 'en' ? 'Saved' : '常用工具' }}</span>
        </NuxtLink>
      </div>

      <template v-if="!props.collapsed">
        <section v-for="category in toolCategories" :key="category.id" class="sidebar-group">
          <h2 class="sidebar-group__title">{{ copy(category.name, locale) }}</h2>
          <NuxtLink
            v-for="tool in toolsByCategory(category.id)"
            :key="tool.slug"
            class="sidebar-tool-link"
            :to="withLocale(`/tools/${tool.slug}/`)"
          >
            <ToolIcon :name="tool.icon" :size="17" />
            <span>{{ copy(tool.name, locale) }}</span>
            <ToolStatusBadge v-if="tool.status" :status="tool.status" :locale="locale" />
          </NuxtLink>
        </section>
      </template>
    </nav>
  </aside>
</template>
