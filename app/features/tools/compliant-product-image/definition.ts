import type { UnpublishedToolDefinition } from '../catalog'

/**
 * The standalone page was withdrawn (ADR-0019). The compliant branch of the
 * product image workbench still runs on this module's presets and renderer, so
 * only the page went away; the slug stays registered as unpublished so nothing
 * else can claim it and a device that saved it is cleaned against the registry.
 */
export const compliantProductImageDefinition: UnpublishedToolDefinition = {
  slug: 'compliant-product-image', category: 'image-commerce', icon: 'shopping-bag',
  availability: { state: 'unpublished', reason: { 'zh-tw': '獨立工具頁已移除，合規輸出保留在商品圖工作台。', en: 'The standalone page was withdrawn; compliant output stays in the product image workbench.' } },
  name: { 'zh-tw': '合規主圖', en: 'Compliant Product Image' },
  description: { 'zh-tw': '依已查核的通路公開規格，在裝置上裁切與縮放商品圖。', en: 'Crop and scale a product image on your device against a reviewed public channel specification.' },
  aliases: { 'zh-tw': [], en: [] }, keywords: { 'zh-tw': [], en: [] },
}
