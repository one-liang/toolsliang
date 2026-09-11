import { describe, expect, it } from 'vitest'
import {
  fitTypedSignatureSize,
  opaqueBounds,
  signatureFormKeys,
  signatureHasTransparency,
  signatureIsEmpty,
  signaturePadAspect,
  signatureRasterSize,
  strokeContentBox,
  typedSignatureText,
  validateSignatureImageFile,
  type SignatureStroke,
} from '@/features/tools/pdf-signature/domain/signature'
import { pdfSignatureImage } from '@/features/tools/pdf-signature/domain/reference'

const stroke = (...points: Array<[number, number]>): SignatureStroke => ({ points: points.map(([x, y]) => ({ x, y })) })

/** An RGBA buffer with one opaque block, to check cropping without a canvas. */
function pixels(width: number, height: number, block: { x: number, y: number, width: number, height: number }) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = block.y; y < block.y + block.height; y += 1) {
    for (let x = block.x; x < block.x + block.width; x += 1) {
      data[(y * width + x) * 4 + 3] = 255
    }
  }
  return data
}

describe('三種簽名形式', () => {
  it('只有繪製、輸入文字與匯入圖片三種', () => {
    expect(signatureFormKeys).toEqual(['drawn', 'typed', 'image'])
  })

  it('簽名板比頁面寬扁，確保放到頁面上時是一條簽名', () => {
    expect(signaturePadAspect).toBeGreaterThan(1.5)
  })
})

describe('繪製的筆跡', () => {
  it('沒有筆跡或只有一個點時不算簽名', () => {
    expect(signatureIsEmpty([])).toBe(true)
    expect(signatureIsEmpty([stroke([0.5, 0.5])])).toBe(true)
    expect(signatureIsEmpty([stroke([0.5, 0.5], [0.5000001, 0.5])])).toBe(true)
    expect(signatureIsEmpty([stroke([0.2, 0.5], [0.8, 0.5])])).toBe(false)
  })

  it('裁切到實際筆跡範圍並留下邊界，不把空白一起帶進 PDF', () => {
    const box = strokeContentBox([stroke([0.4, 0.5], [0.6, 0.7])], 0.02)!

    expect(box.x).toBeCloseTo(0.38, 6)
    expect(box.y).toBeCloseTo(0.48, 6)
    expect(box.width).toBeCloseTo(0.24, 6)
    expect(box.height).toBeCloseTo(0.24, 6)
  })

  it('裁切範圍不會超出簽名板', () => {
    const box = strokeContentBox([stroke([0, 0], [1, 1])], 0.1)!

    expect(box).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('空白筆跡沒有裁切範圍', () => {
    expect(strokeContentBox([], 0.02)).toBeUndefined()
  })
})

describe('點陣化的尺寸', () => {
  it('以最大放置寬度的兩倍計算，維持簽名長寬比', () => {
    const size = signatureRasterSize({ aspect: 3, maxPlacedWidthPt: 300 })

    expect(size).toEqual({ width: 600, height: 200 })
    expect(pdfSignatureImage.renderScale).toBe(2)
  })

  it('不超過單邊像素上限，長邊是高時也一樣', () => {
    const wide = signatureRasterSize({ aspect: 3, maxPlacedWidthPt: 4000 })
    expect(Math.max(wide.width, wide.height)).toBe(pdfSignatureImage.maxEdgePixels)
    expect(wide.width / wide.height).toBeCloseTo(3, 2)

    const tall = signatureRasterSize({ aspect: 0.25, maxPlacedWidthPt: 4000 })
    expect(Math.max(tall.width, tall.height)).toBe(pdfSignatureImage.maxEdgePixels)
    expect(tall.width / tall.height).toBeCloseTo(0.25, 2)
  })

  it('很窄的簽名也至少有一個像素', () => {
    const size = signatureRasterSize({ aspect: 1000, maxPlacedWidthPt: 10 })

    expect(size.height).toBeGreaterThanOrEqual(1)
    expect(size.width).toBeGreaterThanOrEqual(1)
  })
})

describe('輸入文字的簽名', () => {
  it('去掉前後空白並限制長度，空白字串不是簽名', () => {
    expect(typedSignatureText('  王小明  ')).toBe('王小明')
    expect(typedSignatureText('   ')).toBe('')
    expect(typedSignatureText('x'.repeat(200)).length).toBeLessThanOrEqual(60)
  })

  it('字級縮到量出來的寬度與高度都放得下', () => {
    // A stand-in for the canvas: every glyph is half the font size wide.
    const measure = (size: number) => ({ width: size * 0.5 * 6, height: size })
    const size = fitTypedSignatureSize({ box: { width: 300, height: 100 }, measure, maxSize: 200 })

    expect(measure(size).width).toBeLessThanOrEqual(300)
    expect(size).toBeLessThanOrEqual(100)
    expect(size).toBeGreaterThan(0)
  })

  it('量不出寬度時不回傳 0 或無限大', () => {
    const size = fitTypedSignatureSize({ box: { width: 300, height: 100 }, measure: () => ({ width: 0, height: 0 }), maxSize: 200 })

    expect(Number.isFinite(size)).toBe(true)
    expect(size).toBeGreaterThan(0)
  })
})

describe('匯入的圖片', () => {
  it('只收得下透明格式，其餘在讀取像素前就退回', async () => {
    const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'sign.png', { type: 'image/png' })
    expect(await validateSignatureImageFile(png)).toBeUndefined()

    const jpeg = new File([new Uint8Array([255, 216, 255, 224])], 'sign.jpg', { type: 'image/jpeg' })
    expect(await validateSignatureImageFile(jpeg)).toBe('signature_needs_alpha')

    const heic = new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99])], 'sign.heic', { type: 'image/heic' })
    expect(await validateSignatureImageFile(heic)).toBe('unsupported_heic')
  })

  it('完全不透明的圖片會被指出來，不會默默蓋住頁面', () => {
    const opaque = new Uint8ClampedArray(16).fill(255)
    expect(signatureHasTransparency(opaque)).toBe(false)
    expect(signatureHasTransparency(pixels(4, 4, { x: 1, y: 1, width: 2, height: 2 }))).toBe(true)
  })

  it('裁到實際有內容的範圍，全透明時沒有範圍', () => {
    expect(opaqueBounds(pixels(8, 6, { x: 2, y: 1, width: 3, height: 2 }), 8, 6))
      .toEqual({ x: 2, y: 1, width: 3, height: 2 })
    expect(opaqueBounds(new Uint8ClampedArray(8 * 6 * 4), 8, 6)).toBeUndefined()
  })
})
