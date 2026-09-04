import { alternateLocalePath } from '@/features/shell/locale'
import type { LocaleCode } from '@/features/tools/catalog'

export function useAppLocale() {
  const route = useRoute()
  const locale = computed<LocaleCode>(() => route.params.locale === 'en' ? 'en' : 'zh-tw')
  const alternateLocale = computed<LocaleCode>(() => locale.value === 'en' ? 'zh-tw' : 'en')
  const withLocale = (path = '') => `/${locale.value}${path}`
  const alternatePath = computed(() => alternateLocalePath(route.fullPath, alternateLocale.value))

  watchEffect(() => {
    useHead({ htmlAttrs: { lang: locale.value === 'en' ? 'en' : 'zh-Hant-TW' } })
  })

  return { locale, alternateLocale, alternatePath, withLocale }
}
