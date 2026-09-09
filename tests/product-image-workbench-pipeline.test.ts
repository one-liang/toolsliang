import { describe, expect, it } from 'vitest'
import {
  planBrandScene,
  planLayoutInput,
  promotionalCanvasBounds,
  resolveLayoutBounds,
  workbenchOutputName,
} from '@/features/tools/product-image-workbench/pipeline'
import { findCompliantImagePreset } from '@/features/tools/compliant-product-image/domain/preset'
import { describeSizeIssue } from '@/features/tools/compliant-product-image/domain/render'
import { imageInputLimits } from '@/features/images/limits'

const today = '2026-09-09'
const preset = findCompliantImagePreset('momo-store-main')!
const settings = {
  presetId: 'momo-store-main',
  width: 1000,
  height: 1000,
  format: 'image/jpeg' as const,
  fit: 'cover' as const,
  zoom: 100,
  offsetX: 0,
  offsetY: 0,
  background: '#ffffff',
}
const product = new File([new Uint8Array([137, 80])], 'product.png', { type: 'image/png' })

describe('版型步驟的輸出範圍', () => {
  it('合規主圖沿用通路 preset 的尺寸限制', () => {
    const bounds = resolveLayoutBounds('compliant', preset, today)

    expect(bounds).toEqual(expect.objectContaining({ exact: { width: 1000, height: 1000 } }))
    expect(describeSizeIssue(bounds, 900, 900)).toBe('not-exact')
  })

  it('品牌宣傳圖不套用通路規格，只受本機處理上限限制', () => {
    const bounds = resolveLayoutBounds('promotional', preset, today)

    expect(bounds).toEqual(promotionalCanvasBounds)
    expect(bounds.exact).toBeUndefined()
    expect(bounds.maxPixels).toBe(imageInputLimits.maxPixels)
    expect(describeSizeIssue(bounds, 900, 1600)).toBeUndefined()
    expect(describeSizeIssue(bounds, 9000, 1000)).toBe('too-large')
  })
})

describe('版型步驟交給算繪引擎的輸入', () => {
  it('合規主圖帶上通路要求的容量範圍', () => {
    const input = planLayoutInput({ file: product, purpose: 'compliant', settings, byteRange: { min: 20_000, max: 2_000_000 } })

    expect(input).toEqual({
      file: product,
      width: 1000,
      height: 1000,
      format: 'image/jpeg',
      fit: 'cover',
      zoom: 100,
      offsetX: 0,
      offsetY: 0,
      background: '#ffffff',
      minBytes: 20_000,
      maxBytes: 2_000_000,
    })
  })

  it('品牌宣傳圖不帶通路容量範圍，避免把通路規則套到宣傳輸出', () => {
    const input = planLayoutInput({ file: product, purpose: 'promotional', settings, byteRange: { min: 20_000, max: 2_000_000 } })

    expect(input.minBytes).toBeUndefined()
    expect(input.maxBytes).toBeUndefined()
  })

  it('去背結果會取代原圖成為版型步驟的輸入', () => {
    const cutout = new File([new Uint8Array([137, 80])], 'cutout.png', { type: 'image/png' })
    expect(planLayoutInput({ file: cutout, purpose: 'compliant', settings, byteRange: {} }).file).toBe(cutout)
  })
})

describe('品牌素材步驟的場景', () => {
  const canvas = { width: 1200, height: 1200 }
  const layout = new File([new Uint8Array([137, 80])], 'layout.png', { type: 'image/png' })
  const frame = new File([new Uint8Array([137, 80])], 'frame.png', { type: 'image/png' })
  const logo = new File([new Uint8Array([137, 80])], 'logo.png', { type: 'image/png' })

  it('版型結果固定置中鋪滿，框版覆蓋整個畫布，Logo 依數字設定擺放', () => {
    const { scene, files } = planBrandScene({
      canvas,
      product: layout,
      frame,
      logo,
      logoScale: 25,
      logoX: 30,
      logoY: -30,
      logoOpacity: 80,
    })

    expect(scene).toEqual({
      width: 1200,
      height: 1200,
      layers: [
        { id: 'product', kind: 'product', assetId: 'product', x: 0, y: 0, scale: 1, opacity: 1, visible: true, fit: 'contain' },
        { id: 'frame', kind: 'frame', assetId: 'frame', x: 0, y: 0, scale: 1, opacity: 1, visible: true, fit: 'cover' },
        { id: 'logo', kind: 'logo', assetId: 'logo', x: 0.3, y: -0.3, scale: 0.25, opacity: 0.8, visible: true, fit: 'contain' },
      ],
    })
    expect(files).toEqual({ product: layout, frame, logo })
  })

  it('沒有選框版或 Logo 時不產生空圖層', () => {
    const { scene, files } = planBrandScene({ canvas, product: layout, logoScale: 25, logoX: 0, logoY: 0, logoOpacity: 100 })

    expect(scene.layers.map(layer => layer.kind)).toEqual(['product'])
    expect(files).toEqual({ product: layout })
  })

  it('框版與 Logo 依圖層順序疊在版型結果之上', () => {
    const { scene } = planBrandScene({ canvas, product: layout, logo, logoScale: 100, logoX: 0, logoY: 0, logoOpacity: 100 })

    expect(scene.layers.map(layer => layer.id)).toEqual(['product', 'logo'])
  })
})

describe('輸出檔名', () => {
  it('依用途與格式命名，不含任何來源檔名', () => {
    expect(workbenchOutputName('compliant', 'image/jpeg')).toBe('compliant-product-image.jpg')
    expect(workbenchOutputName('compliant', 'image/webp')).toBe('compliant-product-image.webp')
    expect(workbenchOutputName('promotional', 'image/png')).toBe('brand-promo-image.png')
  })
})
