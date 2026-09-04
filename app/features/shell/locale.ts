import type { LocaleCode } from '@/features/tools/catalog'

const LOCALE_SEGMENT = /^\/(?:zh-tw|en)(?=[/?#]|$)/

/**
 * Switches the locale segment while keeping the rest of the location, so the
 * visitor stays on the tool, filter, and section they were already reading.
 */
export function alternateLocalePath(fullPath: string, locale: LocaleCode): string {
  if (LOCALE_SEGMENT.test(fullPath)) return fullPath.replace(LOCALE_SEGMENT, `/${locale}`)

  return `/${locale}${fullPath.startsWith('/') ? fullPath : `/${fullPath}`}`
}
