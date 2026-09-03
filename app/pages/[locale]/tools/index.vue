<script setup lang="ts">
definePageMeta({
  layout: 'app-shell',
  validate: route => ['zh-tw', 'en'].includes(String(route.params.locale)),
})

const { locale } = useAppLocale()
const copy = computed(() => locale.value === 'en' ? {
  eyebrow: 'Tool directory', title: 'What do you want to get done?',
  intro: 'Search or browse by category. Every tool opens in its own focused workspace.',
} : {
  eyebrow: '工具目錄', title: '今天想完成什麼？',
  intro: '搜尋或依分類瀏覽，每個工具都會開啟自己的專注工作區。',
})

usePageSeo({
  locale,
  path: '/tools/',
  title: computed(() => locale.value === 'en' ? 'All tools' : '全部工具'),
  description: computed(() => copy.value.intro),
})
</script>

<template>
  <main id="main-content" class="workspace-page directory-page">
    <header class="workspace-heading">
      <p class="eyebrow">{{ copy.eyebrow }}</p>
      <h1>{{ copy.title }}</h1>
      <p>{{ copy.intro }}</p>
    </header>
    <ToolSearch :locale="locale" />
    <ToolCategoryGrid :locale="locale" />
  </main>
</template>
