import { buildWebAppManifest } from '../../../app/features/pwa/manifest'
import { isSupportedLocale } from '../../../app/features/tools/catalog'

export default defineEventHandler((event) => {
  const locale = getRouterParam(event, 'locale') ?? ''
  if (!isSupportedLocale(locale)) throw createError({ statusCode: 404, statusMessage: 'Unknown locale' })

  setResponseHeader(event, 'content-type', 'application/manifest+json; charset=utf-8')
  return buildWebAppManifest(locale)
})
