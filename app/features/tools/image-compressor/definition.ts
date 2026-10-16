import type { PublishedToolDefinition } from '../catalog'
export const imageCompressorDefinition: PublishedToolDefinition = {
  slug: 'image-compressor', category: 'image-commerce', icon: 'image',
  availability: { state: 'published', publishedAt: '2026-09-07' },
  name: { 'zh-tw': '圖片壓縮', en: 'Image Compressor' },
  description: { 'zh-tw': '在裝置上以建議品質壓縮一張或多張圖片、維持原尺寸，比較後下載。', en: 'Compress one image or a batch on your device at a recommended quality, keep their dimensions, compare, and download.' },
  aliases: { 'zh-tw': ['照片壓縮', '圖片縮小'], en: ['photo compressor', 'reduce image size'] },
  keywords: { 'zh-tw': ['JPEG', 'PNG', 'WebP', '品質', '透明'], en: ['JPEG', 'PNG', 'WebP', 'quality', 'transparency'] },
  processingClass: 'worker', routeComponentKey: 'ImageCompressorWorkspace', offlineMode: 'ready', capabilities: ['javascript', 'web-worker'],
  acceptedInput: { 'zh-tw': '一次一張或多張 JPEG、PNG、WebP，最多 20 張、合計 200 MiB；每張最多 25 MiB、2,400 萬像素、單邊 8,192 像素。不支援 HEIC／HEIF。', en: 'One or more JPEG, PNG, or WebP images at a time, up to 20 and 200 MiB in all; each up to 25 MiB, 24 megapixels, and 8,192 pixels per side. HEIC/HEIF is not supported.' },
  localProcessingStatement: { 'zh-tw': '圖片、預覽與輸出只在此裝置處理，不傳送或自動保存。', en: 'Images, previews, and output are processed only on this device, never sent or automatically saved.' },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true, workspace: 'wide' },
  seo: {
    contentKey: 'image-compressor',
    title: { 'zh-tw': '圖片壓縮：本機壓縮 JPEG、PNG、WebP，維持原尺寸', en: 'Image Compressor: compress JPEG, PNG, and WebP locally' },
    description: { 'zh-tw': '圖片不離開裝置。一次壓縮一張或多張 JPEG、PNG、WebP 並維持原尺寸，比較預覽與大小後逐張或打包下載；不支援 HEIC／HEIF。', en: 'Keep images on your device. Compress one or many JPEG, PNG, and WebP images at a recommended quality without resizing, compare previews and sizes, then download them one by one or as a ZIP. HEIC/HEIF is not supported.' },
    answer: { 'zh-tw': 'JPEG 與 WebP 會以建議品質 80 重新壓縮，畫質略降換取較小的檔案，圖片尺寸不變；PNG 不受品質設定影響。格式不變時，輸出不會比原檔大；換格式時請先比較大小再下載。輸出不帶原圖的拍攝資訊與位置，原檔請自行保留。', en: 'JPEG and WebP are recompressed at a recommended quality of 80, trading a little detail for a smaller file, and keep their dimensions; PNG ignores the quality setting. With the same format, the output is never larger than the original; compare sizes before downloading when you switch formats. The output leaves out the original’s shooting details and location, so keep your originals.' },
  },
}
