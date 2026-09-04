import { siteOrigin, type LocaleCode } from '@/features/tools/catalog'

export function usePageSeo(options: {
  locale: Ref<LocaleCode>
  path: string | Ref<string>
  title: string | Ref<string>
  description: string | Ref<string>
  structuredData?: ComputedRef<Record<string, unknown>>
}) {
  const resolvedPath = computed(() => unref(options.path))
  const canonical = computed(() => `${siteOrigin}/${options.locale.value}${resolvedPath.value}`)

  useSeoMeta({
    title: () => unref(options.title),
    description: () => unref(options.description),
    ogTitle: () => unref(options.title),
    ogDescription: () => unref(options.description),
    ogUrl: canonical,
    ogSiteName: 'toolsliang',
    ogType: 'website',
    ogLocale: () => options.locale.value === 'en' ? 'en' : 'zh_TW',
    ogLocaleAlternate: () => options.locale.value === 'en' ? 'zh_TW' : 'en',
    twitterCard: 'summary',
  })

  useHead(() => ({
    link: [
      { rel: 'canonical', href: canonical.value },
      { rel: 'alternate', hreflang: 'zh-Hant-TW', href: `${siteOrigin}/zh-tw${resolvedPath.value}` },
      { rel: 'alternate', hreflang: 'en', href: `${siteOrigin}/en${resolvedPath.value}` },
      { rel: 'alternate', hreflang: 'x-default', href: `${siteOrigin}/zh-tw${resolvedPath.value}` },
    ],
    script: options.structuredData
      ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(options.structuredData.value) }]
      : [],
  }))
}
