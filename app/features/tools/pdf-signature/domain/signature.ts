/**
 * The three forms a signature can take, and the arithmetic that turns any of
 * them into one transparent image.
 *
 * T24 fixed the contract: drawn, typed and imported signatures all become a PNG
 * with an alpha channel before anything is embedded, so the document never gains
 * a font and never gains an opaque box over its own content (§6.5 of
 * `docs/research/009-pdf-local-editing-engine-and-safety-boundary.md`). What
 * lives here is only the part that can be decided without a canvas: what counts
 * as a signature, how much of the pad it occupies, and how many pixels it is
 * worth rasterising.
 */
import { pdfSignatureImage } from './reference'
import { validateImageInput } from '@/features/images/input'

export const signatureFormKeys = ['drawn', 'typed', 'image'] as const

export type SignatureForm = typeof signatureFormKeys[number]

/** The pad is a signature line, not a drawing board: three times as wide as tall. */
export const signaturePadAspect = 3

/** A handwriting gesture, as shares of the pad, so the pad can be any size on screen. */
export interface SignatureStroke {
  points: Array<{ x: number, y: number }>
}

export interface SignatureBox {
  x: number
  y: number
  width: number
  height: number
}

/** Below this the two points are the same press, not a movement. */
const MIN_STROKE_SPAN = 0.002
/** Typed signatures are names, not paragraphs. */
const MAX_TYPED_LENGTH = 60

/** A press with no movement leaves a dot the visitor did not mean as a signature. */
export function signatureIsEmpty(strokes: readonly SignatureStroke[]): boolean {
  return !strokes.some(stroke => stroke.points.some((point, index) => {
    const first = stroke.points[0]!
    return index > 0 && (Math.abs(point.x - first.x) > MIN_STROKE_SPAN || Math.abs(point.y - first.y) > MIN_STROKE_SPAN)
  }))
}

/**
 * The part of the pad the handwriting actually uses, with a margin so the
 * stroke's own width is not clipped. Cropping here is what keeps the signature
 * from arriving on the page as a mostly empty rectangle.
 */
export function strokeContentBox(strokes: readonly SignatureStroke[], padding: number): SignatureBox | undefined {
  const points = strokes.flatMap(stroke => stroke.points)
  if (!points.length) return undefined

  const left = Math.max(0, Math.min(...points.map(point => point.x)) - padding)
  const top = Math.max(0, Math.min(...points.map(point => point.y)) - padding)
  const right = Math.min(1, Math.max(...points.map(point => point.x)) + padding)
  const bottom = Math.min(1, Math.max(...points.map(point => point.y)) + padding)

  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * How many pixels the signature is rasterised at. The record asks for twice the
 * placed size in points; the placed size is not known while the signature is
 * being made, so the widest placement the page allows is used instead and the
 * single-edge cap still wins.
 */
export function signatureRasterSize({ aspect, maxPlacedWidthPt }: { aspect: number, maxPlacedWidthPt: number }) {
  const { renderScale, maxEdgePixels } = pdfSignatureImage
  const requested = maxPlacedWidthPt * renderScale
  const width = Math.min(requested, aspect >= 1 ? maxEdgePixels : maxEdgePixels * aspect)

  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(width / aspect)) }
}

export function typedSignatureText(value: string): string {
  return value.trim().slice(0, MAX_TYPED_LENGTH)
}

/**
 * The largest font size whose measured text still fits the box. The measurement
 * is injected because only a canvas can do it, which keeps the search itself
 * testable.
 */
export function fitTypedSignatureSize({
  box,
  measure,
  maxSize,
}: {
  box: { width: number, height: number }
  measure: (size: number) => { width: number, height: number }
  maxSize: number
}): number {
  let size = maxSize
  for (let step = 0; step < 24 && size > 1; step += 1) {
    const measured = measure(size)
    if (measured.width <= box.width && measured.height <= box.height) break
    size = Math.floor(size * 0.9)
  }

  return Math.max(1, Math.min(size, box.height))
}

/**
 * Only formats that can carry an alpha channel are accepted. A JPEG would place
 * an opaque rectangle over the page, which looks like a mistake the tool made,
 * so it is refused by name rather than silently flattened.
 */
export async function validateSignatureImageFile(file: File): Promise<'unsupported_heic' | 'unsupported_format' | 'signature_needs_alpha' | undefined> {
  const code = await validateImageInput(file)
  if (code) return code
  if (/^image\/jpeg$/i.test(file.type) || /\.jpe?g$/i.test(file.name)) return 'signature_needs_alpha'

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  const webp = String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
  if (!png && !webp) return 'signature_needs_alpha'
}

/** Whether anything in the image is see-through at all. */
export function signatureHasTransparency(data: Uint8ClampedArray): boolean {
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset]! < 250) return true
  }

  return false
}

/** The smallest rectangle holding every pixel that is not fully transparent. */
export function opaqueBounds(data: Uint8ClampedArray, width: number, height: number): SignatureBox | undefined {
  let left = width
  let top = height
  let right = -1
  let bottom = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3]! === 0) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }

  if (right < 0) return undefined

  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}
