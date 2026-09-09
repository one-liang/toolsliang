import type { PublishedToolDefinition } from '../catalog'
import { compliantImageContentReview } from './domain/sources'

export const compliantProductImageDefinition: PublishedToolDefinition = {
  slug: 'compliant-product-image', category: 'image-commerce', icon: 'shopping-bag',
  availability: { state: 'published', publishedAt: '2026-09-08' },
  status: { kind: 'new', startsAt: '2026-09-08', endsAt: '2026-10-08' },
  name: { 'zh-tw': '合規主圖', en: 'Compliant Product Image' },
  description: { 'zh-tw': '依已查核的通路公開規格，在裝置上裁切與縮放商品圖。', en: 'Crop and scale a product image on your device against a reviewed public channel specification.' },
  aliases: { 'zh-tw': ['電商主圖', '通路主圖規格', '商品圖尺寸'], en: ['marketplace main image', 'channel image spec', 'product image size'] },
  keywords: { 'zh-tw': ['主圖', '尺寸', '長寬比', '容量', 'momo', '露天'], en: ['main image', 'dimensions', 'aspect ratio', 'file size', 'Amazon', 'Google'] },
  processingClass: 'worker', routeComponentKey: 'CompliantProductImageWorkspace', offlineMode: 'ready',
  capabilities: ['javascript', 'web-worker'],
  acceptedInput: { 'zh-tw': '單張 JPEG、PNG 或 WebP 商品圖；最多 25 MiB、2,400 萬像素、單邊 8,192 像素。不支援 HEIC／HEIF。', en: 'One JPEG, PNG, or WebP product image; up to 25 MiB, 24 megapixels, 8,192 pixels per side. HEIC/HEIF is not supported.' },
  localProcessingStatement: { 'zh-tw': '商品圖片、裁切參數、預覽與輸出只在這台裝置上處理，不會傳送或自動保存。', en: 'Product images, crop settings, previews, and outputs are handled only on this device; nothing is sent or saved automatically.' },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true },
  seo: {
    contentKey: 'compliant-product-image',
    title: { 'zh-tw': '合規主圖：依通路公開規格在本機裁切商品圖', en: 'Compliant Product Image: crop to a channel specification, locally' },
    description: { 'zh-tw': '商品圖不離開裝置。依 Google、Amazon、momo 與露天已查核的公開規格調整尺寸、長寬比、格式與容量，每個 preset 都標示來源與查核日期。', en: 'Product images stay on your device. Match the reviewed public specifications from Google, Amazon, momo, and Ruten for size, ratio, format, and capacity, with the source and review date shown for every preset.' },
    answer: { 'zh-tw': '選一個通路 preset，工具會在本機把商品圖裁切、縮放並輸出成該通路載明的尺寸、長寬比、格式與容量，並逐條列出它檢查了什麼、只提供輔助的是什麼，以及哪些要你自己確認。規格輔助，不保證通路審核通過；每個 preset 都附來源網址與查核日期，超過效期即停用。', en: 'Pick a channel preset and the tool crops, scales, and writes the image locally to the size, ratio, format, and capacity that channel published, then lists what it checked, what it only assisted with, and what is yours to confirm. Specification guidance, not a guarantee of channel approval — every preset carries its source URL and review date, and is disabled once that date lapses.' },
  },
  contentReview: compliantImageContentReview,
}
