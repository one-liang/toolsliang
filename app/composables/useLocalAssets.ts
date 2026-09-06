import { onMounted, ref } from 'vue'
import { openLocalAssetStore } from '@/features/shell/local-assets/indexeddb-store'
import {
  createLocalAssetRepository,
  type LocalAssetErrorCode,
  type LocalAssetListing,
  type LocalAssetResult,
  type UnreadableAsset,
} from '@/features/shell/local-assets/repository'
import type { LocalAssetRecord } from '@/features/shell/local-assets/schema'
import { summarizeLocalAssets, type LocalAssetUsage } from '@/features/shell/local-assets/usage'

/**
 * The device view of the local assets a visitor chose to keep. Everything here
 * reads and writes the browser database of this device: no request is made, and
 * the export file is produced locally by an action the visitor started.
 */
export function useLocalAssets() {
  const repository = createLocalAssetRepository(openLocalAssetStore)
  const records = ref<LocalAssetRecord[]>([])
  const unreadable = ref<UnreadableAsset[]>([])
  const usage = ref<LocalAssetUsage>(summarizeLocalAssets([]))
  const error = ref<LocalAssetErrorCode | null>(null)
  const busy = ref(false)
  /** The device has been read once; before that the interface promises nothing about it. */
  const ready = ref(false)

  function applyListing(listing: LocalAssetListing) {
    records.value = listing.records
    unreadable.value = listing.unreadable
    usage.value = listing.usage
  }

  /**
   * A failed operation keeps whatever the interface already shows. Losing the
   * list would take away the very controls that recover from the failure.
   */
  async function run<T>(operation: () => Promise<LocalAssetResult<T>>): Promise<T | null> {
    busy.value = true
    try {
      const result = await operation()
      error.value = result.ok ? null : result.code
      return result.ok ? result.value : null
    }
    finally {
      busy.value = false
    }
  }

  async function refresh() {
    const listing = await run(() => repository.list())
    if (listing) applyListing(listing)
    ready.value = true
  }

  onMounted(refresh)

  return {
    records,
    unreadable,
    usage,
    error,
    busy,
    ready,
    refresh,

    async remove(id: string) {
      const listing = await run(() => repository.remove(id))
      if (listing) applyListing(listing)
    },

    async rename(id: string, name: string) {
      const listing = await run(() => repository.rename(id, name))
      if (listing) applyListing(listing)
    },

    async clearAll() {
      const listing = await run(() => repository.clear())
      if (listing) applyListing(listing)
    },

    /** Produces the backup file on this device and hands it to the browser's own download. */
    async exportAll(): Promise<string | null> {
      const bundle = await run(() => repository.exportBundle())
      if (!bundle) return null

      const url = URL.createObjectURL(new Blob([bundle.contents], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = bundle.fileName
      link.rel = 'noopener'
      document.body.append(link)
      link.click()
      link.remove()
      // Revoked on the next task: some browsers still need the URL when the click returns.
      setTimeout(() => URL.revokeObjectURL(url), 0)

      return bundle.fileName
    },

    /** Reads the chosen file in the browser; it is never sent anywhere. */
    async importFile(file: File): Promise<{ added: number, replaced: number } | null> {
      const outcome = await run(async () => repository.importBundle(await file.text()))
      if (!outcome) return null

      applyListing(outcome.listing)
      return { added: outcome.added, replaced: outcome.replaced }
    },
  }
}
