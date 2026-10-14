import type { ImageFormat } from './types'

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
