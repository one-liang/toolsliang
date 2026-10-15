import { imageSignature } from './input'
import { stripJpegMetadata } from './jpeg-metadata'

/**
 * The source file as it can stand in for a re-encode of itself: the same coded
 * pixels, without the EXIF/GPS, XMP, text, and comment metadata a re-encode drops.
 *
 * Re-encoding an image that was already saved leaner than the chosen settings
 * only adds bytes, so a tool that keeps format and dimensions can hand this back
 * instead. It is undefined whenever these bytes would not show what the
 * re-encode shows: an EXIF orientation the decoder applied (removing it would
 * turn the picture), an animation the re-encode flattens to its first frame, or
 * a container this reader cannot walk to the end.
 */
export function originalAsOutput(bytes: Uint8Array<ArrayBuffer>): ArrayBuffer | undefined {
  try {
    const format = imageSignature(bytes)
    if (format === 'image/jpeg') return jpeg(bytes)
    if (format === 'image/png') return png(bytes)
    if (format === 'image/webp') return webp(bytes)
  }
  catch { /* A container that cannot be read to the end is never reused; the re-encode stands. */ }
}

const fourcc = (bytes: Uint8Array, offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
const hasExifHeader = (data: Uint8Array) => fourcc(data, 0) === 'Exif' && data[4] === 0 && data[5] === 0

/** False when EXIF names an orientation other than 1, or when it cannot be read well enough to tell. */
function exifUpright(data: Uint8Array): boolean {
  const tiff = hasExifHeader(data) ? data.subarray(6) : data
  const order = String.fromCharCode(tiff[0] ?? 0, tiff[1] ?? 0)
  if (order !== 'II' && order !== 'MM') return false
  const little = order === 'II'
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
  const directory = view.getUint32(4, little)
  const entries = view.getUint16(directory, little)
  for (let entry = directory + 2; entry < directory + 2 + entries * 12; entry += 12) {
    if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little) === 1
  }
  return true
}

function jpeg(bytes: Uint8Array<ArrayBuffer>) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) return
    while (bytes[offset] === 255) offset++
    const marker = bytes[offset++]
    if (marker === 0xda || marker === 0xd9) return stripJpegMetadata(bytes)
    const size = view.getUint16(offset)
    if (size < 2 || offset + size > bytes.length) return
    const payload = bytes.subarray(offset + 2, offset + size)
    if (marker === 0xe1 && hasExifHeader(payload) && !exifUpright(payload)) return
    offset += size
  }
}

/** Ancillary chunks that describe the file rather than its pixels or colour. */
const pngMetadata = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'])

function png(bytes: Uint8Array<ArrayBuffer>) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts = [bytes.subarray(0, 8)]
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const end = offset + 12 + length
    if (end > bytes.length) return
    const type = fourcc(bytes, offset + 4)
    if (type === 'acTL' || (type === 'eXIf' && !exifUpright(bytes.subarray(offset + 8, offset + 8 + length)))) return
    if (!pngMetadata.has(type)) parts.push(bytes.subarray(offset, end))
    if (type === 'IEND') return concat(parts)
    offset = end
  }
}

function webp(bytes: Uint8Array<ArrayBuffer>) {
  // Only the extended layout (VP8X) can carry EXIF or XMP; a simple file is already bare.
  if (fourcc(bytes, 12) !== 'VP8X') return bytes.slice().buffer
  const flags = bytes[20]!
  if (flags & 0x02) return
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts = [bytes.subarray(0, 12)]
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const type = fourcc(bytes, offset)
    const size = view.getUint32(offset + 4, true)
    if (offset + 8 + size > bytes.length) return
    if (type === 'EXIF' && !exifUpright(bytes.subarray(offset + 8, offset + 8 + size))) return
    const end = Math.min(bytes.length, offset + 8 + size + (size % 2))
    if (type !== 'EXIF' && type !== 'XMP ') parts.push(bytes.subarray(offset, end))
    offset = end
  }
  const output = new Uint8Array(concat(parts))
  new DataView(output.buffer).setUint32(4, output.length - 8, true)
  output[20] = flags & ~0x0c
  return output.buffer
}

function concat(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let written = 0
  for (const part of parts) { output.set(part, written); written += part.length }
  return output.buffer
}
