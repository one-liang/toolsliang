/**
 * How one step's result becomes the next step's input.
 *
 * The workbench composes the engines the independent tools already ship
 * (ADR-0004) and adds no rendering of its own, so everything here is the plain
 * translation between them: what the layout engine is handed, and what scene
 * the promotional renderer composes on top of the layout result. Keeping it
 * pure means the wiring is testable without a worker, a canvas or a file.
 */
import { imageInputLimits } from '@/features/images/limits'
import { resolveOutputBounds, type EncodableMimeType, type OutputBounds } from '../compliant-product-image/domain/render'
import type { CompliantImagePreset } from '../compliant-product-image/domain/reference'
import type { CompliantRenderInput } from '../compliant-product-image/types'
import type { PromoInput } from '../brand-promo-image/engine'
import type { PromoLayer, PromoLayerKind } from '../brand-promo-image/scene'
import type { WorkbenchPurpose } from './session'

export interface WorkbenchLayoutSettings {
  presetId: string
  width: number
  height: number
  format: EncodableMimeType
  fit: 'cover' | 'contain'
  /** Percentage of the fitted size; 100 leaves the fit untouched. */
  zoom: number
  offsetX: number
  offsetY: number
  background: string
}

/**
 * What a promotional canvas may be. No channel published it, so it is only the
 * device budget every image entry point already enforces — stated here rather
 * than inherited from a preset, because borrowing a channel's numbers for
 * promotional artwork is exactly the confusion ADR-0012 rules out.
 */
export const promotionalCanvasBounds: OutputBounds = {
  minWidth: 1,
  maxWidth: imageInputLimits.maxSide,
  minHeight: 1,
  maxHeight: imageInputLimits.maxSide,
  maxPixels: imageInputLimits.maxPixels,
}

export function resolveLayoutBounds(
  purpose: WorkbenchPurpose,
  preset: CompliantImagePreset,
  today: string,
): OutputBounds {
  return purpose === 'compliant' ? resolveOutputBounds(preset, today) : { ...promotionalCanvasBounds }
}

/**
 * The layout engine is the compliant renderer, whichever branch is running: it
 * is the module that fits one image onto one canvas. Only the compliant branch
 * hands it a channel's capacity range, so a promotional output is never quietly
 * squeezed to a rule that does not apply to it.
 */
export function planLayoutInput(request: {
  file: File
  purpose: WorkbenchPurpose
  settings: WorkbenchLayoutSettings
  byteRange: { min?: number, max?: number }
}): CompliantRenderInput {
  const { file, purpose, settings, byteRange } = request

  return {
    file,
    width: settings.width,
    height: settings.height,
    format: settings.format,
    fit: settings.fit,
    zoom: settings.zoom,
    offsetX: settings.offsetX,
    offsetY: settings.offsetY,
    background: settings.background,
    minBytes: purpose === 'compliant' ? byteRange.min : undefined,
    maxBytes: purpose === 'compliant' ? byteRange.max : undefined,
  }
}

export interface WorkbenchBrandRequest {
  canvas: { width: number, height: number }
  /** The layout step's own output, already the size of the canvas. */
  product: File
  frame?: File
  logo?: File
  /** Percentages, exactly as the numeric fields hold them. */
  logoScale: number
  logoX: number
  logoY: number
  logoOpacity: number
}

function layer(kind: PromoLayerKind, patch: Partial<PromoLayer> = {}): PromoLayer {
  return {
    id: kind,
    kind,
    assetId: kind,
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    visible: true,
    fit: kind === 'frame' ? 'cover' : 'contain',
    ...patch,
  }
}

/**
 * The promotional composition, back to front: the layout result, then the
 * frame that surrounds it, then the Logo the merchant placed. The layout result
 * is already the canvas, so it is never moved or rescaled here — a second
 * placement would silently undo the sizing the previous step just produced.
 */
export function planBrandScene(request: WorkbenchBrandRequest): PromoInput {
  const layers: PromoLayer[] = [layer('product')]
  const files: Record<string, File> = { product: request.product }

  if (request.frame) {
    layers.push(layer('frame'))
    files.frame = request.frame
  }
  if (request.logo) {
    layers.push(layer('logo', {
      x: request.logoX / 100,
      y: request.logoY / 100,
      scale: request.logoScale / 100,
      opacity: request.logoOpacity / 100,
    }))
    files.logo = request.logo
  }

  return { scene: { width: request.canvas.width, height: request.canvas.height, layers }, files }
}

const outputExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * The downloaded file is named after what it is, never after what was imported:
 * a source file name is tool content and has no reason to travel with a result
 * the merchant may share.
 */
export function workbenchOutputName(purpose: WorkbenchPurpose, format: string) {
  const stem = purpose === 'compliant' ? 'compliant-product-image' : 'brand-promo-image'

  return `${stem}.${outputExtensions[format] ?? 'png'}`
}
