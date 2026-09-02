<script setup lang="ts">
import { Home, LayoutGrid, Star } from '@lucide/vue'

const { locale, withLocale } = useAppLocale()
const route = useRoute()
const showingSaved = computed(() => route.query.saved === 'true')
const onHome = computed(() => route.path.replace(/\/$/, '') === `/${locale.value}`)
</script>

<template>
  <nav class="mobile-nav" :aria-label="locale === 'en' ? 'Mobile navigation' : '手機導覽'">
    <NuxtLink :class="{ 'mobile-nav--active': onHome }" :to="withLocale('/')">
      <Home :size="21" aria-hidden="true" />
      <span>{{ locale === 'en' ? 'Home' : '首頁' }}</span>
    </NuxtLink>
    <NuxtLink :class="{ 'mobile-nav--active': route.path.includes('/tools') && !showingSaved }" :to="withLocale('/tools/')">
      <LayoutGrid :size="21" aria-hidden="true" />
      <span>{{ locale === 'en' ? 'Tools' : '工具' }}</span>
    </NuxtLink>
    <NuxtLink :class="{ 'mobile-nav--active': showingSaved }" :to="withLocale('/tools/?saved=true')">
      <Star :size="21" aria-hidden="true" />
      <span>{{ locale === 'en' ? 'Saved' : '常用' }}</span>
    </NuxtLink>
  </nav>
</template>
