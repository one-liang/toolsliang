/**
 * What T26 found when it tried to turn a Word document into a PDF on the
 * user's own device, and what the platform must do about it.
 *
 * The evaluation record `docs/research/011-word-to-pdf-local-conversion-feasibility.md`
 * is the source and ADR-0017 is the decision; this module is the part the rest
 * of the codebase can import. Its job is unusual for a reference module: the
 * gate returned no-go, so most of what it carries is a boundary — which
 * surfaces this tool may not appear on, which claims may never be made, and
 * what would have to change before anyone measures again.
 *
 * It holds no engine, no conversion and nothing derived from a document,
 * because there is no tool. It exists so that "we decided not to publish this"
 * is a fact the tests can check rather than a note somebody has to remember.
 */

/** Names the reviewed candidate set by the day the measurements were taken. */
export const wordToPdfReferenceVersion = 'word-to-pdf-2026-09-12'

/** The slug ADR-0011 reserves for this tool, held unpublished until a gate passes. */
export const wordToPdfReservedSlug = 'word-to-pdf'

/**
 * Licences this project may redistribute from its own bundle. BSD-2-Clause is
 * added to the T24 list: it is the same attribution-only shape as BSD-3-Clause
 * without the non-endorsement clause, and nothing in it stops the file being
 * served from our own origin.
 */
export const wordToPdfPermittedLicences = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause'] as const

/** What a library contributes to a conversion. No measured library does more than two. */
export const wordToPdfLibraryStages = ['unzip', 'parse', 'layout', 'paginate', 'rasterise', 'write-pdf', 'read-pdf'] as const

export type WordToPdfLibraryStage = typeof wordToPdfLibraryStages[number]

export interface WordToPdfLibrary {
  id: string
  package: string
  /** The published version every measurement ran on. */
  version: string
  publishedAt: string
  stages: readonly WordToPdfLibraryStage[]
  /** The licence this project relies on, which for a dual-licensed package is a choice. */
  licence: string
  /** What the manifest declares, verbatim — not always one licence. */
  licenceDeclared: string
  /**
   * Whether the manifest, the licence file and the files the package actually
   * ships say the same thing. Only a verified library may be bundled, which
   * ADR-0001 requires of every dependency that would touch tool content.
   */
  licenceVerified: boolean
  /** The page whose wording the licence column transcribes. */
  licenceUrl: string
  repository: string
}

export const wordToPdfLibraries: readonly WordToPdfLibrary[] = [
  {
    id: 'jszip',
    package: 'jszip',
    version: '3.10.1',
    publishedAt: '2022-08-02',
    stages: ['unzip'],
    /*
     * Dual licensed, and the choice has to be written down: a bare
     * "(MIT OR GPL-3.0-or-later)" in a manifest says what is on offer, not
     * which offer we took. This project takes MIT and never the GPL one.
     */
    licence: 'MIT',
    licenceDeclared: '(MIT OR GPL-3.0-or-later)',
    licenceVerified: true,
    licenceUrl: 'https://github.com/Stuk/jszip/blob/main/LICENSE.markdown',
    repository: 'https://github.com/Stuk/jszip',
  },
  {
    id: 'docx-preview',
    package: 'docx-preview',
    version: '0.4.0',
    publishedAt: '2026-07-07',
    stages: ['parse', 'layout', 'paginate'],
    licence: 'Apache-2.0',
    licenceDeclared: 'Apache-2.0',
    licenceVerified: true,
    licenceUrl: 'https://github.com/VolodymyrBaydalka/docxjs/blob/master/LICENSE',
    repository: 'https://github.com/VolodymyrBaydalka/docxjs',
  },
  {
    id: 'mammoth',
    package: 'mammoth',
    version: '1.12.3',
    publishedAt: '2026-09-12',
    stages: ['parse'],
    licence: 'BSD-2-Clause',
    licenceDeclared: 'BSD-2-Clause',
    licenceVerified: true,
    licenceUrl: 'https://github.com/mwilliamson/mammoth.js/blob/master/LICENSE',
    repository: 'https://github.com/mwilliamson/mammoth.js',
  },
  {
    id: 'html2canvas',
    package: 'html2canvas',
    version: '1.4.1',
    publishedAt: '2022-01-22',
    stages: ['rasterise'],
    licence: 'MIT',
    licenceDeclared: 'MIT',
    licenceVerified: true,
    licenceUrl: 'https://github.com/niklasvh/html2canvas/blob/master/LICENSE',
    repository: 'https://github.com/niklasvh/html2canvas',
  },
  {
    id: 'jspdf',
    package: 'jspdf',
    version: '4.2.1',
    publishedAt: '2026-03-17',
    stages: ['write-pdf'],
    licence: 'MIT',
    licenceDeclared: 'MIT',
    licenceVerified: true,
    licenceUrl: 'https://github.com/parallax/jsPDF/blob/master/LICENSE',
    repository: 'https://github.com/parallax/jsPDF',
  },
  {
    id: 'pdfjs-dist',
    package: 'pdfjs-dist',
    version: '6.3.289',
    publishedAt: '2026-08-29',
    stages: ['read-pdf'],
    licence: 'Apache-2.0',
    licenceDeclared: 'Apache-2.0',
    licenceVerified: true,
    licenceUrl: 'https://github.com/mozilla/pdf.js/blob/master/LICENSE',
    repository: 'https://github.com/mozilla/pdf.js',
  },
]

/** Only these could have been bundled with a tool, had there been one. */
export const redistributableWordToPdfLibraries = wordToPdfLibraries.filter(
  library => library.licenceVerified
    && (wordToPdfPermittedLicences as readonly string[]).includes(library.licence),
)

export interface WordToPdfPipeline {
  id: string
  /** `dom` stops at the rendered document; `pdf` carries on to a file. */
  output: 'dom' | 'pdf'
  libraries: readonly string[]
}

/**
 * The chains that were measured. Nothing published reads a DOCX and writes a
 * PDF by itself, so a candidate is always a chain — and where the chain breaks
 * is the finding.
 */
export const wordToPdfPipelines: readonly WordToPdfPipeline[] = [
  { id: 'docx-preview', output: 'dom', libraries: ['jszip', 'docx-preview'] },
  { id: 'mammoth', output: 'dom', libraries: ['mammoth'] },
  { id: 'docx-preview-raster-pdf', output: 'pdf', libraries: ['jszip', 'docx-preview', 'html2canvas', 'jspdf'] },
  { id: 'mammoth-raster-pdf', output: 'pdf', libraries: ['mammoth', 'html2canvas', 'jspdf'] },
]

/** Why a library was ruled out before any browser opened a document with it. */
export const wordToPdfExclusionReasons = [
  'copyleft-licence',
  'creation-only',
  'no-browser-build',
  'proprietary-licence',
  'requires-server',
  'runtime-not-redistributed',
  'wraps-a-candidate',
] as const

export type WordToPdfExclusionReason = typeof wordToPdfExclusionReasons[number]

export interface WordToPdfExclusion {
  id: string
  package: string
  reason: WordToPdfExclusionReason
  /** The page whose own wording the exclusion rests on. */
  sourceUrl: string
}

export const wordToPdfExclusions: readonly WordToPdfExclusion[] = [
  { id: 'zetajs', package: 'zetajs', reason: 'runtime-not-redistributed', sourceUrl: 'https://www.npmjs.com/package/zetajs/v/1.2.0' },
  { id: 'pandoc-wasm', package: 'pandoc-wasm', reason: 'copyleft-licence', sourceUrl: 'https://www.npmjs.com/package/pandoc-wasm/v/1.1.0' },
  { id: 'nativedocuments-docx-wasm', package: '@nativedocuments/docx-wasm', reason: 'proprietary-licence', sourceUrl: 'https://www.npmjs.com/package/@nativedocuments/docx-wasm/v/2.2.13-1561490777' },
  { id: 'onlyoffice-document-editor', package: '@onlyoffice/document-editor-react', reason: 'requires-server', sourceUrl: 'https://www.npmjs.com/package/@onlyoffice/document-editor-react/v/2.2.0' },
  { id: 'docx2pdf', package: 'docx2pdf', reason: 'no-browser-build', sourceUrl: 'https://www.npmjs.com/package/docx2pdf/v/0.0.4' },
  { id: 'js-preview-docx', package: '@js-preview/docx', reason: 'wraps-a-candidate', sourceUrl: 'https://www.npmjs.com/package/@js-preview/docx/v/1.6.4' },
  { id: 'docx', package: 'docx', reason: 'creation-only', sourceUrl: 'https://www.npmjs.com/package/docx/v/9.7.1' },
  { id: 'pdfmake', package: 'pdfmake', reason: 'creation-only', sourceUrl: 'https://www.npmjs.com/package/pdfmake/v/0.3.11' },
]

/**
 * What §12.13 of the specification requires of the corpus before a gate may be
 * decided at all. A later re-measurement that covers less than this is not a
 * re-measurement of the same question.
 */
export const wordToPdfCorpusRequirements = {
  minimumDocuments: 30,
  features: [
    'paragraphs',
    'tables',
    'images',
    'headers',
    'footers',
    'page-breaks',
    'lists',
    'cjk-fonts',
    'latin-fonts',
    'equations',
    'footnotes',
    'tracked-changes',
    'macros',
  ],
  /** Containers a conversion must refuse rather than half-understand. */
  refusedDocuments: [
    'macro-enabled',
    'legacy-binary-doc',
    'encrypted-docx',
    'truncated-package',
    'not-a-package',
  ],
} as const

/**
 * The five stages §12.13 names, against the pipeline stage that covers each.
 *
 * `font-resolution` has no owner, and that is the point: no measured library
 * resolves fonts or reports a missing one. The browser substitutes silently and
 * nothing in the chain is in a position to tell the user, which is why it is a
 * gate of its own rather than a footnote.
 */
export const wordToPdfSpecStages = [
  { spec: 'parse', coveredBy: 'parse' },
  { spec: 'layout', coveredBy: 'layout' },
  { spec: 'font-resolution', coveredBy: null },
  { spec: 'pdf-render', coveredBy: 'write-pdf' },
  { spec: 'validate', coveredBy: 'read-pdf' },
] as const

/** The budgets §12.13 sets, in the units the harness reports. */
export const wordToPdfBudgets = {
  firstProgressMs: 250,
  referenceConversionMs: 30_000,
  mainThreadTaskMs: 50,
} as const

export const wordToPdfGateKeys = [
  'licence',
  'supply-chain',
  'maintenance',
  'browser-support',
  'pagination',
  'content-fidelity',
  'font-resolution',
  'output-text',
  'unsupported-input',
  'progress-and-cancellation',
  'main-thread',
  'performance',
  'memory-headroom',
  'privacy',
] as const

export type WordToPdfGateKey = typeof wordToPdfGateKeys[number]
export type WordToPdfGateVerdict = 'pass' | 'conditional' | 'fail'

export interface WordToPdfGate {
  key: WordToPdfGateKey
  verdict: WordToPdfGateVerdict
}

/**
 * The gates, in the order the record tabulates them.
 *
 * Nothing here is a complaint about any of the libraries: each does the job it
 * says it does, and content fidelity, privacy, performance and cross-browser
 * agreement all passed. The failures are about the jobs nobody does — laying a
 * Word document out on a page, and writing that page as text rather than as a
 * photograph of text.
 */
export const wordToPdfGates: readonly WordToPdfGate[] = [
  { key: 'licence', verdict: 'pass' },
  { key: 'supply-chain', verdict: 'pass' },
  { key: 'maintenance', verdict: 'conditional' },
  { key: 'browser-support', verdict: 'pass' },
  { key: 'pagination', verdict: 'fail' },
  { key: 'content-fidelity', verdict: 'pass' },
  { key: 'font-resolution', verdict: 'fail' },
  { key: 'output-text', verdict: 'fail' },
  { key: 'unsupported-input', verdict: 'fail' },
  { key: 'progress-and-cancellation', verdict: 'fail' },
  { key: 'main-thread', verdict: 'fail' },
  { key: 'performance', verdict: 'pass' },
  { key: 'memory-headroom', verdict: 'conditional' },
  { key: 'privacy', verdict: 'pass' },
]

/** The gates that failed. Every one of them is a reason this tool is not published. */
export const wordToPdfBlockingGates = wordToPdfGates
  .filter(gate => gate.verdict === 'fail')
  .map(gate => gate.key)

/** `go` needs every gate to pass or be conditional; a single failure blocks it. */
export const wordToPdfDecision: 'go' | 'no-go' = wordToPdfBlockingGates.length === 0 ? 'go' : 'no-go'

/**
 * The public surfaces this tool may not appear on while the decision is no-go.
 * Each key names something a test can look at, so the boundary is enforced
 * rather than remembered.
 */
export const wordToPdfForbiddenSurfaces = [
  'public-route',
  'navigation-entry',
  'tool-catalog-entry',
  'search-index-entry',
  'sitemap-entry',
  'structured-data',
  'seo-page',
  'offline-asset',
] as const

export type WordToPdfForbiddenSurface = typeof wordToPdfForbiddenSurfaces[number]

/**
 * What would have to change before this is worth measuring again. These are
 * conditions on the world, not tasks for this project: none of them is
 * something the team can do by trying harder.
 */
export const wordToPdfReassessmentConditions = [
  'redistributable-layout-engine',
  'text-bearing-output',
  'worker-safe-conversion',
  'progress-and-cancellation-api',
  'maintained-rasteriser',
] as const

export type WordToPdfReassessmentCondition = typeof wordToPdfReassessmentConditions[number]

/**
 * Claims that may never appear about this tool, in either locale. They are
 * forbidden because the measurements say they would be false, not because they
 * are strong: a converter that loses a document's pagination cannot be
 * described as keeping its layout.
 */
export const wordToPdfForbiddenWording = [
  '與 Word 相同',
  '完美轉檔',
  '版面完全保留',
  '支援所有 Word 功能',
  '可搜尋的 PDF',
  'identical to Word',
  'pixel-perfect',
  'preserves your layout',
  'supports every Word feature',
  'searchable PDF',
] as const

/**
 * Whether a Word to PDF surface may be published. It is a function rather than
 * a constant so a caller reads the gate, not a copy of last year's answer.
 */
export function wordToPdfPublicationAllowed() {
  return wordToPdfDecision === 'go'
}
