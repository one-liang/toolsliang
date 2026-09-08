import { describe, expect, it } from 'vitest'
import {
  backgroundRemovalBudgets,
  backgroundRemovalCandidates,
  backgroundRemovalCapabilityLevels,
  backgroundRemovalDecision,
  backgroundRemovalExclusionReasons,
  backgroundRemovalExclusions,
  backgroundRemovalFailureCodes,
  backgroundRemovalGateKeys,
  backgroundRemovalPermittedLicences,
  backgroundRemovalReferenceVersion,
  backgroundRemovalRuntime,
  redistributableCandidates,
  type BackgroundRemovalCandidate,
} from '@/features/tools/image-background-remover/domain/reference'
import {
  backgroundRemovalDecisionRecord as record,
  backgroundRemovalMeasurements as measurements,
  measuredFixture,
  measuredRun,
  parseCandidates,
  parseCapabilityLevels,
  parseCostRows,
  parseExclusions,
  parseFailureCodes,
  parseFingerprints,
  parseFixtureKeys,
  parseGates,
  parseQualityRows,
  parseTransferRows,
  sectionBody,
} from './support/image-background-removal-decision-record'

function candidateById(id: string): BackgroundRemovalCandidate {
  const candidate = backgroundRemovalCandidates.find(entry => entry.id === id)
  if (!candidate) throw new Error(`No candidate ${id}`)

  return candidate
}

/** Model assets may be downloaded; nothing about an image ever may be sent. */
const allowedAssetHosts = ['huggingface.co', 'cdn.jsdelivr.net', 'github.com']

describe('vocabulary matches the decision record', () => {
  it('publishes exactly the documented candidates', () => {
    expect(backgroundRemovalCandidates.map(candidate => candidate.id)).toEqual(
      parseCandidates().map(row => row.id),
    )
  })

  it('describes each candidate the way the record does', () => {
    for (const row of parseCandidates()) {
      const candidate = candidateById(row.id)
      expect(candidate.family).toBe(row.family)
      expect(candidate.scope).toBe(row.scope)
      expect(candidate.precision).toBe(row.precision)
      expect(candidate.licence).toBe(row.licence)
      expect(candidate.licenceVerified).toBe(row.redistributable)
      expect(candidate.licenceUrl).toBe(row.licenceUrl)
    }
  })

  it('publishes exactly the documented exclusions and reasons', () => {
    const documented = parseExclusions()
    expect(backgroundRemovalExclusions.map(entry => entry.id)).toEqual(documented.map(row => row.id))
    for (const row of documented) {
      const exclusion = backgroundRemovalExclusions.find(entry => entry.id === row.id)
      expect(exclusion?.reason).toBe(row.reason)
      expect(backgroundRemovalExclusionReasons).toContain(row.reason)
    }
  })

  it('publishes exactly the documented capability ladder and failure codes', () => {
    expect([...backgroundRemovalCapabilityLevels]).toEqual(parseCapabilityLevels())
    expect([...backgroundRemovalFailureCodes]).toEqual(parseFailureCodes())
  })

  it('names the representative cases the harness actually built', () => {
    expect(parseFixtureKeys()).toEqual(measurements.fixtures.names)
  })

  it('carries a review version matching the measurement date', () => {
    expect(backgroundRemovalReferenceVersion).toBe(`image-background-remover-${measurements.measuredAt}`)
  })
})

describe('provenance is recorded for every candidate', () => {
  it('pins a repository commit and a file digest', () => {
    for (const candidate of backgroundRemovalCandidates) {
      expect(candidate.revision).toMatch(/^[0-9a-f]{40}$/)
      expect(candidate.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(candidate.bytes).toBeGreaterThan(0)
      expect(new URL(candidate.licenceUrl).protocol).toBe('https:')
      expect(allowedAssetHosts).toContain(new URL(candidate.licenceUrl).host)
    }
  })

  it('matches the fingerprints written into the record', () => {
    const documented = parseFingerprints()
    expect(documented.map(row => row.id)).toEqual(backgroundRemovalCandidates.map(candidate => candidate.id))
    for (const row of documented) {
      const candidate = candidateById(row.id)
      expect(candidate.repo).toBe(row.repo)
      expect(candidate.revision).toBe(row.revision)
      expect(candidate.file).toBe(row.file)
      expect(candidate.bytes).toBe(row.bytes)
      expect(candidate.sha256).toBe(row.sha256)
    }
  })

  it('matches the digests the harness verified on disk', () => {
    for (const candidate of backgroundRemovalCandidates) {
      const measured = measurements.candidates.find(entry => entry.id === candidate.id)
      expect(measured?.sha256).toBe(candidate.sha256)
      expect(measured?.bytes).toBe(candidate.bytes)
      expect(measured?.repo).toBe(candidate.repo)
      expect(measured?.revision).toBe(candidate.revision)
    }
  })

  it('names the runtime the measurements ran on', () => {
    expect(backgroundRemovalRuntime.version).toBe(measurements.runtime.version)
    expect(backgroundRemovalRuntime.licence).toBe(measurements.runtime.licence)
    expect(allowedAssetHosts).toContain(new URL(backgroundRemovalRuntime.source).host)
  })
})

describe('documented numbers come from the measurement file', () => {
  it('restates transfer and load cost exactly', () => {
    for (const row of parseTransferRows()) {
      const measured = measurements.candidates.find(entry => entry.id === row.id)
      expect(measured?.transfer.bytes).toBe(row.bytes)
      expect(measured?.transfer.brotliBytes).toBe(row.brotliBytes)

      const run = measuredRun('chromium', row.id, 'wasm')
      expect(run.sessionCreateMs ?? null).toBe(row.sessionCreateMs)
      expect(run.sessionWasmBytes ?? null).toBe(row.sessionWasmBytes)
    }
  })

  it('restates mask quality exactly', () => {
    const columns = [
      ['portrait', 'portrait-person', 'iou'],
      ['hair', 'fine-hair', 'iou'],
      ['product', 'product-bottle', 'iou'],
      ['glass', 'semi-transparent-glass', 'softAlphaMae'],
      ['lowContrast', 'low-contrast-box', 'iou'],
    ] as const

    for (const row of parseQualityRows()) {
      const run = measuredRun('chromium', row.id, 'wasm')
      for (const [column, fixture, metric] of columns) {
        const measured = measuredFixture(run, fixture)[metric]
        expect(`${row[column]}`, `${row.id} ${fixture}`).toBe(measured === undefined ? '—' : `${measured}`)
      }
    }
  })

  it('restates inference cost and memory exactly', () => {
    for (const row of parseCostRows()) {
      const run = measuredRun('chromium', row.id, row.provider)
      if (run.fixtures.length === 0) {
        /* A run that never reached a fixture, such as a session that timed out. */
        expect(run.failure, row.id).toBeDefined()
        expect([row.coldMs, row.warmMs, row.largeMs, row.peakWasmBytes]).toEqual([null, null, null, null])
        continue
      }

      const cold = measuredFixture(run, 'product-bottle')
      expect(cold.inferenceMs ?? null).toBe(row.coldMs)
      expect(cold.warmInferenceMs ?? null).toBe(row.warmMs)

      /* The 12 MP column is the whole pipeline, because the models resize the
       * input themselves and inference alone would hide the real cost. */
      const large = run.fixtures.find(entry => entry.fixture === 'product-bottle' && entry.width === 4000)
      const endToEnd = large?.inferenceMs === undefined
        ? null
        : (large.preprocessMs ?? 0) + large.inferenceMs + (large.postprocessMs ?? 0)
      expect(endToEnd).toBe(row.largeMs)
      expect(cold.peakWasmBytes ?? null).toBe(row.peakWasmBytes)
    }
  })

  it('measured every candidate on the WebAssembly baseline in three browsers', () => {
    for (const browser of ['chromium', 'firefox', 'webkit']) {
      const entry = measurements.browsers.find(candidate => candidate.browser === browser)
      expect(entry, browser).toBeDefined()
      expect(entry!.providers).toContain('wasm')
      for (const candidate of backgroundRemovalCandidates) {
        /* Either it produced fixtures or it recorded why it could not. */
        const run = measuredRun(browser, candidate.id, 'wasm')
        const outcome = run.failure ?? run.fixtures.find(fixture => fixture.failure) ?? run.fixtures[0]
        expect(outcome, `${browser} ${candidate.id}`).toBeDefined()
      }
    }
  })

  it('reports no uncaught page error from any run', () => {
    for (const browser of measurements.browsers) expect(browser.pageErrors).toEqual([])
  })
})

describe('the decision follows from the gates', () => {
  it('recommends a candidate that was measured and licensed for redistribution', () => {
    const recommended = candidateById(backgroundRemovalDecision.recommendedCandidateId)
    expect(backgroundRemovalPermittedLicences).toContain(recommended.licence)
    expect(recommended.licenceVerified).toBe(true)
    expect(redistributableCandidates.map(entry => entry.id)).toContain(recommended.id)
    expect(backgroundRemovalExclusions.map(entry => entry.id)).not.toContain(recommended.id)
  })

  it('never lets an unverified licence reach the redistributable list', () => {
    for (const candidate of backgroundRemovalCandidates) {
      const listed = redistributableCandidates.some(entry => entry.id === candidate.id)
      expect(listed, candidate.id).toBe(candidate.licenceVerified
        && (backgroundRemovalPermittedLicences as readonly string[]).includes(candidate.licence))
    }
    /* The one the record calls out: measured, useful as a baseline, not ours to serve. */
    expect(redistributableCandidates.map(entry => entry.id)).not.toContain('isnet-general-fp16')
  })

  it('publishes exactly the gate vocabulary the record tabulates', () => {
    expect([...backgroundRemovalGateKeys]).toEqual(parseGates().map(gate => gate.key))
  })

  it('never claims an unconditional go while a gate fails', () => {
    const gates = parseGates()
    expect(gates.length).toBeGreaterThan(0)
    expect(backgroundRemovalDecision.gateVerdicts).toEqual(
      Object.fromEntries(gates.map(gate => [gate.key, gate.verdict])),
    )

    const failing = gates.filter(gate => gate.verdict === 'fail').map(gate => gate.key)
    expect(backgroundRemovalDecision.blockingGates).toEqual(failing)
    if (failing.length > 0) expect(backgroundRemovalDecision.status).toBe('no-go')
  })

  it('keeps the specification budgets it was measured against', () => {
    expect(backgroundRemovalBudgets.maxCompressedTransferBytes).toBe(40 * 1024 * 1024)
    expect(backgroundRemovalBudgets.desktopCachedRunMs).toBe(30000)
    expect(backgroundRemovalBudgets.mobileCachedRunMs).toBe(60000)
    expect(record).toContain('§12.8')
  })

  it('only leaves the transfer exception empty when the selection fits the budget', () => {
    const selected = measurements.candidates
      .find(entry => entry.id === backgroundRemovalDecision.recommendedCandidateId)
    expect(selected).toBeDefined()

    if (backgroundRemovalDecision.transferExceptionBytes === null) {
      expect(selected!.transfer.brotliBytes)
        .toBeLessThanOrEqual(backgroundRemovalBudgets.maxCompressedTransferBytes)
      return
    }
    expect(backgroundRemovalDecision.transferExceptionBytes).toBe(selected!.transfer.brotliBytes)
    expect(backgroundRemovalDecision.transferExceptionBytes)
      .toBeGreaterThan(backgroundRemovalBudgets.maxCompressedTransferBytes)
  })

  it('states the narrower scope whenever the selection is not the specified tool', () => {
    const selected = candidateById(backgroundRemovalDecision.recommendedCandidateId)
    expect(backgroundRemovalDecision.recommendedScope).toBe(selected.scope)
    if (backgroundRemovalDecision.status !== 'go') {
      expect(sectionBody('## 1. 決策摘要')).toContain(backgroundRemovalDecision.recommendedCandidateId)
    }
  })

  it('can fall back inside the same family, and the fallback also runs', () => {
    const fallback = backgroundRemovalDecision.fallbackCandidateId
    if (fallback === null) return

    const selected = candidateById(backgroundRemovalDecision.recommendedCandidateId)
    expect(candidateById(fallback).family).toBe(selected.family)
    for (const browser of ['chromium', 'firefox', 'webkit']) {
      const run = measuredRun(browser, fallback, 'wasm')
      expect(measuredFixture(run, 'product-bottle').failure, `${browser} ${fallback}`).toBeUndefined()
    }
  })

  it('never recommends a candidate that failed on the WebAssembly baseline', () => {
    for (const id of [backgroundRemovalDecision.recommendedCandidateId, backgroundRemovalDecision.fallbackCandidateId]) {
      if (!id) continue
      for (const browser of ['chromium', 'firefox', 'webkit']) {
        const run = measuredRun(browser, id, 'wasm')
        expect(run.failure, `${browser} ${id}`).toBeUndefined()
        expect(measuredFixture(run, 'product-bottle').inferenceMs).toBeGreaterThan(0)
      }
    }
  })
})

describe('the local boundary is stated and machine checkable', () => {
  it('downloads model and runtime assets from allowed hosts only', () => {
    for (const candidate of backgroundRemovalCandidates) {
      expect(new URL(candidate.provenanceUrl).host).toBe('huggingface.co')
      expect(candidate.provenanceUrl).toContain(candidate.revision)
    }
    expect(new URL(measurements.runtime.base).host).toBe('cdn.jsdelivr.net')
  })

  it('records that image pixels never leave the device', () => {
    const boundary = sectionBody('## 10. 隱私邊界')
    expect(boundary).toContain('像素')
    expect(boundary).toContain('不離開')
    expect(boundary).toContain('不上傳')
  })

  it('keeps the harness free of photographs and third-party images', () => {
    const limits = sectionBody('## 12. 驗證範圍與限制')
    expect(limits).toContain('合成素材')
    expect(limits).toContain('照片')
  })
})
