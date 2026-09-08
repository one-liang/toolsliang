import { describe, expect, it } from 'vitest'
import {
  getTool,
  publishedTools,
  validateToolRegistry,
  type PublishedToolDefinition,
  type ToolOfflineAsset,
} from '@/features/tools/catalog'

function withOffline(patch: Partial<Pick<PublishedToolDefinition, 'offlineMode' | 'offlineAssets'>>): PublishedToolDefinition {
  return { ...structuredClone(getTool('ntd-uppercase')!), ...patch }
}

const engine: ToolOfflineAsset = {
  id: 'demo-engine',
  version: '2026-09-01',
  url: '/assets/offline/demo-engine-2026-09-01.wasm',
  bytes: 4_000_000,
  sha256: 'a3f5c1d0b27e4498a6f01d7c9b8e2f3a4c5d6e7f8091a2b3c4d5e6f708192a3b',
  label: { 'zh-tw': '去背模型', en: 'Background removal model' },
}

describe('offline capability registration', () => {
  it('accepts a heavy tool that declares an explicitly versioned asset', () => {
    expect(validateToolRegistry([withOffline({ offlineMode: 'requires-first-download', offlineAssets: [engine] })])).toEqual([])
  })

  it('rejects a heavy tool that declares no cacheable asset', () => {
    expect(validateToolRegistry([withOffline({ offlineMode: 'online-to-prepare', offlineAssets: [] })]))
      .toContain('[ntd-uppercase] a tool that is not offline ready must declare at least one versioned offline asset')
  })

  it('rejects an offline-ready tool that hides a first-use download', () => {
    expect(validateToolRegistry([withOffline({ offlineMode: 'ready', offlineAssets: [engine] })]))
      .toContain('[ntd-uppercase] an offline ready tool must not require a downloaded asset')
  })

  it('requires the cache key version to be visible in the asset URL', () => {
    const drifted = { ...engine, url: '/assets/offline/demo-engine.wasm' }
    expect(validateToolRegistry([withOffline({ offlineMode: 'requires-first-download', offlineAssets: [drifted] })]))
      .toContain('[ntd-uppercase] offline asset demo-engine must serve its version from a first-party versioned URL')
  })

  it('refuses an offline asset served by a third party', () => {
    const thirdParty = { ...engine, url: 'https://cdn.example.test/demo-engine-2026-09-01.wasm' }
    expect(validateToolRegistry([withOffline({ offlineMode: 'requires-first-download', offlineAssets: [thirdParty] })]))
      .toContain('[ntd-uppercase] offline asset demo-engine must serve its version from a first-party versioned URL')
  })

  it('requires a size and a localized label so the download can be explained before it starts', () => {
    const unexplained = { ...engine, bytes: 0, label: { 'zh-tw': '', en: '' } }
    const issues = validateToolRegistry([withOffline({ offlineMode: 'requires-first-download', offlineAssets: [unexplained] })])
    expect(issues).toContain('[ntd-uppercase] offline asset demo-engine requires a positive size')
    expect(issues).toContain('[ntd-uppercase] offline asset demo-engine requires a localized label')
  })

  it('requires a verifiable digest so substituted bytes can never be cached', () => {
    const unverifiable = { ...engine, sha256: 'not-a-digest' }
    expect(validateToolRegistry([withOffline({ offlineMode: 'requires-first-download', offlineAssets: [unverifiable] })]))
      .toContain('[ntd-uppercase] offline asset demo-engine requires a lowercase SHA-256 digest')
  })

  it('rejects a duplicate asset id within one tool', () => {
    expect(validateToolRegistry([withOffline({ offlineMode: 'requires-first-download', offlineAssets: [engine, engine] })]))
      .toContain('[ntd-uppercase] duplicate offline asset id: demo-engine')
  })

  it('keeps every currently registered tool consistent with its declared offline mode', () => {
    expect(validateToolRegistry()).toEqual([])
    for (const tool of publishedTools) {
      if (tool.offlineMode === 'ready') expect(tool.offlineAssets ?? []).toEqual([])
      else expect((tool.offlineAssets ?? []).length).toBeGreaterThan(0)
    }
  })
})
