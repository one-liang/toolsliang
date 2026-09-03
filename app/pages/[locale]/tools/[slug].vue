<script setup lang="ts">
import { LockKeyhole, Star } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { copy, getCategory, getTool } from '@/features/tools/catalog'

definePageMeta({
  layout: 'app-shell',
  validate: route => ['zh-tw', 'en'].includes(String(route.params.locale)) && Boolean(getTool(String(route.params.slug))),
})

const route = useRoute()
const { locale, withLocale } = useAppLocale()
const tool = computed(() => getTool(String(route.params.slug))!)
const category = computed(() => getCategory(tool.value.category)!)
const isRepresentative = computed(() => tool.value.slug === 'ntd-uppercase')

usePageSeo({
  locale,
  path: computed(() => `/tools/${tool.value.slug}/`),
  title: computed(() => copy(tool.value.name, locale.value)),
  description: computed(() => copy(tool.value.description, locale.value)),
  structuredData: computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: copy(tool.value.name, locale.value),
    description: copy(tool.value.description, locale.value),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    url: `https://toolsliang.com/${locale.value}/tools/${tool.value.slug}/`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'TWD' },
  })),
})
</script>

<template>
  <main id="main-content" class="workspace-page tool-page">
    <nav class="breadcrumbs" :aria-label="locale === 'en' ? 'Breadcrumb' : '麵包屑導覽'">
      <NuxtLink :to="withLocale('/tools/')">{{ locale === 'en' ? 'All tools' : '全部工具' }}</NuxtLink>
      <span aria-hidden="true">/</span>
      <span>{{ copy(category.name, locale) }}</span>
    </nav>

    <header class="tool-heading">
      <span class="tool-heading__icon"><ToolIcon :name="tool.icon" :size="26" /></span>
      <div class="tool-heading__copy">
        <div class="tool-heading__title-row">
          <h1>{{ copy(tool.name, locale) }}</h1>
          <ToolStatusBadge v-if="tool.status" :status="tool.status" :locale="locale" />
        </div>
        <p>{{ copy(tool.description, locale) }}</p>
      </div>
      <Button variant="outline" class="tool-heading__save">
        <Star :size="18" aria-hidden="true" />
        {{ locale === 'en' ? 'Save' : '加入常用' }}
      </Button>
    </header>

    <div class="local-processing-note">
      <LockKeyhole :size="17" aria-hidden="true" />
      <span>{{ locale === 'en' ? 'Local processing · Nothing is uploaded' : '本機處理・不會上傳任何內容' }}</span>
    </div>

    <NtdUppercaseWorkspace v-if="isRepresentative" />
    <ToolSpecificationNotice v-else :tool="tool" :locale="locale" />
  </main>
</template>
