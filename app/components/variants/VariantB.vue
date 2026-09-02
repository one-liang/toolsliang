<script setup lang="ts">
import { categories } from '~/data/tools'

const { filteredTools, locale, t } = usePrototype()
</script>

<template>
  <div id="top" class="variant variant-b">
    <AppSidebar tone="ink" />

    <div class="b-shell">
      <header class="b-topbar">
        <div>
          <p>{{ t('早安，今天要完成什麼？', 'Good morning. What are we finishing?') }}</p>
          <span><i />{{ t('所有工具都可匿名使用', 'Every tool works anonymously') }}</span>
        </div>
        <SearchBox compact />
        <ThemeLanguageControls />
      </header>

      <main id="main-content" class="b-main">
        <section class="b-launcher" aria-labelledby="b-title">
          <div class="b-launcher__copy">
            <p class="hero-kicker"><UiIcon name="command" />{{ t('工具駕駛艙', 'TOOL COCKPIT') }}</p>
            <h1 id="b-title">{{ t('找工具、做事情，留在同一個畫面。', 'Find it and finish it, in one view.') }}</h1>
            <p>{{ t('左邊導航、中間找工具、右邊直接工作。適合知道目標、想快速完成的人。', 'Navigate on the left, discover in the middle, work on the right—made for fast, task-first visits.') }}</p>
          </div>
          <PrivacyPromise compact />
        </section>

        <div class="b-dashboard">
          <section class="b-directory" aria-labelledby="b-directory-title">
            <div class="b-directory__header">
              <div>
                <p class="eyebrow">{{ t('工具導覽', 'DIRECTORY') }}</p>
                <h2 id="b-directory-title">{{ t('從分類開始', 'Start with a category') }}</h2>
              </div>
              <button type="button">{{ t('全部 24 個', 'All 24') }}<UiIcon name="arrow-right" /></button>
            </div>

            <div class="b-category-grid">
              <button v-for="(category, index) in categories" :key="category.name" type="button" :class="`b-category-${index}`">
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <strong>{{ locale === 'zh-tw' ? category.name : category.nameEn }}</strong>
                <small>{{ category.hint }}</small>
                <i>{{ index === 0 ? '08' : `0${index + 3}` }}</i>
              </button>
            </div>

            <div class="b-favorites">
              <div class="b-directory__header">
                <div>
                  <p class="eyebrow">{{ t('熱門與常用', 'POPULAR & SAVED') }}</p>
                  <h2>{{ t('下一次更快找到', 'Faster next time') }}</h2>
                </div>
              </div>
              <div class="b-tool-list">
                <ToolCard v-for="(tool, index) in filteredTools.slice(0, 3)" :key="tool.slug" :tool="tool" :index="index" />
              </div>
            </div>
          </section>

          <aside class="b-workbench" aria-label="已釘選的工具工作區">
            <div class="b-workbench__label">
              <span><i />{{ t('已釘選工作區', 'PINNED WORKSPACE') }}</span>
              <button type="button" aria-label="關閉工作區">×</button>
            </div>
            <ToolWorkspace />
          </aside>
        </div>
      </main>
    </div>

    <MobileNavigation />
  </div>
</template>
