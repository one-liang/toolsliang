<script setup lang="ts">
import '@fontsource-variable/archivo/wdth.css'
import '~/assets/css/landing.css'

const { locale, withLocale } = useAppLocale()
</script>

<template>
  <div class="landing-layout">
    <a class="skip-link" href="#main-content">{{ locale === 'en' ? 'Skip to main content' : '跳至主要內容' }}</a>
    <SiteHeader />
    <slot />
    <footer class="nb-footer">
      <div class="nb-wrap nb-footer__inner">
        <BrandMark />
        <nav class="nb-footer__nav" :aria-label="locale === 'en' ? 'Footer' : '頁尾導覽'">
          <NuxtLink :to="withLocale('/tools/')">{{ locale === 'en' ? 'All tools' : '全部工具' }}</NuxtLink>
          <NuxtLink :to="withLocale('/storage/')">{{ locale === 'en' ? 'Local assets' : '本機資產' }}</NuxtLink>
        </nav>
      </div>
    </footer>
    <PwaUpdateBanner />
  </div>
</template>
