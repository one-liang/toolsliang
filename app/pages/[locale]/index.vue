<script setup lang="ts">
import { LockKeyhole } from '@lucide/vue'
import { isSupportedLocale } from '@/features/tools/catalog'

definePageMeta({
  layout: 'landing',
  validate: route => isSupportedLocale(String(route.params.locale)),
})

const { locale, withLocale } = useAppLocale()
const t = computed(() => locale.value === 'en' ? {
  eyebrow: 'Everyday tools, ready when you are',
  title: 'Get it done without sending it away.',
  intro: 'Fast utilities for files, images, data, and text — processed locally in your browser.',
  privacyTitle: 'Your content stays on this device',
  privacyBody: 'Files, text, values, and results are not uploaded to toolsliang or third-party processors.',
  browse: 'Browse all tools',
  section: 'All tool categories',
  sectionBody: 'Choose a task and open its focused workspace.',
} : {
  eyebrow: '日常工具，打開就能用',
  title: '事情處理好，內容不用交出去。',
  intro: '文件、圖片、資料與文字工具，都在你的瀏覽器裡快速完成。',
  privacyTitle: '內容只留在這台裝置',
  privacyBody: '檔案、文字、數值與處理結果不會上傳到 toolsliang 或第三方處理服務。',
  browse: '瀏覽全部工具',
  section: '所有工具分類',
  sectionBody: '選擇任務，直接進入各自專注的工具頁。',
})

usePageSeo({
  locale,
  path: '/',
  title: computed(() => locale.value === 'en' ? 'Private browser tools' : '在瀏覽器完成的實用工具'),
  description: computed(() => t.value.intro),
  structuredData: computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'toolsliang',
    url: `https://toolsliang.com/${locale.value}/`,
    inLanguage: locale.value === 'en' ? 'en' : 'zh-Hant-TW',
  })),
})
</script>

<template>
  <main id="main-content" class="landing-main">
    <section class="landing-hero" aria-labelledby="landing-title">
      <p class="eyebrow">{{ t.eyebrow }}</p>
      <h1 id="landing-title">{{ t.title }}</h1>
      <p class="landing-hero__intro">{{ t.intro }}</p>
      <ToolSearch :locale="locale" large />
      <div class="landing-hero__actions">
        <Button as-child size="lg">
          <NuxtLink :to="withLocale('/tools/')">{{ t.browse }}</NuxtLink>
        </Button>
      </div>
    </section>

    <section class="privacy-strip" aria-labelledby="privacy-title">
      <span class="privacy-strip__icon"><LockKeyhole :size="22" aria-hidden="true" /></span>
      <div>
        <h2 id="privacy-title">{{ t.privacyTitle }}</h2>
        <p>{{ t.privacyBody }}</p>
      </div>
    </section>

    <section class="landing-catalog" aria-labelledby="catalog-title">
      <header class="section-heading">
        <p class="eyebrow">toolsliang catalog</p>
        <h2 id="catalog-title">{{ t.section }}</h2>
        <p>{{ t.sectionBody }}</p>
      </header>
      <ToolCategoryGrid :locale="locale" />
    </section>
  </main>
</template>
