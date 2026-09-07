<script setup lang="ts">
import { LockKeyhole, Star } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { copy, formatReviewDate, getCategory, getTool, isSupportedLocale } from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'
import { buildToolStructuredData } from '@/features/tools/structured-data'
import { getToolWorkspaceAssets, resolveToolWorkspace } from '@/features/tools/workspace-resolver'

definePageMeta({
  layout: 'app-shell',
  validate: route => isSupportedLocale(String(route.params.locale)) && Boolean(getTool(String(route.params.slug))),
})

const route = useRoute()
const { locale, withLocale } = useAppLocale()
const { isSaved, storageAvailable, toggleSaved } = useSavedTools()
const tool = computed(() => getTool(String(route.params.slug))!)
const saved = computed(() => isSaved(tool.value.slug))
const category = computed(() => getCategory(tool.value.category)!)
const workspace = computed(() => resolveToolWorkspace(tool.value.routeComponentKey)!)
const faq = computed(() => getToolFaq(tool.value.seo.contentKey, locale.value))

useHead(() => ({ link: getToolWorkspaceAssets(tool.value.routeComponentKey).map(href => ({ rel: 'preload', as: 'fetch', href, crossorigin: 'anonymous' as const })) }))

usePageSeo({
  locale,
  path: computed(() => `/tools/${tool.value.slug}/`),
  title: computed(() => copy(tool.value.seo.title, locale.value)),
  description: computed(() => copy(tool.value.seo.description, locale.value)),
  structuredData: computed(() => buildToolStructuredData(tool.value, locale.value)),
})
</script>

<template>
  <main id="main-content" class="workspace-page tool-page" tabindex="-1">
    <nav class="breadcrumbs" :aria-label="locale === 'en' ? 'Breadcrumb' : '麵包屑導覽'">
      <NuxtLink :to="withLocale('/tools/')">{{ locale === 'en' ? 'All tools' : '全部工具' }}</NuxtLink>
      <span aria-hidden="true">/</span>
      <span>{{ copy(category.name, locale) }}</span>
    </nav>

    <header class="tool-heading" :class="{ 'tool-heading--with-icon': tool.pagePresentation.showHeadingIcon }">
      <span v-if="tool.pagePresentation.showHeadingIcon" class="tool-heading__icon"><ToolIcon :name="tool.icon" :size="26" /></span>
      <div class="tool-heading__copy">
        <div class="tool-heading__title-row">
          <h1>{{ copy(tool.name, locale) }}</h1>
          <ToolStatusBadge v-if="tool.status" :status="tool.status" :locale="locale" />
        </div>
        <p>{{ copy(tool.description, locale) }}</p>
      </div>
      <Button
        variant="outline"
        class="tool-heading__save"
        :aria-pressed="saved"
        @click="toggleSaved(tool.slug)"
      >
        <Star :size="18" aria-hidden="true" />
        {{ saved
          ? (locale === 'en' ? 'Saved' : '已加入常用')
          : (locale === 'en' ? 'Save' : '加入常用') }}
      </Button>
    </header>

    <SavedStorageNotice v-if="!storageAvailable" :locale="locale" />

    <div v-if="tool.pagePresentation.showLocalProcessingStatement" class="local-processing-note">
      <LockKeyhole :size="17" aria-hidden="true" />
      <span>{{ copy(tool.localProcessingStatement, locale) }}</span>
    </div>

    <ToolCapabilityGate :requirements="tool.capabilities" :locale="locale">
      <component :is="workspace" />
    </ToolCapabilityGate>

    <section class="tool-contract" :aria-labelledby="`tool-answer-${tool.slug}`">
      <div class="tool-section-heading">
        <p class="eyebrow">{{ locale === 'en' ? 'Usage notes' : '使用備註' }}</p>
        <h2 :id="`tool-answer-${tool.slug}`">{{ locale === 'en' ? 'Before you start' : '開始前先知道' }}</h2>
        <p>{{ copy(tool.seo.answer, locale) }}</p>
      </div>
      <dl>
        <div>
          <dt>{{ locale === 'en' ? 'Accepted input' : '可接受輸入' }}</dt>
          <dd>{{ copy(tool.acceptedInput, locale) }}</dd>
        </div>
        <div>
          <dt>{{ locale === 'en' ? 'Offline use' : '離線能力' }}</dt>
          <dd><ToolOfflineStatus :tool="tool" :locale="locale" /></dd>
        </div>
      </dl>
    </section>

    <section v-if="faq.length" class="tool-contract tool-contract--faq" :aria-labelledby="`tool-faq-${tool.slug}`">
      <div class="tool-section-heading">
        <p class="eyebrow">{{ locale === 'en' ? 'Common questions' : '常見問題' }}</p>
        <h2 :id="`tool-faq-${tool.slug}`">{{ locale === 'en' ? 'What people ask about this tool' : '關於這個工具的常見問題' }}</h2>
      </div>
      <dl class="tool-faq">
        <div v-for="entry in faq" :key="entry.heading" class="tool-faq__item">
          <dt class="tool-faq__question">{{ entry.heading }}</dt>
          <dd class="tool-faq__answer">{{ entry.body }}</dd>
        </div>
      </dl>
    </section>

    <section class="tool-contract tool-contract--sources" :aria-labelledby="`tool-sources-${tool.slug}`">
      <div class="tool-section-heading">
        <p class="eyebrow">{{ locale === 'en' ? 'References' : '參考依據' }}</p>
        <h2 :id="`tool-sources-${tool.slug}`">{{ locale === 'en' ? 'Sources and review' : '資料來源與審閱' }}</h2>
      </div>
      <div class="tool-contract__sources">
        <strong>{{ copy(tool.contentReview.sourceEdition, locale) }}</strong>
        <span>
          {{ locale === 'en' ? 'Effective' : '資料生效日' }}：
          <time :datetime="tool.contentReview.sourceEffectiveAt">{{ formatReviewDate(tool.contentReview.sourceEffectiveAt, locale) }}</time>
        </span>
        <span>
          {{ locale === 'en' ? 'Reviewed' : '內容審閱日' }}：
          <time :datetime="tool.contentReview.reviewedAt">{{ formatReviewDate(tool.contentReview.reviewedAt, locale) }}</time>
        </span>
        <span class="tool-contract__source-links">
          <a
            v-for="source in tool.contentReview.sources"
            :key="source.url"
            :href="source.url"
            target="_blank"
            rel="noopener noreferrer"
          >{{ copy(source.title, locale) }}</a>
        </span>
      </div>
    </section>
  </main>
</template>
