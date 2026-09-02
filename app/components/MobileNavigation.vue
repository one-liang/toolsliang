<script setup lang="ts">
const { activeMobileNav, t } = usePrototype()
const items = [
  { key: 'home', icon: 'home' as const, zh: '首頁', en: 'Home' },
  { key: 'tools', icon: 'tool' as const, zh: '工具', en: 'Tools' },
  { key: 'favorites', icon: 'heart' as const, zh: '常用', en: 'Saved' },
  { key: 'account', icon: 'user' as const, zh: '我的', en: 'Me' },
]
</script>

<template>
  <nav class="mobile-navigation" :aria-label="t('手機主要導覽', 'Mobile primary navigation')">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      :class="{ active: activeMobileNav === item.key }"
      :aria-current="activeMobileNav === item.key ? 'page' : undefined"
      @click="activeMobileNav = item.key"
    >
      <UiIcon :name="item.icon" :filled="activeMobileNav === item.key && item.key === 'heart'" />
      <span>{{ t(item.zh, item.en) }}</span>
    </button>
  </nav>
</template>
