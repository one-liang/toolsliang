import { computed } from 'vue'
import { mockTools } from '~/data/tools'

export type PrototypeVariant = 'A' | 'B' | 'C'
export type PrototypeLocale = 'zh-tw' | 'en'

export const usePrototype = () => {
  const route = useRoute()
  const router = useRouter()
  const rawVariant = computed(() => String(route.query.variant ?? 'A').toUpperCase())
  const variant = computed<PrototypeVariant>(() =>
    rawVariant.value === 'B' || rawVariant.value === 'C' ? rawVariant.value : 'A',
  )

  const isDark = useState('prototype-dark', () => false)
  const locale = useState<PrototypeLocale>('prototype-locale', () =>
    route.path.startsWith('/en') ? 'en' : 'zh-tw',
  )
  const favorites = useState<string[]>('prototype-favorites', () => [
    'image-compressor',
    'new-taiwan-dollar-uppercase',
  ])
  const search = useState('prototype-search', () => '')
  const activeMobileNav = useState('prototype-mobile-nav', () => 'home')
  const sidebarCollapsed = useState('prototype-sidebar', () => false)

  const filteredTools = computed(() => {
    const value = search.value.trim().toLocaleLowerCase()
    if (!value) return mockTools
    return mockTools.filter((tool) =>
      [tool.name, tool.nameEn, tool.description, tool.descriptionEn, tool.category]
        .join(' ')
        .toLocaleLowerCase()
        .includes(value),
    )
  })

  const setVariant = async (next: PrototypeVariant) => {
    await router.replace({ query: { ...route.query, variant: next } })
  }

  const setLocale = async (next: PrototypeLocale) => {
    locale.value = next
    await router.push({
      path: next === 'en' ? '/en/' : '/zh-tw/',
      query: route.query,
    })
  }

  const toggleFavorite = (slug: string) => {
    favorites.value = favorites.value.includes(slug)
      ? favorites.value.filter((favorite) => favorite !== slug)
      : [...favorites.value, slug]
  }

  const t = (zh: string, en: string) => (locale.value === 'zh-tw' ? zh : en)

  return {
    activeMobileNav,
    favorites,
    filteredTools,
    isDark,
    locale,
    search,
    setLocale,
    sidebarCollapsed,
    setVariant,
    t,
    toggleFavorite,
    variant,
  }
}
