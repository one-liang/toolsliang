import { describe, expect, it } from 'vitest'
import {
  describeOfflineReadiness,
  initialOfflineAssetState,
  offlineAssetProgress,
  reduceOfflineAsset,
  resolveOfflineReadiness,
  type OfflineAssetState,
} from '@/features/pwa/offline-assets'
import type { ToolOfflineAsset } from '@/features/tools/catalog'

const engine: ToolOfflineAsset = {
  id: 'demo-engine',
  version: '2026-09-01',
  url: '/assets/offline/demo-engine-2026-09-01.wasm',
  bytes: 4_000_000,
  sha256: 'a3f5c1d0b27e4498a6f01d7c9b8e2f3a4c5d6e7f8091a2b3c4d5e6f708192a3b',
  label: { 'zh-tw': '去背模型', en: 'Background removal model' },
}

function stateAfter(events: Parameters<typeof reduceOfflineAsset>[1][]): OfflineAssetState {
  return events.reduce(reduceOfflineAsset, initialOfflineAssetState(engine))
}

describe('offline asset download state', () => {
  it('starts unknown until the cache has been inspected', () => {
    expect(initialOfflineAssetState(engine)).toEqual({
      phase: 'unknown', receivedBytes: 0, totalBytes: 4_000_000, attempts: 0,
    })
  })

  it('reports an already cached version without a download', () => {
    expect(stateAfter([{ type: 'inspected', cached: true }]).phase).toBe('cached')
    expect(stateAfter([{ type: 'inspected', cached: false }]).phase).toBe('idle')
  })

  it('ignores a cache probe that resolves after the visitor has already acted', () => {
    const state = stateAfter([
      { type: 'requested', online: false },
      { type: 'inspected', cached: false },
    ])
    expect(state.phase).toBe('blocked-offline')
  })

  it('explains that a missing asset cannot be fetched while offline, and stays retryable', () => {
    const state = stateAfter([{ type: 'inspected', cached: false }, { type: 'requested', online: false }])
    expect(state.phase).toBe('blocked-offline')
    expect(state.attempts).toBe(0)
  })

  it('tracks progress against the declared size', () => {
    const state = stateAfter([
      { type: 'inspected', cached: false },
      { type: 'requested', online: true },
      { type: 'progress', receivedBytes: 1_000_000 },
    ])
    expect(state.phase).toBe('downloading')
    expect(offlineAssetProgress(state)).toBeCloseTo(0.25)
  })

  it('prefers the served length when it differs from the declared size', () => {
    const state = stateAfter([
      { type: 'inspected', cached: false },
      { type: 'requested', online: true },
      { type: 'progress', receivedBytes: 400, totalBytes: 800 },
    ])
    expect(offlineAssetProgress(state)).toBeCloseTo(0.5)
  })

  it('discards partial bytes when the user cancels', () => {
    const state = stateAfter([
      { type: 'inspected', cached: false },
      { type: 'requested', online: true },
      { type: 'progress', receivedBytes: 1_000_000 },
      { type: 'cancelled' },
    ])
    expect(state).toMatchObject({ phase: 'idle', receivedBytes: 0, attempts: 0 })
  })

  it('ignores progress that arrives after a cancellation', () => {
    const state = stateAfter([
      { type: 'inspected', cached: false },
      { type: 'requested', online: true },
      { type: 'cancelled' },
      { type: 'progress', receivedBytes: 2_000_000 },
    ])
    expect(state).toMatchObject({ phase: 'idle', receivedBytes: 0 })
  })

  it('keeps a failure retryable and counts the attempt', () => {
    const state = stateAfter([
      { type: 'inspected', cached: false },
      { type: 'requested', online: true },
      { type: 'progress', receivedBytes: 1_000 },
      { type: 'failed' },
    ])
    expect(state).toMatchObject({ phase: 'failed', receivedBytes: 0, attempts: 1 })
  })

  it('returns to downloading on a retry after a failure', () => {
    const state = stateAfter([
      { type: 'inspected', cached: false },
      { type: 'requested', online: true },
      { type: 'failed' },
      { type: 'requested', online: true },
    ])
    expect(state).toMatchObject({ phase: 'downloading', attempts: 1 })
  })

  it('reaches the cached phase with a complete progress reading', () => {
    const state = stateAfter([
      { type: 'inspected', cached: false },
      { type: 'requested', online: true },
      { type: 'progress', receivedBytes: 4_000_000 },
      { type: 'completed' },
    ])
    expect(state.phase).toBe('cached')
    expect(offlineAssetProgress(state)).toBe(1)
  })
})

describe('tool offline readiness', () => {
  const readyTool = { offlineMode: 'ready' as const, offlineAssets: undefined }
  const heavyTool = { offlineMode: 'requires-first-download' as const, offlineAssets: [engine] }

  it('reports a lightweight tool as ready without any download', () => {
    expect(resolveOfflineReadiness(readyTool, { cachedAssetKeys: [], online: false })).toBe('ready')
  })

  it('reports a heavy tool as prepared once every declared version is cached', () => {
    expect(resolveOfflineReadiness(heavyTool, { cachedAssetKeys: ['demo-engine@2026-09-01'], online: true })).toBe('prepared')
  })

  it('asks for a download when a declared version is missing and the device is online', () => {
    expect(resolveOfflineReadiness(heavyTool, { cachedAssetKeys: [], online: true })).toBe('needs-download')
  })

  it('treats a superseded version as missing rather than as prepared', () => {
    expect(resolveOfflineReadiness(heavyTool, { cachedAssetKeys: ['demo-engine@2026-01-01'], online: true })).toBe('needs-download')
  })

  it('explains that the download cannot happen until the device is back online', () => {
    expect(resolveOfflineReadiness(heavyTool, { cachedAssetKeys: [], online: false })).toBe('blocked-offline')
  })

  it('describes every readiness state in both locales without promising more than it delivers', () => {
    expect(describeOfflineReadiness('ready', 'zh-tw')).toBe('離線可用：首次載入後即可離線使用。')
    expect(describeOfflineReadiness('prepared', 'zh-tw')).toBe('已下載所需資源，可離線使用。')
    expect(describeOfflineReadiness('needs-download', 'zh-tw')).toBe('首次使用需下載所需資源，下載後即可離線使用。')
    expect(describeOfflineReadiness('blocked-offline', 'zh-tw')).toBe('目前離線，需連線下載所需資源後才能使用。')
    expect(describeOfflineReadiness('ready', 'en')).toContain('offline')
    expect(describeOfflineReadiness('blocked-offline', 'en')).toContain('online')
  })
})
