<script setup lang="ts">
import { isSupportedLocale } from '@/features/tools/catalog'

definePageMeta({
  layout: 'app-shell',
  validate: route => isSupportedLocale(String(route.params.locale)),
})

const { locale } = useAppLocale()
const { restored, savedTools, storageAvailable, moveSaved, removeSaved } = useSavedTools()
const { showingSaved: savedOnly } = useSavedToolsView()
const copy = computed(() => locale.value === 'en' ? {
  eyebrow: 'Tool directory', title: 'What do you want to get done?',
  intro: 'Search or browse by category. Every tool opens in its own focused workspace.',
  savedTitle: 'Saved tools', savedIntro: 'Tools saved on this device, in the order you arranged them. Only tool names are kept here — never what you work on.',
} : {
  eyebrow: '工具目錄', title: '今天想完成什麼？',
  intro: '搜尋或依分類瀏覽，每個工具都會開啟自己的專注工作區。',
  savedTitle: '常用工具', savedIntro: '保存在這台裝置上的常用工具，順序由你決定。這裡只記錄工具名稱，不會保存你處理的內容。',
})

usePageSeo({
  locale,
  path: '/tools/',
  title: computed(() => savedOnly.value ? copy.value.savedTitle : (locale.value === 'en' ? 'All tools' : '全部工具')),
  description: computed(() => savedOnly.value ? copy.value.savedIntro : copy.value.intro),
})

useSeoMeta({
  robots: () => (process.env.NUXT_PAGES_DEMO === 'true' || savedOnly.value) ? 'noindex, nofollow' : 'index, follow',
})
</script>

<template>
  <main id="main-content" class="workspace-page directory-page" tabindex="-1">
    <header class="workspace-heading">
      <p class="eyebrow">{{ copy.eyebrow }}</p>
      <h1>{{ savedOnly ? copy.savedTitle : copy.title }}</h1>
      <p>{{ savedOnly ? copy.savedIntro : copy.intro }}</p>
    </header>
    <template v-if="savedOnly">
      <SavedStorageNotice v-if="!storageAvailable" :locale="locale" />
      <SavedToolList v-if="restored" :tools="savedTools" :locale="locale" @move="moveSaved" @remove="removeSaved" />
    </template>
    <template v-else>
      <ToolSearch :locale="locale" />
      <ToolCategoryGrid :locale="locale" />
    </template>
  </main>
</template>
