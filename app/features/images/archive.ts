/**
 * How a finished batch becomes one file, here on the device.
 *
 * §12.11 asks for a batch archive and says the archive is assembled locally.
 * There is no server step to fall back on, so the container is written here:
 * a stored — never deflated — ZIP, because every entry is already a compressed
 * picture and re-compressing one costs seconds to save nothing.
 *
 * The writer only packs what it is handed. What each entry is called is the
 * caller's decision, and the timestamp is a constant rather than the device
 * clock, which is one more thing about the person that a file they share has
 * no reason to carry.
 */
export interface ImageArchiveEntry { name: string, bytes: Uint8Array }

/** One finished output as the page holds it, before the worker reads its bytes. */
export interface ImageArchiveEntryInput {
  /** Decided by the calling tool; the writer never derives one. */
  name: string
  blob: Blob
}

export interface ImageArchiveInput { entries: ImageArchiveEntryInput[] }

export interface ArchiveWireOutput { bytes: ArrayBuffer }

export interface ImageArchiveOutput { blob: Blob }

/**
 * A stored ZIP keeps sizes and offsets in 32-bit fields, so the container itself
 * stops well before four gibibytes. This is not a limit the batch limits already
 * cover: outputs are not bounded by their sources, and a 200 MiB batch of JPEGs
 * written to the largest canvas a tool allows becomes gigabytes of PNG.
 */
export const imageArchiveLimits = { maxBytes: 3 * 1024 ** 3 } as const

export type ImageArchiveIssue = 'nothing_to_archive' | 'archive_too_large'

/** The preflight §12.11 asks for: an archive that cannot be written is refused before it is started. */
export function checkImageArchive(request: { count: number, bytes: number }): ImageArchiveIssue | undefined {
  if (request.count < 1) return 'nothing_to_archive'
  if (request.bytes > imageArchiveLimits.maxBytes) return 'archive_too_large'
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (value >>> 1) ^ 0xEDB88320 : value >>> 1
    table[index] = value >>> 0
  }

  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF]! ^ (crc >>> 8)

  return (crc ^ 0xFFFFFFFF) >>> 0
}

/** 1980-01-01, the earliest a DOS timestamp can state, so no local clock is written down. */
const dosTime = 0
const dosDate = 0x0021
/** Bit 11: the names are read as UTF-8 rather than as the writer's code page. */
const utf8NameFlag = 0x0800

export function buildZipArchive(entries: ImageArchiveEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const planned = entries.map(entry => ({ ...entry, name: encoder.encode(entry.name), crc: crc32(entry.bytes) }))
  const localSize = planned.reduce((total, entry) => total + 30 + entry.name.length + entry.bytes.length, 0)
  const directorySize = planned.reduce((total, entry) => total + 46 + entry.name.length, 0)
  const archive = new Uint8Array(localSize + directorySize + 22)
  const view = new DataView(archive.buffer)
  let offset = 0

  const offsets: number[] = []
  for (const entry of planned) {
    offsets.push(offset)
    view.setUint32(offset, 0x04034B50, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint16(offset + 6, utf8NameFlag, true)
    view.setUint16(offset + 8, 0, true)
    view.setUint16(offset + 10, dosTime, true)
    view.setUint16(offset + 12, dosDate, true)
    view.setUint32(offset + 14, entry.crc, true)
    view.setUint32(offset + 18, entry.bytes.length, true)
    view.setUint32(offset + 22, entry.bytes.length, true)
    view.setUint16(offset + 26, entry.name.length, true)
    view.setUint16(offset + 28, 0, true)
    archive.set(entry.name, offset + 30)
    archive.set(entry.bytes, offset + 30 + entry.name.length)
    offset += 30 + entry.name.length + entry.bytes.length
  }

  const directoryOffset = offset
  planned.forEach((entry, index) => {
    view.setUint32(offset, 0x02014B50, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint16(offset + 6, 20, true)
    view.setUint16(offset + 8, utf8NameFlag, true)
    view.setUint16(offset + 10, 0, true)
    view.setUint16(offset + 12, dosTime, true)
    view.setUint16(offset + 14, dosDate, true)
    view.setUint32(offset + 16, entry.crc, true)
    view.setUint32(offset + 20, entry.bytes.length, true)
    view.setUint32(offset + 24, entry.bytes.length, true)
    view.setUint16(offset + 28, entry.name.length, true)
    view.setUint16(offset + 30, 0, true)
    view.setUint16(offset + 32, 0, true)
    view.setUint16(offset + 34, 0, true)
    view.setUint16(offset + 36, 0, true)
    view.setUint32(offset + 38, 0, true)
    view.setUint32(offset + 42, offsets[index]!, true)
    archive.set(entry.name, offset + 46)
    offset += 46 + entry.name.length
  })

  view.setUint32(offset, 0x06054B50, true)
  view.setUint16(offset + 4, 0, true)
  view.setUint16(offset + 6, 0, true)
  view.setUint16(offset + 8, planned.length, true)
  view.setUint16(offset + 10, planned.length, true)
  view.setUint32(offset + 12, directorySize, true)
  view.setUint32(offset + 16, directoryOffset, true)
  view.setUint16(offset + 20, 0, true)

  return archive
}

const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** The extension an output of this format is saved with. */
export function imageFileExtension(format: string) {
  return imageExtensions[format] ?? 'png'
}

/** Long enough to recognise a name, short enough that a folder of them still extracts on Windows. */
const maxStemLength = 100

/**
 * The part of a picture's own name an output keeps: no extension, nothing a
 * file system would read as a folder or refuse outright, and composed Unicode,
 * so a name typed on macOS and one typed on Windows compare as the same name.
 */
function outputStem(sourceName: string) {
  const stem = Array.from(sourceName.normalize('NFC').replace(/\.[^.]*$/, '').replace(/[\\/:*?"<>|\p{Cc}]/gu, '_'))
    .slice(0, maxStemLength)
    .join('')
    .replace(/^[\s.]+|[\s.]+$/g, '')

  return stem || 'image'
}

/**
 * What each output of a batch is called when the person has to match it with
 * the picture it came from: the original's name, a suffix saying what was done
 * to it, and the extension of the format it was written in.
 *
 * Two outputs that would share a name — the same picture added twice, or
 * `photo.jpg` and `photo.png` both written as WebP — keep the first one plain
 * and number the rest from 2, in batch order. Names are compared without case,
 * because the archive is usually extracted onto a file system that does not
 * tell `Photo` from `photo`, and one entry would silently replace the other.
 *
 * The same name is meant for the single download and for the archive entry, so
 * a file saved on its own and the same file taken out of the ZIP agree.
 */
export function nameImageOutputs(sources: readonly { name: string, format: string }[], suffix: string): string[] {
  const taken = new Set<string>()

  return sources.map((source) => {
    const stem = suffix ? `${outputStem(source.name)}-${suffix}` : outputStem(source.name)
    const extension = imageFileExtension(source.format)
    let name = `${stem}.${extension}`
    for (let ordinal = 2; taken.has(name.toLowerCase()); ordinal += 1) name = `${stem}-${ordinal}.${extension}`
    taken.add(name.toLowerCase())

    return name
  })
}
