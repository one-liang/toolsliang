/**
 * Readers find the squares by how much darker they are than the background.
 * Two rules keep a printed batch from being unreadable: the code must be the
 * darker of the two, because many readers miss a light code on a dark ground,
 * and the pair must differ by at least the contrast the site already asks of
 * its own text. The threshold is a starting value; the scan check before
 * release can move it (docs/research/012-qr-code-scan-verification.md).
 */
export const qrMinimumContrast = 4.5

export const qrDefaultColors = { foreground: '#000000', background: '#ffffff' } as const

export interface QrColors {
  foreground: string
  background: string
}

export type QrColorProblem = 'inverted' | 'low-contrast'

export type QrColorCheck =
  | { state: 'ok', contrast: number }
  | { state: 'blocked', problem: QrColorProblem, contrast: number }

/** `#rrggbb` only: what a colour field hands back, and what a file can be trusted to hold. */
export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value)
}

export function checkQrColors(colors: QrColors): QrColorCheck {
  const foreground = relativeLuminance(colors.foreground)
  const background = relativeLuminance(colors.background)
  const contrast = contrastRatio(foreground, background)

  if (foreground > background) return { state: 'blocked', problem: 'inverted', contrast }
  if (contrast < qrMinimumContrast) return { state: 'blocked', problem: 'low-contrast', contrast }
  return { state: 'ok', contrast }
}

/** Relative luminance as WCAG defines it, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string) {
  if (!isHexColor(hex)) throw new Error(`Not a #rrggbb colour: ${hex}`)
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function contrastRatio(first: number, second: number) {
  const [lighter, darker] = first >= second ? [first, second] : [second, first]
  return (lighter + 0.05) / (darker + 0.05)
}
