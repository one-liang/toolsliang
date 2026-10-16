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
import type { CompressionInput, ImageFormat } from '../image-compressor/types'
import type { EncodableMimeType, OutputBounds } from '../compliant-product-image/domain/render'
import type { CompliantRenderInput } from '../compliant-product-image/types'
import type { PromoInput } from '../brand-promo-image/engine'
import type { PromoLayer, PromoLayerKind } from '../brand-promo-image/scene'

export interface WorkbenchLayoutSettings {
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
 * What the layout canvas may be: the device budget every image entry point
 * already enforces, and nothing more. No channel's numbers narrow it since
 * ADR-0022 removed the channel presets.
 */
export const workbenchCanvasBounds: OutputBounds = {
  minWidth: 1,
  maxWidth: imageInputLimits.maxSide,
  minHeight: 1,
  maxHeight: imageInputLimits.maxSide,
  maxPixels: imageInputLimits.maxPixels,
}

/**
 * The layout engine is the renderer in `compliant-product-image/`: it is the
 * module that fits one image onto one canvas, and the settings reach it as they
 * are, with no capacity range attached.
 */
export function planLayoutInput(request: {
  file: File
  settings: WorkbenchLayoutSettings
}): CompliantRenderInput {
  const { file, settings } = request

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

export interface WorkbenchCompressionSettings {
  format: ImageFormat
  /** Percent, exactly as the numeric field holds it. */
  quality: number
  maxWidth: number
  maxHeight: number
}

/**
 * Capacity control. The merchant sets the quality and the largest size, and it
 * is the independent compressor engine that applies them (ADR-0004), with the
 * same ceilings every other image entry point uses.
 */
export function planCompressionInput(request: { file: File, settings: WorkbenchCompressionSettings }): CompressionInput {
  const { file, settings } = request

  return {
    file,
    format: settings.format,
    quality: Math.min(100, Math.max(1, settings.quality)) / 100,
    maxWidth: Math.min(imageInputLimits.maxSide, Math.max(1, Math.round(settings.maxWidth))),
    maxHeight: Math.min(imageInputLimits.maxSide, Math.max(1, Math.round(settings.maxHeight))),
  }
}
