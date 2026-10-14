<script setup lang="ts">
import {
  AlertCircle, Check, CheckCircle2, Crop, LoaderCircle, Search, Settings, Star,
} from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { isSupportedLocale, publishedTools } from '@/features/tools/catalog'

definePageMeta({
  layout: 'app-shell',
  validate: route => isSupportedLocale(String(route.params.locale)),
})

const { locale } = useAppLocale()
const sample = ref('')
const errorFieldId = useId()
const errorMessageId = useId()
const showcaseTools = computed(() => publishedTools.slice(0, 2))
const swatches = [
  ['color-background', '頁面背景'], ['color-surface-subtle', '次要表面'], ['color-foreground', '主要文字'],
  ['color-muted-foreground', '次要文字'], ['color-border', '2px 邊界'], ['color-primary', '強調與 hover'],
  ['color-result-surface', '結果區'], ['color-holiday', '放假日'], ['color-success', '成功'], ['color-destructive', '錯誤'],
]
const fills = [
  ['fill-image-commerce', '圖片與商務素材'], ['fill-document', '文件與金額'], ['fill-time-calendar', '時間與行事曆'],
  ['fill-calculation', '計算工具'], ['fill-random-selection', '本機抽選'],
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
  <main id="main-content" class="workspace-page ds-page" tabindex="-1">
    <header class="workspace-heading ds-intro">
      <h1>{{ locale === 'en' ? 'toolsliang Design System' : 'toolsliang 設計系統' }}</h1>
      <p>{{ locale === 'en' ? 'White paper, ink rules and five flat category fills: clear at a glance, never shadowed.' : '白紙、黑框與五色分類平塗：一眼看懂，從不加陰影。' }}</p>
      <div class="ds-principles">
        <Badge variant="outline">Ink #0B0B0B</Badge>
        <Badge variant="pro">Accent #FFD23F</Badge>
        <Badge variant="outline">2px rules, no shadows</Badge>
        <Badge variant="outline">Local first</Badge>
        <Badge variant="outline">WCAG 2.2 AA</Badge>
        <Badge variant="outline">中文 + English</Badge>
      </div>
    </header>

    <section class="ds-section" aria-labelledby="ds-color">
      <div class="ds-section__heading"><div><h2 id="ds-color">Color & semantic tokens</h2><p>語意色隨 light / dark theme 切換；五個分類平塗色在兩種主題都不變，上面的文字一律用墨色。</p></div></div>
      <div class="swatch-grid">
        <Card v-for="swatch in swatches" :key="swatch[0]" class="swatch-card">
          <span class="swatch-card__sample" :style="{ background: `var(--${swatch[0]})` }" />
          <strong>--{{ swatch[0] }}</strong><small>{{ swatch[1] }}</small>
        </Card>
      </div>
      <h3 class="ds-subheading">Category fills</h3>
      <div class="swatch-grid">
        <Card v-for="fill in fills" :key="fill[0]" class="swatch-card">
          <span class="swatch-card__sample" :style="{ background: `var(--${fill[0]})` }" />
          <strong>--{{ fill[0] }}</strong><small>{{ fill[1] }}</small>
        </Card>
      </div>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-type">
      <div class="ds-section__heading"><div><h2 id="ds-type">Typography</h2><p>中文用各平台系統字型，英文與數字用自架的 Archivo，不載入第三方字型 CDN。</p></div></div>
      <Card class="type-specimen">
        <div class="type-display">免費線上工具，一頁辦好一件事</div>
        <div class="type-heading">One page, one job done.</div>
        <p>繁體中文使用各平台的系統字型：Apple 裝置是 PingFang TC，Windows 是微軟正黑體，其他平台為 Noto Sans TC。English and numerals use the self-hosted Archivo variable font. 標題用 800 字重與收緊的字距。</p>
        <code>const content = 'stays on this device'</code>
      </Card>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-structure">
      <div class="ds-section__heading"><div><h2 id="ds-structure">Spacing, radius, border, shadow & z-index</h2><p>4px 基線、2px 墨色邊界；任何元件都不使用陰影。</p></div></div>
      <div class="ds-two-columns">
        <Card class="token-card"><h3>Spacing</h3><div v-for="space in spacing" :key="space" class="spacing-row"><code>{{ space }}px</code><span :style="{ width: `${Math.max(space, 2)}px` }" /></div></Card>
        <Card class="token-card"><h3>Shape & depth</h3><div class="radius-examples"><span>12</span><span>16</span><span>20</span><span>28</span></div><p><strong>Border</strong> · 2px ink rule</p><p><strong>Shadow</strong> · none, anywhere</p><p><strong>Z</strong> · 0 / 20 / 40 / 60 / 80 / 100</p></Card>
      </div>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-components">
      <div class="ds-section__heading"><div><h2 id="ds-components">Components & states</h2><p>由 shadcn-vue 慣例建立，公開 class 只使用 semantic token。</p></div></div>
      <Card class="component-showcase">
        <div class="component-row"><span class="component-label">Buttons</span><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><Button disabled>Disabled</Button><Button aria-busy="true"><LoaderCircle class="spin" :size="18" /> Loading</Button></div>
        <div class="component-row"><span class="component-label">Badges</span><Badge variant="new">NEW</Badge><Badge variant="pro">PRO</Badge><Badge variant="hot">熱門</Badge><Badge variant="saved">常用</Badge><Badge variant="success"><Check :size="13" />Success</Badge><Badge variant="error"><AlertCircle :size="13" />Error</Badge></div>
        <div class="component-row component-row--fields"><span class="component-label">Fields</span><label><span>Default</span><Input v-model="sample" placeholder="輸入內容" /></label><label><span>Error</span><Input aria-invalid="true" value="無效內容" /></label><label><span>Disabled</span><Input disabled value="不可編輯" /></label></div>
      </Card>

      <h3 class="ds-subheading">Interaction & feedback states</h3>
      <p class="ds-subheading__note">每個狀態都是實際 production 元件，可直接用滑鼠與鍵盤驗證；狀態一律搭配文字，不只靠顏色。</p>
      <div class="state-matrix">
        <article class="state-demo">
          <h4>Hover</h4>
          <Button data-state-demo="hover" variant="outline">尋找工具</Button>
          <p>指標移入改成黃色背景與墨色邊框，沒有陰影或位移。</p>
        </article>
        <article class="state-demo">
          <h4>Focus</h4>
          <Button data-state-demo="focus" variant="outline">用 Tab 聚焦這顆按鈕</Button>
          <p>鍵盤 focus 顯示 3px focus ring 與 2px offset。</p>
        </article>
        <article class="state-demo">
          <h4>Active</h4>
          <Button data-state-demo="active">按住看按下狀態</Button>
          <p>按下時切換到 primary active token，轉場 80ms。</p>
        </article>
        <article class="state-demo">
          <h4>Disabled</h4>
          <Button data-state-demo="disabled" disabled>目前無法使用</Button>
          <p>停用時同時關閉指標事件，並以文字說明無法使用。</p>
        </article>
        <article class="state-demo">
          <h4>Loading</h4>
          <Button data-state-demo="loading" aria-busy="true">
            <LoaderCircle class="spin" :size="18" aria-hidden="true" />處理中…
          </Button>
          <p>以 aria-busy 與「處理中」文字宣告，不只靠旋轉動畫。</p>
        </article>
        <article class="state-demo">
          <h4>Error</h4>
          <label class="state-demo__label" :for="errorFieldId">輸入金額（新臺幣）</label>
          <Input
            :id="errorFieldId"
            data-state-demo="error"
            aria-invalid="true"
            :aria-describedby="errorMessageId"
            default-value="1o.999"
          />
          <p :id="errorMessageId" class="field-error" role="alert">請輸入零以上、小數點後最多兩位的金額。</p>
        </article>
        <article class="state-demo">
          <h4>Success</h4>
          <p class="state-message" data-state-demo="success">
            <CheckCircle2 :size="17" aria-hidden="true" />已複製結果到剪貼簿
          </p>
          <p>成功訊息同時提供 icon、文字與語意色，且不自動消失。</p>
        </article>
      </div>

      <h3 class="ds-subheading">App shell components</h3>
      <p class="ds-subheading__note">工具卡片、狀態標籤與本機搜尋都是 App Shell 正在使用的元件；側欄、底部導覽與分類 drawer 就是包住本頁的外框。</p>
      <div class="shell-showcase">
        <ToolCard v-for="tool in showcaseTools" :key="tool.slug" :tool="tool" :locale="locale" />
      </div>
      <div class="shell-showcase__search">
        <span class="component-label">Search</span>
        <ToolSearch :locale="locale" />
      </div>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-icons">
      <div class="ds-section__heading"><div><h2 id="ds-icons">Icons</h2><p>Lucide outline，固定 1.75–2px stroke；不使用 emoji 當結構 icon。</p></div></div>
      <Card class="icon-specimen"><span><Search :size="16" /><small>16</small></span><span><Star :size="20" /><small>20</small></span><span><Settings :size="24" /><small>24</small></span><span><Crop :size="32" /><small>32</small></span></Card>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-responsive">
      <div class="ds-section__heading"><div><h2 id="ds-responsive">Responsive behavior</h2><p>觸控優先，桌面才增加側邊欄；不把 hover 當必要操作。</p></div></div>
      <div class="breakpoint-table" role="table" aria-label="Responsive breakpoints">
        <div v-for="item in breakpoints" :key="item[0]" role="row"><strong role="cell">{{ item[0] }}</strong><code role="cell">{{ item[1] }}</code><span role="cell">{{ item[2] }}</span></div>
      </div>
      <div class="responsive-demo"><div class="responsive-demo__sidebar" /><div class="responsive-demo__content"><span /><span /><span /><span /></div><div class="responsive-demo__nav" /></div>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-motion">
      <div class="ds-section__heading"><div><h2 id="ds-motion">Motion & reduced motion</h2><p>80 / 150 / 220 / 360ms；不追蹤滑鼠、不持續漂浮。首頁的示範動畫以 GSAP 只播放一次。</p></div></div>
      <Card class="motion-demo"><span class="motion-dot" /><div><strong>Standard · cubic-bezier(0.2, 0, 0, 1)</strong><p>系統啟用 reduced motion 時，動畫立即收斂且內容不延遲顯示。</p></div></Card>
    </section>

    <Separator />
    <section class="ds-section" aria-labelledby="ds-a11y">
      <div class="ds-section__heading"><div><h2 id="ds-a11y">WCAG 2.2 AA baseline</h2><p>正式頁面與元件都必須遵守的交付條件。</p></div></div>
      <ul class="a11y-list"><li>一般文字 4.5:1，大字與 UI 邊界 3:1。</li><li>所有任務支援鍵盤；focus 可見且不被 sticky 區塊遮住。</li><li>產品互動目標以 44 × 44px 為基線。</li><li>支援 320px reflow、200% zoom 與文字間距覆寫。</li><li>狀態不只靠顏色；loading、error、success 有文字語意。</li></ul>
    </section>
  </main>
</template>
