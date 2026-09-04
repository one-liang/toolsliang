import { describe, expect, it } from 'vitest'
import {
  buildShellAssetUrls,
  buildShellPrecacheUrls,
  cacheName,
  disposeRequest,
  isRetiredOfflineAsset,
  isObsoleteCacheName,
  isStorableResponse,
  OFFLINE_ASSET_CACHE,
  offlineRoutes,
} from '@/features/pwa/cache-policy'

const origin = 'https://toolsliang.com'
const buildId = 'build-a1'

function request(url: string, patch: Partial<{ method: string, mode: string, destination: string }> = {}) {
  return { url, method: 'GET', ...patch }
}

describe('service worker cache naming', () => {
  it('scopes shell and static caches to one build so an obsolete version can be swept', () => {
    expect(cacheName('shell', buildId)).toBe('toolsliang-shell-v1-build-a1')
    expect(cacheName('static', buildId)).toBe('toolsliang-static-v1-build-a1')
  })

  it('keeps downloaded offline assets outside the per-build scope so a deploy does not re-download them', () => {
    expect(cacheName('offline-asset', buildId)).toBe(OFFLINE_ASSET_CACHE)
    expect(OFFLINE_ASSET_CACHE).not.toContain(buildId)
  })

  it('treats another build of the same cache role as obsolete', () => {
    expect(isObsoleteCacheName('toolsliang-shell-v1-build-old', buildId)).toBe(true)
    expect(isObsoleteCacheName('toolsliang-static-v1-build-a1', buildId)).toBe(false)
    expect(isObsoleteCacheName(OFFLINE_ASSET_CACHE, buildId)).toBe(false)
  })

  it('never claims a cache the platform does not own', () => {
    expect(isObsoleteCacheName('some-other-app-v3', buildId)).toBe(false)
  })

  it('retires a downloaded asset no published tool declares any more', () => {
    // No published tool declares an offline asset yet, so every stored one is retired.
    expect(isRetiredOfflineAsset(`${origin}/assets/offline/demo-engine-2026-01-01.wasm`, origin)).toBe(true)
  })
})

describe('service worker request disposition', () => {
  it('serves prerendered navigations from the shell cache', () => {
    expect(disposeRequest(request(`${origin}/zh-tw/tools/ntd-uppercase/`, { mode: 'navigate' }), origin)).toBe('shell-document')
  })

  it('serves build-hashed application assets from the static cache', () => {
    expect(disposeRequest(request(`${origin}/_nuxt/entry.Bx1.js`, { destination: 'script' }), origin)).toBe('immutable-asset')
    expect(disposeRequest(request(`${origin}/icons/icon-192.png`, { destination: 'image' }), origin)).toBe('immutable-asset')
    expect(disposeRequest(request(`${origin}/zh-tw/manifest.webmanifest`), origin)).toBe('immutable-asset')
  })

  it('serves a route payload with its build id, which the cache matches ignoring the query', () => {
    expect(disposeRequest(request(`${origin}/zh-tw/tools/_payload.json?_b=9f2c`), origin)).toBe('route-payload')
    expect(disposeRequest(request(`${origin}/zh-tw/tools/_payload.json`), origin)).toBe('route-payload')
  })

  it('refuses a payload path on a private route', () => {
    expect(disposeRequest(request(`${origin}/account/_payload.json?_b=9f2c`), origin)).toBe('bypass')
  })

  it('serves versioned offline assets from the long-lived asset cache', () => {
    expect(disposeRequest(request(`${origin}/assets/offline/demo-engine-2026-09-01.wasm`), origin)).toBe('offline-asset')
  })

  it('never touches a request that could carry tool content', () => {
    // A prerendered static site has no API route, so anything that can hold a body is out of scope.
    expect(disposeRequest(request(`${origin}/collect`, { method: 'POST' }), origin)).toBe('bypass')
    // Search queries and tool input are tool content and must not become cache keys.
    expect(disposeRequest(request(`${origin}/zh-tw/tools/?q=%E7%A7%81%E5%AF%86`, { mode: 'navigate' }), origin)).toBe('bypass')
    expect(disposeRequest(request('blob:https://toolsliang.com/9f2c-uuid'), origin)).toBe('bypass')
    expect(disposeRequest(request('data:image/png;base64,iVBOR'), origin)).toBe('bypass')
  })

  it('never caches another origin', () => {
    expect(disposeRequest(request('https://analytics.example.test/collect.js', { destination: 'script' }), origin)).toBe('bypass')
  })

  it('never caches account, auth or private routes', () => {
    expect(disposeRequest(request(`${origin}/auth/callback`, { mode: 'navigate' }), origin)).toBe('bypass')
    expect(disposeRequest(request(`${origin}/account/preferences`, { mode: 'navigate' }), origin)).toBe('bypass')
    expect(disposeRequest(request(`${origin}/api/session`), origin)).toBe('bypass')
  })
})

describe('storable responses', () => {
  it('stores an ordinary same-origin success', () => {
    expect(isStorableResponse({ status: 200, type: 'basic', headers: {} })).toBe(true)
  })

  it('refuses partial, opaque, error and no-store responses', () => {
    expect(isStorableResponse({ status: 206, type: 'basic', headers: {} })).toBe(false)
    expect(isStorableResponse({ status: 200, type: 'opaque', headers: {} })).toBe(false)
    expect(isStorableResponse({ status: 404, type: 'basic', headers: {} })).toBe(false)
    expect(isStorableResponse({ status: 200, type: 'basic', headers: { 'cache-control': 'private, no-store' } })).toBe(false)
  })
})

describe('shell precache list', () => {
  const urls = buildShellPrecacheUrls()

  it('precaches both locales of the App Shell and the offline explanation', () => {
    expect(urls).toEqual(expect.arrayContaining([
      '/zh-tw/', '/zh-tw/tools/', '/zh-tw/offline/',
      '/en/', '/en/tools/', '/en/offline/',
    ]))
  })

  it('precaches lightweight tools that are already offline ready', () => {
    expect(urls).toContain('/zh-tw/tools/ntd-uppercase/')
    expect(urls).toContain('/en/tools/ntd-uppercase/')
  })

  it('lists every offline route so prerendering and the shell cache cannot drift apart', () => {
    for (const route of offlineRoutes()) expect(urls).toContain(route)
  })

  it('holds no duplicate and no query variant', () => {
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls.every(url => url.startsWith('/') && !url.includes('?'))).toBe(true)
  })
})

describe('shell asset precache list', () => {
  const assets = buildShellAssetUrls()

  it('precaches the install manifest of both locales', () => {
    expect(assets).toContain('/zh-tw/manifest.webmanifest')
    expect(assets).toContain('/en/manifest.webmanifest')
  })

  it('precaches the route payload of every precached page, so offline navigation works', () => {
    for (const route of buildShellPrecacheUrls()) expect(assets).toContain(`${route}_payload.json`)
  })

  it('carries no page document, which belongs in the shell cache instead', () => {
    for (const route of buildShellPrecacheUrls()) expect(assets).not.toContain(route)
  })
})
