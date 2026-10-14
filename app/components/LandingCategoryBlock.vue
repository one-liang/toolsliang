<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import type { LandingCategory } from '@/features/landing/content'
import type { LocaleCode } from '@/features/tools/catalog'

defineProps<{ category: LandingCategory, locale: LocaleCode }>()
</script>

<template>
  <article :class="['nb-block', `nb-block--${category.id}`, `nb-fill--${category.id}`]" :aria-labelledby="`category-${category.id}`">
    <header>
      <h3 :id="`category-${category.id}`" class="nb-block__title">{{ category.name }}</h3>
      <p class="nb-block__pitch">{{ category.pitch }}</p>
    </header>
    <div class="nb-block__demo">
      <slot />
    </div>
    <ul class="nb-block__tools">
      <li v-for="tool in category.tools" :key="tool.slug">
        <NuxtLink class="nb-tool" :to="`/${locale}/tools/${tool.slug}/`">
          <span class="nb-tool__name">{{ tool.name }}</span>
          <span class="nb-tool__tagline">{{ tool.tagline }}</span>
          <span class="nb-tool__go" aria-hidden="true"><ArrowRight :size="18" :stroke-width="2.5" /></span>
        </NuxtLink>
      </li>
    </ul>
  </article>
</template>
