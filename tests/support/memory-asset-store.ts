import type { LocalAssetStore } from '@/features/shell/local-assets/repository'
import type { LocalAssetRecord } from '@/features/shell/local-assets/schema'

/**
 * The device store, in memory. It keeps the one promise the browser adapter
 * makes — `putAll` lands completely or not at all — so a repository or a
 * workspace can be exercised against real persistence rules without a browser.
 */
export class MemoryAssetStore implements LocalAssetStore {
  rows = new Map<string, unknown>()
  estimateValue: { usage: number, quota: number } | null = null
  putError: unknown = null

  async list() {
    return [...this.rows.values()]
  }

  async putAll(records: LocalAssetRecord[]) {
    if (this.putError) throw this.putError
    for (const record of records) this.rows.set(record.id, record)
  }

  async remove(id: string) {
    this.rows.delete(id)
  }

  async clear() {
    this.rows.clear()
  }

  async estimate() {
    return this.estimateValue
  }
}
