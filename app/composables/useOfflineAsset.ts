import { computed, getCurrentInstance, onMounted, ref, type Ref } from 'vue'
import { OFFLINE_ASSET_CACHE } from '@/features/pwa/cache-policy'
import {
  initialOfflineAssetState,
  offlineAssetKey,
  offlineAssetProgress,
  reduceOfflineAsset,
  type OfflineAssetEvent,
  type OfflineAssetState,
} from '@/features/pwa/offline-assets'
import type { ToolOfflineAsset } from '@/features/tools/catalog'

interface SharedDownload {
  state: Ref<OfflineAssetState>
  controller: AbortController | null
  running: Promise<void> | null
  inspected: boolean
}

/**
 * One asset is one download, however many places on the page offer it. The tool
 * page explains the download beside its offline note and the workspace needs
 * the same answer before it can run, so both read this shared entry instead of
 * fetching the same megabytes twice.
 */
const downloads = new Map<string, SharedDownload>()

function sharedDownload(asset: ToolOfflineAsset): SharedDownload {
  const key = offlineAssetKey(asset)
  const existing = downloads.get(key)
  if (existing) return existing
  const created: SharedDownload = { state: ref(initialOfflineAssetState(asset)), controller: null, running: null, inspected: false }
  downloads.set(key, created)
  return created
}

/** Test seam: the registry outlives a component, so a suite starts from nothing. */
export function resetOfflineAssetDownloads() {
  downloads.clear()
}

function openCache() {
  return 'caches' in globalThis ? caches.open(OFFLINE_ASSET_CACHE) : null
}

async function digestOf(bytes: BlobPart[]) {
  const buffer = await new Blob(bytes).arrayBuffer()
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Downloads one large first-party asset into the long-lived offline cache with
 * progress, cancellation and retry. Only the versioned asset URL is requested;
 * nothing about the visitor or their work is part of it. Bytes are checked
 * against the digest the registry declares before they are stored, so a
 * corrupted or substituted file can never be handed to a runtime.
 */
export function useOfflineAsset(asset: ToolOfflineAsset) {
  const shared = sharedDownload(asset)

  function dispatch(event: OfflineAssetEvent) {
    shared.state.value = reduceOfflineAsset(shared.state.value, event)
  }

  async function inspect() {
    if (shared.inspected) return
    shared.inspected = true
    const cache = await openCache()
    dispatch({ type: 'inspected', cached: Boolean(await cache?.match(asset.url)) })
  }

  async function run() {
    let aborted = false
    const controller = new AbortController()
    shared.controller = controller
    controller.signal.addEventListener('abort', () => { aborted = true })
    try {
      const response = await fetch(asset.url, { signal: controller.signal, cache: 'no-store' })
      if (!response.ok || !response.body) throw new Error('offline asset unavailable')

      const declared = Number(response.headers.get('content-length')) || undefined
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.byteLength
        dispatch({ type: 'progress', receivedBytes: received, totalBytes: declared })
      }

      // A cancellation that lands on the last chunk still keeps nothing.
      if (aborted) return

      if (await digestOf(chunks as BlobPart[]) !== asset.sha256) {
        dispatch({ type: 'failed', reason: 'digest-mismatch' })
        return
      }

      const cache = await openCache()
      await cache?.put(asset.url, new Response(new Blob(chunks as BlobPart[]), {
        headers: { 'content-type': response.headers.get('content-type') ?? 'application/octet-stream' },
      }))
      dispatch({ type: 'completed' })
    }
    catch {
      // A cancellation has already discarded the partial bytes and left the downloading phase.
      if (!aborted) dispatch({ type: 'failed' })
    }
    finally {
      shared.controller = null
      shared.running = null
    }
  }

  async function download() {
    if (shared.running) return shared.running
    const started = reduceOfflineAsset(shared.state.value, { type: 'requested', online: navigator.onLine })
    shared.state.value = started
    // A cached, already running, or offline request never opens a connection.
    if (started.phase !== 'downloading') return
    shared.running = run()
    return shared.running
  }

  function cancel() {
    dispatch({ type: 'cancelled' })
    shared.controller?.abort()
    shared.controller = null
    shared.running = null
  }

  if (getCurrentInstance()) onMounted(inspect)
  else void inspect()

  return {
    cachedKey: computed(() => shared.state.value.phase === 'cached' ? offlineAssetKey(asset) : null),
    cancel,
    download,
    progress: computed(() => offlineAssetProgress(shared.state.value)),
    state: shared.state,
  }
}
