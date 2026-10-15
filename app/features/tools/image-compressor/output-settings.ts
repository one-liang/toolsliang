import type { ImageFormat } from './types'

/**
 * The quality JPEG and WebP are written at; the page does not ask for one.
 *
 * 0.8 is the long-standing web default for both encoders: photographs stay
 * free of visible artifacts at ordinary viewing sizes, while camera and editor
 * exports, typically saved at 0.9 or above, still shrink. A source already
 * saved leaner than this is handed back as it is rather than re-encoded larger.
 */
export const recommendedQuality = 0.8

/**
 * The output format a picked image starts on, before the user chooses one.
 *
 * A lossy source keeps its own format: turning a WebP into a JPEG at the same
 * quality typically doubles its bytes, the opposite of what compressing
 * promises. PNG has no lossy mode to compress with, so it starts on JPEG, as
 * every source did before; so does a WebP this browser cannot write.
 */
export function defaultOutputFormat(source: ImageFormat | undefined, available: readonly ImageFormat[]): ImageFormat {
  if ((source === 'image/jpeg' || source === 'image/webp') && available.includes(source)) return source
  return available.includes('image/jpeg') ? 'image/jpeg' : available[0] ?? 'image/jpeg'
}
