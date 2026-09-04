<script setup lang="ts">
const { locale } = useAppLocale()
const collapsed = useState('sidebar-collapsed', () => false)
</script>

<template>
  <div :class="['app-shell', { 'app-shell--collapsed': collapsed }]">
    <a class="skip-link" href="#main-content">{{ locale === 'en' ? 'Skip to main content' : '跳至主要內容' }}</a>
    <AppSidebar :collapsed="collapsed" @toggle="collapsed = !collapsed" />
    <div class="app-shell__content">
      <AppTopbar />
      <slot />
    </div>
    <MobileBottomNav />
    <PwaUpdateBanner />
  </div>
</template>
