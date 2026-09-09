import { expect, it } from 'vitest'
import { createPromoHistory, createPromoLayer, serializePromoScene, promoPlacement } from '@/features/tools/brand-promo-image/scene'

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
