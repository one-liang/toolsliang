<script setup lang="ts">
import { categories, mockTools } from '~/data/tools'

const { locale, t } = usePrototype()
</script>

<template>
  <div id="top" class="variant variant-a">
    <header class="landing-header">
      <BrandMark />
      <nav aria-label="主要導覽">
        <a href="#popular">{{ t('熱門工具', 'Popular') }}</a>
        <a href="#workspace">{{ t('工具工作區', 'Workspace') }}</a>
        <a href="#privacy">{{ t('隱私承諾', 'Privacy') }}</a>
      </nav>
      <ThemeLanguageControls />
    </header>

    <main id="main-content">
      <section class="a-hero" aria-labelledby="a-title">
        <div class="a-hero__halo a-hero__halo--one" />
        <div class="a-hero__halo a-hero__halo--two" />
        <p class="hero-kicker"><UiIcon name="sparkle" />{{ t('台灣日常，一站完成', 'EVERYDAY TOOLS, ONE BRIGHT PLACE') }}</p>
        <h1 id="a-title">
          {{ t('事情很多，工具就該', 'Lots to do. Your tools should feel') }}
          <span>{{ t('簡單一點。', 'effortless.') }}</span>
        </h1>
        <p class="a-hero__intro">
          {{ t('從商品圖、PDF 到金額與行事曆，打開就能用。工具內容只在你的裝置處理。', 'From product images and PDFs to amounts and calendars—ready when you are, processed only on your device.') }}
        </p>
        <SearchBox autofocus />
        <div class="a-hero__popular">
          <span>{{ t('大家常找', 'POPULAR') }}</span>
          <button v-for="tool in mockTools.slice(0, 3)" :key="tool.slug" type="button">
            {{ locale === 'zh-tw' ? tool.name : tool.nameEn }}
          </button>
        </div>
        <div class="a-scroll-cue" aria-hidden="true"><span />{{ t('往下逛工具', 'Explore') }}</div>
      </section>

      <section class="a-categories section-shell" aria-labelledby="category-title">
        <div class="section-heading">
          <p class="eyebrow">{{ t('四個方向，快速抵達', 'FOUR QUICK PATHS') }}</p>
          <h2 id="category-title">{{ t('今天想處理哪一類？', 'What are you working on?') }}</h2>
        </div>
        <div class="a-category-row">
          <button v-for="(category, index) in categories" :key="category.name" type="button">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <strong>{{ locale === 'zh-tw' ? category.name : category.nameEn }}</strong>
            <small>{{ category.hint }}</small>
            <UiIcon name="arrow-right" />
          </button>
        </div>
      </section>

      <section id="popular" class="a-popular section-shell" aria-labelledby="popular-title">
        <div class="section-heading section-heading--row">
          <div>
            <p class="eyebrow">{{ t('熱門工具', 'MOST USED') }}</p>
            <h2 id="popular-title">{{ t('不用研究，直接開始。', 'Open one and get it done.') }}</h2>
          </div>
          <button class="outline-button" type="button">{{ t('查看全部工具', 'Browse all tools') }}<UiIcon name="arrow-right" /></button>
        </div>
        <div class="tool-grid">
          <ToolCard v-for="(tool, index) in mockTools.slice(0, 4)" :key="tool.slug" :tool="tool" :index="index" />
        </div>
      </section>

      <div id="privacy" class="section-shell"><PrivacyPromise /></div>

      <section id="workspace" class="a-workspace-section" aria-labelledby="workspace-preview-title">
        <div class="section-shell section-heading section-heading--row">
          <div>
            <p class="eyebrow">{{ t('進入工作模式', 'THEN, GET TO WORK') }}</p>
            <h2 id="workspace-preview-title">{{ t('Landing 與工具工作區，各自專心。', 'A calm landing. A focused workspace.') }}</h2>
          </div>
          <p>{{ t('找到工具後，切換到專為操作設計的 App Shell。', 'Once you choose a tool, the focused app shell takes over.') }}</p>
        </div>
        <div class="workspace-stage section-shell">
          <AppSidebar />
          <div class="workspace-stage__main">
            <div class="workspace-stage__bar">
              <SearchBox compact />
              <ThemeLanguageControls />
            </div>
            <ToolWorkspace />
          </div>
        </div>
      </section>
    </main>

    <MobileNavigation />
  </div>
</template>
