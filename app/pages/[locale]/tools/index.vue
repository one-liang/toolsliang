<script setup lang="ts">
import { isSupportedLocale } from '@/features/tools/catalog'

definePageMeta({
  layout: 'app-shell',
  validate: route => isSupportedLocale(String(route.params.locale)),
})

const { locale } = useAppLocale()
const route = useRoute()
const { savedTools } = useSavedTools()
const savedOnly = computed(() => route.query.saved === 'true')
const copy = computed(() => locale.value === 'en' ? {
  eyebrow: 'Tool directory', title: 'What do you want to get done?',
  intro: 'Search or browse by category. Every tool opens in its own focused workspace.',
  savedTitle: 'Saved tools', savedIntro: 'Tools saved on this device.', savedEmpty: 'No saved tools on this device yet.',
} : {
  eyebrow: '工具目錄', title: '今天想完成什麼？',
  intro: '搜尋或依分類瀏覽，每個工具都會開啟自己的專注工作區。',
  savedTitle: '常用工具', savedIntro: '保存在這台裝置上的常用工具。', savedEmpty: '這台裝置還沒有常用工具。',
})

usePageSeo({
  locale,
  path: '/tools/',
  title: computed(() => savedOnly.value ? copy.value.savedTitle : (locale.value === 'en' ? 'All tools' : '全部工具')),
  description: computed(() => savedOnly.value ? copy.value.savedIntro : copy.value.intro),
})

useSeoMeta({
  robots: () => savedOnly.value ? 'noindex, nofollow' : 'index, follow',
})
</script>

<template>
  <main id="main-content" class="workspace-page directory-page">
    <header class="workspace-heading">
      <p class="eyebrow">{{ copy.eyebrow }}</p>
      <h1>{{ savedOnly ? copy.savedTitle : copy.title }}</h1>
      <p>{{ savedOnly ? copy.savedIntro : copy.intro }}</p>
    </header>
    <ToolSearch v-if="!savedOnly" :locale="locale" />
    <ToolCategoryGrid :locale="locale" :tools="savedOnly ? savedTools : undefined" />
    <p v-if="savedOnly && !savedTools.length" class="empty-state">{{ copy.savedEmpty }}</p>
  </main>
</template>
