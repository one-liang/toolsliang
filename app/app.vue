<script setup lang="ts">
import type { PrototypeVariant } from '~/composables/usePrototype'

const { isDark, locale, setVariant, variant } = usePrototype()
const isPrototype = import.meta.dev

const variants: Record<PrototypeVariant, string> = {
  A: '搜尋廣場',
  B: '簡約動態工具台',
  C: '任務跑道',
}

useHead(() => ({
  htmlAttrs: {
    class: isDark.value ? 'dark' : '',
    lang: locale.value === 'zh-tw' ? 'zh-Hant-TW' : 'en',
  },
  link: [
    { rel: 'canonical', href: `https://toolsliang.com/${locale.value === 'en' ? 'en' : 'zh-tw'}/` },
    { rel: 'alternate', hreflang: 'zh-TW', href: 'https://toolsliang.com/zh-tw/' },
    { rel: 'alternate', hreflang: 'en', href: 'https://toolsliang.com/en/' },
    { rel: 'alternate', hreflang: 'x-default', href: 'https://toolsliang.com/zh-tw/' },
  ],
}))
</script>

<template>
  <div class="prototype-root" :class="{ 'is-dark': isDark }">
    <a class="skip-link" href="#main-content">跳到主要內容</a>
    <VariantA v-if="variant === 'A'" />
    <VariantB v-else-if="variant === 'B'" />
    <VariantC v-else />
    <PrototypeSwitcher
      v-if="isPrototype"
      :current="variant"
      :labels="variants"
      @change="setVariant"
    />
  </div>
</template>
