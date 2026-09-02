import type { LocaleCode } from '@/features/tools/catalog'

export function usePageSeo(options: {
  locale: Ref<LocaleCode>
  path: string | Ref<string>
  title: string | Ref<string>
  description: string | Ref<string>
  structuredData?: ComputedRef<Record<string, unknown>>
}) {
  const resolvedPath = computed(() => unref(options.path))
  const canonical = computed(() => `https://toolsliang.com/${options.locale.value}${resolvedPath.value}`)

  useSeoMeta({
    title: () => unref(options.title),
    description: () => unref(options.description),
    ogTitle: () => unref(options.title),
    ogDescription: () => unref(options.description),
    ogUrl: canonical,
    ogSiteName: 'toolsliang',
    twitterCard: 'summary',
  })

  useHead(() => ({
    link: [
      { rel: 'canonical', href: canonical.value },
      { rel: 'alternate', hreflang: 'zh-Hant-TW', href: `https://toolsliang.com/zh-tw${resolvedPath.value}` },
      { rel: 'alternate', hreflang: 'en', href: `https://toolsliang.com/en${resolvedPath.value}` },
      { rel: 'alternate', hreflang: 'x-default', href: `https://toolsliang.com/zh-tw${resolvedPath.value}` },
    ],
    script: options.structuredData
      ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(options.structuredData.value) }]
      : [],
  }))
}
