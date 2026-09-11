/**
 * Where the signatures sit, before anything is written.
 *
 * The whole placement state is this module: a list of rectangles, each one a
 * share of the page it belongs to, plus the undo history. Nothing here touches
 * a PDF, a canvas or a worker — which is what lets the keyboard, the numeric
 * fields and the pointer all drive the same arithmetic, and lets the tests
 * check placement without opening a document.
 *
 * `reference.ts` owns the geometry itself: T24 proved those functions by
 * reading signed documents back, so this module only ever composes them.
 */
import {
  clampNormalizedRect,
  pdfDisplayBox,
  pdfSignaturePlacement,
  type NormalizedRect,
  type PdfPageGeometry,
  type PdfSignaturePlacement,
} from './reference'
import type { LocaleCode } from '../../catalog'

/** One page of the open document, as the tool holds it. */
export interface PdfWorkspacePage extends PdfPageGeometry {
  /** Zero-based, so it indexes the array; the interface adds one when it speaks. */
  index: number
}

/** The rasterised signature a placement shows, in its own pixels. */
export interface SignatureSource {
  id: string
  width: number
  height: number
}

export interface PlacedSignature {
  id: string
  page: number
  signatureId: string
  rect: NormalizedRect
  /** The signature's own width ÷ height, so a resize never distorts handwriting. */
  aspect: number
}

export interface PdfWorkspaceState {
  pages: PdfWorkspacePage[]
  placements: PlacedSignature[]
  selectedId: string | null
  /** Past placement lists, oldest first. Selection is not a change worth undoing. */
  history: PlacedSignature[][]
}

/** What a placement asks the writer for: a page, a rectangle and which signature. */
export interface SignatureExportRequest {
  page: number
  rect: NormalizedRect
  signatureId: string
}

/** Arrow keys move by the fine step; holding Shift moves by the coarse one. */
export const nudgeStepPt = { fine: 1, coarse: 10 } as const

/** A signature narrower than this is no longer something a reader can see. */
const MIN_WIDTH_PT = 24
/** A first placement takes this share of the page width, then keeps its own shape. */
const DEFAULT_WIDTH_RATIO = 0.3
/** And sits this far above the bottom edge, where a signature line usually is. */
const DEFAULT_BOTTOM_MARGIN_RATIO = 0.12

export function createPdfWorkspace(pages: PdfWorkspacePage[]): PdfWorkspaceState {
  return { pages, placements: [], selectedId: null, history: [] }
}

function pageOf(state: PdfWorkspaceState, index: number): PdfWorkspacePage {
  const page = state.pages.find(candidate => candidate.index === index)
  if (!page) throw new Error(`unknown_page:${index}`)

  return page
}

/** A rectangle with the signature's own shape, sized in points of the display box. */
function rectForWidth(page: PdfWorkspacePage, aspect: number, widthPt: number, leftPt: number, topPt: number): NormalizedRect {
  const display = pdfDisplayBox(page)
  const width = Math.min(Math.max(widthPt, MIN_WIDTH_PT), display.width)
  const height = Math.min(width / aspect, display.height)

  return clampNormalizedRect({
    x: leftPt / display.width,
    y: topPt / display.height,
    width: width / display.width,
    height: height / display.height,
  })
}

/** Every change goes through here, so the history can never miss one. */
function withPlacements(
  state: PdfWorkspaceState,
  placements: PlacedSignature[],
  selectedId: string | null,
): PdfWorkspaceState {
  return { ...state, placements, selectedId, history: [...state.history, state.placements] }
}

function replace(state: PdfWorkspaceState, id: string, change: (placement: PlacedSignature, page: PdfWorkspacePage) => PlacedSignature): PdfWorkspaceState {
  const current = state.placements.find(placement => placement.id === id)
  if (!current) return state

  const next = change(current, pageOf(state, current.page))
  return withPlacements(state, state.placements.map(placement => placement.id === id ? next : placement), id)
}

export function placeSignature(
  state: PdfWorkspaceState,
  { id, page: index, signature }: { id: string, page: number, signature: SignatureSource },
): PdfWorkspaceState {
  const page = pageOf(state, index)
  const display = pdfDisplayBox(page)
  const aspect = signature.width / signature.height
  const widthPt = display.width * DEFAULT_WIDTH_RATIO
  const heightPt = Math.min(widthPt / aspect, display.height)
  const rect = rectForWidth(
    page,
    aspect,
    widthPt,
    (display.width - widthPt) / 2,
    display.height * (1 - DEFAULT_BOTTOM_MARGIN_RATIO) - heightPt,
  )

  return withPlacements(state, [...state.placements, { id, page: index, signatureId: signature.id, rect, aspect }], id)
}

/** Moves by points of the display box; a rectangle pushed past an edge stops at it. */
export function movePlacement(state: PdfWorkspaceState, id: string, delta: { x: number, y: number }): PdfWorkspaceState {
  return replace(state, id, (placement, page) => {
    const display = pdfDisplayBox(page)
    return {
      ...placement,
      rect: clampNormalizedRect({
        ...placement.rect,
        x: placement.rect.x + delta.x / display.width,
        y: placement.rect.y + delta.y / display.height,
      }),
    }
  })
}

/** Scales the width and lets the signature's own shape decide the height. */
export function resizePlacement(state: PdfWorkspaceState, id: string, factor: number): PdfWorkspaceState {
  return replace(state, id, (placement, page) => {
    const display = pdfDisplayBox(page)
    return {
      ...placement,
      rect: rectForWidth(
        page,
        placement.aspect,
        placement.rect.width * display.width * factor,
        placement.rect.x * display.width,
        placement.rect.y * display.height,
      ),
    }
  })
}

/** The numeric fields: the position and width a visitor typed, in points. */
export function setPlacementRect(
  state: PdfWorkspaceState,
  id: string,
  { leftPt, topPt, widthPt }: { leftPt: number, topPt: number, widthPt: number },
): PdfWorkspaceState {
  return replace(state, id, (placement, page) => ({
    ...placement,
    rect: rectForWidth(page, placement.aspect, widthPt, leftPt, topPt),
  }))
}

export function removePlacement(state: PdfWorkspaceState, id: string): PdfWorkspaceState {
  const placements = state.placements.filter(placement => placement.id !== id)
  if (placements.length === state.placements.length) return state

  return withPlacements(state, placements, placements.at(-1)?.id ?? null)
}

export function selectPlacement(state: PdfWorkspaceState, id: string | null): PdfWorkspaceState {
  return { ...state, selectedId: id }
}

/** One step back. An empty history is already the beginning, not an error. */
export function undoPlacement(state: PdfWorkspaceState): PdfWorkspaceState {
  const previous = state.history.at(-1)
  if (!previous) return state

  const selectedId = previous.some(placement => placement.id === state.selectedId)
    ? state.selectedId
    : previous.at(-1)?.id ?? null

  return { ...state, placements: previous, selectedId, history: state.history.slice(0, -1) }
}

export function canUndoPlacement(state: PdfWorkspaceState): boolean {
  return state.history.length > 0
}

export function placementsOnPage(state: PdfWorkspaceState, index: number): PlacedSignature[] {
  return state.placements.filter(placement => placement.page === index)
}

/** The numbers a writer or a preview needs, or nothing when that placement is gone. */
export function placementGeometry(state: PdfWorkspaceState, id: string): PdfSignaturePlacement | undefined {
  const placement = state.placements.find(candidate => candidate.id === id)
  if (!placement) return undefined

  return pdfSignaturePlacement(pageOf(state, placement.page), placement.rect)
}

/**
 * What the writer is asked to do, with nothing else in it: a page index, a
 * rectangle as shares of that page, and which signature to draw.
 */
export function signatureExportRequests(state: PdfWorkspaceState): SignatureExportRequest[] {
  return state.placements.map(({ page, rect, signatureId }) => ({ page, rect, signatureId }))
}

function points(value: number, locale: LocaleCode): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en' : 'zh-TW', { maximumFractionDigits: 1 }).format(value)
}

/**
 * The placement as a sentence. A rectangle on a canvas is the one thing a
 * screen reader cannot read, so every position the pointer can reach is also
 * available as numbers and as this summary.
 */
export function placementSummary(state: PdfWorkspaceState, id: string, locale: LocaleCode): string {
  const geometry = placementGeometry(state, id)
  const placement = state.placements.find(candidate => candidate.id === id)
  if (!geometry || !placement) return ''

  const page = placement.page + 1
  const left = points(geometry.left, locale)
  const top = points(geometry.top, locale)
  const width = points(geometry.width, locale)
  const height = points(geometry.height, locale)

  return locale === 'en'
    ? `Page ${page}, ${left} pt from the left, ${top} pt from the top, ${width} pt wide and ${height} pt tall`
    : `第 ${page} 頁，距左 ${left} pt、距上 ${top} pt，寬 ${width} pt、高 ${height} pt`
}
