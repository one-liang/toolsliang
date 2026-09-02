<script setup lang="ts">
import { Button } from '@/components/ui/button'

const { locale, withLocale } = useAppLocale()
</script>

<template>
  <header class="site-header">
    <BrandMark />
    <nav class="site-header__nav" :aria-label="locale === 'en' ? 'Primary navigation' : '主要導覽'">
      <Button as-child variant="ghost">
        <NuxtLink :to="withLocale('/tools/')">{{ locale === 'en' ? 'All tools' : '全部工具' }}</NuxtLink>
      </Button>
      <ThemeLocaleControls />
    </nav>
  </header>
</template>
