/**
 * What the workbench's layout step may write: the formats a canvas can encode,
 * and why a requested canvas cannot be produced.
 *
 * Channel presets used to narrow both (ADR-0012). They were removed by
 * ADR-0022, so the only bounds left are the device budget every image entry
 * point already enforces, and they are handed in rather than read off a rule.
 */

/** The formats a browser canvas can be asked to write. */
export const encodableFormats = ['jpeg', 'png', 'webp'] as const

export type EncodableFormat = typeof encodableFormats[number]

export type EncodableMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

export const formatMimeTypes: Record<EncodableFormat, EncodableMimeType> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** The canvas a layout may be written to, already intersected with what this device can decode. */
export interface OutputBounds {
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
  maxPixels: number
}

/** Why a requested canvas cannot be produced, in the order the checks run. */
export const outputSizeIssues = [
  'too-small',
  'too-large',
  'too-many-pixels',
] as const

export type OutputSizeIssue = typeof outputSizeIssues[number]

export function describeSizeIssue(
  bounds: OutputBounds,
  width: number,
  height: number,
): OutputSizeIssue | undefined {
  if (![width, height].every(value => Number.isInteger(value) && value >= 1)) return 'too-small'
  if (width < bounds.minWidth || height < bounds.minHeight) return 'too-small'
  if (width > bounds.maxWidth || height > bounds.maxHeight) return 'too-large'
  if (width * height > bounds.maxPixels) return 'too-many-pixels'
}
