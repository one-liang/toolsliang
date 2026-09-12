import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDecisionRecordReader } from './decision-record'

/**
 * Reader for the T26 feasibility record. The document is the specification: the
 * reference module the platform imports and the measurement file the harness
 * wrote both have to agree with it, so a gate can never be relaxed in one place
 * only — least of all the one that says this tool may not be published.
 */
const reader = createDecisionRecordReader('docs/research/011-word-to-pdf-local-conversion-feasibility.md')

export const wordToPdfDecisionRecord = reader.record
export const sectionBody = reader.sectionBody
export const parseForbiddenWording = reader.parseForbiddenWording

/** The measurement file the harness writes; parsed, never edited by hand. */
export const wordToPdfMeasurements = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/research/data/011-word-to-pdf-measurements.json'), 'utf8'),
) as WordToPdfMeasurements

export interface WordToPdfMeasurements {
  measuredAt: string
  host: { platform: string, arch: string, cpus: number }
  budgets: {
    firstProgressMs: number
    referenceConversionMs: number
    mainThreadTaskMs: number
    referenceFixture: string
  }
  raster: { scale: number, sliceHeightPx: number, imageFormat: string, imageQuality: number }
  pdfSubset: string[]
  memorySubset: string[]
  externalLinkProbe: string
  permittedLicences: string[]
  fixtures: MeasuredFixture[]
  libraries: MeasuredLibrary[]
  pipelines: MeasuredPipeline[]
  exclusions: MeasuredExclusion[]
  browsers: MeasuredBrowser[]
}

/** What a corpus document declares about itself, in its own markup. */
export interface DeclaredContent {
  pages: number | null
  sections: number
  orientations: string[]
  text: string[]
  absentText: string[]
  tables: { rows: number, columns: number }[]
  images: number
  headerText: string[]
  footerText: string[]
  footnoteText: string[]
  endnoteText: string[]
  commentText: string[]
  listMarkers: string[]
  hyperlinks: string[]
  fields: string[]
  equationText: string[]
  /** Families the document names in `w:rFonts`; §12.13 asks what happens to them. */
  fontFamilies: string[]
}

/**
 * One font family, as the browser answered for it.
 *
 * `installed` means the family changed the width of a measured string against
 * at least one generic baseline, which is the only evidence that a real face
 * backs it. A family that is asked for and not installed was substituted, and
 * nothing in any pipeline said so.
 */
export interface MeasuredFont {
  family: string
  /** A CSS keyword naming a category rather than a face; never "installed". */
  generic: boolean
  installed: boolean
  widths: { generic: string, width: number, baselineWidth: number }[]
}

export interface MeasuredFixture {
  name: string
  category: string
  filename: string
  mediaType: string
  features: string[]
  /** `refuse` means a conversion that succeeds is the failure. */
  expectation: 'convert' | 'refuse'
  note: string
  declared: DeclaredContent
  byteLength: number
  sha256: string
}

export interface MeasuredLibrary {
  id: string
  package: string
  version: string
  publishedAt: string
  stages: string[]
  licence: string
  /** What the manifest says, which is not always one licence. */
  licenceDeclared: string
  licenceVerified: boolean
  licenceUrl: string
  repository: string
  integrity: string
  files: Record<string, string>
  assets: { role: string, file: string, sha256: string, bytes: number, brotliBytes: number }[]
  transfer: { bytes: number, brotliBytes: number }
}

export interface MeasuredPipeline {
  id: string
  /** The library that reads the document; the harness is told, never left to infer. */
  parser: string
  output: 'dom' | 'pdf'
  libraries: string[]
  stages: string[]
  note: string
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

export interface MeasuredProbe {
  renderedPages: number
  pageBoxes: { widthPx: number, heightPx: number, orientation: string }[]
  /** The column counts the page boxes actually apply, `auto` filtered out. */
  columnCounts: string[]
  orientations: string[]
  textLength: number
  declaredText: { value: string, present: boolean, inOrder: boolean }[]
  absentText: { value: string, present: boolean }[]
  headerText: { value: string, present: boolean }[]
  footerText: { value: string, present: boolean }[]
  footnoteText: { value: string, present: boolean }[]
  endnoteText: { value: string, present: boolean }[]
  commentText: { value: string, present: boolean }[]
  equationText: { markers: { value: string, present: boolean }[], elements: number } | null
  /** Families the document asked for, and families the conversion ended up asking for. */
  declaredFonts: MeasuredFont[]
  renderedFonts: MeasuredFont[]
  tables: { rows: number, columns: number, cells: number }[]
  images: { count: number, decoded: number, sources: string[] }
  listMarkers: string[]
  links: string[]
  contentHeightPx: number
}

export interface MeasuredReadBack {
  readable: boolean
  pages?: number
  pageSizes?: { widthPt: number, heightPt: number, orientation: string, textItems: number }[]
  /** Zero across every page means the file holds pictures of words, not words. */
  textItems?: number
  selectableText?: { value: string, present: boolean }[]
  error?: string
}

export interface MeasuredRun {
  pipelineId: string
  fixture: string
  output: 'dom' | 'pdf'
  outcome: 'ok' | 'failed' | 'timeout'
  stages: {
    readMs?: number
    parseMs?: number
    layoutMs?: number
    rasteriseMs?: number
    writePdfMs?: number
    firstObservableMs?: number | null
    conversionMs?: number
  }
  error: { name: string, message: string } | null
  messages?: string[]
  inputBytes?: number
  probe?: MeasuredProbe
  pdf?: {
    bytes: number
    writtenPages: number
    writtenPageSizes: { widthPt: number, heightPt: number }[]
    /** Non-paper pixels per page; a zero is a blank page inside a readable file. */
    inkRatios: number[]
  }
  readBack?: MeasuredReadBack
  memory?: { baselineBytes: number, peakBytes: number, deltaBytes: number } | null
  /** The longest stretch the main thread never returned to the event loop. */
  longestStallMs?: number
  blockedMs?: number
  wallClockMs?: number
  /** URLs the browser asked for that the job had no business needing, any origin. */
  unexpectedRequests?: string[]
  /** Served by the harness but never reported by the browser; the capture's own cross-check. */
  unservedMismatch?: string[]
}

export interface MeasuredBrowser {
  browser: string
  environment: {
    userAgent: string
    deviceMemoryGb: number | null
    hardwareConcurrency: number | null
    crossOriginIsolated: boolean
    memoryApi: string
    longTaskObserver: string
    offscreenCanvas: boolean
    wasm: boolean
  }
  pageErrors: string[]
  runs: MeasuredRun[]
}

export const browserNames = ['chromium', 'firefox', 'webkit'] as const

export function measuredBrowser(name: string): MeasuredBrowser {
  const browser = wordToPdfMeasurements.browsers.find(entry => entry.browser === name)
  if (!browser) throw new Error(`No measurements for ${name}`)

  return browser
}

export function measuredRun(browser: string, pipelineId: string, fixture: string): MeasuredRun {
  const run = measuredBrowser(browser).runs.find(entry => entry.pipelineId === pipelineId && entry.fixture === fixture)
  if (!run) throw new Error(`No ${browser} run for ${pipelineId}/${fixture}`)

  return run
}

export function optionalRun(browser: string, pipelineId: string, fixture: string) {
  return measuredBrowser(browser).runs.find(entry => entry.pipelineId === pipelineId && entry.fixture === fixture)
}

export function measuredFixture(name: string): MeasuredFixture {
  const fixture = wordToPdfMeasurements.fixtures.find(entry => entry.name === name)
  if (!fixture) throw new Error(`No measured fixture ${name}`)

  return fixture
}

export function measuredLibrary(id: string): MeasuredLibrary {
  const library = wordToPdfMeasurements.libraries.find(entry => entry.id === id)
  if (!library) throw new Error(`No measured library ${id}`)

  return library
}

export function everyRun() {
  return browserNames.flatMap(browser => measuredBrowser(browser).runs.map(run => ({ browser, run })))
}

/**
 * How the record names what a pipeline did with a document: a measurement is an
 * outcome and an error, a verdict is the one word the matrix prints, and both
 * the document and the reference module have to reach it the same way.
 */
export type ConversionVerdict = 'converted' | 'rejected' | 'timed-out'

export function verdictOf(run: MeasuredRun): ConversionVerdict {
  if (run.outcome === 'timeout') return 'timed-out'
  return run.outcome === 'ok' ? 'converted' : 'rejected'
}

/** §2.1: the libraries the matrix loaded. */
export function parseLibraries() {
  const pattern = /^\| `([a-z0-9-]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| (是|否) \| <(\S+)> \|$/gm

  return reader.tableRows('### 2.1 量測候選', pattern).map(([, id, packageName, version, , licence, redistributable, licenceUrl]) => ({
    id: id!,
    package: packageName!.trim(),
    version: version!.trim(),
    licence: licence!.trim(),
    licenceVerified: redistributable === '是',
    licenceUrl: licenceUrl!,
  }))
}

/** §2.2: the chains that were actually run, and what each one ends in. */
export function parsePipelines() {
  const pattern = /^\| `([a-z0-9-]+)` \| `(dom|pdf)` \| ([^|]+) \| ([\d,]+) \|$/gm

  return reader.tableRows('### 2.2 量測管線', pattern).map(([, id, output, libraries, brotli]) => ({
    id: id!,
    output: output!,
    libraries: libraries!.trim().split(' + ').map(name => name.replace(/`/g, '')),
    brotliBytes: Number(brotli!.replaceAll(',', '')),
  }))
}

/** §2.3: what was ruled out before a browser ran, and on what fact. */
export function parseExclusions() {
  const pattern = /^\| `([a-z0-9-]+)` \| ([^|]+) \| `([a-z-]+)` \| ([^|]+) \|$/gm

  return reader.tableRows('### 2.3 量測前排除', pattern).map(([, id, specifier, reason]) => ({
    id: id!,
    /* The column is `name@version`, and a scoped name has an `@` of its own. */
    package: specifier!.trim().slice(0, specifier!.trim().lastIndexOf('@')),
    version: specifier!.trim().slice(specifier!.trim().lastIndexOf('@') + 1),
    reason: reason!,
  }))
}

/** §3: the corpus, with the digest of the bytes that were measured. */
export function parseFixtures() {
  const pattern = /^\| `([a-z0-9-]+)` \| `([a-z]+)` \| `(convert|refuse)` \| ([\d-]+) \| ([\d,]+) \| `([0-9a-f]{64})` \|$/gm

  return reader.tableRows('## 3. 測試集', pattern).map(([, name, category, expectation, pages, bytes, sha256]) => ({
    name: name!,
    category: category!,
    expectation: expectation!,
    declaredPages: pages === '-' ? null : Number(pages),
    byteLength: Number(bytes!.replaceAll(',', '')),
    sha256: sha256!,
  }))
}

/** §4.1: one verdict per pipeline, document and browser. */
export function parseVerdicts(heading: string) {
  const pattern = /^\| `([a-z0-9-]+)` \| `([a-z0-9-]+)` \| ([a-z-]+) \| ([a-z-]+) \| ([a-z-]+) \|$/gm

  return reader.tableRows(heading, pattern).map(([, pipelineId, fixture, chromium, firefox, webkit]) => ({
    pipelineId: pipelineId!,
    fixture: fixture!,
    verdicts: { chromium: chromium!, firefox: firefox!, webkit: webkit! } as Record<string, string>,
  }))
}

/** §4.2: declared pages against the pages each browser actually produced. */
export function parsePaginationRows() {
  const pattern = /^\| `([a-z0-9-]+)` \| (\d+) \| (\d+) \| (\d+) \| (\d+) \|$/gm

  return reader.tableRows('### 4.2 分頁', pattern).map(([, fixture, declared, chromium, firefox, webkit]) => ({
    fixture: fixture!,
    declaredPages: Number(declared),
    rendered: { chromium: Number(chromium), firefox: Number(firefox), webkit: Number(webkit) } as Record<string, number>,
  }))
}

/** §4.3: what each pipeline kept of one document feature, as a verdict word. */
export function parseFidelityRows() {
  const pattern = /^\| `([a-z0-9-]+)` \| `([a-z0-9-]+)` \| (kept|lost|altered|leaked) \| (kept|lost|altered|leaked) \|$/gm

  return reader.tableRows('### 4.3 內容保真', pattern).map(([, fixture, aspect, docxPreview, mammoth]) => ({
    fixture: fixture!,
    aspect: aspect!,
    docxPreview: docxPreview!,
    mammoth: mammoth!,
  }))
}

/**
 * §4.4: what happened to each font family the corpus asks for.
 *
 * Installation is per browser, because it turned out not to agree: the same
 * machine resolves a family in one engine and substitutes it in another. The
 * two "carried" columns are single, because whether a conversion passes the
 * request on is a property of the conversion, and that did agree everywhere.
 */
export function parseFontRows() {
  const pattern = /^\| `([a-z0-9-]+)` \| ([^|]+) \| (是|否) \| (是|否) \| (是|否) \| (是|否) \| (是|否) \|$/gm

  return reader.tableRows('### 4.4 字型解析', pattern).map(([, fixture, family, chromium, firefox, webkit, docxPreview, mammoth]) => ({
    fixture: fixture!,
    family: family!.trim(),
    installed: { chromium: chromium === '是', firefox: firefox === '是', webkit: webkit === '是' } as Record<string, boolean>,
    /* Whether the conversion passed the document's request on to the browser at all. */
    carriedByDocxPreview: docxPreview === '是',
    carriedByMammoth: mammoth === '是',
  }))
}

/** §5: the timings and stalls the budgets are judged against. */
export function parseTimings() {
  const pattern = /^\| `([a-z0-9-]+)` \| `([a-z0-9-]+)` \| ([a-z]+) \| (\d+) \| (\d+) \| (\d+) \| ([\d-]+) \|$/gm

  return reader.tableRows('## 5. 效能、記憶體與主執行緒', pattern).map(([, pipelineId, fixture, browser, firstObservableMs, conversionMs, longestStallMs, memoryMiB]) => ({
    pipelineId: pipelineId!,
    fixture: fixture!,
    browser: browser!,
    firstObservableMs: Number(firstObservableMs),
    conversionMs: Number(conversionMs),
    longestStallMs: Number(longestStallMs),
    memoryMiB: memoryMiB === '-' ? null : Number(memoryMiB),
  }))
}

/** §6.1: what an independent reader found inside each produced file. */
export function parseOutputRows() {
  const pattern = /^\| `([a-z0-9-]+)` \| `([a-z0-9-]+)` \| ([a-z]+) \| (\d+) \| (\d+) \| (\d+) \| (是|否) \|$/gm

  return reader.tableRows('### 6.1 產出與讀回', pattern).map(([, pipelineId, fixture, browser, declared, written, textItems, readable]) => ({
    pipelineId: pipelineId!,
    fixture: fixture!,
    browser: browser!,
    declaredPages: Number(declared),
    writtenPages: Number(written),
    textItems: Number(textItems),
    readable: readable === '是',
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

/** §9.2: the public surfaces a no-go forbids, each as a key the platform can check. */
export function parseForbiddenSurfaces() {
  const pattern = /^\| `([a-z-]+)` \| ([^|]+) \|$/gm

  return reader.tableRows('### 9.2 禁止的公開面', pattern).map(([, key]) => key!)
}

/** §9.3: what would have to change before this is measured again. */
export function parseReassessmentConditions() {
  const pattern = /^\| `([a-z-]+)` \| ([^|]+) \|$/gm

  return reader.tableRows('### 9.3 重新評估條件', pattern).map(([, key]) => key!)
}

/** §9.5: the five stages §12.13 names, against the pipeline stage that covers each. */
export function parseSpecStages() {
  const pattern = /^\| `([a-z-]+)` \| (`[a-z-]+`|無) \| ([^|]+) \|$/gm

  return reader.tableRows('### 9.5 規格階段對照', pattern).map(([, spec, coveredBy]) => ({
    spec: spec!,
    coveredBy: coveredBy === '無' ? null : coveredBy!.replace(/`/g, ''),
  }))
}

/** §9.4: the budgets the record judged the gate against. */
export function parseBudgets() {
  const pattern = /^\| `([a-zA-Z]+)` \| ([\d,]+) \| ([^|]+) \|$/gm

  return reader.tableRows('### 9.4 量測時採用的預算', pattern).map(([, key, value]) => ({
    key: key!,
    value: Number(value!.replaceAll(',', '')),
  }))
}
