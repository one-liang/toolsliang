<script setup lang="ts">
const { isDark, locale, setLocale, t } = usePrototype()
</script>

<template>
  <div class="utility-controls">
    <button
      class="icon-button"
      type="button"
      :aria-label="t(isDark ? '切換亮色模式' : '切換暗色模式', isDark ? 'Use light theme' : 'Use dark theme')"
      @click="isDark = !isDark"
    >
      <UiIcon :name="isDark ? 'sun' : 'moon'" />
    </button>
    <button
      class="text-button"
      type="button"
      :aria-label="t('切換為英文', 'Switch to Traditional Chinese')"
      @click="setLocale(locale === 'zh-tw' ? 'en' : 'zh-tw')"
    >
      <UiIcon name="language" />
      {{ locale === 'zh-tw' ? 'EN' : '繁中' }}
    </button>
  </div>
</template>
