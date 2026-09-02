<script setup lang="ts">
import type { PrototypeVariant } from '~/composables/usePrototype'

const props = defineProps<{
  current: PrototypeVariant
  labels: Record<PrototypeVariant, string>
}>()
const emit = defineEmits<{ change: [variant: PrototypeVariant] }>()
const order: PrototypeVariant[] = ['A', 'B', 'C']

const cycle = (direction: -1 | 1) => {
  const index = order.indexOf(props.current)
  emit('change', order[(index + direction + order.length) % order.length]!)
}

const handleKey = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
  if (event.key === 'ArrowLeft') cycle(-1)
  if (event.key === 'ArrowRight') cycle(1)
}

onMounted(() => window.addEventListener('keydown', handleKey))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKey))
</script>

<template>
  <aside class="prototype-switcher" aria-label="Prototype 方案切換器">
    <button type="button" aria-label="上一個方案" @click="cycle(-1)">
      <UiIcon name="arrow-left" />
    </button>
    <div class="prototype-switcher__label" aria-live="polite">
      <span>PROTOTYPE</span>
      <strong>{{ current }} · {{ labels[current] }}</strong>
    </div>
    <div class="prototype-switcher__options" aria-label="選擇方案">
      <button
        v-for="key in order"
        :key="key"
        type="button"
        :class="{ active: current === key }"
        :aria-current="current === key ? 'true' : undefined"
        :aria-label="`切換到方案 ${key}`"
        @click="emit('change', key)"
      >
        {{ key }}
      </button>
    </div>
    <button type="button" aria-label="下一個方案" @click="cycle(1)">
      <UiIcon name="arrow-right" />
    </button>
  </aside>
</template>
