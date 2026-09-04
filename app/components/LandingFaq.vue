<script setup lang="ts">
import { computed } from 'vue'
import { getLandingFaq } from '@/features/landing/content'
import type { LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode }>()
const entries = computed(() => getLandingFaq(props.locale))
</script>

<template>
  <dl class="landing-faq__list">
    <div v-for="entry in entries" :key="entry.heading" class="landing-faq__item">
      <dt class="landing-faq__question">{{ entry.heading }}</dt>
      <dd class="landing-faq__answer">{{ entry.body }}</dd>
    </div>
  </dl>
</template>
