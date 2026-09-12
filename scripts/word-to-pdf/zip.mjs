/**
 * The smallest ZIP writer a DOCX needs, and the reader the corpus checks itself with.
 *
 * A DOCX is an OPC package: a ZIP whose members are XML parts. Writing the
 * container here rather than pulling in an archiver keeps the corpus a pure
 * function of this repository — the bytes a measurement ran on can be rebuilt
 * from source alone, which is what makes the evaluation repeatable.
 *
 * Only what OPC actually uses is implemented: deflate and store, no data
 * descriptors, no ZIP64, no encryption. Anything larger than 4 GiB or more than
 * 65535 members is out of range and throws rather than writing a file that
 * looks valid and is not.
 */
import { deflateRawSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

export function crc32(buffer) {
  let crc = 0xFFFFFFFF
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/**
 * `entries` is `[{ name, data, store }]` in the order they should appear.
 * `[Content_Types].xml` must be first, because a reader is allowed to stream
 * the package and needs the content types before any part it describes.
 */
export function writeZip(entries) {
  if (entries.length > 0xFFFF) throw new Error('zip_too_many_entries')

  const locals = []
  const central = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8')
    const deflated = entry.store ? raw : deflateRawSync(raw, { level: 9 })
    /* A part that deflate makes bigger is stored; the reader accepts either. */
    const stored = entry.store || deflated.length >= raw.length
    const body = stored ? raw : deflated
    const method = stored ? 0 : 8
    const checksum = crc32(raw)

    if (raw.length > 0xFFFFFFFF || offset > 0xFFFFFFFF) throw new Error('zip_needs_zip64')

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034B50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(method, 8)
    /* A fixed MS-DOS timestamp: 1980-01-01 00:00:00, so the same corpus hashes the same on every machine. */
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0x0021, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014B50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(0, 8)
    header.writeUInt16LE(method, 10)
    header.writeUInt16LE(0, 12)
    header.writeUInt16LE(0x0021, 14)
    header.writeUInt32LE(checksum, 16)
    header.writeUInt32LE(body.length, 20)
    header.writeUInt32LE(raw.length, 24)
    header.writeUInt16LE(name.length, 28)
    header.writeUInt16LE(0, 30)
    header.writeUInt16LE(0, 32)
    header.writeUInt16LE(0, 34)
    header.writeUInt16LE(0, 36)
    header.writeUInt32LE(0, 38)
    header.writeUInt32LE(offset, 42)

    locals.push(local, name, body)
    central.push(header, name)
    offset += local.length + name.length + body.length
  }

  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054B50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...locals, directory, end])
}
