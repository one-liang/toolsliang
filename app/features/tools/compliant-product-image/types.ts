import type { EncodableMimeType } from './domain/render'

/**
 * What crosses the worker boundary: plain numbers the layout step already
 * settled, so the renderer only fits one image onto one canvas.
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
  /** The encoder quality the file was written at; absent for PNG. */
  quality?: number
}

export interface CompliantRenderOutput extends Omit<CompliantRenderWireOutput, 'bytes' | 'preview'> {
  blob: Blob
  preview: Blob
}
