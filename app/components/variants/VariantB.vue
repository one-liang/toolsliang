<script setup lang="ts">
import { categories, mockTools } from '~/data/tools'

const { filteredTools, locale, search, t } = usePrototype()
const root = ref<HTMLElement | null>(null)
const activeCategory = ref(0)
const workbenchVisible = ref(true)
const categoryIcons = ['sparkle', 'copy', 'command', 'home'] as const
let cleanupMotion: (() => void) | undefined

const visibleTools = computed(() => {
  if (search.value.trim()) return filteredTools.value.slice(0, 3)
  const category = categories[activeCategory.value]
  return filteredTools.value.filter(tool => tool.category === category?.name).slice(0, 3)
})

const categoryCount = (name: string) => mockTools.filter(tool => tool.category === name).length

const selectCategory = (index: number) => {
  search.value = ''
  activeCategory.value = index
}

const updateSpotlight = (event: PointerEvent) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const target = event.currentTarget as HTMLElement
  const bounds = target.getBoundingClientRect()
  target.style.setProperty('--pointer-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`)
  target.style.setProperty('--pointer-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`)
}

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
      .from('.b-topbar', { y: -12, opacity: 0, duration: 0.38 })
      .from('.b-launcher__copy > *', { y: 18, opacity: 0, stagger: 0.06, duration: 0.42 }, '-=0.18')
      .from('.b-privacy-note', { x: 18, opacity: 0, duration: 0.38 }, '-=0.25')
      .from('.b-category-grid button', {
        y: 14,
        opacity: 0,
        stagger: 0.045,
        duration: 0.32,
      }, '-=0.2')
      .from('.b-tool-list .tool-card', { y: 12, opacity: 0, stagger: 0.05, duration: 0.32 }, '-=0.18')
      .from('.b-workbench', { x: 22, opacity: 0, duration: 0.42 }, '-=0.28')
  }, root.value)
  cleanupMotion = () => context.revert()
})

onBeforeUnmount(() => cleanupMotion?.())
</script>

<template>
  <div id="top" ref="root" class="variant variant-b">
    <AppSidebar tone="plain" />

    <div class="b-shell">
      <header class="b-topbar">
        <div class="b-local-status">
          <span><i />{{ t('本機處理', 'Local processing') }}</span>
        </div>
        <SearchBox compact />
        <ThemeLanguageControls />
      </header>

      <main id="main-content" class="b-main">
        <section class="b-launcher" aria-labelledby="b-title" @pointermove="updateSpotlight">
          <div class="b-launcher__copy">
            <p class="hero-kicker"><UiIcon name="sparkle" />{{ t('24 個實用工具', '24 practical tools') }}</p>
            <h1 id="b-title">{{ t('想做什麼？', 'What do you need?') }}</h1>
            <div class="b-search-stage">
              <SearchBox input-id="b-tool-search" />
            </div>
          </div>
          <div class="b-privacy-note">
            <PrivacyPromise compact />
          </div>
        </section>

        <div class="b-dashboard" :class="{ 'b-dashboard--wide': !workbenchVisible }">
          <section class="b-directory" aria-labelledby="b-directory-title">
            <div class="b-directory__header">
              <div>
                <p class="eyebrow">{{ t('工具導覽', 'TOOLS') }}</p>
                <h2 id="b-directory-title">{{ t('選擇分類', 'Choose a category') }}</h2>
              </div>
              <button class="b-underlined-action" type="button">{{ t('全部工具', 'All tools') }}<UiIcon name="arrow-right" /></button>
            </div>

            <div class="b-category-grid">
              <button
                v-for="(category, index) in categories"
                :key="category.name"
                type="button"
                :class="[`b-category-${index}`, { active: activeCategory === index }]"
                :aria-pressed="activeCategory === index"
                @click="selectCategory(index)"
              >
                <span class="b-category-icon"><UiIcon :name="categoryIcons[index]!" /></span>
                <strong>{{ locale === 'zh-tw' ? category.name : category.nameEn }}</strong>
                <small>{{ categoryCount(category.name) }}</small>
              </button>
            </div>

            <div class="b-favorites">
              <div class="b-directory__header">
                <div>
                  <p class="eyebrow">{{ t('快速開始', 'QUICK START') }}</p>
                  <h2>{{ locale === 'zh-tw' ? `${categories[activeCategory]?.name ?? ''}工具` : `${categories[activeCategory]?.nameEn ?? ''} tools` }}</h2>
                </div>
              </div>
              <div class="b-tool-list">
                <ToolCard v-for="(tool, index) in visibleTools" :key="tool.slug" :tool="tool" :index="index" />
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
              <span><i />{{ t('目前工具', 'CURRENT TOOL') }}</span>
              <button type="button" :aria-label="t('收起工作區', 'Close workspace')" @click="workbenchVisible = false">×</button>
            </div>
            <ToolWorkspace />
          </aside>
        </div>
      </main>
    </div>

    <MobileNavigation />
  </div>
</template>
