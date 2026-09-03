<script setup lang="ts">
defineProps<{ compact?: boolean }>()
const { locale, withLocale } = useAppLocale()
</script>

<template>
  <NuxtLink class="brand-mark" :to="withLocale('/')" :aria-label="locale === 'en' ? 'toolsliang home' : 'toolsliang 首頁'">
    <span class="brand-mark__symbol" aria-hidden="true"><span /></span>
    <span v-if="!compact" class="brand-mark__name">toolsliang</span>
  </NuxtLink>
</template>
