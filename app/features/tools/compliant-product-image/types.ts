import type { EncodableMimeType } from './domain/render'

/**
 * What crosses the worker boundary. The preset itself never does: the page
 * resolves a preset into plain numbers first, so the renderer has no opinion
 * about channels and cannot quietly reinterpret a rule while drawing.
 */
export interface CompliantRenderInput {
  file: File
  width: number
  height: number
  format: EncodableMimeType
  fit: 'cover' | 'contain'
  /** Percentage of the fitted size; 100 leaves the fit untouched. */
  zoom: number
  offsetX: number
  offsetY: number
  /** `#rrggbb` painted behind the image, so a crop never leaves a hole. */
  background: string
  /** The capacity the channel requires, when it published one. */
  minBytes?: number
  maxBytes?: number
}

export interface CompliantRenderWireOutput {
  bytes: ArrayBuffer
  preview: ArrayBuffer
  format: EncodableMimeType
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  /** Share of the canvas the source image covers, so the page can report it. */
  coverage: number
  /** The encoder quality that landed inside the capacity range; absent for PNG. */
  quality?: number
}

export interface CompliantRenderOutput extends Omit<CompliantRenderWireOutput, 'bytes' | 'preview'> {
  blob: Blob
  preview: Blob
}
