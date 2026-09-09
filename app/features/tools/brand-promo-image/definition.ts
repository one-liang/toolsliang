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
  localProcessingStatement: { 'zh-tw': '圖片、背景、框版、Logo、圖層與輸出只留在這台裝置；只有你主動保存的資產會存入本機資料庫。', en: 'Images, backgrounds, frames, Logos, layers, and output stay on this device. Only assets you explicitly save enter the local database.' },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true },
  seo: {
    contentKey: 'brand-promo-image',
    title: { 'zh-tw': '品牌宣傳圖：本機組合背景、框版與 Logo', en: 'Brand Promo Image: local backgrounds, frames, and Logos' },
    description: { 'zh-tw': '圖片不離開裝置。匯入商品圖、背景、框版與 Logo，以鍵盤調整圖層並下載 PNG，主動保存的素材可在同一裝置重用。', en: 'Keep images on your device. Import products, backgrounds, frames, and Logos, adjust layers with the keyboard, and download PNG. Reuse explicitly saved assets on the same device.' },
    answer: { 'zh-tw': '匯入圖片後選取圖層，以數字調整位置、縮放與順序，預覽後下載透明 PNG。第一版只提供背景、框版與 Logo 組合，不含文字或價籤，也不保證符合通路主圖規範。', en: 'Import images, select a layer, and adjust position, scale, and order with numeric controls. Preview and download a transparent PNG. Version one combines backgrounds, frames, and Logos without text or price tags and makes no marketplace main-image compliance claim.' },
  },
  contentReview: {
    reviewedAt: '2026-09-09', sourceEffectiveAt: '2026-09-09',
    sourceEdition: { 'zh-tw': '品牌宣傳圖第一版產品規格與本機資產決策', en: 'Brand Promo Image v1 specification and local asset decisions' },
    sources: [{ title: { 'zh-tw': '品牌宣傳圖產品邊界', en: 'Promotional image product boundary' }, url: 'https://github.com/one-liang/toolsliang/blob/develop/docs/adr/0012-separate-compliant-and-promotional-product-images.md' }],
  },
}
