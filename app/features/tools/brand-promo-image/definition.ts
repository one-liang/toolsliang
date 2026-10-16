import type { PublishedToolDefinition } from '../catalog'
export const brandPromoImageDefinition: PublishedToolDefinition = {
  slug: 'brand-promo-image', category: 'image-commerce', icon: 'image',
  availability: { state: 'published', publishedAt: '2026-09-09' },
  name: { 'zh-tw': '品牌宣傳圖', en: 'Brand Promo Image' },
  description: { 'zh-tw': '在本機為商品圖組合背景、框版與 Logo。', en: 'Combine a product image with backgrounds, frames, and Logos locally.' },
  aliases: { 'zh-tw': ['品牌素材', '商品宣傳圖'], en: ['promotional image', 'brand composition'] },
  keywords: { 'zh-tw': ['框版', 'Logo', '背景', '圖層'], en: ['frame', 'Logo', 'background', 'layers'] },
  processingClass: 'worker', routeComponentKey: 'BrandPromoImageWorkspace', offlineMode: 'ready', capabilities: ['javascript', 'web-worker'],
  acceptedInput: { 'zh-tw': 'JPEG、PNG、WebP；每張最多 25 MiB、2,400 萬像素、單邊 8,192 像素；最多 12 個圖層。不支援 HEIC／HEIF。', en: 'JPEG, PNG, WebP; up to 25 MiB, 24 megapixels, 8,192 pixels per side per image; up to 12 layers. HEIC/HEIF is not supported.' },
  localProcessingStatement: { 'zh-tw': '圖片、背景、框版、Logo、圖層與輸出只留在這台裝置，不會上傳；關掉頁面後也不會保存。', en: 'Images, backgrounds, frames, Logos, layers, and output stay on this device and are never uploaded, and nothing is kept once you close the page.' },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true },
  seo: {
    contentKey: 'brand-promo-image',
    title: { 'zh-tw': '品牌宣傳圖：本機組合背景、框版與 Logo', en: 'Brand Promo Image: local backgrounds, frames, and Logos' },
    description: { 'zh-tw': '圖片不離開裝置。加入商品圖、背景、框版與 Logo，拖曳或用數字調整圖層，再下載透明 PNG。', en: 'Keep images on your device. Add a product image, background, frame, and Logo, adjust layers by dragging or with numbers, and download a transparent PNG.' },
    answer: { 'zh-tw': '加入圖片後，在預覽上拖曳圖層，或用數字調整位置、縮放與上下順序，再下載透明 PNG。第一版只提供背景、框版與 Logo 組合，不含文字或價籤，也不保證符合通路主圖規範。', en: 'Add images, then drag layers on the preview or use numbers to set position, scale, and order, and download a transparent PNG. Version one combines backgrounds, frames, and Logos without text or price tags and makes no marketplace main-image compliance claim.' },
  },
}
