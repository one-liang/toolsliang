import { computed } from 'vue'
import { useOnline } from '@vueuse/core'
import { backgroundRemovalAssets } from '@/features/tools/image-background-remover/domain/model'

/**
 * The state of the portrait model on this device, for every surface that offers
 * to put it there.
 *
 * Two places now need the same answer — the background remover's own workspace
 * and the workbench's cutout step — and the answer is not a single asset but
 * three files that have to be present together, downloaded one after another,
 * and reported as one percentage. `useOfflineAsset` already shares a download
 * between callers; this shares the reading of it.
 *
 * It deliberately returns no sentences. What a visitor is told differs between
 * the two surfaces (one of them can offer to skip the step), and copy that only
 * looks shared is worse than copy that is written where it is read.
 */
export function useBackgroundRemovalModel() {
  const online = useOnline()
  const assets = backgroundRemovalAssets.map(asset => ({ asset, ...useOfflineAsset(asset) }))
  const totalBytes = backgroundRemovalAssets.reduce((total, asset) => total + asset.bytes, 0)

  const ready = computed(() => assets.every(entry => entry.state.value.phase === 'cached'))
  const downloading = computed(() => assets.some(entry => entry.state.value.phase === 'downloading'))
  const failure = computed(() => assets.find(entry => entry.state.value.phase === 'failed')?.state.value.failureReason)
  const receivedBytes = computed(() => assets.reduce(
    (total, entry) => total + (entry.state.value.phase === 'cached' ? entry.asset.bytes : entry.state.value.receivedBytes),
    0,
  ))
  const percent = computed(() => Math.min(100, Math.round(receivedBytes.value / totalBytes * 100)))

  /**
   * §12.8 requires a device with no room for the model to be told rather than
   * to fail mid-write, so the estimate is checked before the first byte.
   * Resolves `insufficient_storage` when there is no room; the caller decides
   * where that is shown.
   */
  async function download(): Promise<'started' | 'insufficient_storage'> {
    const estimate = await navigator.storage?.estimate?.().catch(() => undefined)
    if (estimate?.quota && estimate.quota - (estimate.usage ?? 0) < totalBytes * 1.2) return 'insufficient_storage'

    for (const entry of assets) {
      if (entry.state.value.phase === 'cached') continue
      await entry.download()
    }

    return 'started'
  }

  function cancel() {
    for (const entry of assets) entry.cancel()
  }

  return { assets, cancel, download, downloading, failure, online, percent, ready, totalBytes }
}
