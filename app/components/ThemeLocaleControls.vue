<script setup lang="ts">
import { Languages, Moon, Sun } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const { locale, alternateLocale, alternatePath } = useAppLocale()
const { toggle } = useThemeMode()
const themeLabel = computed(() => locale.value === 'en' ? 'Toggle color theme' : '切換色彩模式')

function toggleTheme() {
  const root = document.documentElement
  root.classList.add('theme-switching')
  toggle()
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => root.classList.remove('theme-switching'))
  })
}
</script>

<template>
  <div class="header-actions">
    <Button variant="ghost" size="icon" :aria-label="themeLabel" :title="themeLabel" @click="toggleTheme">
      <Sun class="theme-icon theme-icon--sun" :size="20" aria-hidden="true" />
      <Moon class="theme-icon theme-icon--moon" :size="20" aria-hidden="true" />
    </Button>
    <Button as-child variant="ghost" class="locale-button">
      <NuxtLink :to="alternatePath" :hreflang="alternateLocale === 'en' ? 'en' : 'zh-Hant-TW'">
        <Languages :size="19" aria-hidden="true" />
        {{ alternateLocale === 'en' ? 'EN' : '繁中' }}
      </NuxtLink>
    </Button>
  </div>
</template>
