import { describe, expect, it } from 'vitest'
import { createLocalAssetRecord, type LocalAssetKind, type LocalAssetRecord } from '@/features/shell/local-assets/schema'
import {
  fitsInQuota,
  formatAssetBytes,
  remainingQuotaBytes,
  summarizeLocalAssets,
} from '@/features/shell/local-assets/usage'

function asset(id: string, kind: LocalAssetKind, size: number): LocalAssetRecord {
  return createLocalAssetRecord(
    { kind, name: id, payload: { format: 'binary', mediaType: 'image/png', bytes: new Uint8Array(size) } },
    { id, now: new Date('2026-09-07T02:00:00Z') },
  )
}

describe('local asset usage', () => {
  it('reports what each kind occupies on this device', () => {
    const usage = summarizeLocalAssets([asset('a', 'logo', 400), asset('b', 'signature', 100), asset('c', 'logo', 500)])

    expect(usage.count).toBe(3)
    expect(usage.totalBytes).toBe(1_000)
    expect(usage.byKind).toEqual([
      { kind: 'calendar', count: 0, bytes: 0 },
      { kind: 'background', count: 0, bytes: 0 },
      { kind: 'frame', count: 0, bytes: 0 },
      { kind: 'logo', count: 2, bytes: 900 },
      { kind: 'signature', count: 1, bytes: 100 },
    ])
  })

  it('leaves the browser estimate out when the device does not offer one', () => {
    const usage = summarizeLocalAssets([asset('a', 'logo', 400)])

    expect(usage.quotaBytes).toBeNull()
    expect(usage.deviceUsedBytes).toBeNull()
    expect(usage.usedRatio).toBeNull()
  })

  it('adds the browser estimate when the device offers one', () => {
    const usage = summarizeLocalAssets([asset('a', 'logo', 400)], { usage: 2_000, quota: 10_000 })

    expect(usage.quotaBytes).toBe(10_000)
    expect(usage.deviceUsedBytes).toBe(2_000)
    expect(usage.usedRatio).toBeCloseTo(0.2, 5)
  })

  it('keeps a reserve so saving an asset never fills the last of the quota', () => {
    const usage = summarizeLocalAssets([], { usage: 0, quota: 1_000_000 })

    // 5% of the quota stays free for the browser's own bookkeeping.
    expect(remainingQuotaBytes(usage)).toBe(950_000)
    expect(fitsInQuota(usage, 950_000)).toBe(true)
    expect(fitsInQuota(usage, 950_001)).toBe(false)
  })

  it('never blocks a save when the browser reports no quota at all', () => {
    const usage = summarizeLocalAssets([])

    expect(remainingQuotaBytes(usage)).toBeNull()
    expect(fitsInQuota(usage, 5_000_000)).toBe(true)
  })

  it('caps the reserve so a large quota is not withheld from the visitor', () => {
    const usage = summarizeLocalAssets([], { usage: 0, quota: 4_000_000_000 })

    expect(remainingQuotaBytes(usage)).toBe(4_000_000_000 - 64 * 1024 * 1024)
  })

  it('reports an exhausted quota as no room rather than a negative number', () => {
    const usage = summarizeLocalAssets([asset('a', 'logo', 400)], { usage: 999_000, quota: 1_000_000 })

    expect(remainingQuotaBytes(usage)).toBe(0)
    expect(fitsInQuota(usage, 1)).toBe(false)
  })

  it('writes sizes people can compare at a glance in both languages', () => {
    expect(formatAssetBytes(0, 'zh-tw')).toBe('0 KB')
    expect(formatAssetBytes(900, 'zh-tw')).toBe('0.9 KB')
    expect(formatAssetBytes(1_048_576, 'zh-tw')).toBe('1 MB')
    expect(formatAssetBytes(1_572_864, 'en')).toBe('1.5 MB')
    expect(formatAssetBytes(2_147_483_648, 'en')).toBe('2 GB')
  })
})
