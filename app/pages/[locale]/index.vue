<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import {
  buildLandingStructuredData,
  getLandingCategories,
  getLandingCopy,
} from '@/features/landing/content'
import { isSupportedLocale } from '@/features/tools/catalog'

definePageMeta({
  layout: 'landing',
  validate: route => isSupportedLocale(String(route.params.locale)),
})

const { locale, withLocale } = useAppLocale()
const t = computed(() => getLandingCopy(locale.value))
const categories = computed(() => getLandingCategories(locale.value))
const root = ref<HTMLElement>()

useLandingMotion(root)

usePageSeo({
  locale,
  path: '/',
  title: computed(() => t.value.seoTitle),
  description: computed(() => t.value.seoDescription),
  structuredData: computed(() => buildLandingStructuredData(locale.value)),
})
</script>

<template>
  <main id="main-content" ref="root" class="nb-main" tabindex="-1">
    <section class="nb-wrap nb-hero" aria-labelledby="landing-title">
      <div class="nb-hero__copy">
        <h1 id="landing-title" class="nb-hero__title">
          <span>{{ t.heroTitleLead }}</span>
          <span><span class="nb-mark">{{ t.heroTitleTail }}</span></span>
        </h1>
        <p class="nb-hero__intro">{{ t.heroIntro }}</p>
        <ToolSearch :locale="locale" large />
        <div class="nb-hero__actions">
          <NuxtLink class="nb-button nb-button--ink" :to="withLocale('/tools/')">
            {{ t.heroBrowseAll }}
            <ArrowRight :size="20" :stroke-width="2.5" aria-hidden="true" />
          </NuxtLink>
        </div>
      </div>
      <LandingHeroDeck :locale="locale" :label="t.heroDeckLabel" />
    </section>

    <section class="nb-wrap nb-section landing-catalog" aria-labelledby="catalog-title">
      <h2 id="catalog-title" class="nb-section__title">{{ t.catalogTitle }}</h2>
      <div class="nb-bento">
        <LandingCategoryBlock v-for="category in categories" :key="category.id" :category="category" :locale="locale">
          <LandingDemoCutout v-if="category.id === 'image-commerce'" :locale="locale" />
          <LandingDemoSignature v-else-if="category.id === 'document'" :locale="locale" />
          <LandingDemoClock v-else-if="category.id === 'time-calendar'" :locale="locale" />
          <LandingDemoBmi v-else-if="category.id === 'calculation'" :locale="locale" />
          <LandingDemoWheel v-else-if="category.id === 'random-selection'" :locale="locale" />
        </LandingCategoryBlock>
      </div>
    </section>

    <section class="nb-wrap nb-section nb-faq landing-faq" aria-labelledby="faq-title">
      <h2 id="faq-title" class="nb-section__title">{{ t.faqTitle }}</h2>
      <LandingFaq :locale="locale" />
    </section>

    <section class="nb-close" aria-labelledby="close-title">
      <div class="nb-wrap nb-close__inner">
        <h2 id="close-title" class="nb-close__title">{{ t.closeTitle }}</h2>
        <NuxtLink class="nb-button nb-button--yellow" :to="withLocale('/tools/')">
          {{ t.closeAction }}
          <ArrowRight :size="20" :stroke-width="2.5" aria-hidden="true" />
        </NuxtLink>
      </div>
    </section>
  </main>
</template>
