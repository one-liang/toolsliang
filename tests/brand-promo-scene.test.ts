import { describe, expect, it } from 'vitest'
import { createPromoHistory, createPromoLayer, movePromoLayer, pickPromoLayer, promoPlacement, promoScaleRange, reorderPromoLayers, resizePromoLayer, serializePromoScene } from '@/features/tools/brand-promo-image/scene'

it('圖層可調整順序與定位，復原重做後仍保持無像素的場景文件', () => {
  const product = createPromoLayer('product', 'local-product')
  const logo = createPromoLayer('logo', 'saved-logo')
  const history = createPromoHistory({ width: 1000, height: 800, layers: [product, logo] })
  history.commit({ ...history.scene, layers: [{ ...logo, x: 0.1, scale: 0.5 }, product] })
  expect(history.scene.layers.map(layer => layer.assetId)).toEqual(['saved-logo', 'local-product'])
  expect(promoPlacement(history.scene.layers[0]!, 200, 100, 1000, 800)).toEqual({ x: 350, y: 275, width: 500, height: 250 })
  history.undo()
  expect(history.scene.layers[0]?.kind).toBe('product')
  history.redo()
  expect(JSON.parse(serializePromoScene(history.scene))).toEqual(history.scene)
  expect(serializePromoScene(history.scene)).not.toMatch(/pixels|data:|blob:/)
})

it('復原後的新調整會替換重做分支，顯示狀態與透明度可復原', () => {
  const logo = createPromoLayer('logo', 'saved-logo')
  const history = createPromoHistory({ width: 1000, height: 1000, layers: [logo] })
  history.commit({ ...history.scene, layers: [{ ...logo, visible: false, opacity: 0.5 }] })
  history.undo()
  expect(history.scene.layers[0]).toMatchObject({ visible: true, opacity: 1 })
  history.commit({ ...history.scene, layers: [{ ...logo, scale: 2 }] })
  expect(history.canRedo).toBe(false)
  expect(history.scene.layers[0]).toMatchObject({ visible: true, opacity: 1, scale: 2 })
})

it('完整放入與填滿裁切使用不同的比例，負位移與非正方形畫布一致', () => {
  const layer = { ...createPromoLayer('product', 'product'), x: -0.1, y: 0.1 }
  expect(promoPlacement(layer, 200, 100, 1000, 1000)).toEqual({ x: -100, y: 350, width: 1000, height: 500 })
  expect(promoPlacement({ ...layer, fit: 'cover' }, 200, 100, 1000, 1000)).toEqual({ x: -600, y: 100, width: 2000, height: 1000 })
})

describe('在預覽上直接操作圖層', () => {
  const canvas = { width: 1000, height: 1000 }
  const source = { width: 200, height: 100 }
  const logo = () => ({ ...createPromoLayer('logo', 'logo'), scale: 0.5 })

  it('拖曳以畫布像素換算位置，Shift 只沿移動較多的方向，且不超出渲染器接受的範圍', () => {
    expect(movePromoLayer(logo(), { x: 100, y: -50 }, canvas)).toEqual({ x: 0.1, y: -0.05 })
    expect(movePromoLayer(logo(), { x: 100, y: -50 }, canvas, { constrain: true })).toEqual({ x: 0.1, y: 0 })
    expect(movePromoLayer(logo(), { x: 5000, y: -5000 }, canvas)).toEqual({ x: 1, y: -1 })
  })

  it('拉角預設等比縮放，對角固定不動', () => {
    const layer = logo()
    const before = promoPlacement(layer, source.width, source.height, canvas.width, canvas.height)
    const patch = resizePromoLayer(layer, 'se', { x: 100, y: 50 }, source, canvas)
    const after = promoPlacement({ ...layer, ...patch }, source.width, source.height, canvas.width, canvas.height)
    expect(patch.scaleY).toBeUndefined()
    expect(after.width / after.height).toBeCloseTo(before.width / before.height, 6)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
    expect(after.width).toBeCloseTo(before.width + 100, 6)
  })

  it('按住 Shift 拉角自由縮放，拉邊只拉伸一個方向，並記成 scaleY', () => {
    const layer = logo()
    const free = resizePromoLayer(layer, 'se', { x: 100, y: 0 }, source, canvas, { proportional: false })
    // 200 × 100 contained in 1000 × 1000 is 1000 px wide at 100%, so 500 px becomes 600 px.
    expect(free.scale).toBeCloseTo(0.6, 6)
    expect(free.scaleY).toBeCloseTo(0.5, 6)
    const stretched = resizePromoLayer(layer, 'n', { x: 0, y: -50 }, source, canvas)
    expect(stretched.scale).toBeCloseTo(0.5, 6)
    expect(stretched.scaleY).toBeCloseTo(0.6, 6)
    const box = promoPlacement({ ...layer, ...stretched }, source.width, source.height, canvas.width, canvas.height)
    // The bottom edge is the anchor when the top edge is pulled.
    expect(box.y + box.height).toBeCloseTo(promoPlacement(layer, source.width, source.height, canvas.width, canvas.height).y + 250, 6)
  })

  it('按住 Alt 從中心縮放，位置不變；已拉伸的圖層等比縮放時保留拉伸比例', () => {
    const layer = { ...logo(), x: 0.2, scaleY: 1 }
    const patch = resizePromoLayer(layer, 'se', { x: 50, y: 50 }, source, canvas, { fromCenter: true })
    expect(patch.x).toBeCloseTo(0.2, 6)
    expect(patch.y).toBeCloseTo(0, 6)
    expect(patch.scaleY! / patch.scale).toBeCloseTo(2, 6)
  })

  it('縮放停在渲染器接受的 1%–400% 之間', () => {
    const tiny = resizePromoLayer(logo(), 'se', { x: -5000, y: -5000 }, source, canvas)
    const huge = resizePromoLayer(logo(), 'se', { x: 50_000, y: 50_000 }, source, canvas)
    for (const value of [tiny.scale, tiny.scaleY ?? tiny.scale, huge.scale, huge.scaleY ?? huge.scale]) {
      expect(value).toBeGreaterThanOrEqual(promoScaleRange.min)
      expect(value).toBeLessThanOrEqual(promoScaleRange.max)
    }
  })

  it('圖層順序可移到任一位置，沒有變化時回傳同一份清單', () => {
    const layers = ['a', 'b', 'c'].map(id => ({ ...createPromoLayer('logo', id), id }))
    expect(reorderPromoLayers(layers, 'a', 2).map(layer => layer.id)).toEqual(['b', 'c', 'a'])
    expect(reorderPromoLayers(layers, 'c', -5).map(layer => layer.id)).toEqual(['c', 'a', 'b'])
    expect(reorderPromoLayers(layers, 'b', 1)).toBe(layers)
  })

  it('點選時依實際有顏色的像素挑最上層：框版透明的中間會選到下面的商品', () => {
    const product = { ...createPromoLayer('product', 'product'), id: 'product' }
    const frame = { ...createPromoLayer('frame', 'frame'), id: 'frame' }
    const hidden = { ...createPromoLayer('logo', 'logo'), id: 'hidden', visible: false }
    const layers = [product, frame, hidden]
    const boxOf = () => ({ x: 0, y: 0, width: 100, height: 100 })
    // The frame only has paint near its edges.
    const opaqueAt = (layer: { id: string }, u: number, v: number) => layer.id === 'product' ? u > 0.25 && u < 0.75 : Math.min(u, v, 1 - u, 1 - v) < 0.1
    expect(pickPromoLayer(layers, { x: 50, y: 50 }, { boxOf, opaqueAt })?.id).toBe('product')
    expect(pickPromoLayer(layers, { x: 2, y: 50 }, { boxOf, opaqueAt })?.id).toBe('frame')
    // Only transparent pixels under the pointer: the selected layer wins, then the topmost box.
    expect(pickPromoLayer(layers, { x: 15, y: 50 }, { boxOf, opaqueAt, selectedId: 'product' })?.id).toBe('product')
    expect(pickPromoLayer(layers, { x: 15, y: 50 }, { boxOf, opaqueAt })?.id).toBe('frame')
    expect(pickPromoLayer(layers, { x: 500, y: 500 }, { boxOf, opaqueAt })).toBeUndefined()
  })
})
