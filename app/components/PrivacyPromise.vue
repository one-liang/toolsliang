<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const { t } = usePrototype()
</script>

<template>
  <section class="privacy-promise" :class="{ 'privacy-promise--compact': compact }" aria-labelledby="privacy-title">
    <div class="privacy-promise__icon"><UiIcon name="shield" :size="compact ? 22 : 30" /></div>
    <div>
      <p class="eyebrow">{{ t('本機處理', 'LOCAL PROCESSING') }}</p>
      <h2 id="privacy-title">{{ t('工具內容，只留在你的裝置。', 'Your tool content stays on your device.') }}</h2>
      <p v-if="!compact">
        {{ t('圖片、PDF、文字、數值與處理結果都不會上傳到 toolsliang、Supabase、分析服務或第三方。', 'Images, PDFs, text, values, and results are never sent to toolsliang, Supabase, analytics, or third parties.') }}
      </p>
    </div>
    <ul v-if="!compact">
      <li><UiIcon name="check" />{{ t('匿名也能使用全部工具', 'Every tool works anonymously') }}</li>
      <li><UiIcon name="check" />{{ t('搜尋同樣在瀏覽器內完成', 'Search also runs in your browser') }}</li>
    </ul>
  </section>
</template>
