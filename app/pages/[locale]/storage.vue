<script setup lang="ts">
import { HardDrive } from '@lucide/vue'
import { localAssetCopy } from '@/features/shell/local-assets/content'
import { isSupportedLocale } from '@/features/tools/catalog'

definePageMeta({
  layout: 'app-shell',
  validate: route => isSupportedLocale(String(route.params.locale)),
})

const { locale } = useAppLocale()
const copy = computed(() => localAssetCopy(locale.value))

// What this page shows is the state of one device, so it carries no canonical
// or hreflang of its own and is never indexed.
useHead(() => ({ title: copy.value.title }))
useSeoMeta({ robots: 'noindex, follow' })
</script>

<template>
  <main id="main-content" class="workspace-page storage-page" tabindex="-1">
    <header class="tool-heading tool-heading--with-icon">
      <span class="tool-heading__icon"><HardDrive :size="26" aria-hidden="true" /></span>
      <div>
        <p class="eyebrow">{{ copy.eyebrow }}</p>
        <h1>{{ copy.title }}</h1>
        <p>{{ copy.intro }}</p>
      </div>
    </header>

    <LocalAssetManager :locale="locale" />
  </main>
</template>
