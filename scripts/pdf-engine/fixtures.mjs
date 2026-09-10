/**
 * Builds the representative PDFs the T24 evaluation measures.
 *
 * Every byte is written here rather than taken from a real document: the
 * evaluation may not use a file whose provenance it cannot state, and the
 * structures under test — rotation, offset page boxes, cross-reference
 * streams, standard-security encryption, a broken start offset — have to be
 * exact rather than "whatever this sample happened to contain".
 *
 * The writer is deliberately independent of every candidate library. A fixture
 * produced by one of them would measure that library against its own output.
 *
 * Nothing here is random: pixels come from a seeded generator and the document
 * identifier, dates and AES initialisation vectors are fixed, so two runs on
 * two machines produce the same bytes and the same SHA-256.
 */
import { createCipheriv, createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'

/** The user password every encrypted fixture is built with. It guards synthetic pages only. */
export const fixturePassword = 'toolsliang-t24'

/** A4 in PDF user space units, the size the reference document uses. */
const A4 = { width: 595.28, height: 841.89 }

/** ISO 32000-1 table 20: the padding string the standard security handler pads passwords with. */
const PASSWORD_PADDING = Buffer.from([
  0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
  0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A,
])

/** Fixed so the built bytes are reproducible; a real writer would randomise it. */
const DOCUMENT_ID = Buffer.from('546f6f6c736c69616e6754323446697801', 'hex').subarray(0, 16)

function md5(...parts) {
  const hash = createHash('md5')
  for (const part of parts) hash.update(part)
  return hash.digest()
}

function rc4(key, data) {
  const state = new Uint8Array(256)
  for (let index = 0; index < 256; index += 1) state[index] = index

  let swap = 0
  for (let index = 0; index < 256; index += 1) {
    swap = (swap + state[index] + key[index % key.length]) & 0xFF
    const held = state[index]
    state[index] = state[swap]
    state[swap] = held
  }

  const out = Buffer.alloc(data.length)
  let i = 0
  let j = 0
  for (let index = 0; index < data.length; index += 1) {
    i = (i + 1) & 0xFF
    j = (j + state[i]) & 0xFF
    const held = state[i]
    state[i] = state[j]
    state[j] = held
    out[index] = data[index] ^ state[(state[i] + state[j]) & 0xFF]
  }

  return out
}

function xorKey(key, value) {
  return Buffer.from(key.map(byte => byte ^ value))
}

function padPassword(password) {
  const bytes = Buffer.from(password, 'latin1').subarray(0, 32)
  return Buffer.concat([bytes, PASSWORD_PADDING], 32)
}

/**
 * The standard security handler, algorithms 2 to 5 of ISO 32000-1 §7.6.3.
 * Only the revisions the matrix needs are implemented: revision 3 with RC4 at
 * 128 bit, and revision 4 with AES-128 in CBC mode.
 */
function standardSecurity({ revision, password, permissions }) {
  const keyLength = 16
  const padded = padPassword(password)

  let ownerDigest = md5(padded)
  for (let round = 0; round < 50; round += 1) ownerDigest = md5(ownerDigest.subarray(0, keyLength))
  const ownerKey = ownerDigest.subarray(0, keyLength)

  let owner = rc4(ownerKey, padded)
  for (let round = 1; round <= 19; round += 1) owner = rc4(xorKey(ownerKey, round), owner)

  const permissionBytes = Buffer.alloc(4)
  permissionBytes.writeInt32LE(permissions, 0)

  let keyDigest = md5(padded, owner, permissionBytes, DOCUMENT_ID)
  for (let round = 0; round < 50; round += 1) keyDigest = md5(keyDigest.subarray(0, keyLength))
  const key = keyDigest.subarray(0, keyLength)

  let user = rc4(key, md5(PASSWORD_PADDING, DOCUMENT_ID))
  for (let round = 1; round <= 19; round += 1) user = rc4(xorKey(key, round), user)
  user = Buffer.concat([user, Buffer.alloc(16)], 32)

  const aes = revision === 4

  function objectKey(number, generation) {
    const suffix = Buffer.alloc(5)
    suffix.writeUIntLE(number, 0, 3)
    suffix.writeUIntLE(generation, 3, 2)
    const parts = aes ? [key, suffix, Buffer.from([0x73, 0x41, 0x6C, 0x54])] : [key, suffix]
    return md5(...parts).subarray(0, Math.min(keyLength + 5, 16))
  }

  return {
    revision,
    owner,
    user,
    permissions,
    /** Fixed per object number, so the same fixture always produces the same bytes. */
    encrypt(data, number, generation) {
      const derived = objectKey(number, generation)
      if (!aes) return rc4(derived, data)

      const iv = md5(Buffer.from(`toolsliang-iv-${number}-${generation}`, 'latin1'))
      const cipher = createCipheriv('aes-128-cbc', derived, iv)
      return Buffer.concat([iv, cipher.update(data), cipher.final()])
    },
    dictionary() {
      const shared = `/Filter /Standard /Length 128 /P ${permissions}`
        + ` /O <${this.owner.toString('hex')}> /U <${this.user.toString('hex')}>`

      return aes
        ? `<< ${shared} /V 4 /R 4 /CF << /StdCF << /CFM /AESV2 /AuthEvent /DocOpen /Length 16 >> >>`
          + ' /StmF /StdCF /StrF /StdCF /EncryptMetadata true >>'
        : `<< ${shared} /V 2 /R 3 >>`
    },
  }
}

/** A deterministic generator; the pixels must not compress, so the byte budgets are real. */
function noisePixels(width, height, seed) {
  const pixels = Buffer.alloc(width * height * 3)
  let state = seed >>> 0
  for (let index = 0; index < pixels.length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    pixels[index] = (state >>> 24) & 0xFF
  }
  return pixels
}

class PdfBuilder {
  constructor({ version = '1.7', security = null } = {}) {
    this.version = version
    this.security = security
    /** Index 0 is the free head; object numbers are one-based, as in the file. */
    this.objects = [null]
  }

  reserve() {
    this.objects.push(null)
    return this.objects.length - 1
  }

  put(number, body) {
    this.objects[number] = body
    return number
  }

  add(body) {
    return this.put(this.reserve(), body)
  }

  /** `dict` must not carry `/Length`; the builder appends it after compression. */
  addStream(dict, data, { compress = false } = {}) {
    const bytes = compress ? deflateSync(data) : Buffer.from(data)
    const filter = compress ? ' /Filter /FlateDecode' : ''
    return this.add({ dict: `${dict}${filter}`, stream: bytes })
  }

  serialize(number) {
    const body = this.objects[number]
    if (body === null || body === undefined) throw new Error(`object ${number} was reserved but never written`)

    if (typeof body === 'string') return Buffer.from(`${number} 0 obj\n${body}\nendobj\n`, 'latin1')

    const stream = this.security ? this.security.encrypt(body.stream, number, 0) : body.stream
    return Buffer.concat([
      Buffer.from(`${number} 0 obj\n${body.dict} /Length ${stream.length} >>\nstream\n`, 'latin1'),
      stream,
      Buffer.from('\nendstream\nendobj\n', 'latin1'),
    ])
  }

  /** A classic cross-reference table, the structure most producers still emit. */
  build({ root, encryptRef = null, brokenStartxref = false }) {
    const header = Buffer.from(`%PDF-${this.version}\n%\xE2\xE3\xCF\xD3\n`, 'latin1')
    const chunks = [header]
    const offsets = [0]
    let offset = header.length

    for (let number = 1; number < this.objects.length; number += 1) {
      const serialized = this.serialize(number)
      offsets.push(offset)
      chunks.push(serialized)
      offset += serialized.length
    }

    const rows = ['0000000000 65535 f \n']
    for (let number = 1; number < this.objects.length; number += 1) {
      rows.push(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`)
    }

    const identifier = `<${DOCUMENT_ID.toString('hex')}> <${DOCUMENT_ID.toString('hex')}>`
    const trailer = `trailer\n<< /Size ${this.objects.length} /Root ${root} 0 R`
      + `${encryptRef ? ` /Encrypt ${encryptRef} 0 R` : ''} /ID [${identifier}] >>\n`

    chunks.push(Buffer.from(`xref\n0 ${this.objects.length}\n${rows.join('')}${trailer}`, 'latin1'))
    /* A start offset that points at nothing is the common damage: the body is
     * intact and only a reader that rebuilds the table can open the file. */
    chunks.push(Buffer.from(`startxref\n${brokenStartxref ? offset + 999_999 : offset}\n%%EOF\n`, 'latin1'))

    return Buffer.concat(chunks)
  }

  /**
   * A PDF 1.5 file: every dictionary object moves into an object stream and
   * the table becomes a cross-reference stream. A writer that only understands
   * the classic table cannot open this, which is exactly what it is here for.
   */
  buildWithObjectStreams({ root, compressed }) {
    const header = Buffer.from(`%PDF-1.5\n%\xE2\xE3\xCF\xD3\n`, 'latin1')
    const chunks = [header]
    const entries = new Map()
    let offset = header.length

    const objectStreamNumber = this.reserve()
    const xrefNumber = this.reserve()

    for (let number = 1; number < this.objects.length; number += 1) {
      if (compressed.includes(number) || number === objectStreamNumber || number === xrefNumber) continue
      const serialized = this.serialize(number)
      entries.set(number, { type: 1, first: offset, second: 0 })
      chunks.push(serialized)
      offset += serialized.length
    }

    const headers = []
    const bodies = []
    let inner = 0
    compressed.forEach((number, index) => {
      const body = this.objects[number]
      if (typeof body !== 'string') throw new Error(`object ${number} has a stream and cannot be compressed`)
      headers.push(`${number} ${inner}`)
      bodies.push(body)
      entries.set(number, { type: 2, first: objectStreamNumber, second: index })
      inner += Buffer.byteLength(`${body}\n`, 'latin1')
    })

    const headerText = `${headers.join(' ')}\n`
    const payload = deflateSync(Buffer.from(`${headerText}${bodies.map(body => `${body}\n`).join('')}`, 'latin1'))
    const objectStream = Buffer.concat([
      Buffer.from(`${objectStreamNumber} 0 obj\n<< /Type /ObjStm /N ${compressed.length}`
        + ` /First ${headerText.length} /Filter /FlateDecode /Length ${payload.length} >>\nstream\n`, 'latin1'),
      payload,
      Buffer.from('\nendstream\nendobj\n', 'latin1'),
    ])
    entries.set(objectStreamNumber, { type: 1, first: offset, second: 0 })
    chunks.push(objectStream)
    offset += objectStream.length

    const size = this.objects.length
    entries.set(xrefNumber, { type: 1, first: offset, second: 0 })
    const table = Buffer.alloc(size * 6)
    for (let number = 0; number < size; number += 1) {
      const entry = entries.get(number) ?? { type: 0, first: 0, second: 65535 }
      table.writeUInt8(entry.type, number * 6)
      table.writeUInt32BE(entry.first, number * 6 + 1)
      table.writeUInt8(entry.second & 0xFF, number * 6 + 5)
    }

    const xrefPayload = deflateSync(table)
    const identifier = `<${DOCUMENT_ID.toString('hex')}> <${DOCUMENT_ID.toString('hex')}>`
    chunks.push(Buffer.concat([
      Buffer.from(`${xrefNumber} 0 obj\n<< /Type /XRef /Size ${size} /W [1 4 1] /Root ${root} 0 R`
        + ` /ID [${identifier}] /Filter /FlateDecode /Length ${xrefPayload.length} >>\nstream\n`, 'latin1'),
      xrefPayload,
      Buffer.from('\nendstream\nendobj\n', 'latin1'),
    ]))

    chunks.push(Buffer.from(`startxref\n${offset}\n%%EOF\n`, 'latin1'))
    return Buffer.concat(chunks)
  }
}

/**
 * One page draws a coloured band across its own top and a small square at its
 * own origin corner, both in the page's unrotated user space. A reader that
 * mishandles `/Rotate` or an offset `/MediaBox` puts them somewhere else, and
 * the rendered pixels say so.
 */
function pageContent(box) {
  const [left, bottom, right, top] = box
  const width = right - left
  const height = top - bottom

  return 'q\n'
    + `0.204 0.435 0.827 rg\n${left} ${top - height * 0.08} ${width} ${height * 0.08} re f\n`
    + `0.937 0.427 0.094 rg\n${left + 12} ${bottom + 12} 36 36 re f\nQ\n`
}

function documentPages(builder, { pages, box, rotate = () => 0, imageFor = () => null }) {
  const pagesNumber = builder.reserve()
  const catalog = builder.add(`<< /Type /Catalog /Pages ${pagesNumber} 0 R >>`)

  const kids = []
  for (let index = 0; index < pages; index += 1) {
    /* A page carries its own image. Sharing one XObject would make a 20-page
     * document weigh what a one-page document weighs, and the byte budgets in
     * §12.12 are about how much a reader actually has to move through. */
    const image = imageFor(index)
    const drawing = image
      ? `${pageContent(box)}q ${box[2] - box[0]} 0 0 ${(box[3] - box[1]) * 0.6} ${box[0]} ${box[1] + 60} cm /Im0 Do Q\n`
      : pageContent(box)
    const contents = builder.addStream('<< ', Buffer.from(drawing, 'latin1'), { compress: true })
    const resources = image ? `<< /XObject << /Im0 ${image} 0 R >> >>` : '<< >>'

    kids.push(builder.add(`<< /Type /Page /Parent ${pagesNumber} 0 R /MediaBox [${box.join(' ')}]`
      + ` /Rotate ${rotate(index)} /Resources ${resources} /Contents ${contents} 0 R >>`))
  }

  builder.put(pagesNumber, `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(kid => `${kid} 0 R`).join(' ')}] >>`)
  return catalog
}

function buildReference({ pages, imageEdge, seed, version = '1.7' }) {
  const builder = new PdfBuilder({ version })
  const box = [0, 0, A4.width, A4.height]
  const imageFor = imageEdge
    ? index => builder.addStream(
        `<< /Type /XObject /Subtype /Image /Width ${imageEdge} /Height ${imageEdge}`
        + ' /ColorSpace /DeviceRGB /BitsPerComponent 8',
        noisePixels(imageEdge, imageEdge, seed + index * 7919),
      )
    : undefined
  const catalog = documentPages(builder, { pages, box, imageFor })
  return builder.build({ root: catalog })
}

function buildRotated() {
  const builder = new PdfBuilder({})
  const box = [0, 0, A4.width, A4.height]
  const catalog = documentPages(builder, { pages: 4, box, rotate: index => index * 90 })
  return builder.build({ root: catalog })
}

function buildOffsetBoxes() {
  const builder = new PdfBuilder({})
  const pagesNumber = builder.reserve()
  const catalog = builder.add(`<< /Type /Catalog /Pages ${pagesNumber} 0 R >>`)
  const box = [20, 30, 615, 822]
  const crop = [50, 60, 545, 762]

  const kids = []
  for (let index = 0; index < 2; index += 1) {
    const content = builder.addStream('<< ', Buffer.from(pageContent(box), 'latin1'), { compress: true })
    kids.push(builder.add(`<< /Type /Page /Parent ${pagesNumber} 0 R /MediaBox [${box.join(' ')}]`
      + ` /CropBox [${crop.join(' ')}] /Rotate 0 /Resources << >> /Contents ${content} 0 R >>`))
  }

  builder.put(pagesNumber, `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(kid => `${kid} 0 R`).join(' ')}] >>`)
  return builder.build({ root: catalog })
}

function buildObjectStreams() {
  const builder = new PdfBuilder({ version: '1.5' })
  const box = [0, 0, A4.width, A4.height]
  const catalog = documentPages(builder, { pages: 3, box })
  /* Every dictionary object moves into the object stream; stream objects cannot. */
  const compressed = []
  for (let number = 1; number < builder.objects.length; number += 1) {
    if (typeof builder.objects[number] === 'string') compressed.push(number)
  }
  return builder.buildWithObjectStreams({ root: catalog, compressed })
}

function buildEncrypted(revision) {
  const security = standardSecurity({ revision, password: fixturePassword, permissions: -1 })
  const builder = new PdfBuilder({ version: revision === 4 ? '1.6' : '1.4', security })
  const box = [0, 0, A4.width, A4.height]
  const catalog = documentPages(builder, { pages: 2, box })
  /* The encryption dictionary is the one object the handler never encrypts. */
  const encryptNumber = builder.reserve()
  builder.put(encryptNumber, security.dictionary())
  const bytes = builder.build({ root: catalog, encryptRef: encryptNumber })
  return bytes
}

function buildBrokenXref() {
  const builder = new PdfBuilder({})
  const box = [0, 0, A4.width, A4.height]
  const catalog = documentPages(builder, { pages: 2, box })
  return builder.build({ root: catalog, brokenStartxref: true })
}

/**
 * The fixtures, in the order the record tabulates them. `structure` is what the
 * document exercises; `expectation` is what a candidate has to do with it.
 */
export function buildFixtures() {
  const reference = buildReference({ pages: 20, imageEdge: 600, seed: 20_240_724 })

  const entries = [
    {
      name: 'reference-20-page',
      structure: 'classic-xref',
      expectation: 'open',
      pages: 20,
      note: 'specification §12.12 reference document: 20 pages, uncompressible page images',
      bytes: reference,
    },
    {
      name: 'rotated-pages',
      structure: 'page-rotation',
      expectation: 'open',
      pages: 4,
      note: '/Rotate 0, 90, 180 and 270 on otherwise identical pages',
      bytes: buildRotated(),
    },
    {
      name: 'offset-crop-box',
      structure: 'offset-boxes',
      expectation: 'open',
      pages: 2,
      note: 'MediaBox with a non-zero origin and a smaller CropBox inside it',
      bytes: buildOffsetBoxes(),
    },
    {
      name: 'object-stream',
      structure: 'xref-stream',
      expectation: 'open',
      pages: 3,
      note: 'PDF 1.5 cross-reference stream with every dictionary in an object stream',
      bytes: buildObjectStreams(),
    },
    {
      name: 'large-56-page',
      structure: 'classic-xref',
      expectation: 'open',
      pages: 56,
      note: 'past the byte cap the tool declares, to place the limit on measured ground',
      bytes: buildReference({ pages: 56, imageEdge: 600, seed: 55_012 }),
    },
    {
      name: 'page-cap-120',
      structure: 'classic-xref',
      expectation: 'open',
      pages: 120,
      note: 'past the page cap the tool declares, with negligible bytes per page',
      bytes: buildReference({ pages: 120, imageEdge: 0, seed: 1 }),
    },
    {
      name: 'encrypted-rc4-128',
      structure: 'standard-security-r3',
      expectation: 'password',
      pages: 2,
      note: 'RC4 128 bit, revision 3, user password required to open',
      bytes: buildEncrypted(3),
    },
    {
      name: 'encrypted-aes-128',
      structure: 'standard-security-r4',
      expectation: 'password',
      pages: 2,
      note: 'AES-128 CBC, revision 4, user password required to open',
      bytes: buildEncrypted(4),
    },
    {
      name: 'broken-xref',
      structure: 'damaged-startxref',
      expectation: 'recover-or-reject',
      pages: 2,
      note: 'intact body, start offset pointing past the end of the file',
      bytes: buildBrokenXref(),
    },
    {
      name: 'truncated',
      structure: 'damaged-truncated',
      expectation: 'reject',
      pages: 0,
      note: 'the reference document cut at 60%: no table, no trailer, no final objects',
      bytes: reference.subarray(0, Math.floor(reference.length * 0.6)),
    },
  ]

  return entries.map(entry => ({
    ...entry,
    bytes: Buffer.from(entry.bytes),
    sha256: createHash('sha256').update(entry.bytes).digest('hex'),
    byteLength: entry.bytes.length,
  }))
}
