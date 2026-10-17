export type ImageFormat = 'image/png' | 'image/jpeg' | 'image/webp'
export interface CompressionInput {
  file: File
  format: ImageFormat
  /** 0–1. JPEG and WebP are encoded at it; below 1, PNG is reduced to at most 256 colours, and at 1 it keeps every colour. */
  quality: number
  maxWidth: number
  maxHeight: number
}
export interface CompressionWireOutput {
  bytes: ArrayBuffer
  preview: ArrayBuffer
  format: ImageFormat
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  /** The source's own coded pixels, without metadata: re-encoding at these settings would have been larger. */
  keptOriginal: boolean
}
export interface CompressionOutput extends Omit<CompressionWireOutput, 'bytes' | 'preview'> { blob: Blob, preview: Blob }
