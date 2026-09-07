/** Shared by all image entry points; inspect at most 4 KiB before any decoder. */
export async function validateImageInput(file: File): Promise<'unsupported_heic' | 'unsupported_format' | undefined> {
  if (/\.hei[cf]$/i.test(file.name) || /^image\/hei[cf](?:-sequence)?$/i.test(file.type)) return 'unsupported_heic'
  const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer())
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
  if (tag(4) === 'ftyp') {
    const brands = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'])
    if (brands.has(tag(8))) return 'unsupported_heic'
    const size = Math.min(new DataView(bytes.buffer).getUint32(0) || bytes.length, bytes.length)
    for (let offset = 16; offset + 4 <= size; offset += 4) if (brands.has(tag(offset))) return 'unsupported_heic'
  }
  if (!imageSignature(bytes)) return 'unsupported_format'
}

export function imageSignature(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | undefined {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp'
}
