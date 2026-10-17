/**
 * Lossy PNG for a browser that can only write PNG losslessly: the picture is
 * reduced to at most 256 colours and written as an indexed PNG (colour type 3,
 * per-entry alpha in tRNS), which is how PNGs are usually made smaller without
 * changing format.
 *
 * Colours are chosen by median cut over a histogram of the picture, refined by
 * a few rounds of k-means, and the picture is mapped to them with
 * Floyd–Steinberg dithering. Fully opaque pixels only take opaque colours and
 * fully transparent pixels one transparent entry, so solid areas never turn
 * see-through and transparent areas never pick up colour. A picture that
 * already has 256 colours or fewer keeps every one of them exactly.
 *
 * Pixels are read a strip at a time, so beyond the canvas they come from this
 * needs the compressed bytes and fixed tables of at most `paletteWorkingBytes`.
 */

/** Rows [y, y + rows) of the picture as straight (not premultiplied) RGBA. */
export type PixelRows = (y: number, rows: number) => Uint8ClampedArray | Uint8Array

export interface Palette {
  /** Straight RGBA, four bytes per entry. Entries that are not fully opaque come first. */
  colors: Uint8Array
  /** How many leading entries are not fully opaque: the length of tRNS. */
  translucent: number
  /** Every colour of the picture is in the palette, so the PNG loses nothing. */
  exact: boolean
}

/**
 * Working memory besides the canvas and the compressed bytes: while choosing,
 * the histogram (18 MiB) and its occupied bins (at most 26 MiB); while writing,
 * the colour caches (4.5 MiB); and one strip of pixels, indices and scanlines.
 */
export const paletteWorkingBytes = 64 * 1024 * 1024

const stripBytes = 4 * 1024 * 1024
const stripRows = (width: number) => Math.max(1, Math.floor(stripBytes / (width * 4)))

/**
 * How much a difference in each premultiplied channel counts: the eye notices
 * green most and blue least, and alpha decides how much of the colour shows.
 */
const [wr, wg, wb, wa] = [0.5, 1, 0.45, 0.625]

/**
 * Histogram bins. Opaque pixels: 6 bits per channel. Translucent pixels: alpha
 * in 64 steps and premultiplied colour in 4 bits per channel, since the fainter
 * a pixel the less its colour shows. Opaque bins come after translucent ones.
 */
const firstOpaqueBin = 1 << 18
const binOf = (r: number, g: number, b: number, a: number) => a === 255
  ? firstOpaqueBin | ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2)
  : ((a >> 2) << 12) | (((r * a / 255) >> 4) << 8) | (((g * a / 255) >> 4) << 4) | ((b * a / 255) >> 4)
const binCount = firstOpaqueBin * 2
const refinements = 3

/** Picks at most `maxColors` colours for the picture, reading it once. */
export function choosePalette(width: number, height: number, read: PixelRows, maxColors = 256): Palette {
  const counts = new Uint32Array(binCount)
  /** Premultiplied channel sums per bin, so a bin's colour is the mean of what its pixels show. */
  const sums = new Float64Array(binCount * 4)
  let distinct: Set<number> | undefined = new Set()
  let transparent = false
  let previous = -1
  const step = stripRows(width)
  for (let y = 0; y < height; y += step) {
    const data = read(y, Math.min(step, height - y))
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, a = data[i + 3]!
      if (a === 0) { transparent = true; continue }
      if (distinct) {
        const key = r * 16777216 + ((g << 16) | (b << 8) | a)
        if (key !== previous) {
          previous = key
          distinct.add(key)
          if (distinct.size > maxColors) distinct = undefined
        }
      }
      const bin = binOf(r, g, b, a), at = bin * 4
      counts[bin]!++
      if (a === 255) { sums[at]! += r; sums[at + 1]! += g; sums[at + 2]! += b; sums[at + 3]! += 255 }
      else { const f = a / 255; sums[at]! += r * f; sums[at + 1]! += g * f; sums[at + 2]! += b * f; sums[at + 3]! += a }
    }
  }
  if (distinct && distinct.size + (transparent ? 1 : 0) <= maxColors) {
    const colors = [...distinct].map(key => [Math.floor(key / 16777216), (key >> 16) & 255, (key >> 8) & 255, key & 255] as const)
    if (transparent) colors.push([0, 0, 0, 0])
    return arrange(colors, true)
  }
  return arrange(medianCut(counts, sums, maxColors - (transparent ? 1 : 0)), false, transparent)
}

/** Box means after median cut and k-means, as straight RGBA. */
function medianCut(counts: Uint32Array, sums: Float64Array, entries: number) {
  // Occupied bins, opaque ones first; each stands for its pixels' premultiplied mean.
  const occupied: number[] = []
  for (let bin = firstOpaqueBin; bin < binCount; bin++) if (counts[bin]) occupied.push(bin)
  const opaqueCount = occupied.length
  for (let bin = 0; bin < firstOpaqueBin; bin++) if (counts[bin]) occupied.push(bin)
  const total = occupied.length
  const weight = new Float64Array(total), color = new Float64Array(total * 4)
  occupied.forEach((bin, j) => {
    const n = counts[bin]!
    weight[j] = n
    for (let c = 0; c < 4; c++) color[j * 4 + c] = sums[bin * 4 + c]! / n
  })
  const order = Int32Array.from({ length: total }, (_, j) => j)
  const channel = [wr, wg, wb, wa]

  /** Weighted squared error of a box around its mean, and the channel it spreads along most. */
  function measure(start: number, end: number) {
    let w = 0
    const s = [0, 0, 0, 0], q = [0, 0, 0, 0]
    for (let k = start; k < end; k++) {
      const j = order[k]!, n = weight[j]!
      w += n
      for (let c = 0; c < 4; c++) { const v = color[j * 4 + c]!; s[c]! += n * v; q[c]! += n * v * v }
    }
    let error = 0, axis = 0, widest = -1
    for (let c = 0; c < 4; c++) {
      const spread = channel[c]! * (q[c]! - s[c]! * s[c]! / w)
      error += spread
      if (spread > widest) { widest = spread; axis = c }
    }
    return { error: end - start > 1 ? error : -1, axis, s, q, w }
  }

  // Opaque and translucent bins start in boxes of their own and are never mixed.
  const boxes: Array<{ start: number, end: number, opaque: boolean } & ReturnType<typeof measure>> = []
  if (opaqueCount) boxes.push({ start: 0, end: opaqueCount, opaque: true, ...measure(0, opaqueCount) })
  if (total > opaqueCount) boxes.push({ start: opaqueCount, end: total, opaque: false, ...measure(opaqueCount, total) })
  while (boxes.length < entries) {
    let pick = -1
    for (let k = 0; k < boxes.length; k++) if (boxes[k]!.error > 0 && (pick < 0 || boxes[k]!.error > boxes[pick]!.error)) pick = k
    if (pick < 0) break
    const box = boxes[pick]!
    const axis = box.axis
    order.subarray(box.start, box.end).sort((x, y) => color[x * 4 + axis]! - color[y * 4 + axis]!)
    // Split where the two halves' errors add up to the least.
    const s = [0, 0, 0, 0], q = [0, 0, 0, 0]
    let w = 0, split = box.start + 1, best = Infinity
    for (let k = box.start; k < box.end - 1; k++) {
      const j = order[k]!, n = weight[j]!
      w += n
      for (let c = 0; c < 4; c++) { const v = color[j * 4 + c]!; s[c]! += n * v; q[c]! += n * v * v }
      let error = 0
      for (let c = 0; c < 4; c++) {
        const rs = box.s[c]! - s[c]!, rq = box.q[c]! - q[c]!
        error += channel[c]! * (q[c]! - s[c]! * s[c]! / w + rq - rs * rs / (box.w - w))
      }
      if (error < best) { best = error; split = k + 1 }
    }
    boxes.splice(pick, 1, { start: box.start, end: split, opaque: box.opaque, ...measure(box.start, split) }, { start: split, end: box.end, opaque: box.opaque, ...measure(split, box.end) })
  }

  // K-means: move each colour to the mean of the bins nearest to it, bins only choosing within their own kind.
  const means = Float64Array.from(boxes.flatMap(box => box.s.map(v => v / box.w)))
  const kinds = [true, false].map(opaque => boxes.flatMap((box, e) => box.opaque === opaque ? [e] : []))
  for (let round = 0; round < refinements; round++) {
    const [opaque, translucent] = kinds.map(kind => nearestOf(means, kind))
    const next = new Float64Array(boxes.length * 5)
    for (let j = 0; j < total; j++) {
      const at = j * 4, n = weight[j]!
      const e = (j < opaqueCount ? opaque : translucent)!(color[at]!, color[at + 1]!, color[at + 2]!, color[at + 3]!)
      next[e * 5 + 4]! += n
      for (let c = 0; c < 4; c++) next[e * 5 + c]! += n * color[at + c]!
    }
    for (let e = 0; e < boxes.length; e++) {
      const n = next[e * 5 + 4]!
      if (n) for (let c = 0; c < 4; c++) means[e * 4 + c] = next[e * 5 + c]! / n
    }
  }
  return boxes.map((box, e) => {
    const [r, g, b, a] = means.subarray(e * 4, e * 4 + 4)
    if (box.opaque) return [byte(r!), byte(g!), byte(b!), 255] as const
    const alpha = Math.min(254, Math.max(1, Math.round(a!)))
    return [byte(r! * 255 / alpha), byte(g! * 255 / alpha), byte(b! * 255 / alpha), alpha] as const
  })
}

/**
 * The nearest of `candidates` (entries of `values`, premultiplied RGBA) to a
 * colour. Entries are searched outward along green, the channel weighted most,
 * and the search stops once green alone puts every remaining entry farther away.
 */
function nearestOf(values: Float64Array, candidates: number[]) {
  const sorted = Int32Array.from(candidates).sort((x, y) => values[x * 4 + 1]! - values[y * 4 + 1]!)
  const greens = Float64Array.from(sorted, e => values[e * 4 + 1]!)
  return (r: number, g: number, b: number, a: number) => {
    let up = 0, down = sorted.length
    while (up < down) { const mid = (up + down) >> 1; if (greens[mid]! < g) up = mid + 1; else down = mid }
    down = up - 1
    let found = sorted[0] ?? 0, closest = Infinity
    while (up < sorted.length || down >= 0) {
      const k = up < sorted.length && (down < 0 || greens[up]! - g <= g - greens[down]!) ? up++ : down--
      const dg = greens[k]! - g
      if (wg * dg * dg >= closest) break
      const e = sorted[k]!
      const d = distance(r - values[e * 4]!, dg, b - values[e * 4 + 2]!, a - values[e * 4 + 3]!)
      if (d < closest) { closest = d; found = e }
    }
    return found
  }
}

const byte = (value: number) => Math.min(255, Math.max(0, Math.round(value)))
const distance = (dr: number, dg: number, db: number, da: number) => wr * dr * dr + wg * dg * dg + wb * db * db + wa * da * da

/** Translucent entries first, by alpha, so tRNS stops at the last of them; one fully transparent entry leads. */
function arrange(entries: ReadonlyArray<readonly [number, number, number, number]>, exact: boolean, transparent = false): Palette {
  const sorted = [...(transparent ? [[0, 0, 0, 0] as const] : []), ...entries].sort((x, y) => x[3] - y[3])
  return { colors: Uint8Array.from(sorted.flat()), translucent: sorted.filter(entry => entry[3] < 255).length, exact }
}

/**
 * Maps strips of the picture, top to bottom, to palette indices with
 * Floyd–Steinberg dithering. Opaque pixels take opaque entries and pass their
 * error only to opaque neighbours; translucent pixels take translucent entries
 * (the transparent one included) and pass error only among themselves. So
 * dithering never makes a solid area see-through, never speckles a transparent
 * one, and still smooths soft shadows and edges.
 */
function paletteMapper(width: number, palette: Palette) {
  const size = palette.colors.length / 4
  const p = Float64Array.from({ length: size * 4 }, (_, k) => {
    const alpha = palette.colors[(k & ~3) + 3]!
    return (k & 3) === 3 ? alpha : palette.colors[k]! * alpha / 255
  })
  const opaque: number[] = [], translucent: number[] = []
  for (let e = 0; e < size; e++) (palette.colors[e * 4 + 3] === 255 ? opaque : translucent).push(e)
  const transparentEntry = translucent.find(e => palette.colors[e * 4 + 3] === 0) ?? 0
  const exact = palette.exact ? new Map<number, number>() : undefined
  if (exact) for (let e = 0; e < size; e++) { const c = palette.colors.subarray(e * 4, e * 4 + 4); exact.set(c[0]! * 16777216 + ((c[1]! << 16) | (c[2]! << 8) | c[3]!), e) }

  const nearestSolid = nearestOf(p, opaque), nearestFaint = nearestOf(p, translucent)
  // Nearest entries by colour cell, filled on first use: 6 bits per channel for opaque pixels;
  // premultiplied 5 bits per colour and 6 for alpha for translucent ones.
  const opaqueCells = new Int16Array(1 << 18).fill(-1)
  const translucentCells = new Int16Array(1 << 21).fill(-1)
  function nearestOpaque(r: number, g: number, b: number) {
    const cell = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2)
    let entry = opaqueCells[cell]!
    if (entry < 0) entry = opaqueCells[cell] = nearestSolid((r & ~3) + 1.5, (g & ~3) + 1.5, (b & ~3) + 1.5, 255)
    return entry
  }
  function nearestTranslucent(r: number, g: number, b: number, a: number) {
    const cell = ((a >> 2) << 15) | ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    let entry = translucentCells[cell]!
    if (entry < 0) {
      const alpha = (a & ~3) + 1.5
      entry = translucentCells[cell] = nearestFaint(Math.min(alpha, (r & ~7) + 3.5), Math.min(alpha, (g & ~7) + 3.5), Math.min(alpha, (b & ~7) + 3.5), alpha)
    }
    return entry
  }

  // Error carried to this row and the next, premultiplied RGBA, one pixel of padding on each side.
  // Opaque and translucent pixels keep separate error so neither leaks into the other.
  const fresh = () => ({ opaque: new Float32Array((width + 2) * 4), translucent: new Float32Array((width + 2) * 4) })
  let here = fresh(), below = fresh()
  let row = 0

  return (data: Uint8ClampedArray | Uint8Array, rows: number) => {
    const indices = new Uint8Array(width * rows)
    for (let y = 0; y < rows; y++, row++) {
      const forward = (row & 1) === 0, dir = forward ? 1 : -1
      for (let step = 0; step < width; step++) {
        const x = forward ? step : width - 1 - step
        const i = (y * width + x) * 4, a = data[i + 3]!
        let entry: number
        if (a === 0) entry = transparentEntry
        else if (exact) entry = exact.get(data[i]! * 16777216 + ((data[i + 1]! << 16) | (data[i + 2]! << 8) | a)) ?? 0
        else {
          const solid = a === 255, error = solid ? here.opaque : here.translucent, next = solid ? below.opaque : below.translucent
          const e = (x + 1) * 4, f = a / 255
          const alpha = solid ? 255 : Math.min(254, byte(a + error[e + 3]!))
          const r = Math.min(alpha, byte(data[i]! * f + error[e]!)), g = Math.min(alpha, byte(data[i + 1]! * f + error[e + 1]!)), b = Math.min(alpha, byte(data[i + 2]! * f + error[e + 2]!))
          entry = solid ? nearestOpaque(r, g, b) : nearestTranslucent(r, g, b, alpha)
          const ahead = e + dir * 4, behind = e - dir * 4
          spread(error, next, e, ahead, behind, 0, r - p[entry * 4]!)
          spread(error, next, e, ahead, behind, 1, g - p[entry * 4 + 1]!)
          spread(error, next, e, ahead, behind, 2, b - p[entry * 4 + 2]!)
          spread(error, next, e, ahead, behind, 3, alpha - p[entry * 4 + 3]!)
        }
        indices[y * width + x] = entry
      }
      ;[here, below] = [below, here]
      below.opaque.fill(0)
      below.translucent.fill(0)
    }
    return indices
  }
}

/** Floyd–Steinberg weights: 7/16 ahead on this row; 3/16 behind, 5/16 below and 1/16 ahead on the next. */
function spread(here: Float32Array, next: Float32Array, at: number, ahead: number, behind: number, channel: number, error: number) {
  here[ahead + channel]! += error * 7 / 16
  next[behind + channel]! += error * 3 / 16
  next[at + channel]! += error * 5 / 16
  next[ahead + channel]! += error / 16
}

/** Writes the picture as an indexed PNG, reading it once more, a strip at a time. */
export async function writeIndexedPng(width: number, height: number, read: PixelRows, palette: Palette): Promise<ArrayBuffer> {
  const size = palette.colors.length / 4
  const depth = size <= 2 ? 1 : size <= 4 ? 2 : size <= 16 ? 4 : 8
  const stride = Math.ceil(width * depth / 8) + 1
  const map = paletteMapper(width, palette)
  const deflate = new CompressionStream('deflate')
  const reader = deflate.readable.getReader()
  const chunks: Uint8Array[] = []
  const drained = (async () => { for (let next = await reader.read(); !next.done; next = await reader.read()) chunks.push(next.value) })()
  drained.catch(() => {})
  const writer = deflate.writable.getWriter()
  const step = stripRows(width)
  for (let y = 0; y < height; y += step) {
    const rows = Math.min(step, height - y)
    const indices = map(read(y, rows), rows)
    // Every scanline uses filter 0: dithered palette indices do not predict from their neighbours.
    const lines = new Uint8Array(stride * rows)
    for (let line = 0; line < rows; line++) {
      const out = line * stride + 1, from = line * width
      if (depth === 8) lines.set(indices.subarray(from, from + width), out)
      else for (let x = 0; x < width; x++) lines[out + ((x * depth) >> 3)]! |= indices[from + x]! << (8 - depth - ((x * depth) & 7))
    }
    await writer.write(lines)
  }
  await writer.close()
  await drained

  const header = new Uint8Array(13), view = new DataView(header.buffer)
  view.setUint32(0, width); view.setUint32(4, height)
  header.set([depth, 3, 0, 0, 0], 8)
  const alpha = palette.colors.filter((_, k) => (k & 3) === 3).subarray(0, palette.translucent)
  const rgb = palette.colors.filter((_, k) => (k & 3) !== 3)
  return png([['IHDR', [header]], ['PLTE', [rgb]], ...(alpha.length ? [['tRNS', [alpha]] as const] : []), ['IDAT', chunks], ['IEND', []]])
}

function png(chunks: ReadonlyArray<readonly [string, readonly Uint8Array[]]>) {
  const length = 8 + chunks.reduce((sum, [, parts]) => sum + 12 + parts.reduce((total, part) => total + part.length, 0), 0)
  const output = new Uint8Array(length), view = new DataView(output.buffer)
  output.set([137, 80, 78, 71, 13, 10, 26, 10])
  let at = 8
  for (const [type, parts] of chunks) {
    const start = at
    view.setUint32(at, parts.reduce((total, part) => total + part.length, 0))
    for (let k = 0; k < 4; k++) output[at + 4 + k] = type.charCodeAt(k)
    at += 8
    for (const part of parts) { output.set(part, at); at += part.length }
    view.setUint32(at, crc32(output.subarray(start + 4, at)))
    at += 4
  }
  return output.buffer
}

let crcTable: Uint32Array | undefined
function crc32(bytes: Uint8Array) {
  crcTable ??= Uint32Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  let crc = 0xFFFFFFFF
  for (let k = 0; k < bytes.length; k++) crc = crcTable[(crc ^ bytes[k]!) & 255]! ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}
