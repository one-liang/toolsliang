<script setup lang="ts">
const props = withDefaults(defineProps<{ compact?: boolean; autofocus?: boolean; inputId?: string }>(), {
  compact: false,
  autofocus: false,
  inputId: undefined,
})
const { filteredTools, locale, search, t } = usePrototype()
const showResults = ref(false)
const generatedId = useId()
const resolvedInputId = computed(() => props.inputId ?? generatedId)
const hideResults = () => window.setTimeout(() => (showResults.value = false), 120)
</script>

<template>
  <div class="search-box" :class="{ 'search-box--compact': compact }">
    <UiIcon name="search" :size="compact ? 19 : 24" />
    <label class="sr-only" :for="resolvedInputId">{{ t('搜尋工具', 'Search tools') }}</label>
    <input
      :id="resolvedInputId"
      v-model="search"
      type="search"
      :autofocus="autofocus"
      autocomplete="off"
      :placeholder="t('想完成什麼？搜尋圖片、PDF、金額…', 'What do you need? Search images, PDFs, amounts…')"
      @focus="showResults = true"
      @blur="hideResults"
    >
    <kbd v-if="!compact">⌘ K</kbd>
    <div v-if="showResults && search" class="search-results" role="listbox">
      <button
        v-for="tool in filteredTools.slice(0, 4)"
        :key="tool.slug"
        type="button"
        role="option"
        @mousedown.prevent
        @click="search = locale === 'zh-tw' ? tool.name : tool.nameEn; showResults = false"
      >
        <span>{{ locale === 'zh-tw' ? tool.name : tool.nameEn }}</span>
        <small>{{ tool.category }}</small>
      </button>
      <p v-if="filteredTools.length === 0">
        {{ t('還找不到。試試「圖片」或「PDF」。', 'No match yet. Try “image” or “PDF”.') }}
      </p>
    </div>
  </div>
</template>
