import type { LocaleCode } from '@/features/tools/catalog'
import { localAssetKinds, type LocalAssetKind, type LocalAssetRecord } from './schema'

/**
 * How much of the device the saved assets occupy, in terms the visitor can act
 * on: what each kind costs, and how much room the browser still reports. The
 * numbers are read from the device only; nothing here is reported anywhere.
 */
export interface LocalAssetKindUsage {
  kind: LocalAssetKind
  count: number
  bytes: number
}

export interface StorageEstimateLike {
  usage?: number
  quota?: number
}

export interface LocalAssetUsage {
  count: number
  totalBytes: number
  byKind: LocalAssetKindUsage[]
  /** Null whenever the browser declines to estimate; the interface then stops promising a number. */
  quotaBytes: number | null
  deviceUsedBytes: number | null
  usedRatio: number | null
}

/**
 * A slice of the quota the product never spends. Browsers start evicting before
 * the very last byte, and an asset saved into that margin is the one most
 * likely to disappear, so a save is refused while there is still room to
 * explain why.
 */
const QUOTA_RESERVE_RATIO = 0.05
const QUOTA_RESERVE_CAP_BYTES = 64 * 1024 * 1024

export function summarizeLocalAssets(
  records: LocalAssetRecord[],
  estimate?: StorageEstimateLike | null,
): LocalAssetUsage {
  const byKind = localAssetKinds.map<LocalAssetKindUsage>((kind) => {
    const owned = records.filter(record => record.kind === kind)
    return { kind, count: owned.length, bytes: owned.reduce((total, record) => total + record.bytes, 0) }
  })

  const quotaBytes = typeof estimate?.quota === 'number' ? estimate.quota : null
  const deviceUsedBytes = typeof estimate?.usage === 'number' ? estimate.usage : null

  return {
    count: records.length,
    totalBytes: byKind.reduce((total, kind) => total + kind.bytes, 0),
    byKind,
    quotaBytes,
    deviceUsedBytes,
    usedRatio: quotaBytes && deviceUsedBytes !== null ? deviceUsedBytes / quotaBytes : null,
  }
}

/** Null means the browser gave no estimate, so the product cannot claim a limit. */
export function remainingQuotaBytes(usage: LocalAssetUsage): number | null {
  if (usage.quotaBytes === null || usage.deviceUsedBytes === null) return null

  const reserve = Math.min(usage.quotaBytes * QUOTA_RESERVE_RATIO, QUOTA_RESERVE_CAP_BYTES)
  return Math.max(0, Math.round(usage.quotaBytes - usage.deviceUsedBytes - reserve))
}

export function fitsInQuota(usage: LocalAssetUsage, incomingBytes: number): boolean {
  const remaining = remainingQuotaBytes(usage)
  return remaining === null || incomingBytes <= remaining
}

const BYTE_UNITS = ['KB', 'MB', 'GB'] as const

/**
 * Sizes are written in the unit a person would compare, starting at KB: a
 * saved asset measured in bytes reads as noise next to a megabyte-sized frame.
 */
export function formatAssetBytes(bytes: number, locale: LocaleCode): string {
  let value = Math.max(0, bytes) / 1024
  let unit: string = BYTE_UNITS[0]

  for (const candidate of BYTE_UNITS.slice(1)) {
    if (value < 1024) break
    value /= 1024
    unit = candidate
  }

  const formatted = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'zh-TW', {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value)

  return `${formatted} ${unit}`
}
