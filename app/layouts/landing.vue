<template>
  <div class="landing-layout">
    <a class="skip-link" href="#main-content">跳至主要內容</a>
    <SiteHeader />
    <slot />
    <footer class="site-footer">
      <BrandMark />
      <p>toolsliang · Local-first utility tools</p>
    </footer>
    <PwaUpdateBanner />
  </div>
</template>
