export interface BackgroundRemovalInput { file: File }

export interface BackgroundRemovalWireOutput {
  bytes: ArrayBuffer
  preview: ArrayBuffer
  /** The output keeps the source dimensions; only the alpha channel changes. */
  width: number
  height: number
  /** Share of the picture the model kept, so the page can warn about an empty or untouched result. */
  coverage: number
}

export interface BackgroundRemovalOutput extends Omit<BackgroundRemovalWireOutput, 'bytes' | 'preview'> {
  blob: Blob
  preview: Blob
}
