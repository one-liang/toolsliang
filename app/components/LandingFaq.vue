<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed } from 'vue'
import { getLandingFaq } from '@/features/landing/content'
import type { LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode }>()
const entries = computed(() => getLandingFaq(props.locale))
</script>

<template>
  <div class="nb-faq__list landing-faq__list">
    <details v-for="(entry, index) in entries" :key="entry.heading" class="nb-faq__item landing-faq__item" :open="index === 0">
      <summary class="nb-faq__question landing-faq__question">
        <span>{{ entry.heading }}</span>
        <span class="nb-faq__icon" aria-hidden="true"><Plus :size="20" :stroke-width="2.5" /></span>
      </summary>
      <p class="nb-faq__answer landing-faq__answer">{{ entry.body }}</p>
    </details>
  </div>
</template>
