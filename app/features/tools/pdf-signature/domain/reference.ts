/**
 * What T24 decided about editing a PDF on the user's own device.
 *
 * The evaluation record `docs/research/009-pdf-local-editing-engine-and-safety-boundary.md`
 * is the source; this module is the part T25 and T26 can import. It carries the
 * selection and its provenance, the safety caps, the placement arithmetic that
 * was proved by reading signed documents back, the failure vocabulary and the
 * wording the tool has to show — never a PDF, and never anything derived from
 * a user's document.
 */
import type { EngineError } from '../../engine/contract'

/** Names the reviewed candidate set by the day the measurements were taken. */
export const pdfSignatureReferenceVersion = 'pdf-signature-2026-09-10'

/**
 * Licences this project may redistribute from its own bundle. A candidate is
 * only selectable when the package, its manifest and everything it ships agree
 * on one of these; a single unexplained binary is enough to exclude it.
 */
export const pdfSignaturePermittedLicences = ['MIT', 'Apache-2.0', 'BSD-3-Clause'] as const

/** What a library can do for a signature tool. Nothing measured does all four. */
export const pdfEngineRoles = ['parse', 'preview', 'password', 'write'] as const

export type PdfEngineRole = typeof pdfEngineRoles[number]

export interface PdfEngineCandidate {
  id: string
  package: string
  /** The published version every measurement ran on. */
  version: string
  publishedAt: string
  roles: readonly PdfEngineRole[]
  /** The identifier the package declares, on its own. */
  licence: string
  /**
   * Whether the manifest, the licence file and the files the package actually
   * ships say the same thing. Only a verified candidate may be bundled, which
   * ADR-0001 requires of every dependency that touches tool content.
   */
  licenceVerified: boolean
  /** The page whose wording the licence column transcribes. */
  licenceUrl: string
  repository: string
}

export const pdfEngineCandidates: readonly PdfEngineCandidate[] = [
  {
    id: 'pdfjs-dist',
    package: 'pdfjs-dist',
    version: '6.3.289',
    publishedAt: '2026-08-29',
    roles: ['parse', 'preview', 'password'],
    licence: 'Apache-2.0',
    licenceVerified: true,
    licenceUrl: 'https://github.com/mozilla/pdf.js/blob/master/LICENSE',
    repository: 'https://github.com/mozilla/pdf.js',
  },
  {
    id: 'hyzyla-pdfium',
    package: '@hyzyla/pdfium',
    version: '2.1.13',
    publishedAt: '2026-05-12',
    roles: ['parse', 'preview', 'password'],
    /*
     * The manifest and the package's own licence file both say MIT, and that
     * file is the MIT boilerplate shipped with git, under someone else's
     * copyright. The five-megabyte WebAssembly binary beside it is a PDFium
     * build, which is BSD-3-Clause with Foxit and Google notices the package
     * does not carry. The declared licence does not cover what is redistributed.
     */
    licence: 'MIT',
    licenceVerified: false,
    licenceUrl: 'https://github.com/hyzyla/pdfium/blob/main/LICENSE.md',
    repository: 'https://github.com/hyzyla/pdfium',
  },
  {
    id: 'pdf-lib',
    package: 'pdf-lib',
    version: '1.17.1',
    publishedAt: '2021-11-06',
    roles: ['parse', 'write'],
    licence: 'MIT',
    licenceVerified: true,
    licenceUrl: 'https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md',
    repository: 'https://github.com/Hopding/pdf-lib',
  },
  {
    id: 'cantoo-pdf-lib',
    package: '@cantoo/pdf-lib',
    version: '2.9.2',
    publishedAt: '2026-09-07',
    roles: ['parse', 'password', 'write'],
    licence: 'MIT',
    licenceVerified: true,
    licenceUrl: 'https://github.com/cantoo-scribe/pdf-lib/blob/master/LICENSE.md',
    repository: 'https://github.com/cantoo-scribe/pdf-lib',
  },
]

/** Only these may be bundled with the tool. */
export const redistributableEngines = pdfEngineCandidates.filter(
  candidate => candidate.licenceVerified
    && (pdfSignaturePermittedLicences as readonly string[]).includes(candidate.licence),
)

/** Why a library was ruled out before any browser opened a document with it. */
export const pdfEngineExclusionReasons = [
  'copyleft-licence',
  'proprietary-licence',
  'creation-only',
  'no-browser-build',
  'unmaintained',
] as const

export type PdfEngineExclusionReason = typeof pdfEngineExclusionReasons[number]

export interface PdfEngineExclusion {
  id: string
  package: string
  reason: PdfEngineExclusionReason
  /** The page whose own wording the exclusion rests on. */
  sourceUrl: string
}

export const pdfEngineExclusions: readonly PdfEngineExclusion[] = [
  { id: 'mupdf', package: 'mupdf', reason: 'copyleft-licence', sourceUrl: 'https://www.npmjs.com/package/mupdf/v/1.28.1' },
  { id: 'jspdf', package: 'jspdf', reason: 'creation-only', sourceUrl: 'https://www.npmjs.com/package/jspdf/v/4.2.1' },
  { id: 'muhammara', package: 'muhammara', reason: 'no-browser-build', sourceUrl: 'https://www.npmjs.com/package/muhammara/v/6.0.6' },
  { id: 'nutrient-viewer', package: '@nutrient-sdk/viewer', reason: 'proprietary-licence', sourceUrl: 'https://www.npmjs.com/package/@nutrient-sdk/viewer/v/1.21.0' },
  { id: 'pdftron-webviewer', package: '@pdftron/webviewer', reason: 'proprietary-licence', sourceUrl: 'https://www.npmjs.com/package/@pdftron/webviewer/v/12.1.0' },
  { id: 'pdf-annotate-js', package: 'pdf-annotate.js', reason: 'unmaintained', sourceUrl: 'https://www.npmjs.com/package/pdf-annotate.js/v/1.0.0' },
]

/** The document structures the matrix covered, named as the fixtures name them. */
export const pdfSignatureStructures = [
  'classic-xref',
  'xref-stream',
  'page-rotation',
  'offset-boxes',
  'standard-security-r3',
  'standard-security-r4',
  'damaged-startxref',
  'damaged-truncated',
] as const

export type PdfDocumentStructure = typeof pdfSignatureStructures[number]

/** The stages §12.12 of the specification fixes, in the order they run. */
export const pdfSignatureStages = ['read', 'parse', 'preview', 'apply', 'write'] as const

export type PdfSignatureStage = typeof pdfSignatureStages[number]

/** Every state the tool has to be able to explain and recover from. */
export const pdfSignatureFailureCodes = [
  'unsupported_browser',
  'not_a_pdf',
  'damaged_pdf',
  'password_required',
  'password_rejected',
  'unsupported_encryption',
  'too_many_pages',
  'too_large',
  'insufficient_memory',
  'export_failed',
  'export_unreadable',
  'cancelled',
] as const

export type PdfSignatureFailureCode = typeof pdfSignatureFailureCodes[number]

const suggestedActions: Record<PdfSignatureFailureCode, EngineError['suggestedAction']> = {
  unsupported_browser: 'use-supported-browser',
  not_a_pdf: 'change-input',
  damaged_pdf: 'change-input',
  password_required: 'enter-password',
  password_rejected: 'enter-password',
  unsupported_encryption: 'change-input',
  too_many_pages: 'change-input',
  too_large: 'change-input',
  insufficient_memory: 'change-input',
  export_failed: 'retry',
  export_unreadable: 'change-input',
  cancelled: 'retry',
}

/**
 * A browser that cannot run the engines at all is the one state the user
 * cannot act their way out of; everything else leaves a way forward.
 */
export function pdfSignatureError(code: PdfSignatureFailureCode): EngineError {
  return { code, recoverable: code !== 'unsupported_browser', suggestedAction: suggestedActions[code] }
}

/** The caps §12.12 sets, restated in machine units. A device may lower them; nothing raises them. */
export const pdfSignatureLimits = {
  maxPages: 100,
  maxBytes: 50 * 1024 * 1024,
  /** The zoom a page preview is rasterised at, and the zoom the matrix measured. */
  previewScale: 1.5,
} as const

/** The desktop budgets §12.12 sets for the 20-page reference document. */
export const pdfSignatureBudgets = {
  firstPagePreviewMs: 3000,
  exportMs: 15000,
} as const

export interface PdfSignatureSelection {
  /** Renders pages and detects encryption; it never writes. */
  previewEngineId: string
  /** Opens, places and exports; it never rasterises. */
  writeEngineId: string
  /** The measured variant the selection is stated in terms of. */
  exportVariant: 'default' | 'incremental'
  /**
   * The export appends the change to the bytes that were opened instead of
   * rewriting the file, so pages nobody signed keep the producer's own bytes.
   */
  exportMode: 'incremental-update'
  /**
   * The writer accepts documents it cannot faithfully reproduce, so an export
   * is read back with the preview engine before it is offered as a download.
   */
  verifyExportBeforeDownload: boolean
  /** Password support is its own capability, declared before a file is opened. */
  passwordSupport: 'declared-capability'
}

export const pdfSignatureSelection: PdfSignatureSelection = {
  previewEngineId: 'pdfjs-dist',
  writeEngineId: 'cantoo-pdf-lib',
  exportVariant: 'incremental',
  exportMode: 'incremental-update',
  verifyExportBeforeDownload: true,
  passwordSupport: 'declared-capability',
}

export type PdfSignatureGateVerdict = 'pass' | 'fail' | 'conditional'

/** The go/no-go criteria, in the order §8 of the record tabulates them. */
export const pdfSignatureGateKeys = [
  'licence',
  'supply-chain',
  'maintenance',
  'browser-support',
  'structure-coverage',
  'password-handling',
  'damaged-input',
  'output-fidelity',
  'performance',
  'memory-headroom',
  'privacy',
] as const

export type PdfSignatureGateKey = typeof pdfSignatureGateKeys[number]

export interface PdfSignatureDecision {
  /** `go` needs every gate to pass or be conditional; a single failure blocks it. */
  status: 'go' | 'conditional-go' | 'no-go'
  /** Exactly the gates that failed. Empty only when the status is `go`. */
  blockingGates: readonly PdfSignatureGateKey[]
  gateVerdicts: Record<PdfSignatureGateKey, PdfSignatureGateVerdict>
}

/**
 * Two libraries, each doing the half it is good at, clear every gate. What is
 * conditional is not the selection but the conduct around it: a damaged
 * document has to be caught by reading the export back, and only Chromium
 * reports how much memory the work took.
 */
export const pdfSignatureDecision: PdfSignatureDecision = {
  status: 'go',
  blockingGates: [],
  gateVerdicts: {
    'licence': 'pass',
    'supply-chain': 'pass',
    'maintenance': 'pass',
    'browser-support': 'pass',
    'structure-coverage': 'pass',
    'password-handling': 'pass',
    'damaged-input': 'conditional',
    'output-fidelity': 'pass',
    'performance': 'pass',
    'memory-headroom': 'conditional',
    'privacy': 'pass',
  },
}

/** A page's visible box and its own `/Rotate`, the two things a placement needs. */
export interface PdfPageGeometry {
  /** The crop box when the page has one, otherwise the media box: `[x0, y0, x1, y1]`. */
  box: readonly [number, number, number, number]
  rotation: number
}

/** A rectangle in the page's display space, each side as a share of that edge. */
export interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PdfDisplayBox {
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
}

export interface PdfSignaturePlacement extends PdfDisplayBox {
  /** Where the rectangle sits in display space, top-left origin, in points. */
  left: number
  top: number
  /** Where the image's own bottom-left corner goes in PDF user space. */
  anchor: { x: number, y: number }
  display: { width: number, height: number }
}

function quarterTurn(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((Math.trunc(rotation) % 360) + 360) % 360
  if (normalized !== 0 && normalized !== 90 && normalized !== 180 && normalized !== 270) {
    throw new Error(`unsupported_rotation:${rotation}`)
  }
  return normalized
}

/**
 * The box a viewer shows: the visible box, turned by the page's own `/Rotate`.
 * Every placement is expressed in this space because it is the only space the
 * user can point at — and a quarter-turned page swaps its edges.
 */
export function pdfDisplayBox(page: PdfPageGeometry): PdfDisplayBox {
  const rotation = quarterTurn(page.rotation)
  const width = page.box[2] - page.box[0]
  const height = page.box[3] - page.box[1]

  return rotation === 90 || rotation === 270
    ? { width: height, height: width, rotation }
    : { width, height, rotation }
}

/** A point in display space, top-left origin, to the same point in PDF user space. */
export function pdfDisplayPointToUserSpace(page: PdfPageGeometry, point: { x: number, y: number }) {
  const [x0, y0, x1, y1] = page.box
  const rotation = quarterTurn(page.rotation)

  if (rotation === 90) return { x: x0 + point.y, y: y0 + point.x }
  if (rotation === 180) return { x: x1 - point.x, y: y0 + point.y }
  if (rotation === 270) return { x: x1 - point.y, y: y1 - point.x }
  return { x: x0 + point.x, y: y1 - point.y }
}

/** The way back, for turning a stored placement into something to draw on screen. */
export function pdfUserSpaceToDisplayPoint(page: PdfPageGeometry, point: { x: number, y: number }) {
  const [x0, y0, x1, y1] = page.box
  const rotation = quarterTurn(page.rotation)

  if (rotation === 90) return { x: point.y - y0, y: point.x - x0 }
  if (rotation === 180) return { x: x1 - point.x, y: point.y - y0 }
  if (rotation === 270) return { x: y1 - point.y, y: x1 - point.x }
  return { x: point.x - x0, y: y1 - point.y }
}

/**
 * Keeps a rectangle inside the page. The size is what the user chose, so it is
 * kept and the position moves; a rectangle larger than the page is the only
 * case where the size has to give.
 */
export function clampNormalizedRect(rect: NormalizedRect): NormalizedRect {
  const width = Math.min(Math.max(rect.width, 0), 1)
  const height = Math.min(Math.max(rect.height, 0), 1)

  return {
    width,
    height,
    x: Math.min(Math.max(rect.x, 0), 1 - width),
    y: Math.min(Math.max(rect.y, 0), 1 - height),
  }
}

/**
 * Turns a rectangle the user placed on a page preview into the numbers a
 * writer needs: the size in points, the user-space point the image's own
 * bottom-left corner goes to, and the turn that keeps it upright on a rotated
 * page. §6 of the record is the evidence that these are the right numbers —
 * signed documents were read back in three browsers and the ink landed inside
 * the rectangle, with nothing changed outside it.
 */
export function pdfSignaturePlacement(page: PdfPageGeometry, rect: NormalizedRect): PdfSignaturePlacement {
  const display = pdfDisplayBox(page)
  const clamped = clampNormalizedRect(rect)
  const width = clamped.width * display.width
  const height = clamped.height * display.height
  const left = clamped.x * display.width
  const top = clamped.y * display.height

  return {
    ...display,
    left,
    top,
    width,
    height,
    anchor: pdfDisplayPointToUserSpace(page, { x: left, y: top + height }),
    display: { width: display.width, height: display.height },
  }
}

export interface LocalizedSentence {
  'zh-tw': string
  en: string
}

/**
 * The wording the tool has to show, fixed in both locales. §10 of the record is
 * the source; T25 may place it, never rewrite it.
 */
export const pdfSignatureDisclosures: Record<string, LocalizedSentence> = {
  'not-a-digital-signature': {
    'zh-tw': '這個工具把你的手寫簽名放到 PDF 頁面上，它不是憑證式數位簽章，也不保證任何法律效力。',
    'en': 'This tool places your handwriting onto a PDF page. It is not a certificate-based digital signature, and it guarantees no legal effect.',
  },
  'no-identity-verification': {
    'zh-tw': '工具不會驗證簽署人身分，也不會留下任何可供第三方查核的紀錄。',
    'en': 'The tool does not check who signed, and it leaves no record a third party could audit.',
  },
  'local-processing': {
    'zh-tw': 'PDF、頁面預覽、簽名筆跡與輸出檔都只在你的裝置上處理，不會送到伺服器或第三方。',
    'en': 'The PDF, its page previews, your signature strokes and the exported file are handled only on your device, never sent to a server or a third party.',
  },
  'saved-signature-is-local': {
    'zh-tw': '只有在你主動保存時，簽名才會留在這台裝置上；它屬於工具內容，不會跟著帳號同步。',
    'en': 'A signature stays on this device only when you choose to save it; it is tool content and never syncs with an account.',
  },
  'password-stays-on-device': {
    'zh-tw': '開啟密碼保護的 PDF 時，密碼只在這台裝置上用來解開檔案，不會被傳送或保存。',
    'en': 'To open a password-protected PDF, the password is used on this device only to unlock the file; it is never sent or stored.',
  },
  'original-pages-untouched': {
    'zh-tw': '輸出會保留原本的頁面尺寸、旋轉與你沒有簽名的頁面內容，簽名只加在你放置的位置上。',
    'en': 'The export keeps the original page size, rotation and every page you did not sign; the signature is added only where you placed it.',
  },
  'damaged-file-refused': {
    'zh-tw': '檔案結構損壞時，工具會直接說明無法處理，不會輸出一份打不開的 PDF。',
    'en': 'When a file\'s structure is damaged, the tool says so instead of exporting a PDF that nothing can open.',
  },
}
