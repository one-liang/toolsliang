<script setup lang="ts">
import { ArrowDown, ArrowUp, X } from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { copy, type LocaleCode, type PublishedToolDefinition } from '@/features/tools/catalog'

type MoveAction = 'move-up' | 'move-down'

const props = defineProps<{ tools: PublishedToolDefinition[], locale: LocaleCode }>()
const emit = defineEmits<{ move: [slug: string, offset: -1 | 1], remove: [slug: string] }>()

const root = ref<HTMLElement | null>(null)
const announcement = ref('')
const pendingMove = ref<{ slug: string, action: MoveAction } | null>(null)

const text = computed(() => props.locale === 'en'
  ? {
      empty: 'No saved tools on this device yet. Open a tool and choose Save to keep it here.',
      moveUp: (name: string) => `Move ${name} up`,
      moveDown: (name: string) => `Move ${name} down`,
      remove: (name: string) => `Remove ${name} from saved tools`,
      position: (index: number, total: number) => `position ${index + 1} of ${total}`,
      moved: (name: string, index: number, total: number) => `${name} is now at position ${index + 1} of ${total}.`,
    }
  : {
      empty: '這台裝置還沒有常用工具。在工具頁按下「加入常用」，工具就會出現在這裡。',
      moveUp: (name: string) => `將「${name}」往上移`,
      moveDown: (name: string) => `將「${name}」往下移`,
      remove: (name: string) => `從常用移除「${name}」`,
      position: (index: number, total: number) => `目前第 ${index + 1} 個，共 ${total} 個`,
      moved: (name: string, index: number, total: number) => `已將「${name}」移到第 ${index + 1} 個，共 ${total} 個。`,
    })

function controlLabel(tool: PublishedToolDefinition, index: number, action: MoveAction) {
  const name = copy(tool.name, props.locale)
  const label = action === 'move-up' ? text.value.moveUp(name) : text.value.moveDown(name)
  return `${label}（${text.value.position(index, props.tools.length)}）`
}

function move(slug: string, action: MoveAction) {
  pendingMove.value = { slug, action }
  emit('move', slug, action === 'move-up' ? -1 : 1)
}

/**
 * A reorder happens in the host's state, so the button that started it can end
 * up somewhere else — or disabled at an end of the list. Announcing the new
 * position and following it with focus keeps keyboard reordering usable.
 */
watch(() => props.tools.map(tool => tool.slug).join('|'), async () => {
  const pending = pendingMove.value
  pendingMove.value = null
  if (!pending) return

  const index = props.tools.findIndex(tool => tool.slug === pending.slug)
  const tool = props.tools[index]
  if (!tool) return

  announcement.value = text.value.moved(copy(tool.name, props.locale), index, props.tools.length)

  await nextTick()
  const control = findControl(pending.slug, pending.action)
  const fallback = findControl(pending.slug, pending.action === 'move-up' ? 'move-down' : 'move-up')
  const target = control?.disabled ? fallback : control
  target?.focus()
})

function findControl(slug: string, action: MoveAction) {
  return root.value?.querySelector<HTMLButtonElement>(`[data-saved-slug="${slug}"] [data-saved-action="${action}"]`) ?? null
}
</script>

<template>
  <div ref="root" class="saved-tools">
    <ul v-if="tools.length" class="saved-tool-list">
      <li v-for="(tool, index) in tools" :key="tool.slug" class="saved-tool" :data-saved-slug="tool.slug">
        <NuxtLink class="saved-tool__link" :to="`/${locale}/tools/${tool.slug}/`">
          <span class="saved-tool__icon"><ToolIcon :name="tool.icon" :size="20" /></span>
          <span class="saved-tool__body">
            <span class="saved-tool__topline">
              <span class="saved-tool__name">{{ copy(tool.name, locale) }}</span>
              <ToolStatusBadge v-if="tool.status" :status="tool.status" :locale="locale" />
            </span>
            <span class="saved-tool__description">{{ copy(tool.description, locale) }}</span>
          </span>
        </NuxtLink>
        <div class="saved-tool__actions">
          <Button
            variant="ghost"
            size="icon"
            data-saved-action="move-up"
            :disabled="index === 0"
            :aria-label="controlLabel(tool, index, 'move-up')"
            @click="move(tool.slug, 'move-up')"
          >
            <ArrowUp :size="19" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            data-saved-action="move-down"
            :disabled="index === tools.length - 1"
            :aria-label="controlLabel(tool, index, 'move-down')"
            @click="move(tool.slug, 'move-down')"
          >
            <ArrowDown :size="19" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            data-saved-action="remove"
            :aria-label="text.remove(copy(tool.name, locale))"
            @click="emit('remove', tool.slug)"
          >
            <X :size="19" aria-hidden="true" />
          </Button>
        </div>
      </li>
    </ul>
    <p v-else class="saved-tools__empty">{{ text.empty }}</p>
    <p class="saved-tools__status sr-only" role="status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>
