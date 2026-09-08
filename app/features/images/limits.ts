/**
 * One set of ceilings for every image entry point. §12.14 requires each of them
 * to refuse the same files, and a visitor moving between two image tools has no
 * way to understand a limit that changes underneath them.
 */
export const imageInputLimits = {
  maxBytes: 25 * 1024 * 1024,
  maxPixels: 24_000_000,
  maxSide: 8192,
} as const

/** True when a picture cannot be decoded within the local budget. */
export function exceedsImageLimits(width: number, height: number): boolean {
  const { maxPixels, maxSide } = imageInputLimits
  return !width || !height || width > maxSide || height > maxSide || width * height > maxPixels
}
