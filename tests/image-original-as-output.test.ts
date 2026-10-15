import { describe, expect, it } from 'vitest'
import { originalAsOutput } from '@/features/images/original-as-output'

const ascii = (text: string) => [...text].map(character => character.charCodeAt(0))
const u32be = (value: number) => [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]
const u32le = (value: number) => u32be(value).reverse()
/** Little-endian TIFF with one IFD0 entry: Orientation (0x0112), SHORT, count 1. */
const tiff = (orientation: number) => [...ascii('II'), 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, orientation, 0, 0, 0, 0, 0, 0, 0]
const exif = (orientation: number) => [...ascii('Exif'), 0, 0, ...tiff(orientation)]
const bytes = (value: ArrayBuffer | undefined) => value && [...new Uint8Array(value)]

const segment = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload]
const jfif = segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0])
const quantization = segment(0xdb, [0, ...Array(64).fill(1)])
const scan = [0xff, 0xda, 0, 2, 9, 8, 7, 0xff, 0xd9]
const jpeg = (...segments: number[][]) => new Uint8Array([0xff, 0xd8, ...segments.flat(), ...scan])

const chunk = (type: string, data: number[] = []) => [...u32be(data.length), ...ascii(type), ...data, 1, 2, 3, 4]
const header = chunk('IHDR', Array(13).fill(0))
const pixels = chunk('IDAT', [5, 6, 7])
const png = (...chunks: number[][]) => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunks.flat(), ...chunk('IEND')])

const riff = (type: string, data: number[]) => [...ascii(type), ...u32le(data.length), ...data, ...(data.length % 2 ? [0] : [])]
const vp8x = (flags: number) => riff('VP8X', [flags, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const frame = riff('VP8L', [0x2f, 1, 2, 3, 4])
const webp = (...chunks: number[][]) => {
  const body = [...ascii('WEBP'), ...chunks.flat()]
  return new Uint8Array([...ascii('RIFF'), ...u32le(body.length), ...body])
}

describe('原圖作為輸出（移除中繼資料）', () => {
  it('JPEG 移除 EXIF、XMP 與註解，保留編碼區段與掃描資料', () => {
    const xmp = segment(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0, ...ascii('<x/>')])
    const source = jpeg(jfif, segment(0xe1, exif(1)), xmp, segment(0xfe, ascii('private comment')), quantization)
    expect(bytes(originalAsOutput(source))).toEqual([...jpeg(jfif, quantization)])
  })

  it.each([3, 6, 8])('JPEG 的 EXIF orientation %i 會被解碼器套用，不能沿用原圖', (orientation) => {
    expect(originalAsOutput(jpeg(jfif, segment(0xe1, exif(orientation)), quantization))).toBeUndefined()
  })

  it('PNG 移除 eXIf 與文字、時間區塊，保留其他區塊', () => {
    const source = png(header, chunk('eXIf', tiff(1)), chunk('tEXt', ascii('Author\0private')), chunk('iTXt', ascii('x')), chunk('zTXt', ascii('y')), chunk('tIME', [7, 234, 10, 14, 0, 0, 0]), chunk('pHYs', Array(9).fill(0)), pixels)
    expect(bytes(originalAsOutput(source))).toEqual([...png(header, chunk('pHYs', Array(9).fill(0)), pixels)])
  })

  it('PNG 動畫或帶旋轉方向時不沿用原圖', () => {
    expect(originalAsOutput(png(header, chunk('acTL', [0, 0, 0, 2, 0, 0, 0, 0]), pixels))).toBeUndefined()
    expect(originalAsOutput(png(header, chunk('eXIf', tiff(6)), pixels))).toBeUndefined()
  })

  it('WebP 移除 EXIF、XMP 區塊並清除對應旗標與 RIFF 大小', () => {
    const iccFlag = 0x20, exifFlag = 0x08, xmpFlag = 0x04
    const profile = riff('ICCP', [1, 2, 3])
    const source = webp(vp8x(iccFlag | exifFlag | xmpFlag), profile, frame, riff('EXIF', exif(1)), riff('XMP ', ascii('<x/>')))
    expect(bytes(originalAsOutput(source))).toEqual([...webp(vp8x(iccFlag), profile, frame)])
  })

  it('WebP 簡單格式沒有中繼資料，原樣沿用', () => {
    const source = webp(frame)
    expect(bytes(originalAsOutput(source))).toEqual([...source])
  })

  it('WebP 動畫或帶旋轉方向時不沿用原圖', () => {
    expect(originalAsOutput(webp(vp8x(0x02), frame))).toBeUndefined()
    expect(originalAsOutput(webp(vp8x(0x08), frame, riff('EXIF', tiff(6))))).toBeUndefined()
  })

  it('損毀或無法辨識的容器不沿用原圖', () => {
    expect(originalAsOutput(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 200, 1]))).toBeUndefined()
    expect(originalAsOutput(png(header).subarray(0, 30))).toBeUndefined()
    expect(originalAsOutput(new Uint8Array(ascii('not an image')))).toBeUndefined()
  })
})
