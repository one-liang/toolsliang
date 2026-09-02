<script setup lang="ts">
import { mockTools } from '~/data/tools'

const { locale, sidebarCollapsed, t } = usePrototype()
const step = ref(1)
</script>

<template>
  <div id="top" class="variant variant-c">
    <header class="c-header">
      <BrandMark />
      <div class="c-header__statement"><span />{{ t('工具內容留在裝置', 'CONTENT STAYS ON DEVICE') }}</div>
      <ThemeLanguageControls />
    </header>

    <main id="main-content">
      <section class="c-hero" aria-labelledby="c-title">
        <div class="c-hero__number" aria-hidden="true">01</div>
        <div class="c-hero__copy">
          <p class="hero-kicker"><UiIcon name="sparkle" />{{ t('任務跑道', 'TASK RUNWAY') }}</p>
          <h1 id="c-title">{{ t('不是逛工具。是把事情一路做完。', 'Not a tool gallery. A runway to done.') }}</h1>
          <p>{{ t('先說你要做什麼，再沿著清楚的任務步驟前進；需要的工具與隱私狀態始終在旁邊。', 'Describe the task, then move through a clear sequence with tools and privacy status always in sight.') }}</p>
        </div>
        <div class="c-command">
          <div class="c-command__prompt">
            <span>01</span>
            <div>
              <label for="c-search">{{ t('告訴我，你想完成什麼？', 'What do you want to finish?') }}</label>
              <SearchBox input-id="c-search" />
            </div>
          </div>
          <div class="c-command__suggestions">
            <span>{{ t('從任務開始', 'START WITH A TASK') }}</span>
            <button v-for="tool in mockTools.slice(0, 4)" :key="tool.slug" type="button">
              {{ locale === 'zh-tw' ? tool.name : tool.nameEn }}<UiIcon name="arrow-right" />
            </button>
          </div>
        </div>
      </section>

      <section class="c-runway" aria-labelledby="runway-title">
        <aside class="c-rail" :class="{ 'c-rail--collapsed': sidebarCollapsed }">
          <button
            class="c-rail__toggle"
            type="button"
            :aria-expanded="!sidebarCollapsed"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            <UiIcon :name="sidebarCollapsed ? 'menu' : 'chevron-left'" />
            <span>{{ t('收合任務列', 'Collapse task rail') }}</span>
          </button>
          <ol>
            <li v-for="(item, index) in [t('選工具', 'Choose'), t('輸入內容', 'Input'), t('檢查結果', 'Review')]" :key="item" :class="{ active: step === index + 1 }">
              <button type="button" @click="step = index + 1">
                <span>0{{ index + 1 }}</span><strong>{{ item }}</strong>
              </button>
            </li>
          </ol>
          <div class="c-rail__privacy"><UiIcon name="shield" /><span>{{ t('本機處理', 'Local only') }}</span></div>
        </aside>

        <div class="c-runway__canvas">
          <header>
            <div>
              <span>{{ t('目前任務', 'CURRENT TASK') }} / 02</span>
              <h2 id="runway-title">{{ t('把金額轉成國字大寫', 'Convert an amount to NTD uppercase') }}</h2>
            </div>
            <div class="c-progress" aria-label="任務完成進度 66%"><i /><i class="done" /><i /></div>
          </header>
          <ToolWorkspace />
        </div>

        <aside class="c-context">
          <div>
            <p class="eyebrow">{{ t('為什麼是這個工具？', 'WHY THIS TOOL?') }}</p>
            <h3>{{ t('為台灣金額格式而設計', 'Designed for Taiwan’s amount format') }}</h3>
            <p>{{ t('適合支票與一般會計填寫參考；不會替你保存輸入。', 'Useful for cheques and accounting references; your input is not saved.') }}</p>
          </div>
          <PrivacyPromise compact />
          <div class="c-context__saved">
            <UiIcon name="heart" />
            <span>{{ t('加入常用工具，下次從任務列開啟', 'Save it to open from the task rail next time') }}</span>
            <button type="button">{{ t('加入常用', 'Save tool') }}</button>
          </div>
        </aside>
      </section>

      <section class="c-catalog" aria-labelledby="c-catalog-title">
        <div>
          <p class="eyebrow">{{ t('也可以直接挑工具', 'OR BROWSE DIRECTLY') }}</p>
          <h2 id="c-catalog-title">{{ t('熟悉的時候，少一步。', 'Skip a step when you know the way.') }}</h2>
        </div>
        <div class="c-catalog__track">
          <ToolCard v-for="(tool, index) in mockTools.slice(0, 4)" :key="tool.slug" :tool="tool" :index="index" />
        </div>
      </section>
    </main>

    <MobileNavigation />
  </div>
</template>
