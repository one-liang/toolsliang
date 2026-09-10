/**
 * How a finished batch becomes one file, here on the device.
 *
 * §12.11 asks for a batch archive and says the archive is assembled locally.
 * There is no server step to fall back on, so the container is written here:
 * a stored — never deflated — ZIP, because every entry is already a compressed
 * picture and re-compressing one costs seconds to save nothing.
 *
 * Nothing about the source travels into it. Entry names are built from the
 * output's purpose and the item's position, and the timestamp is a constant
 * rather than the device clock, which is one more thing about the person that
 * a file they share has no reason to carry.
 */
import type { WorkbenchPurpose } from './session'

export interface WorkbenchArchiveEntry { name: string, bytes: Uint8Array }

/**
 * A stored ZIP keeps sizes and offsets in 32-bit fields, so the container
 * itself stops well before four gibibytes. The batch limits are far below this;
 * it is the last line, not the working ceiling.
 */
export const workbenchArchiveLimits = { maxBytes: 3 * 1024 ** 3 } as const

export type WorkbenchArchiveIssue = 'nothing_to_archive' | 'archive_too_large'

/** The preflight §12.11 asks for: an archive that cannot be written is refused before it is started. */
export function checkWorkbenchArchive(request: { count: number, bytes: number }): WorkbenchArchiveIssue | undefined {
  if (request.count < 1) return 'nothing_to_archive'
  if (request.bytes > workbenchArchiveLimits.maxBytes) return 'archive_too_large'
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

export function buildZipArchive(entries: WorkbenchArchiveEntry[]): Uint8Array {
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

const outputExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const outputStems: Record<WorkbenchPurpose, string> = {
  compliant: 'compliant-product-image',
  promotional: 'brand-promo-image',
}

/**
 * What one output is called: what it is, and where it sat in the batch. The
 * same name is used for a single download and for the entry inside the archive,
 * because it is the same file either way — and neither carries the name of the
 * picture the merchant imported.
 */
export function workbenchOutputName(purpose: WorkbenchPurpose, ordinal: number, format: string) {
  return `${outputStems[purpose]}-${String(ordinal).padStart(2, '0')}.${outputExtensions[format] ?? 'png'}`
}

export function workbenchArchiveName(purpose: WorkbenchPurpose) {
  return `${outputStems[purpose]}s.zip`
}
