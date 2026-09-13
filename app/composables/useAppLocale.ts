import { manifestPath } from '@/features/pwa/manifest'
import { alternateLocalePath } from '@/features/shell/locale'
import type { LocaleCode } from '@/features/tools/catalog'

export function useAppLocale() {
  const route = useRoute()
  const pagesDemo = process.env.NUXT_PAGES_DEMO === 'true'
  const locale = computed<LocaleCode>(() => route.params.locale === 'en' ? 'en' : 'zh-tw')
  const alternateLocale = computed<LocaleCode>(() => locale.value === 'en' ? 'zh-tw' : 'en')
  const withLocale = (path = '') => `/${locale.value}${path}`
  const alternatePath = computed(() => alternateLocalePath(route.fullPath, alternateLocale.value))

  watchEffect(() => {
    // The installed app opens the locale it was installed from, so the manifest follows the page.
    useHead({
      htmlAttrs: { lang: locale.value === 'en' ? 'en' : 'zh-Hant-TW' },
      link: pagesDemo ? [] : [{ rel: 'manifest', href: manifestPath(locale.value) }],
    })
  })

  return { locale, alternateLocale, alternatePath, withLocale }
}
