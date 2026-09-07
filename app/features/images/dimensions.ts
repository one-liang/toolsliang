import { imageSignature } from './input'

/** Read container dimensions before allocating decoded pixels. All reads are bounded by the file. */
export function imageDimensions(bytes: Uint8Array): { width: number, height: number } | undefined {
  const format = imageSignature(bytes)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (format === 'image/png') {
    if (bytes.length < 33 || view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) return
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (format === 'image/webp') {
    if (bytes.length < 25 || view.getUint32(4, true) + 8 !== bytes.length) return
    const chunk = String.fromCharCode(...bytes.subarray(12, 16))
    const chunkSize = view.getUint32(16, true)
    if (chunkSize + 20 > bytes.length) return
    if (chunk === 'VP8X' && chunkSize === 10 && bytes.length >= 30) {
      return { width: 1 + bytes[24]! + bytes[25]! * 256 + bytes[26]! * 65536, height: 1 + bytes[27]! + bytes[28]! * 256 + bytes[29]! * 65536 }
    }
    if (chunk === 'VP8 ' && chunkSize >= 10 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
    }
    if (chunk === 'VP8L' && chunkSize >= 5 && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    return
  }
  if (format === 'image/jpeg') {
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) return
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]
      if (marker === undefined || marker === 0xda || marker === 0xd9) return
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      if (offset + 2 > bytes.length) return
      const size = view.getUint16(offset)
      if (size < 2 || offset + size > bytes.length) return
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (size < 8) return
        return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) }
      }
      offset += size
    }
  }
}
