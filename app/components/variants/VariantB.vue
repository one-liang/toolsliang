<script setup lang="ts">
import { categories } from '~/data/tools'

const { filteredTools, locale, t } = usePrototype()
const root = ref<HTMLElement | null>(null)
const activeCategory = ref(0)
const workbenchVisible = ref(true)
let cleanupMotion: (() => void) | undefined

onMounted(async () => {
  if (!root.value) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  root.value.dataset.motion = reduceMotion ? 'reduced' : 'active'
  if (reduceMotion) return

  const { gsap } = await import('gsap')
  const context = gsap.context(() => {
    const timeline = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        if (root.value) root.value.dataset.motion = 'ready'
      },
    })
    timeline
      .from('.b-topbar', { y: -18, opacity: 0, duration: 0.45 })
      .from('.b-motion-hero > *:not(.doodle-layer)', { y: 24, opacity: 0, stagger: 0.07, duration: 0.5 }, '-=0.2')
      .from('.b-category-grid button', {
        y: 20,
        opacity: 0,
        rotation: (index) => [-1.4, 1.1, 0.7, -0.8][index] ?? 0,
        stagger: 0.06,
        duration: 0.42,
      }, '-=0.28')
      .from('.b-workbench', { x: 28, opacity: 0, duration: 0.5 }, '-=0.35')

    gsap.fromTo(
      '.doodle-stroke',
      { strokeDasharray: 1, strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 0.9, stagger: 0.09, ease: 'power2.inOut' },
    )
  }, root.value)
  cleanupMotion = () => context.revert()
})

onBeforeUnmount(() => cleanupMotion?.())
</script>

<template>
  <div id="top" ref="root" class="variant variant-b">
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
        <section class="b-launcher b-motion-hero" aria-labelledby="b-title">
          <DoodleLayer />
          <span class="b-tape b-tape--hero" aria-hidden="true" />
          <div class="b-launcher__copy">
            <p class="hero-kicker"><UiIcon name="command" />{{ t('手繪工具桌', 'THE TOOL SKETCHBOOK') }}</p>
            <h1 id="b-title">
              {{ t('找工具、做事情，', 'Find it and finish it,') }}
              <span class="b-marker">{{ t('留在同一張桌上。', 'on one lively desk.') }}</span>
            </h1>
            <p>{{ t('左邊翻分類、中間挑工具、右邊直接動手。像攤開工作手帳，清楚但不無聊。', 'Flip through categories on the left, pick a tool in the middle, and get to work on the right—clear, lively, and all in view.') }}</p>
            <span class="b-hand-note">{{ t('先找，再做，完成。', 'find → make → done') }}</span>
          </div>
          <div class="b-privacy-note">
            <span class="b-tape" aria-hidden="true" />
            <PrivacyPromise compact />
            <small>{{ t('這不是雲端便條：內容真的不會離開裝置。', 'Not a cloud note—your content truly stays here.') }}</small>
          </div>
        </section>

        <div class="b-dashboard" :class="{ 'b-dashboard--wide': !workbenchVisible }">
          <section class="b-directory" aria-labelledby="b-directory-title">
            <span class="b-paperclip" aria-hidden="true" />
            <div class="b-directory__header">
              <div>
                <p class="eyebrow">{{ t('工具導覽', 'TOOL INDEX') }}</p>
                <h2 id="b-directory-title">{{ t('今天從哪一頁開始？', 'Which page do we open today?') }}</h2>
              </div>
              <button class="b-underlined-action" type="button">{{ t('翻全部 24 個', 'Flip through all 24') }}<UiIcon name="arrow-right" /></button>
            </div>

            <div class="b-category-grid">
              <button
                v-for="(category, index) in categories"
                :key="category.name"
                type="button"
                :class="[`b-category-${index}`, { active: activeCategory === index }]"
                :aria-pressed="activeCategory === index"
                @click="activeCategory = index"
              >
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <strong>{{ locale === 'zh-tw' ? category.name : category.nameEn }}</strong>
                <small>{{ category.hint }}</small>
                <i>{{ index === 0 ? '08' : `0${index + 3}` }}</i>
                <svg viewBox="0 0 120 20" aria-hidden="true"><path pathLength="1" d="M3 13c28-7 63-8 113-3" /></svg>
              </button>
            </div>

            <div class="b-favorites">
              <div class="b-directory__header">
                <div>
                  <p class="eyebrow">{{ t('熱門與常用', 'POPULAR & SAVED') }}</p>
                  <h2>{{ t('夾在手帳裡，下次更快。', 'Keep these within easy reach.') }}</h2>
                </div>
              </div>
              <div class="b-tool-list">
                <ToolCard v-for="(tool, index) in filteredTools.slice(0, 3)" :key="tool.slug" :tool="tool" :index="index" />
              </div>
            </div>
          </section>

          <button
            v-if="!workbenchVisible"
            class="b-workbench-tab"
            type="button"
            :aria-expanded="false"
            @click="workbenchVisible = true"
          >
            <UiIcon name="tool" />{{ t('打開工作頁', 'Open work page') }}
          </button>

          <aside v-show="workbenchVisible" class="b-workbench" aria-label="已釘選的工具工作區">
            <div class="b-workbench__label">
              <span><i />{{ t('已攤開的工作頁', 'OPEN WORK PAGE') }}</span>
              <button type="button" :aria-label="t('收起工作區', 'Close workspace')" @click="workbenchVisible = false">×</button>
            </div>
            <span class="b-tape b-tape--workbench" aria-hidden="true" />
            <ToolWorkspace />
          </aside>
        </div>
      </main>
    </div>

    <MobileNavigation />
  </div>
</template>
