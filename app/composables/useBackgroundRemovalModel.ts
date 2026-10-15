import { computed } from 'vue'
import { useOnline } from '@vueuse/core'
import { backgroundRemovalAssets } from '@/features/tools/image-background-remover/domain/model'

/**
 * How one attempt to put the model on the device ended. `cancelled` is the
 * visitor's own choice and needs no explanation; every other ending that is
 * not `ready` is a reason the caller has to show with a way to try again.
 */
export type BackgroundRemovalModelOutcome = 'ready' | 'offline' | 'insufficient_storage' | 'failed' | 'digest-mismatch' | 'cancelled'

/**
 * The state of the portrait model on this device, for every surface that needs
 * it there.
 *
 * Two places need the same answer — the background remover's own workspace
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

  /** Resolves once this device has said whether it already holds every file. */
  async function inspect() {
    await Promise.all(assets.map(entry => entry.inspect()))
  }

  function outcome(): BackgroundRemovalModelOutcome {
    if (ready.value) return 'ready'
    const phases = assets.map(entry => entry.state.value)
    if (phases.some(state => state.phase === 'blocked-offline')) return 'offline'
    const failed = phases.find(state => state.phase === 'failed')
    if (failed) return failed.failureReason === 'digest-mismatch' ? 'digest-mismatch' : 'failed'
    return 'cancelled'
  }

  async function attempt(): Promise<BackgroundRemovalModelOutcome> {
    await inspect()
    if (ready.value) return 'ready'
    // Not every browser updates `navigator.onLine` when the connection drops,
    // but every one fires the event, which is what `online` follows.
    if (!online.value) return 'offline'

    // §12.8 requires a device with no room for the model to be told rather
    // than to fail mid-write, so the estimate is checked before the first byte.
    const estimate = await navigator.storage?.estimate?.().catch(() => undefined)
    if (estimate?.quota && estimate.quota - (estimate.usage ?? 0) < totalBytes * 1.2) return 'insufficient_storage'

    const stored = (entry: typeof assets[number]) => entry.state.value.phase === 'cached'
    for (const entry of assets) {
      if (stored(entry)) continue
      await entry.download()
      // A file that did not arrive makes the rest useless for now.
      if (!stored(entry)) break
    }

    return outcome()
  }

  /**
   * Starting the model while one attempt is already under way joins that
   * attempt: a background start and a visitor waiting on it must see the
   * same bytes and the same ending, never a second download.
   */
  let inflight: Promise<BackgroundRemovalModelOutcome> | null = null

  function download(): Promise<BackgroundRemovalModelOutcome> {
    inflight ??= attempt().finally(() => { inflight = null })
    return inflight
  }

  function cancel() {
    for (const entry of assets) entry.cancel()
  }

  /** The browser cleared a stored file, so the next start fetches all of them again. */
  function forget() {
    for (const entry of assets) entry.forget()
  }

  return { assets, cancel, download, downloading, failure, forget, inspect, online, percent, ready, totalBytes }
}
