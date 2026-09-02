<script setup lang="ts">
import { ChevronLeft, ChevronRight, LayoutGrid, PanelLeftClose, Star } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { copy, toolCategories, toolsByCategory } from '@/features/tools/catalog'

const props = defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const { locale, withLocale } = useAppLocale()
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
      <NuxtLink class="sidebar-primary-link" :to="withLocale('/tools/')">
        <LayoutGrid :size="20" aria-hidden="true" />
        <span v-if="!props.collapsed">{{ locale === 'en' ? 'All tools' : '全部工具' }}</span>
      </NuxtLink>
      <NuxtLink class="sidebar-primary-link" :to="withLocale('/tools/?saved=true')">
        <Star :size="20" aria-hidden="true" />
        <span v-if="!props.collapsed">{{ locale === 'en' ? 'Saved' : '常用工具' }}</span>
      </NuxtLink>

      <template v-if="!props.collapsed">
        <section v-for="category in toolCategories" :key="category.id" class="sidebar-group">
          <h2 class="sidebar-group__title">
            <ToolIcon :name="category.icon" :size="17" />
            {{ copy(category.name, locale) }}
          </h2>
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

    <Button v-if="!props.collapsed" variant="ghost" class="app-sidebar__collapse" @click="emit('toggle')">
      <ChevronLeft :size="18" aria-hidden="true" />
      {{ locale === 'en' ? 'Collapse' : '收合導覽' }}
    </Button>
  </aside>
</template>
