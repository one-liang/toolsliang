import { expect, it } from 'vitest'
import { getTool } from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'
it('中英文目錄與 FAQ 說明品牌宣傳圖的本機保存及產品邊界', () => {
  const tool = getTool('brand-promo-image')
  expect(tool?.routeComponentKey).toBe('BrandPromoImageWorkspace')
  expect(tool?.localProcessingStatement['zh-tw']).toContain('裝置')
  expect(getToolFaq('brand-promo-image', 'en').map(item => item.body).join(' ')).toContain('text')
})
