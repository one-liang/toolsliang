/** Keep image coding/color segments; discard EXIF/XMP, Photoshop metadata, and comments. */
export function stripJpegMetadata(bytes: Uint8Array<ArrayBuffer>): ArrayBuffer {
  const parts: Uint8Array<ArrayBuffer>[] = [bytes.subarray(0, 2)]
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2
  while (offset + 4 <= bytes.length) {
    const start = offset
    if (bytes[offset++] !== 255) throw new Error('invalid_encoded_jpeg')
    while (bytes[offset] === 255) offset++
    const marker = bytes[offset++]
    if (marker === 0xda || marker === 0xd9) { parts.push(bytes.subarray(start)); break }
    if (offset + 2 > bytes.length) throw new Error('invalid_encoded_jpeg')
    const size = view.getUint16(offset)
    if (size < 2 || offset + size > bytes.length) throw new Error('invalid_encoded_jpeg')
    offset += size
    if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) parts.push(bytes.subarray(start, offset))
  }
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let written = 0
  for (const part of parts) { output.set(part, written); written += part.length }
  return output.buffer
}
