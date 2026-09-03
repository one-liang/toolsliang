<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'secondary' | 'outline' | 'new' | 'pro' | 'hot' | 'saved' | 'success' | 'error'

const props = withDefaults(defineProps<{
  variant?: Variant
  class?: HTMLAttributes['class']
}>(), { variant: 'default', class: undefined })
</script>

<template>
  <span data-slot="badge" :class="cn('ui-badge', `ui-badge--${variant}`, props.class)">
    <slot />
  </span>
</template>
