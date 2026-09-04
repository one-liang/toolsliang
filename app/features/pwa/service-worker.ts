/**
 * toolsliang Service Worker.
 *
 * Bundled to `/sw.js` by `scripts/build-service-worker.mjs` so it shares one
 * cache policy with the application and the unit tests. It stores versioned
 * application assets only: every request that could carry tool content is
 * refused by `disposeRequest` before a cache is opened.
 */
import {
  buildShellAssetUrls,
  buildShellPrecacheUrls,
  cacheName,
  disposeRequest,
  isObsoleteCacheName,
  isRetiredOfflineAsset,
  isStorableResponse,
} from './cache-policy'
import { extractShellAssets, extractShellFonts } from './shell-assets'
import { supportedLocales } from '../tools/catalog'

declare const self: ServiceWorkerGlobalScope
declare const __SW_BUILD_ID__: string

const BUILD_ID = __SW_BUILD_ID__
const SHELL_CACHE = cacheName('shell', BUILD_ID)
const STATIC_CACHE = cacheName('static', BUILD_ID)
const OFFLINE_ASSET_CACHE = cacheName('offline-asset', BUILD_ID)

function inspect(request: Request) {
  return disposeRequest({
    url: request.url,
    method: request.method,
    mode: request.mode,
    destination: request.destination,
  }, self.location.origin)
}

function storable(response: Response) {
  return isStorableResponse({
    status: response.status,
    type: response.type,
    headers: { 'cache-control': response.headers.get('cache-control') ?? '' },
  })
}

/** Falls back to the visitor's own locale so an offline page never switches language. */
function offlineRouteFor(url: string) {
  const segment = new URL(url).pathname.split('/')[1] ?? ''
  const locale = supportedLocales.find(candidate => candidate === segment) ?? supportedLocales[0]
  return `/${locale}/offline/`
}

/**
 * Precaching runs alongside a page the visitor is already using, so it takes
 * the network a few requests at a time instead of all at once. A burst starves
 * the requests that page still needs, which surfaces as failed route payloads.
 */
const PRECACHE_CONCURRENCY = 4

async function inBatches<T>(items: T[], run: (item: T) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += PRECACHE_CONCURRENCY) {
    await Promise.all(items.slice(index, index + PRECACHE_CONCURRENCY).map(run))
  }
}

/** One unavailable asset degrades offline support; it must not fail the install. */
async function storeStatic(cache: Cache, url: string) {
  try {
    const response = await fetch(url)
    if (!storable(response)) return undefined

    await cache.put(url, response.clone())
    return response
  }
  catch {
    return undefined
  }
}

async function precacheShell() {
  const [shell, statics] = await Promise.all([caches.open(SHELL_CACHE), caches.open(STATIC_CACHE)])

  // Route payloads and the install manifest come first: they are small, and a
  // page starts prefetching payloads for its visible links immediately.
  await inBatches(buildShellAssetUrls(), url => storeStatic(statics, url))

  const assets = new Set<string>()
  await inBatches(buildShellPrecacheUrls(), async (url) => {
    const response = await fetch(url, { cache: 'reload' }).catch(() => undefined)
    if (!response || !storable(response)) return

    await shell.put(url, response.clone())
    for (const asset of extractShellAssets(await response.text())) assets.add(asset)
  })

  // Fonts are declared inside the stylesheet, so they are only discoverable
  // once the shell CSS itself has been fetched.
  const fonts = new Set<string>()
  await inBatches([...assets], async (asset) => {
    const response = await storeStatic(statics, asset)
    if (!response || !asset.endsWith('.css')) return

    const cssUrl = new URL(asset, self.location.origin).href
    for (const font of extractShellFonts(await response.text(), cssUrl)) fonts.add(font)
  })

  await inBatches([...fonts], url => storeStatic(statics, url))
}

self.addEventListener('install', (event) => {
  // No skipWaiting: a new version waits until the visitor accepts it.
  event.waitUntil(precacheShell())
})

/** Frees the device from versions nothing can use any more. */
async function sweepObsoleteCaches() {
  const names = await caches.keys()
  await Promise.all(names.filter(name => isObsoleteCacheName(name, BUILD_ID)).map(name => caches.delete(name)))

  const offlineAssets = await caches.open(OFFLINE_ASSET_CACHE)
  const stored = await offlineAssets.keys()
  await Promise.all(stored
    .filter(request => isRetiredOfflineAsset(request.url, self.location.origin))
    .map(request => offlineAssets.delete(request)))
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await sweepObsoleteCaches()
    await self.clients.claim()
  })())
})

/**
 * A cache write must never sit between the network and the page: awaiting it
 * holds the response body open, which stalls streamed payloads in some
 * browsers. The write is handed to the worker's own lifetime instead.
 */
type KeepAlive = (task: Promise<unknown>) => void

/** Network first, so a deployed page is never shadowed by a stale shell entry. */
async function respondToDocument(request: Request, keep: KeepAlive) {
  const cache = await caches.open(SHELL_CACHE)

  try {
    const response = await fetch(request)
    if (storable(response)) keep(cache.put(request, response.clone()))
    return response
  }
  catch {
    const cached = await cache.match(request)
    if (cached) return cached

    // Redirecting keeps the address bar and the rendered route in step, so the
    // offline explanation hydrates as itself instead of as a failed page.
    const offlineRoute = offlineRouteFor(request.url)
    if (new URL(request.url).pathname === offlineRoute) return Response.error()
    return Response.redirect(new URL(offlineRoute, self.location.origin).href, 302)
  }
}

/** Cache first: application assets are build-scoped and immutable within a build. */
async function respondToAsset(request: Request, cacheKey: string, keep: KeepAlive) {
  const cache = await caches.open(cacheKey)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (storable(response)) keep(cache.put(request, response.clone()))
    return response
  }
  catch {
    // Offline and never cached: fail as a network error rather than as a rejection.
    return Response.error()
  }
}

/**
 * A large engine is written by the tool's own download flow, which owns progress
 * and cancellation. The worker only serves what that flow already stored.
 */
async function respondToOfflineAsset(request: Request) {
  const cached = await caches.open(OFFLINE_ASSET_CACHE).then(cache => cache.match(request))
  if (cached) return cached

  try {
    return await fetch(request)
  }
  catch {
    return Response.error()
  }
}

/**
 * Route payloads are requested with a build id in the query string. They are
 * matched ignoring it, so the precached payload keeps serving until the next
 * build replaces the cache that holds it.
 */
async function respondToPayload(request: Request, keep: KeepAlive) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request, { ignoreSearch: true })
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (storable(response)) keep(cache.put(request, response.clone()))
    return response
  }
  catch {
    return Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const disposition = inspect(event.request)
  if (disposition === 'bypass') return

  // A failed cache write only costs offline coverage; it must not reject the response.
  const keep: KeepAlive = task => event.waitUntil(task.catch(() => undefined))

  if (disposition === 'shell-document') event.respondWith(respondToDocument(event.request, keep))
  else if (disposition === 'route-payload') event.respondWith(respondToPayload(event.request, keep))
  else if (disposition === 'immutable-asset') event.respondWith(respondToAsset(event.request, STATIC_CACHE, keep))
  else event.respondWith(respondToOfflineAsset(event.request))
})

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | null
  if (data?.type === 'toolsliang:apply-update') self.skipWaiting()
})
