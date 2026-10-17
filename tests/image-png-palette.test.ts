import { crc32, inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { choosePalette, writeIndexedPng, type PixelRows } from '@/features/images/png-palette'

/** A picture held in memory, read the way the worker reads its canvas. */
function picture(width: number, height: number, pixel: (x: number, y: number) => readonly [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4)
  const reads: Array<[number, number]> = []
  const read: PixelRows = (y, rows) => { reads.push([y, rows]); return data.slice(y * width * 4, (y + rows) * width * 4) }
  return { data, read, reads }
}

async function encode(width: number, height: number, read: PixelRows) {
  return new Uint8Array(await writeIndexedPng(width, height, read, choosePalette(width, height, read)))
}

/** Reads an indexed PNG back to straight RGBA, checking every chunk's CRC on the way. */
function decode(png: Uint8Array) {
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const chunks: Record<string, Uint8Array> = {}
  const order: string[] = []
  for (let at = 8; at < png.length;) {
    const length = view.getUint32(at), type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    const data = png.subarray(at + 8, at + 8 + length)
    expect(view.getUint32(at + 8 + length), `${type} CRC`).toBe(crc32(png.subarray(at + 4, at + 8 + length)))
    chunks[type] = data
    order.push(type)
    at += 12 + length
  }
  const header = new DataView(chunks.IHDR!.buffer, chunks.IHDR!.byteOffset, 13)
  const width = header.getUint32(0), height = header.getUint32(4), depth = chunks.IHDR![8]!, colourType = chunks.IHDR![9]!
  const plte = chunks.PLTE!, trns = chunks.tRNS ?? new Uint8Array()
  const raw = inflateSync(chunks.IDAT!)
  const stride = Math.ceil(width * depth / 8) + 1
  expect(raw.length).toBe(stride * height)
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    expect(raw[y * stride], '每列都不使用濾波').toBe(0)
    for (let x = 0; x < width; x++) {
      const bit = x * depth, byte = raw[y * stride + 1 + (bit >> 3)]!
      const index = (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1)
      rgba.set([plte[index * 3]!, plte[index * 3 + 1]!, plte[index * 3 + 2]!, index < trns.length ? trns[index]! : 255], (y * width + x) * 4)
    }
  }
  return { width, height, depth, colourType, order, entries: plte.length / 3, translucent: trns.length, rgba }
}

describe('PNG 減色', () => {
  it('256 色以內完整保留每個顏色與透明度，並用最小的位元深度', async () => {
    const colours = [[255, 0, 0, 255], [0, 128, 0, 128], [0, 0, 0, 0]] as const
    const { data, read } = picture(9, 5, (x, y) => colours[(x + y) % 3]!)
    const output = decode(await encode(9, 5, read))
    expect(output).toMatchObject({ width: 9, height: 5, depth: 2, colourType: 3, entries: 3, translucent: 2, order: ['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'] })
    expect([...output.rgba]).toEqual([...data])
  })

  it('全不透明時不寫 tRNS', async () => {
    const { read } = picture(4, 4, x => x % 2 ? [0, 0, 255, 255] : [255, 255, 255, 255])
    const output = decode(await encode(4, 4, read))
    expect(output).toMatchObject({ depth: 1, entries: 2, translucent: 0, order: ['IHDR', 'PLTE', 'IDAT', 'IEND'] })
  })

  it('超過 256 色時減到 256 色以內：實心處不變透明、透明處不帶顏色、柔邊與漸層接近原圖', async () => {
    const size = 96
    // A gradient body, a soft edge fading out to the right, and a transparent margin.
    const { data, read } = picture(size, size, (x, y) => {
      if (x >= 80) return [0, 0, 0, 0]
      const alpha = x < 64 ? 255 : Math.round(255 * (80 - x) / 16)
      return [x * 3, y * 2 + 40, 255 - x - y, alpha]
    })
    const output = decode(await encode(size, size, read))
    expect(output.entries).toBeLessThanOrEqual(256)
    expect(output.depth).toBe(8)
    let error = 0, counted = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 255) expect(output.rgba[i + 3], `第 ${i / 4} 個像素`).toBe(255)
      if (data[i + 3] === 0) expect([...output.rgba.subarray(i, i + 4)], `第 ${i / 4} 個像素`).toEqual([0, 0, 0, 0])
      else {
        const before = data[i + 3]! / 255, after = output.rgba[i + 3]! / 255
        for (let c = 0; c < 3; c++) { error += Math.abs(data[i + c]! * before - output.rgba[i + c]! * after); counted++ }
        error += Math.abs(data[i + 3]! - output.rgba[i + 3]!); counted++
      }
    }
    expect(error / counted).toBeLessThan(4)
  })

  it('一次只讀一段像素，挑顏色與寫檔各讀一遍', async () => {
    const width = 2048, height = 1200
    const { read, reads } = picture(width, height, (x, y) => [x & 255, y & 255, (x + y) & 255, 255])
    await encode(width, height, read)
    expect(reads).toEqual([[0, 512], [512, 512], [1024, 176], [0, 512], [512, 512], [1024, 176]])
    expect(Math.max(...reads.map(([, rows]) => rows * width * 4))).toBeLessThanOrEqual(4 * 1024 * 1024)
  })
})
