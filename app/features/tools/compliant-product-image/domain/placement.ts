/**
 * Pure geometry: where one source image lands on one output canvas.
 *
 * It is separated from `render.ts` because the worker needs exactly this and
 * nothing else. Importing the preset interpretation would drag every channel's
 * rules into the worker bundle, and the renderer has no business reading them.
 */

export interface PlacementRequest {
  sourceWidth: number
  sourceHeight: number
  targetWidth: number
  targetHeight: number
  fit: 'cover' | 'contain'
  /** Percentage of the fitted size; 100 leaves the fit untouched. */
  zoom: number
  /** Percentage of the canvas width and height to shift by, from the centre. */
  offsetX: number
  offsetY: number
}

export interface Placement {
  x: number
  y: number
  width: number
  height: number
  /** Share of the canvas the source image actually covers, after cropping. */
  coverage: number
}

/**
 * Where the source image lands on the output canvas. Every input is a number a
 * keyboard can type, and the result is the same rectangle the worker draws and
 * the preview overlays, so what a merchant sees is what is encoded.
 */
export function planPlacement(request: PlacementRequest): Placement {
  const { sourceWidth, sourceHeight, targetWidth, targetHeight, fit, zoom, offsetX, offsetY } = request
  const scales = [targetWidth / sourceWidth, targetHeight / sourceHeight]
  const base = fit === 'cover' ? Math.max(...scales) : Math.min(...scales)
  const scale = base * (zoom / 100)
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const x = Math.round((targetWidth - width) / 2 + (offsetX / 100) * targetWidth)
  const y = Math.round((targetHeight - height) / 2 + (offsetY / 100) * targetHeight)
  const visibleWidth = Math.max(0, Math.min(x + width, targetWidth) - Math.max(x, 0))
  const visibleHeight = Math.max(0, Math.min(y + height, targetHeight) - Math.max(y, 0))

  return { x, y, width, height, coverage: (visibleWidth * visibleHeight) / (targetWidth * targetHeight) }
}
