import type { PublishedToolDefinition } from '../catalog'
export const imageCompressorDefinition: PublishedToolDefinition = {
  slug: 'image-compressor', category: 'image-commerce', icon: 'image',
  availability: { state: 'published', publishedAt: '2026-09-07' },
  name: { 'zh-tw': '圖片壓縮', en: 'Image Compressor' },
  description: { 'zh-tw': '在裝置上調整圖片品質、尺寸與格式，比較後下載。', en: 'Adjust image quality, size, and format on your device, compare, and download.' },
  aliases: { 'zh-tw': ['照片壓縮', '圖片縮小'], en: ['photo compressor', 'resize image'] },
  keywords: { 'zh-tw': ['JPEG', 'PNG', 'WebP', '品質', '透明'], en: ['JPEG', 'PNG', 'WebP', 'quality', 'transparency'] },
  processingClass: 'worker', routeComponentKey: 'ImageCompressorWorkspace', offlineMode: 'ready', capabilities: ['javascript', 'web-worker'],
  acceptedInput: { 'zh-tw': '單張 JPEG、PNG 或 WebP；最多 25 MiB、2,400 萬像素、單邊 8,192 像素。不支援 HEIC／HEIF。', en: 'One JPEG, PNG, or WebP; up to 25 MiB, 24 megapixels, 8,192 pixels per side. HEIC/HEIF is not supported.' },
  localProcessingStatement: { 'zh-tw': '圖片、預覽與輸出只在此裝置處理，不傳送或自動保存。', en: 'Images, previews, and output are processed only on this device, never sent or automatically saved.' },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true },
  seo: {
    contentKey: 'image-compressor',
    title: { 'zh-tw': '圖片壓縮：本機調整 JPEG、PNG、WebP 品質與尺寸', en: 'Image Compressor: resize JPEG, PNG, and WebP locally' },
    description: { 'zh-tw': '圖片不離開裝置。調整 JPEG、PNG、WebP 的尺寸、品質與格式，比較預覽與大小後下載；不支援 HEIC／HEIF。', en: 'Keep images on your device. Resize and convert JPEG, PNG, and WebP, compare previews and sizes, then download. HEIC/HEIF is not supported.' },
    answer: { 'zh-tw': 'JPEG／WebP 品質調整為有損編碼；PNG 不使用品質參數。輸出不保證更小，請先比較大小。重新編碼不複製原始中繼資料；保留原檔以供封存。', en: 'JPEG/WebP quality adjustment uses lossy encoding; PNG ignores quality. Output is not guaranteed to be smaller. Compare sizes first. Re-encoding does not copy source metadata; keep originals for archival use.' },
  },
  contentReview: {
    reviewedAt: '2026-09-07', sourceEffectiveAt: '2026-09-07',
    sourceEdition: { 'zh-tw': 'WHATWG Canvas／ImageBitmap 與圖片格式規格（2026-09-07 查閱）', en: 'WHATWG Canvas/ImageBitmap and image format specifications (accessed September 7, 2026)' },
    sources: [
      { title: { 'zh-tw': 'HTML Canvas 編碼規格', en: 'HTML Canvas encoding' }, url: 'https://html.spec.whatwg.org/multipage/canvas.html' },
      { title: { 'zh-tw': 'ImageBitmap 方向處理', en: 'ImageBitmap orientation' }, url: 'https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html' },
      { title: { 'zh-tw': 'PNG 圖片格式', en: 'PNG format' }, url: 'https://www.w3.org/TR/png-3/' },
      { title: { 'zh-tw': 'WebP 圖片格式', en: 'WebP format' }, url: 'https://www.rfc-editor.org/rfc/rfc9649.html' },
    ],
  },
}
