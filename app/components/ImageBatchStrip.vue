<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { CircleCheck, Clock, LoaderCircle, RotateCcw, Trash2, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { ImageBatchItem } from '@/composables/useImageBatch'
import type { LocalizedCopy } from '@/features/tools/catalog'
import { imageBatchStatusLabels, imageInputErrors } from '@/features/images/messages'

/**
 * Every picture of a batch as a thumbnail with its state, and the one on screen.
 *
 * The thumbnails are one listbox, a single stop for the Tab key: the arrow keys,
 * Home and End move through it and the preview follows, and Delete removes the
 * picture under focus. Removing and retrying are also buttons beside the
 * current picture's name, so a pointer or a screen reader never needs the key.
 * State is said three ways — an icon badge, the tile's border and words — so
 * colour never carries it alone.
 */
const props = withDefaults(defineProps<{
  items: readonly ImageBatchItem[]
  selectedId?: string
  /** Stops removing and retrying while the tool cannot let go of a picture; choosing one to preview stays possible. */
  disabled?: boolean
  /** What a failed picture's error code means. The shared input errors are always included. */
  messages?: Record<string, LocalizedCopy>
}>(), { selectedId: undefined, disabled: false, messages: () => ({}) })

const emit = defineEmits<{ select: [id: string], remove: [id: string], retry: [id: string] }>()

const { locale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const id = useId()
const list = ref<HTMLElement>()
let refocus = false

const icons = { pending: Clock, running: LoaderCircle, done: CircleCheck, failed: TriangleAlert }
const currentIndex = computed(() => Math.max(0, props.items.findIndex(item => item.id === props.selectedId)))
const current = computed(() => props.items.find(item => item.id === props.selectedId))
const position = (index: number) => en.value ? `${index + 1} of ${props.items.length}` : `第 ${index + 1}／${props.items.length} 張`
const optionAt = (index: number) => list.value?.querySelectorAll<HTMLElement>('[role="option"]')[index]
const statusOf = (item: ImageBatchItem) => imageBatchStatusLabels[item.status][locale.value]
const messageOf = (item: ImageBatchItem) => item.error ? ({ ...imageInputErrors, ...props.messages })[item.error]?.[locale.value] ?? '' : ''

const summary = computed(() => {
  const count = { pending: 0, running: 0, done: 0, failed: 0 }
  for (const item of props.items) count[item.status] += 1

  return en.value
    ? `${props.items.length} images: ${count.done} done, ${count.running} working, ${count.failed} failed, ${count.pending} waiting.`
    : `共 ${props.items.length} 張：${count.done} 張完成、${count.running} 張處理中、${count.failed} 張失敗、${count.pending} 張等待處理。`
})

function choose(index: number) {
  const item = props.items[index]
  if (!item) return
  emit('select', item.id)
  optionAt(index)?.focus()
}

function remove(item: ImageBatchItem) {
  if (!props.disabled) emit('remove', item.id)
}

function onKey(event: KeyboardEvent) {
  const last = props.items.length - 1
  const moves: Record<string, number> = {
    ArrowRight: Math.min(last, currentIndex.value + 1),
    ArrowDown: Math.min(last, currentIndex.value + 1),
    ArrowLeft: Math.max(0, currentIndex.value - 1),
    ArrowUp: Math.max(0, currentIndex.value - 1),
    Home: 0,
    End: last,
  }
  if (event.key in moves) {
    event.preventDefault()
    choose(moves[event.key]!)
  }
  else if ((event.key === 'Delete' || event.key === 'Backspace') && current.value && !props.disabled) {
    event.preventDefault()
    refocus = true
    remove(current.value)
  }
}

/** After a removal from the keyboard, focus lands on the picture that took its place. */
watch(() => [props.items, props.selectedId] as const, async () => {
  if (!refocus) return
  refocus = false
  await nextTick()
  optionAt(currentIndex.value)?.focus()
})

/** A picture chosen from outside the row is brought into view inside it. */
watch(() => props.selectedId, async () => {
  await nextTick()
  optionAt(currentIndex.value)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
})
</script>

<template>
  <div v-if="items.length" class="image-batch-strip">
    <p class="sr-only" role="status">{{ summary }}</p>
    <ul
      ref="list"
      role="listbox"
      class="image-batch-strip__list"
      aria-orientation="horizontal"
      :aria-label="en ? 'Images in this batch' : '這批圖片'"
      :aria-describedby="`${id}-hint`"
      aria-keyshortcuts="Delete"
      @keydown="onKey"
    >
      <li
        v-for="(item, index) in items"
        :key="item.id"
        role="option"
        class="image-batch-strip__item"
        :aria-selected="item.id === selectedId"
        :tabindex="index === currentIndex ? 0 : -1"
        :data-batch-item="item.id"
        :data-batch-status="item.status"
        @click="choose(index)"
      >
        <img v-if="item.url" :src="item.url" alt="" decoding="async" loading="lazy" draggable="false">
        <span class="image-batch-strip__badge" :data-status="item.status" aria-hidden="true">
          <component :is="icons[item.status]" :size="14" :stroke-width="2.5" />
        </span>
        <span class="sr-only">{{ position(index) }}{{ en ? ': ' : '：' }}{{ item.file.name }}{{ en ? ', ' : '，' }}{{ statusOf(item) }}</span>
      </li>
    </ul>
    <p :id="`${id}-hint`" class="sr-only">
      {{ en ? 'Use the arrow keys to choose an image to preview. Press Delete to remove it.' : '用方向鍵選擇要預覽的圖片，按 Delete 鍵可以移除。' }}
    </p>
    <div v-if="current" class="image-batch-strip__current" :data-batch-current="current.id">
      <p class="image-batch-strip__caption">
        <span class="image-batch-strip__position">{{ position(currentIndex) }}</span>
        <span class="image-batch-strip__name" :title="current.file.name">{{ current.file.name }}</span>
        <span class="image-batch-strip__state" :data-status="current.status">
          <component :is="icons[current.status]" :size="16" aria-hidden="true" />{{ statusOf(current) }}
        </span>
      </p>
      <div class="image-batch-strip__actions">
        <Button v-if="current.status === 'failed' && current.retryable" variant="outline" :disabled="disabled" data-batch-retry @click="emit('retry', current.id)">
          <RotateCcw :size="16" aria-hidden="true" />{{ en ? 'Try again' : '重試' }}
        </Button>
        <Button variant="outline" :disabled="disabled" data-batch-remove @click="remove(current)">
          <Trash2 :size="16" aria-hidden="true" />{{ en ? 'Remove' : '移除' }}
        </Button>
      </div>
      <p v-if="current.status === 'failed' && messageOf(current)" class="image-batch-strip__error">
        <TriangleAlert :size="16" aria-hidden="true" />{{ messageOf(current) }}
      </p>
    </div>
  </div>
</template>
