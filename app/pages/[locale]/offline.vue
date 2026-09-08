<script setup lang="ts">
import { CloudOff } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { isSupportedLocale, publishedTools } from '@/features/tools/catalog'

definePageMeta({
  layout: 'app-shell',
  validate: route => isSupportedLocale(String(route.params.locale)),
})

const { locale, withLocale } = useAppLocale()
const offlineReadyTools = publishedTools.filter(tool => tool.offlineMode === 'ready')

// The offline explanation is a shell fallback, not indexable content, so it
// carries no canonical or hreflang of its own.
useHead(() => ({
  title: locale.value === 'en' ? 'You are offline' : '目前無法連線',
  meta: [{ name: 'robots', content: 'noindex, follow' }],
}))
</script>

<template>
  <main id="main-content" class="workspace-page offline-page" tabindex="-1">
    <header class="offline-page__heading">
      <span class="offline-page__icon"><CloudOff :size="26" aria-hidden="true" /></span>
      <div>
        <h1>{{ locale === 'en' ? 'You are offline' : '目前無法連線' }}</h1>
        <p>
          {{ locale === 'en'
            ? 'This page has not been stored on your device yet. Tools you already opened keep working offline, because they run entirely on this device.'
            : '這個頁面還沒有存到你的裝置上。已經開啟過的工具仍可離線使用，因為它們完全在這台裝置上執行。' }}
        </p>
      </div>
    </header>

    <section class="tool-contract" aria-labelledby="offline-available">
      <div class="tool-section-heading">
        <p class="eyebrow">{{ locale === 'en' ? 'Available now' : '現在可以使用' }}</p>
        <h2 id="offline-available">{{ locale === 'en' ? 'Tools that work offline' : '可離線使用的工具' }}</h2>
        <p>
          {{ locale === 'en'
            ? 'Tools that need a large engine or model work offline only once you have downloaded it; otherwise they wait until you are back online.'
            : '需要下載大型引擎或模型的工具，只有在已經下載過之後才能離線使用，否則要等重新連線。' }}
        </p>
      </div>
      <ul class="offline-page__tools">
        <li v-for="tool in offlineReadyTools" :key="tool.slug">
          <NuxtLink :to="withLocale(`/tools/${tool.slug}/`)">{{ tool.name[locale] }}</NuxtLink>
        </li>
      </ul>
    </section>

    <div class="offline-page__actions">
      <Button as="a" :href="withLocale('/tools/')">
        {{ locale === 'en' ? 'Open the tool directory' : '開啟工具目錄' }}
      </Button>
    </div>
  </main>
</template>
