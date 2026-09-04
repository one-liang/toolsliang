import { computed, onMounted, watch } from 'vue'
import { resolvePublishedTools } from '@/features/tools/catalog'

const storageKey = 'toolsliang-common-tools'

export function useSavedTools() {
  const savedSlugs = useState<string[]>('common-tool-slugs', () => [])
  const storageReady = useState('common-tool-storage-ready', () => false)

  onMounted(() => {
    if (storageReady.value) return
    storageReady.value = true

    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
      if (Array.isArray(stored)) {
        savedSlugs.value = resolvePublishedTools(stored.filter((slug): slug is string => typeof slug === 'string'))
          .map(tool => tool.slug)
      }
    }
    catch {
      savedSlugs.value = []
    }
  })

  watch(savedSlugs, (slugs) => {
    if (!storageReady.value) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(slugs))
    }
    catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
  }, { deep: true })

  const savedTools = computed(() => resolvePublishedTools(savedSlugs.value))
  const isSaved = (slug: string) => savedSlugs.value.includes(slug)
  const toggleSaved = (slug: string) => {
    const tool = resolvePublishedTools([slug])[0]
    if (!tool) return
    savedSlugs.value = isSaved(slug)
      ? savedSlugs.value.filter(savedSlug => savedSlug !== slug)
      : [...savedSlugs.value, slug]
  }

  return { isSaved, savedTools, toggleSaved }
}
