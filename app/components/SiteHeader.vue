<script setup lang="ts">
const { locale, withLocale } = useAppLocale()
</script>

<template>
  <header class="site-header nb-header">
    <div class="nb-wrap nb-header__inner">
      <BrandMark />
      <nav class="nb-header__nav" :aria-label="locale === 'en' ? 'Primary navigation' : '主要導覽'">
        <NuxtLink class="nb-pill nb-header__link" :to="withLocale('/tools/')">{{ locale === 'en' ? 'All tools' : '全部工具' }}</NuxtLink>
        <ThemeLocaleControls />
      </nav>
    </div>
  </header>
</template>
