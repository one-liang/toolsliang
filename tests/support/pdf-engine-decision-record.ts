import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDecisionRecordReader } from './decision-record'

/**
 * Reader for the T24 evaluation record. The document is the specification: the
 * reference module T25 and T26 import and the measurement file the harness
 * wrote both have to agree with it, so a verdict can never be corrected in one
 * place only.
 */
const reader = createDecisionRecordReader('docs/research/009-pdf-local-editing-engine-and-safety-boundary.md')

export const pdfEngineDecisionRecord = reader.record
export const sectionBody = reader.sectionBody
export const parseForbiddenWording = reader.parseForbiddenWording

/** The measurement file the harness writes; parsed, never edited by hand. */
export const pdfEngineMeasurements = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/research/data/009-pdf-engine-measurements.json'), 'utf8'),
) as PdfEngineMeasurements

export interface PdfEngineMeasurements {
  measuredAt: string
  host: { platform: string, arch: string, cpus: number }
  previewScale: number
  permittedLicences: string[]
  fixtures: MeasuredFixture[]
  candidates: MeasuredCandidate[]
  exclusions: MeasuredExclusion[]
  browsers: MeasuredBrowser[]
}

export interface MeasuredFixture {
  name: string
  structure: string
  expectation: 'open' | 'password' | 'recover-or-reject' | 'reject'
  pages: number
  note: string
  byteLength: number
  sha256: string
}

export interface MeasuredCandidate {
  id: string
  package: string
  version: string
  publishedAt: string
  roles: string[]
  licence: string
  licenceVerified: boolean
  licenceUrl: string
  repository: string
  integrity: string
  files: Record<string, string>
  assets: { role: string, file: string, sha256: string, bytes: number, brotliBytes: number }[]
  transfer: { bytes: number, brotliBytes: number }
}

export interface MeasuredExclusion {
  id: string
  package: string
  version: string
  reason: string
  detail: string
  sourceUrl: string
}

export interface MeasuredBrowser {
  browser: string
  environment: {
    userAgent: string
    hardwareConcurrency: number | null
    deviceMemory: number | null
    crossOriginIsolated: boolean
    memoryApi: string
    offscreenCanvas: boolean
    wasm: boolean
  }
  pageErrors: string[]
  runs: MeasuredRun[]
}

export interface MeasuredPageVerification {
  pageCount: number
  widthPreserved: boolean
  heightPreserved: boolean
  rotationPreserved: boolean
  displayWidth: number
  displayHeight: number
  inkRatio: number
  seeThroughRatio: number
  strayInkPixels: number
  changedPixelsOutsidePlacement: number
  comparedPixels: number
}

export interface MeasuredRun {
  candidateId: string
  fixture: string
  variant: 'default' | 'incremental' | 'with-password' | 'ignore-encryption'
  outcome: 'ok' | 'open-failed' | 'error' | 'timeout'
  roles?: string[]
  inputBytes?: number
  pageCount?: number
  exportBytes?: number
  memoryBytes?: number | null
  firstPage?: { width: number, height: number, rotation: number | null }
  lastPage?: { width: number, height: number, rotation: number | null }
  preview?: { width: number, height: number }
  stages: {
    libraryLoadMs?: number
    openMs?: number
    firstPagePreviewMs?: number
    lastPagePreviewMs?: number
    applyMs?: number
    exportMs?: number
    verifyMs?: number
  }
  verify?: {
    firstPage?: MeasuredPageVerification
    lastPage?: MeasuredPageVerification
    untouchedPage?: { index: number, changedPixels: number, comparedPixels: number }
    failed?: { name: string, message: string }
  }
  error?: { name: string, message: string }
  wallClockMs?: number
}

export function measuredBrowser(name: string): MeasuredBrowser {
  const browser = pdfEngineMeasurements.browsers.find(entry => entry.browser === name)
  if (!browser) throw new Error(`No measurements for ${name}`)

  return browser
}

export function measuredRun(browser: string, candidateId: string, fixture: string, variant = 'default'): MeasuredRun {
  const run = measuredBrowser(browser).runs.find(entry => entry.candidateId === candidateId
    && entry.fixture === fixture && entry.variant === variant)
  if (!run) throw new Error(`No ${browser} run for ${candidateId}/${fixture}/${variant}`)

  return run
}

export function measuredCandidate(id: string): MeasuredCandidate {
  const candidate = pdfEngineMeasurements.candidates.find(entry => entry.id === id)
  if (!candidate) throw new Error(`No measured candidate ${id}`)

  return candidate
}

export function measuredFixture(name: string): MeasuredFixture {
  const fixture = pdfEngineMeasurements.fixtures.find(entry => entry.name === name)
  if (!fixture) throw new Error(`No measured fixture ${name}`)

  return fixture
}

/**
 * How the record names what a browser did with a document. A measurement is a
 * stage and an error class; a verdict is the one word the matrix prints, and
 * both the document and the reference module have to reach it the same way.
 */
export type EngineVerdict = 'opened' | 'password-required' | 'rejected' | 'timed-out'

const passwordErrors = /password/i

export function verdictOf(run: MeasuredRun): EngineVerdict {
  if (run.outcome === 'timeout') return 'timed-out'
  if (run.outcome === 'ok') return 'opened'
  if (passwordErrors.test(run.error?.message ?? '') || passwordErrors.test(run.error?.name ?? '')) {
    return 'password-required'
  }
  return 'rejected'
}

export const browserNames = ['chromium', 'firefox', 'webkit'] as const

/** §2.1: the candidates the matrix measured. */
export function parseCandidates() {
  const pattern = /^\| `([a-z0-9-]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| (是|否) \| <(\S+)> \|$/gm

  return reader.tableRows('### 2.1 量測候選', pattern).map(([, id, packageName, version, roles, licence, redistributable, licenceUrl]) => ({
    id: id!,
    package: packageName!.trim(),
    version: version!.trim(),
    roles: roles!.trim().split('、'),
    licence: licence!.trim(),
    licenceVerified: redistributable === '是',
    licenceUrl: licenceUrl!,
  }))
}

/** §2.2: what was ruled out before a browser ran, and on what fact. */
export function parseExclusions() {
  const pattern = /^\| `([a-z0-9-]+)` \| ([^|]+) \| `([a-z-]+)` \| ([^|]+) \|$/gm

  return reader.tableRows('### 2.2 量測前排除', pattern).map(([, id, packageName, reason]) => ({
    id: id!,
    package: packageName!.trim(),
    reason: reason!,
  }))
}

/** §3: the representative documents, with the digest of the bytes that were measured. */
export function parseFixtures() {
  const pattern = /^\| `([a-z0-9-]+)` \| `([a-z0-9-]+)` \| `([a-z-]+)` \| (\d+) \| ([\d,]+) \| `([0-9a-f]{64})` \|$/gm

  return reader.tableRows('## 3. 代表性文件', pattern).map(([, name, structure, expectation, pages, bytes, sha256]) => ({
    name: name!,
    structure: structure!,
    expectation: expectation!,
    pages: Number(pages),
    byteLength: Number(bytes!.replaceAll(',', '')),
    sha256: sha256!,
  }))
}

/** §4.1 and §4.2: one verdict per candidate, document and browser. */
export function parseVerdicts(heading: string) {
  const pattern = /^\| `([a-z0-9-]+)` \| `([a-z0-9-]+)` \| ([a-z-]+) \| ([a-z-]+) \| ([a-z-]+) \|$/gm

  return reader.tableRows(heading, pattern).map(([, candidateId, fixture, chromium, firefox, webkit]) => ({
    candidateId: candidateId!,
    fixture: fixture!,
    verdicts: { chromium: chromium!, firefox: firefox!, webkit: webkit! } as Record<string, string>,
  }))
}

/** §5: the timings the budgets are judged against. */
export function parseTimings() {
  const pattern = /^\| `([a-z0-9-]+)` \| `([a-z0-9-]+)` \| ([a-z]+) \| (\d+) \| ([\d-]+) \| ([\d-]+) \| ([\d-]+) \|$/gm

  return reader.tableRows('## 5. 效能與記憶體', pattern).map(([, candidateId, fixture, browser, openMs, previewMs, exportMs, memoryMiB]) => ({
    candidateId: candidateId!,
    fixture: fixture!,
    browser: browser!,
    openMs: Number(openMs),
    previewMs: previewMs === '-' ? null : Number(previewMs),
    exportMs: exportMs === '-' ? null : Number(exportMs),
    memoryMiB: memoryMiB === '-' ? null : Number(memoryMiB),
  }))
}

/** §6.3: what reading the exported document back proved, for the selected writer. */
export function parseFidelityRows() {
  const pattern = /^\| `([a-z0-9-]+)` \| ([a-z]+) \| ([\d.]+) \| ([\d.]+) \| (\d+) \| (\d+) \| (\d+) \|$/gm

  return reader.tableRows('### 6.3 讀回結果', pattern).map(([, fixture, browser, ink, seeThrough, stray, changed, untouched]) => ({
    fixture: fixture!,
    browser: browser!,
    inkRatio: Number(ink),
    seeThroughRatio: Number(seeThrough),
    strayInkPixels: Number(stray),
    changedPixelsOutsidePlacement: Number(changed),
    untouchedPageChangedPixels: Number(untouched),
  }))
}

/** §7: the failure vocabulary, its recoverability and the action it suggests. */
export function parseFailureCodes() {
  const pattern = /^\| `([a-z_]+)` \| ([^|]+) \| (是|否) \| `([a-z-]+)` \|$/gm

  return reader.tableRows('## 7. 密碼、不支援結構與損毀檔策略', pattern).map(([, code, , recoverable, action]) => ({
    code: code!,
    recoverable: recoverable === '是',
    suggestedAction: action!,
  }))
}

/** §8: the go/no-go gates, in the order the record tabulates them. */
export function parseGates() {
  const pattern = /^\| `([a-z-]+)` \| (pass|fail|conditional) \| ([^|]+) \|$/gm

  return reader.tableRows('## 8. Go／No-Go 判定', pattern).map(([, key, verdict]) => ({
    key: key!,
    verdict: verdict!,
  }))
}

/** §9: the limits and budgets T25 has to implement. */
export function parseLimits() {
  const pattern = /^\| `([a-zA-Z]+)` \| ([\d,]+) \| ([^|]+) \|$/gm

  return reader.tableRows('### 9.2 上限與預算', pattern).map(([, key, value]) => ({
    key: key!,
    value: Number(value!.replaceAll(',', '')),
  }))
}

/** §10.1: the bilingual wording the tool has to show, fixed in both locales. */
export function parseDisclosures() {
  return reader.parseBilingualRows('### 10.1 產品文案')
}
