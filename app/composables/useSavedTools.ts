import { computed, onMounted, readonly } from 'vue'
import { getDeviceStorage } from '@/features/shell/device-storage'
import {
  addSavedTool,
  moveSavedTool,
  persistSavedTools,
  readSavedTools,
  removeSavedTool,
  toggleSavedTool,
} from '@/features/shell/saved-tools'
import { resolvePublishedTools, resolveToolSlug } from '@/features/tools/catalog'

/**
 * Anonymous common tools: the stable tool ids this device saved, in the order
 * the visitor arranged them. Nothing about tool content, usage, or history is
 * recorded, and storage is only written after an explicit save, removal, or
 * reorder — a visit that never saves anything leaves no trace on the device.
 */
export function useSavedTools() {
  const savedSlugs = useState<string[]>('saved-tool-slugs', () => [])
  const restored = useState('saved-tools-restored', () => false)

  onMounted(() => {
    if (restored.value) return
    restored.value = true
    savedSlugs.value = readSavedTools(getDeviceStorage(), slug => resolveToolSlug(slug))
  })

  const savedTools = computed(() => resolvePublishedTools(savedSlugs.value))
  const isSaved = (slug: string) => savedSlugs.value.includes(slug)

  function commit(next: string[]) {
    savedSlugs.value = next
    persistSavedTools(getDeviceStorage(), next)
  }

  return {
    savedSlugs: readonly(savedSlugs),
    savedTools,
    isSaved,
    /** Saves an unsaved tool or removes a saved one, following a renamed slug to the tool it became. */
    toggleSaved(slug: string) {
      const current = resolveToolSlug(slug)
      if (!current) return
      commit(toggleSavedTool(savedSlugs.value, current))
    },
    saveTool(slug: string) {
      const current = resolveToolSlug(slug)
      if (!current) return
      commit(addSavedTool(savedSlugs.value, current))
    },
    removeSaved(slug: string) {
      commit(removeSavedTool(savedSlugs.value, slug))
    },
    moveSaved(slug: string, offset: -1 | 1) {
      commit(moveSavedTool(savedSlugs.value, slug, offset))
    },
  }
}
