<script setup lang="ts">
import {
  AlertCircle, Check, CheckCircle2, Crop, LoaderCircle, Search, Settings, Star,
} from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

definePageMeta({
  layout: 'app-shell',
  validate: route => ['zh-tw', 'en'].includes(String(route.params.locale)),
})

const { locale } = useAppLocale()
const sample = ref('')
const swatches = [
  ['background', '頁面背景'], ['surface', '主要表面'], ['surface-subtle', '次要表面'],
  ['foreground', '主要文字'], ['muted-foreground', '次要文字'], ['border', '邊界'],
  ['primary', '主要操作'], ['success', '成功'], ['warning', '提醒'], ['destructive', '錯誤'],
]
const spacing = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80]
const breakpoints = [
  ['phone', '0', '單欄、底部導覽'], ['phone-lg', '480px', '增加 gutter'],
  ['tablet', '768px', '雙欄分類網格'], ['desktop', '1024px', '桌面側邊欄'],
  ['desktop-lg', '1280px', '最多三欄'], ['wide', '1536px', '增加外側留白'],
]

usePageSeo({
  locale,
  path: '/design-system/',
  title: computed(() => locale.value === 'en' ? 'Design system' : '設計系統'),
  description: computed(() => locale.value === 'en'
    ? 'The tokens, components, states, and responsive rules used by toolsliang.'
    : 'toolsliang 使用中的 token、元件、狀態與響應式規則。'),
})
</script>

<template>
  <main id="main-content" class="workspace-page ds-page">
    <header class="workspace-heading ds-intro">
      <p class="eyebrow">Version 1.0 · formal baseline</p>
      <h1>{{ locale === 'en' ? 'toolsliang Design System' : 'toolsliang 設計系統' }}</h1>
      <p>{{ locale === 'en' ? 'A calm, fast, privacy-forward utility desk.' : '平靜、快速、重視隱私的日常工具桌。' }}</p>
      <div class="ds-principles">
        <Badge variant="outline">Primary #FF8C42</Badge>
        <Badge variant="outline">Flat, not shadowed</Badge>
        <Badge variant="outline">Local first</Badge>
        <Badge variant="outline">WCAG 2.2 AA</Badge>
        <Badge variant="outline">中文 + English</Badge>
      </div>
    </header>

    <section class="ds-section" aria-labelledby="ds-color">
      <div class="ds-section__heading"><span>01</span><div><h2 id="ds-color">Color & semantic tokens</h2><p>相同語意會隨 light / dark theme 切換，不在頁面寫任意色碼。</p></div></div>
      <div class="swatch-grid">
        <Card v-for="swatch in swatches" :key="swatch[0]" class="swatch-card">
          <span class="swatch-card__sample" :style="{ background: `var(--color-${swatch[0]})` }" />
          <strong>--color-{{ swatch[0] }}</strong><small>{{ swatch[1] }}</small>
        </Card>
      </div>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-type">
      <div class="ds-section__heading"><span>02</span><div><h2 id="ds-type">Typography</h2><p>系統字型優先，不載入第三方字型 CDN。</p></div></div>
      <Card class="type-specimen">
        <div class="type-display">事情處理好，內容不用交出去。</div>
        <div class="type-heading">A focused workspace for every tool.</div>
        <p>繁體中文使用 PingFang TC、Noto Sans TC 與微軟正黑體。English uses locally bundled Roboto. 內文行高保留足夠空間，讓中英文混排依然清楚。</p>
        <code>const content = 'stays on this device'</code>
      </Card>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-structure">
      <div class="ds-section__heading"><span>03</span><div><h2 id="ds-structure">Spacing, radius, border, shadow & z-index</h2><p>4px 基線、清楚邊界；卡片與 hover 一律沒有陰影。</p></div></div>
      <div class="ds-two-columns">
        <Card class="token-card"><h3>Spacing</h3><div v-for="space in spacing" :key="space" class="spacing-row"><code>{{ space }}px</code><span :style="{ width: `${Math.max(space, 2)}px` }" /></div></Card>
        <Card class="token-card"><h3>Shape & depth</h3><div class="radius-examples"><span>8</span><span>12</span><span>16</span><span>22</span></div><p><strong>Border</strong> · 1px semantic border</p><p><strong>Shadow</strong> · none; overlays only</p><p><strong>Z</strong> · 0 / 20 / 40 / 60 / 80 / 100</p></Card>
      </div>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-components">
      <div class="ds-section__heading"><span>04</span><div><h2 id="ds-components">Components & states</h2><p>由 shadcn-vue 慣例建立，公開 class 只使用 semantic token。</p></div></div>
      <Card class="component-showcase">
        <div class="component-row"><span class="component-label">Buttons</span><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><Button disabled>Disabled</Button><Button aria-busy="true"><LoaderCircle class="spin" :size="18" /> Loading</Button></div>
        <div class="component-row"><span class="component-label">Badges</span><Badge variant="new">NEW</Badge><Badge variant="pro">PRO</Badge><Badge variant="hot">熱門</Badge><Badge variant="saved">常用</Badge><Badge variant="success"><Check :size="13" />Success</Badge><Badge variant="error"><AlertCircle :size="13" />Error</Badge></div>
        <div class="component-row component-row--fields"><span class="component-label">Fields</span><label><span>Default</span><Input v-model="sample" placeholder="輸入內容" /></label><label><span>Error</span><Input aria-invalid="true" value="無效內容" /></label><label><span>Disabled</span><Input disabled value="不可編輯" /></label></div>
        <div class="state-grid">
          <div><Search /><strong>Hover</strong><p>只改背景與邊框</p></div><div><Settings /><strong>Focus</strong><p>3px ring + 2px offset</p></div><div><CheckCircle2 /><strong>Success</strong><p>文字、icon、顏色</p></div><div><AlertCircle /><strong>Error</strong><p>可宣告的錯誤訊息</p></div>
        </div>
      </Card>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-icons">
      <div class="ds-section__heading"><span>05</span><div><h2 id="ds-icons">Icons</h2><p>Lucide outline，固定 1.75–2px stroke；不使用 emoji 當結構 icon。</p></div></div>
      <Card class="icon-specimen"><span><Search :size="16" /><small>16</small></span><span><Star :size="20" /><small>20</small></span><span><Settings :size="24" /><small>24</small></span><span><Crop :size="32" /><small>32</small></span></Card>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-responsive">
      <div class="ds-section__heading"><span>06</span><div><h2 id="ds-responsive">Responsive behavior</h2><p>觸控優先，桌面才增加側邊欄；不把 hover 當必要操作。</p></div></div>
      <div class="breakpoint-table" role="table" aria-label="Responsive breakpoints">
        <div v-for="item in breakpoints" :key="item[0]" role="row"><strong role="cell">{{ item[0] }}</strong><code role="cell">{{ item[1] }}</code><span role="cell">{{ item[2] }}</span></div>
      </div>
      <div class="responsive-demo"><div class="responsive-demo__sidebar" /><div class="responsive-demo__content"><span /><span /><span /><span /></div><div class="responsive-demo__nav" /></div>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-motion">
      <div class="ds-section__heading"><span>07</span><div><h2 id="ds-motion">Motion & reduced motion</h2><p>80 / 150 / 220 / 360ms；不追蹤滑鼠、不持續漂浮、不讓 hover 位移。</p></div></div>
      <Card class="motion-demo"><span class="motion-dot" /><div><strong>Standard · cubic-bezier(0.2, 0, 0, 1)</strong><p>系統啟用 reduced motion 時，動畫立即收斂且內容不延遲顯示。</p></div></Card>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-a11y">
      <div class="ds-section__heading"><span>08</span><div><h2 id="ds-a11y">WCAG 2.2 AA baseline</h2><p>正式頁面與元件都必須遵守的交付條件。</p></div></div>
      <ul class="a11y-list"><li>一般文字 4.5:1，大字與 UI 邊界 3:1。</li><li>所有任務支援鍵盤；focus 可見且不被 sticky 區塊遮住。</li><li>產品互動目標以 44 × 44px 為基線。</li><li>支援 320px reflow、200% zoom 與文字間距覆寫。</li><li>狀態不只靠顏色；loading、error、success 有文字語意。</li></ul>
    </section>
  </main>
</template>
