import { describe, expect, it } from 'vitest'
import {
  buildZipArchive,
  checkImageArchive,
  crc32,
  imageArchiveLimits,
  imageFileExtension,
  nameImageOutputs,
} from '@/features/images/archive'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Reads the central directory back, so the test judges the file and not the writer. */
function readCentralDirectory(archive: Uint8Array) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  let end = archive.length - 22
  while (end >= 0 && view.getUint32(end, true) !== 0x06054B50) end -= 1
  expect(end).toBeGreaterThanOrEqual(0)

  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  const entries = []
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(offset, true)).toBe(0x02014B50)
    const nameLength = view.getUint16(offset + 28, true)
    const entry = {
      crc: view.getUint32(offset + 16, true),
      compressedSize: view.getUint32(offset + 20, true),
      size: view.getUint32(offset + 24, true),
      method: view.getUint16(offset + 10, true),
      name: decoder.decode(archive.subarray(offset + 46, offset + 46 + nameLength)),
      localOffset: view.getUint32(offset + 42, true),
    }
    entries.push(entry)
    offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
  }

  return entries
}

describe('本機組成的封存檔', () => {
  it('CRC-32 與公開的參考值一致', () => {
    expect(crc32(encoder.encode('hello')) >>> 0).toBe(0x3610A686)
    expect(crc32(new Uint8Array())).toBe(0)
  })

  it('封存檔可被一般解壓程式讀回：每個項目都在中央目錄裡，內容原樣保存', () => {
    const first = encoder.encode('first image bytes')
    const second = encoder.encode('second image bytes')
    const archive = buildZipArchive([
      { name: 'brand-promo-image-01.png', bytes: first },
      { name: 'brand-promo-image-02.png', bytes: second },
    ])

    expect(Array.from(archive.subarray(0, 4))).toEqual([0x50, 0x4B, 0x03, 0x04])

    const entries = readCentralDirectory(archive)
    expect(entries.map(entry => entry.name)).toEqual(['brand-promo-image-01.png', 'brand-promo-image-02.png'])
    // Stored, never deflated: the pictures are already compressed formats.
    expect(entries.every(entry => entry.method === 0)).toBe(true)
    expect(entries.map(entry => entry.size)).toEqual([first.length, second.length])
    expect(entries.map(entry => entry.compressedSize)).toEqual([first.length, second.length])
    expect(entries[0]!.crc >>> 0).toBe(crc32(first) >>> 0)

    const payload = archive.subarray(entries[0]!.localOffset + 30 + entries[0]!.name.length)
    expect(decoder.decode(payload.subarray(0, first.length))).toBe('first image bytes')
  })

  it('封存檔不寫入裝置時鐘，只用固定時間戳', () => {
    const archive = buildZipArchive([{ name: 'a.png', bytes: encoder.encode('a') }])
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)

    expect(view.getUint16(10, true)).toBe(0)
    expect(view.getUint16(12, true)).toBe(0x0021)
  })

  it('空批次與超出封存能力的批次在開始前就說明，不會產生半個檔案', () => {
    expect(checkImageArchive({ count: 0, bytes: 0 })).toBe('nothing_to_archive')
    expect(checkImageArchive({ count: 3, bytes: 1024 })).toBeUndefined()
    expect(checkImageArchive({ count: 3, bytes: imageArchiveLimits.maxBytes + 1 })).toBe('archive_too_large')
  })
})


describe('依原檔名命名輸出', () => {
  const sources = (...names: [string, string][]) => names.map(([name, format]) => ({ name, format }))

  it('原檔名去掉副檔名，加上後綴與輸出格式的副檔名', () => {
    expect(nameImageOutputs(sources(['產品照.JPG', 'image/jpeg'], ['banner.final.png', 'image/webp']), 'compressed'))
      .toEqual(['產品照-compressed.jpg', 'banner.final-compressed.webp'])
    expect(imageFileExtension('image/jpeg')).toBe('jpg')
    expect(imageFileExtension('image/unknown')).toBe('png')
  })

  it('重名時第一個保留原名，其餘依批次順序從 2 起加序號', () => {
    expect(nameImageOutputs(sources(['a.jpg', 'image/webp'], ['a.png', 'image/webp'], ['a.webp', 'image/webp'], ['b.jpg', 'image/webp']), 'cutout'))
      .toEqual(['a-cutout.webp', 'a-cutout-2.webp', 'a-cutout-3.webp', 'b-cutout.webp'])
  })

  it('同一張圖加入兩次也各自有名字；格式不同就不算重名', () => {
    expect(nameImageOutputs(sources(['a.png', 'image/png'], ['a.png', 'image/png'], ['a.png', 'image/jpeg']), 'promo'))
      .toEqual(['a-promo.png', 'a-promo-2.png', 'a-promo.jpg'])
  })

  it('只差大小寫也算重名，解壓到不分大小寫的磁碟時不會互相覆蓋', () => {
    expect(nameImageOutputs(sources(['Photo.jpg', 'image/jpeg'], ['photo.JPG', 'image/jpeg']), 'compressed'))
      .toEqual(['Photo-compressed.jpg', 'photo-compressed-2.jpg'])
  })

  it('加上的序號不會撞到另一張本來就叫那個名字的圖', () => {
    expect(nameImageOutputs(sources(['a.jpg', 'image/png'], ['a.png', 'image/png'], ['a-2.png', 'image/png']), ''))
      .toEqual(['a.png', 'a-2.png', 'a-2-2.png'])
  })

  it('macOS 拆開儲存的重音字與一般合成字視為同名', () => {
    const decomposed = 'café.png'
    const composed = 'café.png'

    expect(nameImageOutputs(sources([decomposed, 'image/png'], [composed, 'image/png']), 'x')).toEqual(['café-x.png', 'café-x-2.png'])
  })

  it('不會產生資料夾、控制字元或空白名稱', () => {
    const [traversal, control, empty, dotted, long] = nameImageOutputs(sources(
      ['../../etc/passwd.png', 'image/png'],
      ['a\u0000b\nc.png', 'image/png'],
      ['.png', 'image/png'],
      ['  ...hidden.  .png', 'image/png'],
      [`${'長'.repeat(300)}.png`, 'image/png'],
    ), 'compressed')

    expect(traversal).toBe('_.._etc_passwd-compressed.png')
    expect(control).toBe('a_b_c-compressed.png')
    expect(empty).toBe('image-compressed.png')
    expect(dotted).toBe('hidden-compressed.png')
    expect(Array.from(long!.replace(/-compressed\.png$/, ''))).toHaveLength(100)
  })

  it('打包後的封存檔內容就是這些名字，原檔一一對得回來', () => {
    const names = nameImageOutputs(sources(['店面.jpg', 'image/jpeg'], ['店面.png', 'image/jpeg']), 'compressed')
    const archive = buildZipArchive(names.map(name => ({ name, bytes: encoder.encode(name) })))

    expect(readCentralDirectory(archive).map(entry => entry.name)).toEqual(['店面-compressed.jpg', '店面-compressed-2.jpg'])
  })
})
