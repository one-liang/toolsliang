<script setup lang="ts">
import { categories, mockTools } from '~/data/tools'

const { filteredTools, locale, t } = usePrototype()
const root = ref<HTMLElement | null>(null)
const workbenchVisible = ref(true)
const categoryIcons = ['sparkle', 'copy', 'command', 'home'] as const
let cleanupMotion: (() => void) | undefined

type ToolIconName = 'calendar' | 'calculator' | 'file-text' | 'image' | 'shuffle' | 'tool'
type BadgeTone = 'new' | 'popular' | 'pro' | 'saved'

interface ToolPresentation {
  icon: ToolIconName
  badge?: BadgeTone
}

const toolPresentation: Record<string, ToolPresentation> = {
  'image-compressor': { icon: 'image', badge: 'popular' },
  'product-image-workbench': { icon: 'image', badge: 'pro' },
  'pdf-signature': { icon: 'file-text', badge: 'new' },
  'new-taiwan-dollar-uppercase': { icon: 'calculator', badge: 'saved' },
  'taiwan-calendar': { icon: 'calendar', badge: 'new' },
  'local-draw': { icon: 'shuffle' },
}

const presentationFor = (slug: string): ToolPresentation => toolPresentation[slug] ?? { icon: 'tool' }

const badgeLabel = (badge: BadgeTone) => {
  if (badge === 'new') return 'NEW'
  if (badge === 'pro') return 'PRO'
  if (badge === 'popular') return t('熱門', 'HOT')
  return t('常用', 'SAVED')
}

const categoryGroups = computed(() => categories
  .map((category, index) => ({
    ...category,
    icon: categoryIcons[index]!,
    tools: filteredTools.value.filter(tool => tool.category === category.name),
  }))
  .filter(group => group.tools.length > 0))

const totalTools = computed(() => mockTools.length)

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
      .from('.b-category-panel', {
        y: 14,
        opacity: 0,
        stagger: 0.045,
        duration: 0.32,
      }, '-=0.2')
      .from('.b-tool-tile', { y: 10, opacity: 0, stagger: 0.035, duration: 0.28 }, '-=0.18')
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
        <SearchBox compact />
        <ThemeLanguageControls />
      </header>

      <main id="main-content" class="b-main">
        <section class="b-launcher" aria-labelledby="b-title">
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
                <h2 id="b-directory-title">{{ t('全部分類', 'All categories') }}</h2>
              </div>
              <span class="b-tool-count">{{ totalTools }} {{ t('個工具', 'tools') }}</span>
            </div>

            <div v-if="categoryGroups.length" class="b-category-board">
              <section v-for="group in categoryGroups" :key="group.name" class="b-category-panel">
                <header>
                  <span class="b-category-icon"><UiIcon :name="group.icon" /></span>
                  <h3>{{ locale === 'zh-tw' ? group.name : group.nameEn }}</h3>
                  <small>{{ group.tools.length }}</small>
                </header>

                <div class="b-category-tools">
                  <button
                    v-for="tool in group.tools"
                    :key="tool.slug"
                    class="b-tool-tile"
                    type="button"
                    @click="workbenchVisible = true"
                  >
                    <span class="b-tool-icon"><UiIcon :name="presentationFor(tool.slug).icon" /></span>
                    <span class="b-tool-copy">
                      <strong>{{ locale === 'zh-tw' ? tool.name : tool.nameEn }}</strong>
                      <small>{{ locale === 'zh-tw' ? tool.description : tool.descriptionEn }}</small>
                    </span>
                    <span
                      v-if="presentationFor(tool.slug).badge"
                      class="b-tool-badge"
                      :class="`b-tool-badge--${presentationFor(tool.slug).badge}`"
                    >
                      {{ badgeLabel(presentationFor(tool.slug).badge!) }}
                    </span>
                  </button>
                </div>
              </section>
            </div>
            <div v-else class="b-empty-state">
              {{ t('找不到符合的工具', 'No matching tools') }}
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
