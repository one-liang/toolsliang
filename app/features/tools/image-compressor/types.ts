export type ImageFormat = 'image/png' | 'image/jpeg' | 'image/webp'
export interface CompressionInput { file: File, format: ImageFormat, quality: number, maxWidth: number, maxHeight: number }
export interface CompressionWireOutput {
  bytes: ArrayBuffer
  preview: ArrayBuffer
  format: ImageFormat
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
}
export interface CompressionOutput extends Omit<CompressionWireOutput, 'bytes' | 'preview'> { blob: Blob, preview: Blob }
