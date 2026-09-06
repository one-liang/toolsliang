import { offlineAssetPathPrefix, publishedTools, supportedLocales } from '../tools/catalog'
import { manifestPath } from './manifest'

/**
 * Bumped by hand when the shape of what the Service Worker stores changes, so a
 * client running an older schema never reads a cache it cannot interpret. The
 * per-build suffix on top of it makes an ordinary deploy sweepable as well.
 */
const CACHE_SCHEMA = 'v1'
const CACHE_PREFIX = 'toolsliang'

export type CacheRole = 'shell' | 'static' | 'offline-asset'

/**
 * Downloaded engines and models are keyed by their own version, so they survive
 * a deploy instead of forcing a visitor to fetch several megabytes again.
 */
export const OFFLINE_ASSET_CACHE = `${CACHE_PREFIX}-offline-asset-${CACHE_SCHEMA}`

const BUILD_SCOPED_ROLES: CacheRole[] = ['shell', 'static']

export function cacheName(role: CacheRole, buildId: string): string {
  if (role === 'offline-asset') return OFFLINE_ASSET_CACHE
  return `${CACHE_PREFIX}-${role}-${CACHE_SCHEMA}-${buildId}`
}

export function isObsoleteCacheName(name: string, buildId: string): boolean {
  return BUILD_SCOPED_ROLES.some(role => name.startsWith(`${CACHE_PREFIX}-${role}-`) && name !== cacheName(role, buildId))
}

/** Every large asset the current registry still declares, as served URLs. */
export function registeredOfflineAssetUrls(): string[] {
  return [...new Set(publishedTools.flatMap(tool => (tool.offlineAssets ?? []).map(asset => asset.url)))]
}

/**
 * A downloaded engine survives deploys, so it is swept by registration rather
 * than by build: once no published tool declares that version, its megabytes
 * are only occupying the device.
 */
export function isRetiredOfflineAsset(url: string, origin: string): boolean {
  try {
    return !registeredOfflineAssetUrls().includes(new URL(url, origin).pathname)
  }
  catch {
    return false
  }
}

export type RequestDisposition = 'shell-document' | 'route-payload' | 'immutable-asset' | 'offline-asset' | 'bypass'

export interface InspectedRequest {
  url: string
  method: string
  mode?: string
  destination?: string
}

/** Auth, account and any future API surface stay out of every cache. */
const PRIVATE_PATH_PREFIXES = ['/auth/', '/account/', '/api/']
const STATIC_ASSET_PREFIXES = ['/_nuxt/', '/icons/', '/fonts/']
const STATIC_ASSET_EXTENSIONS = ['.js', '.mjs', '.css', '.woff2', '.woff', '.png', '.svg', '.ico', '.webmanifest', '.json']
/** The prerendered route state Nuxt loads on client-side navigation. */
const ROUTE_PAYLOAD = /\/_payload\.json$/
const CACHEABLE_METHODS = ['GET']

/**
 * Decides what the Service Worker is allowed to do with one request. Everything
 * that could carry tool content — a body-bearing method, a Blob or data URL,
 * another origin, a private route, or any query string other than the build id
 * on a route payload — is refused before a cache is opened, so tool content can
 * never reach storage by accident.
 */
export function disposeRequest(request: InspectedRequest, origin: string): RequestDisposition {
  if (!CACHEABLE_METHODS.includes(request.method.toUpperCase())) return 'bypass'

  let url: URL
  try {
    url = new URL(request.url, origin)
  }
  catch {
    return 'bypass'
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'bypass'
  if (url.origin !== new URL(origin).origin) return 'bypass'
  if (PRIVATE_PATH_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) return 'bypass'

  // The only query string the platform emits is the build id on a route payload,
  // and that entry is matched ignoring it. Everything else carrying a query is
  // either tool content or a variant that must not shadow the canonical page.
  if (ROUTE_PAYLOAD.test(url.pathname)) return 'route-payload'
  if (url.search) return 'bypass'

  if (url.pathname.startsWith(`${offlineAssetPathPrefix}/`)) return 'offline-asset'

  if (STATIC_ASSET_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) return 'immutable-asset'
  if (STATIC_ASSET_EXTENSIONS.some(extension => url.pathname.endsWith(extension))) return 'immutable-asset'

  if (request.mode === 'navigate' || request.destination === 'document') return 'shell-document'

  return 'bypass'
}

export interface InspectedResponse {
  status: number
  type: string
  headers: Record<string, string>
}

export function isStorableResponse(response: InspectedResponse): boolean {
  if (response.status !== 200) return false
  if (response.type !== 'basic' && response.type !== 'default') return false

  const cacheControl = response.headers['cache-control'] ?? ''
  return !/no-store|private/i.test(cacheControl)
}

/** The offline explanation is a real page, so prerendering and the shell cache read one list. */
export function offlineRoutes(): string[] {
  return supportedLocales.map(locale => `/${locale}/offline/`)
}

/**
 * The local asset manager. What it shows depends entirely on the device, so it
 * is never indexed, but it is precached: reviewing, exporting and clearing
 * device-local assets has to keep working with no connection.
 */
export function storageRoutes(): string[] {
  return supportedLocales.map(locale => `/${locale}/storage/`)
}

/**
 * The minimum App Shell: both locales of the landing page, the tool directory,
 * the offline explanation, and the tools that already run from the cache. A
 * tool that needs a first-use download is deliberately absent — an installed
 * shortcut must never imply it works before its assets exist.
 */
export function buildShellPrecacheUrls(): string[] {
  const urls = supportedLocales.flatMap(locale => [
    `/${locale}/`,
    `/${locale}/tools/`,
    ...publishedTools.filter(tool => tool.offlineMode === 'ready').map(tool => `/${locale}/tools/${tool.slug}/`),
  ])

  return [...new Set([...urls, ...offlineRoutes(), ...storageRoutes()])]
}

/**
 * What a precached page needs beyond its HTML: the install manifest, and the
 * route payload that client-side navigation between shell pages reads. Without
 * the payload an offline visitor can open a page but not navigate to the next.
 */
export function buildShellAssetUrls(): string[] {
  return [
    ...supportedLocales.map(manifestPath),
    ...buildShellPrecacheUrls().map(route => `${route}_payload.json`),
  ]
}
