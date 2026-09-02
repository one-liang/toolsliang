<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { copy, type LocaleCode, type ToolDefinition } from '@/features/tools/catalog'

defineProps<{ tool: ToolDefinition; locale: LocaleCode }>()
</script>

<template>
  <Card class="tool-card">
    <NuxtLink class="tool-card__link" :to="`/${locale}/tools/${tool.slug}/`">
      <span class="tool-card__icon"><ToolIcon :name="tool.icon" /></span>
      <span class="tool-card__body">
        <span class="tool-card__topline">
          <span class="tool-card__name">{{ copy(tool.name, locale) }}</span>
          <ToolStatusBadge v-if="tool.status" :status="tool.status" :locale="locale" />
        </span>
        <span class="tool-card__description">{{ copy(tool.description, locale) }}</span>
      </span>
      <ArrowRight class="tool-card__arrow" :size="18" aria-hidden="true" />
    </NuxtLink>
  </Card>
</template>
