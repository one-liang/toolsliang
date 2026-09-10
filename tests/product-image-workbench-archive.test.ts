import { describe, expect, it } from 'vitest'
import {
  buildZipArchive,
  checkWorkbenchArchive,
  crc32,
  workbenchOutputName,
  workbenchArchiveLimits,
  workbenchArchiveName,
} from '@/features/tools/product-image-workbench/archive'

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
    expect(checkWorkbenchArchive({ count: 0, bytes: 0 })).toBe('nothing_to_archive')
    expect(checkWorkbenchArchive({ count: 3, bytes: 1024 })).toBeUndefined()
    expect(checkWorkbenchArchive({ count: 3, bytes: workbenchArchiveLimits.maxBytes + 1 })).toBe('archive_too_large')
  })
})

describe('封存檔內的命名', () => {
  it('項目名稱只由用途、序號與格式組成，不含來源檔名', () => {
    expect(workbenchOutputName('compliant', 1, 'image/jpeg')).toBe('compliant-product-image-01.jpg')
    expect(workbenchOutputName('promotional', 12, 'image/png')).toBe('brand-promo-image-12.png')
    expect(workbenchOutputName('promotional', 3, 'image/webp')).toBe('brand-promo-image-03.webp')
  })

  it('封存檔本身也依用途命名', () => {
    expect(workbenchArchiveName('compliant')).toBe('compliant-product-images.zip')
    expect(workbenchArchiveName('promotional')).toBe('brand-promo-images.zip')
  })
})
