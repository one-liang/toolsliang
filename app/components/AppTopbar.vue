<script setup lang="ts">
import { Search } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const { locale, withLocale } = useAppLocale()
</script>

<template>
  <header class="app-topbar">
    <BrandMark class="app-topbar__brand" />
    <Button as-child variant="ghost" class="app-topbar__search">
      <NuxtLink :to="withLocale('/tools/')">
        <Search :size="19" aria-hidden="true" />
        <span class="app-topbar__search-label">{{ locale === 'en' ? 'Find a tool' : '尋找工具' }}</span>
      </NuxtLink>
    </Button>
    <ThemeLocaleControls />
  </header>
</template>
