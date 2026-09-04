<script setup lang="ts">
import { LockKeyhole, ShieldCheck } from '@lucide/vue'
import {
  buildLandingStructuredData,
  getLandingCopy,
  getLandingPrivacyPoints,
} from '@/features/landing/content'
import { isSupportedLocale } from '@/features/tools/catalog'

definePageMeta({
  layout: 'landing',
  validate: route => isSupportedLocale(String(route.params.locale)),
})

const { locale, withLocale } = useAppLocale()
const t = computed(() => getLandingCopy(locale.value))
const privacyPoints = computed(() => getLandingPrivacyPoints(locale.value))

usePageSeo({
  locale,
  path: '/',
  title: computed(() => t.value.seoTitle),
  description: computed(() => t.value.seoDescription),
  structuredData: computed(() => buildLandingStructuredData(locale.value)),
})
</script>

<template>
  <main id="main-content" class="landing-main" tabindex="-1">
    <section class="landing-hero" aria-labelledby="landing-title">
      <p class="eyebrow">{{ t.heroEyebrow }}</p>
      <h1 id="landing-title">{{ t.heroTitle }}</h1>
      <p class="landing-hero__intro">{{ t.heroIntro }}</p>
      <ToolSearch :locale="locale" large />
      <p class="landing-search-note">
        <ShieldCheck :size="16" aria-hidden="true" />
        <span>{{ t.heroSearchNote }}</span>
      </p>
      <div class="landing-hero__actions">
        <Button as-child size="lg">
          <NuxtLink :to="withLocale('/tools/')">{{ t.heroBrowseAll }}</NuxtLink>
        </Button>
      </div>
    </section>

    <section class="landing-section landing-privacy" aria-labelledby="privacy-title">
      <header class="section-heading">
        <p class="eyebrow">{{ t.privacyEyebrow }}</p>
        <h2 id="privacy-title">{{ t.privacyTitle }}</h2>
        <p>{{ t.privacyBody }}</p>
      </header>
      <ul class="landing-privacy__points">
        <li v-for="point in privacyPoints" :key="point.title" class="landing-privacy__point">
          <span class="landing-privacy__icon"><LockKeyhole :size="20" aria-hidden="true" /></span>
          <div>
            <h3>{{ point.title }}</h3>
            <p>{{ point.body }}</p>
          </div>
        </li>
      </ul>
    </section>

    <section class="landing-section landing-featured" aria-labelledby="featured-title">
      <header class="section-heading">
        <p class="eyebrow">{{ t.featuredEyebrow }}</p>
        <h2 id="featured-title">{{ t.featuredTitle }}</h2>
        <p>{{ t.featuredIntro }}</p>
      </header>
      <LandingFeaturedTools :locale="locale" />
    </section>

    <section class="landing-section landing-catalog" aria-labelledby="catalog-title">
      <header class="section-heading">
        <p class="eyebrow">{{ t.catalogEyebrow }}</p>
        <h2 id="catalog-title">{{ t.catalogTitle }}</h2>
        <p>{{ t.catalogIntro }}</p>
      </header>
      <ToolCategoryGrid :locale="locale" :heading-level="3" />
    </section>

    <section class="landing-section landing-faq" aria-labelledby="faq-title">
      <header class="section-heading">
        <p class="eyebrow">{{ t.faqEyebrow }}</p>
        <h2 id="faq-title">{{ t.faqTitle }}</h2>
        <p>{{ t.faqIntro }}</p>
      </header>
      <LandingFaq :locale="locale" />
    </section>
  </main>
</template>
