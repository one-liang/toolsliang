import { computed, onMounted, ref } from 'vue'
import { OFFLINE_ASSET_CACHE } from '@/features/pwa/cache-policy'
import {
  initialOfflineAssetState,
  offlineAssetKey,
  offlineAssetProgress,
  reduceOfflineAsset,
  type OfflineAssetEvent,
} from '@/features/pwa/offline-assets'
import type { ToolOfflineAsset } from '@/features/tools/catalog'

/**
 * Downloads one large first-party asset into the long-lived offline cache with
 * progress, cancellation and retry. Only the versioned asset URL is requested;
 * nothing about the visitor or their work is part of it.
 */
export function useOfflineAsset(asset: ToolOfflineAsset) {
  const state = ref(initialOfflineAssetState(asset))
  let controller: AbortController | null = null

  function dispatch(event: OfflineAssetEvent) {
    state.value = reduceOfflineAsset(state.value, event)
  }

  function openCache() {
    return 'caches' in globalThis ? caches.open(OFFLINE_ASSET_CACHE) : null
  }

  async function inspect() {
    const cache = await openCache()
    dispatch({ type: 'inspected', cached: Boolean(await cache?.match(asset.url)) })
  }

  async function download() {
    const started = reduceOfflineAsset(state.value, { type: 'requested', online: navigator.onLine })
    state.value = started
    // A cached, already running, or offline request never opens a connection.
    if (started.phase !== 'downloading') return

    let aborted = false
    controller = new AbortController()
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
      controller = null
    }
  }

  function cancel() {
    dispatch({ type: 'cancelled' })
    controller?.abort()
    controller = null
  }

  onMounted(inspect)

  return {
    cachedKey: computed(() => state.value.phase === 'cached' ? offlineAssetKey(asset) : null),
    cancel,
    download,
    progress: computed(() => offlineAssetProgress(state.value)),
    state,
  }
}
