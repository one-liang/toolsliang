<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { computed, ref, useId } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { copy, searchTools, type LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode; large?: boolean }>()
const query = ref('')
const results = computed(() => searchTools(query.value, props.locale).slice(0, 6))
const helpId = useId()
const resultId = useId()
</script>

<template>
  <div :class="['tool-search', { 'tool-search--large': large }]">
    <Search class="tool-search__icon" :size="large ? 24 : 20" aria-hidden="true" />
    <Input
      v-model="query"
      type="search"
      autocomplete="off"
      :placeholder="locale === 'en' ? 'Search tools, e.g. NTD amount' : '搜尋工具，例如：支票金額'"
      :aria-label="locale === 'en' ? 'Search all tools' : '搜尋全部工具'"
      :aria-describedby="helpId"
    />
    <Button
      v-if="query"
      variant="ghost"
      size="icon"
      class="tool-search__clear"
      :aria-label="locale === 'en' ? 'Clear search' : '清除搜尋'"
      @click="query = ''"
    >
      <X :size="18" aria-hidden="true" />
    </Button>
    <span :id="helpId" class="sr-only">
      {{ locale === 'en' ? 'Search runs only in this browser.' : '搜尋只在此瀏覽器內執行。' }}
    </span>
    <div
      v-if="query"
      :id="resultId"
      class="tool-search__results"
      role="region"
      aria-live="polite"
      :aria-label="locale === 'en' ? 'Tool search results' : '工具搜尋結果'"
    >
      <NuxtLink
        v-for="tool in results"
        :key="tool.slug"
        class="tool-search__result"
        :to="`/${locale}/tools/${tool.slug}/`"
      >
        <ToolIcon :name="tool.icon" />
        <span>{{ copy(tool.name, locale) }}</span>
        <ToolStatusBadge v-if="tool.status" :status="tool.status" :locale="locale" />
      </NuxtLink>
      <p v-if="!results.length" class="tool-search__empty">
        {{ locale === 'en' ? 'No matching tools yet.' : '目前沒有相符工具。' }}
      </p>
    </div>
  </div>
</template>
