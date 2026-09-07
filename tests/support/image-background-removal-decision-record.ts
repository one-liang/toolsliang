import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDecisionRecordReader } from './decision-record'

/**
 * Reader for the T18 evaluation record. The document is the specification: the
 * reference module and the measurement file both have to agree with it, so a
 * number can never be corrected in one place only.
 */
const reader = createDecisionRecordReader('docs/research/007-image-background-removal-model-evaluation.md')

export const backgroundRemovalDecisionRecord = reader.record

/** The measurement file the harness writes; parsed, never edited by hand. */
export const backgroundRemovalMeasurements = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/research/data/007-background-removal-measurements.json'), 'utf8'),
) as BackgroundRemovalMeasurements

export interface BackgroundRemovalMeasurements {
  measuredAt: string
  host: { platform: string, arch: string, cpus: number }
  runtime: { id: string, version: string, licence: string, base: string, files: { file: string, sha256: string, bytes: number, brotliBytes: number }[] }
  fixtures: { size: number, names: string[], large: { name: string, width: number, height: number }, confirmation: string[] }
  candidates: MeasuredCandidate[]
  browsers: MeasuredBrowser[]
}

export interface MeasuredCandidate {
  id: string
  input: { width: number, height: number }
  family: string
  scope: string
  repo: string
  revision: string
  file: string
  bytes: number
  sha256: string
  precision: string
  licence: string
  licenceUrl: string
  transfer: { bytes: number, brotliBytes: number }
}

export interface MeasuredBrowser {
  browser: string
  environment: {
    userAgent: string
    memoryApi: string
    hardwareConcurrency: number | null
    crossOriginIsolated: boolean
    webgpu: { available: boolean, fp16?: boolean, vendor?: string | null, architecture?: string | null } | null
  }
  threads: number
  providers: string[]
  pageErrors: string[]
  runs: MeasuredRun[]
}

export interface MeasuredRun {
  candidateId: string
  provider: string
  configuration: string
  transferBytes?: number
  sessionCreateMs?: number
  sessionHeapBytes?: number | null
  failure?: { stage: string, message: string }
  fixtures: MeasuredFixture[]
}

export interface MeasuredFixture {
  fixture: string
  width: number
  height: number
  preprocessMs?: number
  postprocessMs?: number
  peakWasmBytes?: number
  inferenceMs?: number
  warmInferenceMs?: number
  peakHeapBytes?: number | null
  iou?: number
  mae?: number
  boundaryMae?: number
  softAlphaMae?: number
  backgroundLeakRate?: number
  foregroundRecall?: number
  failure?: string
}

/**
 * The effective run for a pair: the one at the candidate's own input size, and
 * among those the attempt that produced fixtures. The harness only records a
 * second attempt when the first ran out of memory and a smaller-input attempt
 * when the native size could not finish, so neither may stand in for the
 * headline numbers.
 */
export function measuredRun(browser: string, candidateId: string, provider: string): MeasuredRun {
  const native = backgroundRemovalMeasurements.candidates
    .find(entry => entry.id === candidateId)?.input.width
  if (native === undefined) throw new Error(`No measured candidate ${candidateId}`)

  const attempts = (backgroundRemovalMeasurements.browsers
    .find(entry => entry.browser === browser)?.runs ?? [])
    .filter(run => run.candidateId === candidateId
      && run.provider === provider
      && run.inputWidth === native)
  const completed = attempts.filter(run => !run.failure && run.fixtures.some(fixture => !fixture.failure))
  const found = (completed.length > 0 ? completed : attempts).at(-1)
  if (!found) throw new Error(`No ${browser} run for ${candidateId} on ${provider}`)

  return found
}

export function measuredFixture(run: MeasuredRun, fixture: string): MeasuredFixture {
  const found = run.fixtures.find(entry => entry.fixture === fixture)
  if (!found) throw new Error(`Run ${run.candidateId}/${run.provider} has no fixture ${fixture}`)

  return found
}

/** §2.1 candidate table: id, family, scope, precision, licence, licence URL. */
export function parseCandidates() {
  const pattern = /^\| `([a-z0-9-.]+)` \| `([a-z0-9-.]+)` \| `([a-z-]+)` \| `([a-z0-9]+)` \| ([^|]+?) \| <(https:\/\/[^>]+)> \|$/gm

  return reader.tableRows('### 2.1 候選', pattern).map(([, id, family, scope, precision, licence, licenceUrl]) => ({
    id: id!,
    family: family!,
    scope: scope!,
    precision: precision!,
    licence: licence!.trim(),
    licenceUrl: licenceUrl!,
  }))
}

/** §2.2 exclusions: what was looked at and why it never reached a browser. */
export function parseExclusions() {
  const pattern = /^\| `([a-z0-9-.]+)` \| `([a-z-]+)` \| ([^|]+?) \|$/gm

  return reader.tableRows('### 2.2 排除的候選', pattern).map(([, id, reason]) => ({ id: id!, reason: reason! }))
}

/** §2.3 fingerprints: repository, pinned commit, file, bytes and digest. */
export function parseFingerprints() {
  const pattern = /^\| `([a-z0-9-.]+)` \| `([^`]+)` \| `([0-9a-f]{40})` \| `([^`]+)` \| ([\d,]+) \| `([0-9a-f]{64})` \|$/gm

  return reader.tableRows('### 2.3 模型檔案指紋', pattern).map(([, id, repo, revision, file, bytes, sha256]) => ({
    id: id!,
    repo: repo!,
    revision: revision!,
    file: file!,
    bytes: Number(bytes!.replaceAll(',', '')),
    sha256: sha256!,
  }))
}

/** §4 fixture table: every representative case and what it probes. */
export function parseFixtureKeys() {
  return reader.parseKeyColumn('## 4. 代表性測試集')
}

/** §5.1 transfer and load: bytes, brotli bytes, session creation. */
export function parseTransferRows() {
  const pattern = /^\| `([a-z0-9-.]+)` \| ([\d,]+) \| ([\d,]+) \| ([\d,]+|—) \| ([\d,]+|—) \|$/gm

  return reader.tableRows('### 5.1 傳輸與載入', pattern).map(([, id, bytes, brotli, session, wasm]) => ({
    id: id!,
    bytes: Number(bytes!.replaceAll(',', '')),
    brotliBytes: Number(brotli!.replaceAll(',', '')),
    sessionCreateMs: session === '—' ? null : Number(session!.replaceAll(',', '')),
    sessionWasmBytes: wasm === '—' ? null : Number(wasm!.replaceAll(',', '')),
  }))
}

/** §5.2 quality: one row per candidate, one column per representative case. */
export function parseQualityRows() {
  const pattern = /^\| `([a-z0-9-.]+)` \| ([\d.]+|—) \| ([\d.]+|—) \| ([\d.]+|—) \| ([\d.]+|—) \| ([\d.]+|—) \|$/gm

  return reader.tableRows('### 5.2 遮罩品質', pattern).map(([, id, portrait, hair, product, glass, lowContrast]) => ({
    id: id!,
    portrait: portrait!,
    hair: hair!,
    product: product!,
    glass: glass!,
    lowContrast: lowContrast!,
  }))
}

/** §5.3 cost: cold and warm inference plus the 12 MP case. */
export function parseCostRows() {
  const pattern = /^\| `([a-z0-9-.]+)` \| `([a-z]+)` \| ([\d,]+|—) \| ([\d,]+|—) \| ([\d,]+|—) \| ([\d,]+|—) \|$/gm

  return reader.tableRows('### 5.3 推論成本與記憶體', pattern).map(([, id, provider, cold, warm, large, peak]) => ({
    id: id!,
    provider: provider!,
    coldMs: cold === '—' ? null : Number(cold!.replaceAll(',', '')),
    warmMs: warm === '—' ? null : Number(warm!.replaceAll(',', '')),
    largeMs: large === '—' ? null : Number(large!.replaceAll(',', '')),
    peakWasmBytes: peak === '—' ? null : Number(peak!.replaceAll(',', '')),
  }))
}

/** §6 capability ladder keys, top tier first. */
export function parseCapabilityLevels() {
  return reader.parseKeyColumn('## 6. 能力層級與降級')
}

/** §7 failure codes every implementation has to surface. */
export function parseFailureCodes() {
  return reader.parseKeyColumn('## 7. 失敗模式', /^\| `([a-z0-9_]+)` \|/gm)
}

/** §8 gates: the go/no-go criteria and the verdict each one reached. */
export function parseGates() {
  const pattern = /^\| `([a-z0-9-]+)` \| ([^|]+?) \| ([^|]+?) \| `(pass|fail|conditional)` \|$/gm

  return reader.tableRows('## 8. go/no-go 標準', pattern).map(([, key, threshold, measured, verdict]) => ({
    key: key!,
    threshold: threshold!.trim(),
    measured: measured!.trim(),
    verdict: verdict!,
  }))
}

export function sectionBody(heading: string) {
  return reader.sectionBody(heading)
}
