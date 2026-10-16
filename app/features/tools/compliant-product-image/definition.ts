import type { UnpublishedToolDefinition } from '../catalog'

/**
 * The standalone page was withdrawn (ADR-0019), and the channel presets, rule
 * checks and sources behind the workbench's compliant branch went after it
 * (ADR-0022). Only the layout renderer in this folder is still in use, by the
 * workbench's layout step. The slug stays registered as unpublished so nothing
 * else can claim it and a device that saved it is cleaned against the registry.
 */
export const compliantProductImageDefinition: UnpublishedToolDefinition = {
  slug: 'compliant-product-image', category: 'image-commerce', icon: 'shopping-bag',
  availability: { state: 'unpublished', reason: { 'zh-tw': '已移除；商品圖工作台不再依通路規格產生主圖。', en: 'Removed; the product image workbench no longer produces images against channel specifications.' } },
  name: { 'zh-tw': '合規主圖', en: 'Compliant Product Image' },
  description: { 'zh-tw': '依已查核的通路公開規格，在裝置上裁切與縮放商品圖。', en: 'Crop and scale a product image on your device against a reviewed public channel specification.' },
  aliases: { 'zh-tw': [], en: [] }, keywords: { 'zh-tw': [], en: [] },
}
