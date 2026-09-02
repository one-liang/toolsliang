<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { Primitive, type PrimitiveProps } from 'reka-ui'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
type Size = 'default' | 'sm' | 'lg' | 'icon'

const props = withDefaults(defineProps<PrimitiveProps & {
  variant?: Variant
  size?: Size
  class?: HTMLAttributes['class']
}>(), {
  as: 'button',
  variant: 'default',
  size: 'default',
  class: undefined,
})

const classes = computed(() => cn(
  'ui-button',
  `ui-button--${props.variant}`,
  `ui-button--size-${props.size}`,
  props.class,
))
</script>

<template>
  <Primitive
    data-slot="button"
    :as="as"
    :as-child="asChild"
    :class="classes"
  >
    <slot />
  </Primitive>
</template>
