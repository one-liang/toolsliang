import { expect, it } from 'vitest'
import { createPromoRenderer } from '@/features/tools/brand-promo-image/engine'
import { createPromoLayer } from '@/features/tools/brand-promo-image/scene'

it('資產缺失與 HEIC 在 Worker 解碼前回報可恢復錯誤', async () => {
  const engine = createPromoRenderer()
  const scene = { width: 1000, height: 1000, layers: [createPromoLayer('logo', 'logo')] }
  expect(await engine.run({ scene, files: {} })).toMatchObject({ status: 'error', error: { code: 'missing_asset' } })
  expect(await engine.run({ scene, files: { logo: new File(['x'], 'logo.heic') } })).toMatchObject({ status: 'error', error: { code: 'unsupported_heic' } })
  engine.dispose()
})

it.each([
  { width: 9000, height: 1000 },
  { width: 6000, height: 5000 },
  { width: 1.5, height: 1000 },
  { width: 0, height: 1000 },
])('不合法輸出尺寸不開始工作：%j', async (size) => {
  const engine = createPromoRenderer()
  expect(await engine.run({ scene: { ...size, layers: [createPromoLayer('logo', 'logo')] }, files: {} })).toMatchObject({ status: 'error', error: { code: 'invalid_options' } })
  engine.dispose()
})

it('已取消的工作不會讀取圖片；釋放後不可重啟', async () => {
  const engine = createPromoRenderer()
  const input = { scene: { width: 1000, height: 1000, layers: [createPromoLayer('logo', 'logo')] }, files: {} }
  const controller = new AbortController(); controller.abort()
  expect(await engine.run(input, { signal: controller.signal })).toEqual({ status: 'cancelled' })
  engine.dispose()
  expect(await engine.run(input)).toMatchObject({ status: 'error', error: { code: 'disposed' } })
})
