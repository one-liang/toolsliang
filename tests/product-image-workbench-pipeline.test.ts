import { describe, expect, it } from 'vitest'
import {
  planBrandScene,
  planCompressionInput,
  planLayoutInput,
  workbenchCanvasBounds,
} from '@/features/tools/product-image-workbench/pipeline'
import { describeSizeIssue } from '@/features/tools/compliant-product-image/domain/render'
import { imageInputLimits } from '@/features/images/limits'

const settings = {
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
  it('畫布只受本機處理上限限制，任何長寬比都可以', () => {
    expect(workbenchCanvasBounds).toEqual({
      minWidth: 1,
      maxWidth: imageInputLimits.maxSide,
      minHeight: 1,
      maxHeight: imageInputLimits.maxSide,
      maxPixels: imageInputLimits.maxPixels,
    })
    expect(describeSizeIssue(workbenchCanvasBounds, 900, 1600)).toBeUndefined()
    expect(describeSizeIssue(workbenchCanvasBounds, 9000, 1000)).toBe('too-large')
  })
})

describe('版型步驟交給算繪引擎的輸入', () => {
  it('設定原樣交給算繪引擎，不附帶任何容量範圍', () => {
    const input = planLayoutInput({ file: product, settings })

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
    })
  })

  it('去背結果會取代原圖成為版型步驟的輸入', () => {
    const cutout = new File([new Uint8Array([137, 80])], 'cutout.png', { type: 'image/png' })
    expect(planLayoutInput({ file: cutout, settings }).file).toBe(cutout)
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

describe('壓縮步驟交給壓縮引擎的輸入', () => {
  it('百分比設定換成引擎的品質比例，尺寸受本機處理上限限制', () => {
    const input = planCompressionInput({ file: product, settings: { format: 'image/jpeg', quality: 80, maxWidth: 20_000, maxHeight: 1200 } })

    expect(input).toEqual({ file: product, format: 'image/jpeg', quality: 0.8, maxWidth: imageInputLimits.maxSide, maxHeight: 1200 })
  })

  it('超出範圍的品質被拉回引擎接受的區間，不會送出無效選項', () => {
    expect(planCompressionInput({ file: product, settings: { format: 'image/png', quality: 0, maxWidth: 800, maxHeight: 800 } }).quality).toBe(0.01)
    expect(planCompressionInput({ file: product, settings: { format: 'image/png', quality: 400, maxWidth: 800, maxHeight: 800 } }).quality).toBe(1)
  })
})
