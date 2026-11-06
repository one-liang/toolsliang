import type { QrColors } from './colors'
import { isHexColor } from './colors'
import { qrQuietZone, type QrMatrix } from './encode'

/** The PNG a visitor downloads: large enough for LINE, slides and about 8.7 cm at 300 dpi. */
export const qrPngSize = 1024

export const qrDownloadNames = { png: 'qr-code.png', svg: 'qr-code.svg' } as const

/**
 * The dark squares as one path, in square units with the quiet zone included,
 * so the preview and the downloaded SVG draw exactly the same shape. Each run
 * of dark squares in a row is one rectangle.
 */
export function qrPathData(matrix: QrMatrix) {
  const parts: string[] = []
  matrix.modules.forEach((row, y) => {
    let x = 0
    while (x < matrix.size) {
      if (!row[x]) {
        x += 1
        continue
      }
      const start = x
      while (x < matrix.size && row[x]) x += 1
      parts.push(`M${start + qrQuietZone} ${y + qrQuietZone}h${x - start}v1h-${x - start}z`)
    }
  })
  return parts.join('')
}

/** Squares per side of the whole image, quiet zone included. */
export function qrViewBoxSize(matrix: QrMatrix) {
  return matrix.size + qrQuietZone * 2
}

/**
 * A complete SVG file. Its only inputs are squares and two checked colours, so
 * nothing the visitor typed can end up inside the file's markup.
 */
export function buildQrSvg(matrix: QrMatrix, colors: QrColors) {
  if (!isHexColor(colors.foreground) || !isHexColor(colors.background)) throw new Error('QR colours must be #rrggbb')
  const side = qrViewBoxSize(matrix)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${qrPngSize}" height="${qrPngSize}" shape-rendering="crispEdges">`,
    `<rect width="${side}" height="${side}" fill="${colors.background}"/>`,
    `<path fill="${colors.foreground}" d="${qrPathData(matrix)}"/>`,
    '</svg>',
  ].join('')
}

/**
 * Where the code sits in a square image of `imageSize` pixels. Every square is
 * a whole number of pixels, so edges stay sharp and all squares are the same
 * size; whatever does not divide evenly goes into the margin, split between the
 * two sides. The margin is never narrower than the four-square quiet zone.
 */
export function qrPixelLayout(matrix: QrMatrix, imageSize = qrPngSize) {
  const pixelsPerModule = Math.floor(imageSize / qrViewBoxSize(matrix))
  if (pixelsPerModule < 1) throw new Error(`${imageSize}px is too small for a ${matrix.size}-square code`)
  const offset = Math.floor((imageSize - pixelsPerModule * matrix.size) / 2)
  return { pixelsPerModule, offset }
}

/**
 * The code as RGBA pixels, ready to become a PNG. Kept free of any drawing
 * surface so a test can read back exactly the pixels a visitor downloads.
 */
export function rasterizeQr(matrix: QrMatrix, colors: QrColors, imageSize = qrPngSize) {
  const { pixelsPerModule, offset } = qrPixelLayout(matrix, imageSize)
  const background = hexToRgb(colors.background)
  const foreground = hexToRgb(colors.foreground)
  const pixels = new Uint8ClampedArray(imageSize * imageSize * 4)

  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = background[0]
    pixels[index + 1] = background[1]
    pixels[index + 2] = background[2]
    pixels[index + 3] = 255
  }

  matrix.modules.forEach((row, moduleY) => {
    row.forEach((dark, moduleX) => {
      if (!dark) return
      const left = offset + moduleX * pixelsPerModule
      const top = offset + moduleY * pixelsPerModule
      for (let y = top; y < top + pixelsPerModule; y += 1) {
        for (let x = left; x < left + pixelsPerModule; x += 1) {
          const index = (y * imageSize + x) * 4
          pixels[index] = foreground[0]
          pixels[index + 1] = foreground[1]
          pixels[index + 2] = foreground[2]
        }
      }
    })
  })

  return { width: imageSize, height: imageSize, pixels }
}

function hexToRgb(hex: string): [number, number, number] {
  if (!isHexColor(hex)) throw new Error(`Not a #rrggbb colour: ${hex}`)
  return [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16)) as [number, number, number]
}
