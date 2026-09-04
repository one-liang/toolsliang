/**
 * Renders the toolsliang install icons from the Design System tokens.
 *
 * The icons are committed under `public/icons/`; this script is the record of
 * how they were produced, so a token change can be replayed instead of
 * redrawn. Run it with `node scripts/generate-app-icons.mjs`.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

// Design System tokens: --neutral-900, --neutral-50, --orange-400.
const BACKGROUND = [0x2d, 0x28, 0x25]
const MARK = [0xfc, 0xfa, 0xf8]
const ACCENT = [0xff, 0x8c, 0x42]

const SAMPLES = 4

/** Signed coverage helper: a rounded square centred on the canvas. */
function insideRoundedSquare(x, y, half, radius) {
  const dx = Math.abs(x) - (half - radius)
  const dy = Math.abs(y) - (half - radius)
  if (dx <= 0 || dy <= 0) return Math.abs(x) <= half && Math.abs(y) <= half
  return Math.hypot(dx, dy) <= radius
}

function insideDiamond(x, y, half) {
  return Math.abs(x) + Math.abs(y) <= half
}

/**
 * `safeArea` shrinks the mark for a maskable icon, whose outer 10% on each side
 * can be cropped away by the platform.
 */
function renderIcon(size, { maskable }) {
  const pixels = Buffer.alloc(size * size * 4)
  const centre = size / 2
  // A maskable icon is full bleed: the platform, not the asset, decides the silhouette.
  const canvasRadius = maskable ? 0 : size * 0.235
  const markHalf = size * (maskable ? 0.28 : 0.335)
  const stroke = size * (maskable ? 0.055 : 0.066)
  const markRadius = markHalf * 0.31
  const diamondHalf = size * (maskable ? 0.105 : 0.125)

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      let backgroundHits = 0
      let markHits = 0
      let accentHits = 0

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const x = column + (sx + 0.5) / SAMPLES - centre
          const y = row + (sy + 0.5) / SAMPLES - centre

          if (!insideRoundedSquare(x, y, centre, canvasRadius)) continue
          backgroundHits += 1

          if (insideDiamond(x, y, diamondHalf)) accentHits += 1
          else if (
            insideRoundedSquare(x, y, markHalf, markRadius)
            && !insideRoundedSquare(x, y, markHalf - stroke, Math.max(markRadius - stroke, 0))
          ) markHits += 1
        }
      }

      const total = SAMPLES * SAMPLES
      const offset = (row * size + column) * 4
      const alpha = Math.round((backgroundHits / total) * 255)
      const markShare = markHits / total
      const accentShare = accentHits / total
      const baseShare = Math.max(backgroundHits / total - markShare - accentShare, 0)
      const weight = markShare + accentShare + baseShare || 1

      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(
          (BACKGROUND[channel] * baseShare + MARK[channel] * markShare + ACCENT[channel] * accentShare) / weight,
        )
      }
      pixels[offset + 3] = alpha
    }
  }

  return pixels
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // truecolour with alpha
  header[10] = 0
  header[11] = 0
  header[12] = 0

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let row = 0; row < size; row += 1) {
    raw[row * (stride + 1)] = 0 // no per-scanline filter
    pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUTPUT_DIR, { recursive: true })

for (const icon of [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
]) {
  const target = join(OUTPUT_DIR, icon.file)
  writeFileSync(target, encodePng(icon.size, renderIcon(icon.size, { maskable: icon.maskable })))
  console.log(`wrote ${target}`)
}
