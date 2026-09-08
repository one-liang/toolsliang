import type { PublishedToolDefinition } from '../catalog'
import { backgroundRemovalAssets } from './domain/model'

export const imageBackgroundRemoverDefinition: PublishedToolDefinition = {
  slug: 'image-background-remover', category: 'image-commerce', icon: 'image',
  availability: { state: 'published', publishedAt: '2026-09-08' },
  status: { kind: 'new', startsAt: '2026-09-08', endsAt: '2026-10-08' },
  name: { 'zh-tw': '人像去背', en: 'Portrait Background Remover' },
  description: { 'zh-tw': '在裝置上把人像從背景分離，下載透明 PNG。', en: 'Separate a person from the background on your device and download a transparent PNG.' },
  aliases: { 'zh-tw': ['人像去背', '照片去背', '透明背景'], en: ['remove background', 'portrait cutout', 'transparent background'] },
  keywords: { 'zh-tw': ['人像', '去背', '透明', 'PNG', '本機'], en: ['portrait', 'background', 'transparent', 'PNG', 'local'] },
  processingClass: 'worker', routeComponentKey: 'ImageBackgroundRemoverWorkspace',
  offlineMode: 'requires-first-download', offlineAssets: backgroundRemovalAssets,
  capabilities: ['javascript', 'web-worker', 'wasm'],
  acceptedInput: { 'zh-tw': '單張含人像的 JPEG、PNG 或 WebP；最多 25 MiB、2,400 萬像素、單邊 8,192 像素。不支援 HEIC／HEIF，也不處理商品或風景。', en: 'One JPEG, PNG, or WebP containing a person; up to 25 MiB, 24 megapixels, 8,192 pixels per side. HEIC/HEIF is not supported, and products or scenery are out of scope.' },
  localProcessingStatement: { 'zh-tw': '模型在你的瀏覽器裡執行，圖片、遮罩與輸出不會傳送或自動保存。', en: 'The model runs inside your browser; images, mattes, and output are never sent or automatically saved.' },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true },
  seo: {
    contentKey: 'image-background-remover',
    title: { 'zh-tw': '人像去背：在瀏覽器本機去背並下載透明 PNG', en: 'Portrait Background Remover: local cutouts, transparent PNG' },
    description: { 'zh-tw': '人像照片不離開裝置。AI 模型在瀏覽器本機執行，分離人物與背景後下載透明 PNG；首次使用需下載模型，不支援 HEIC／HEIF，也不處理商品圖。', en: 'Keep portrait photos on your device. An AI model runs locally in your browser to separate a person from the background and download a transparent PNG. First use downloads the model; HEIC/HEIF and product photos are not supported.' },
    answer: { 'zh-tw': '這是人像去背：模型只學過把人和背景分開，商品、動物與風景不在範圍內。首次使用會下載模型與推論資源到這台裝置，之後即使離線也能使用；髮絲、半透明與低對比邊緣不保證準確，請放大檢查後再使用。', en: 'This is portrait matting: the model was trained to separate people from a background, so products, animals, and scenery are out of scope. First use downloads the model and runtime to this device and later runs work offline. Hair, semi-transparent areas, and low-contrast edges are not guaranteed, so zoom in and check before using the result.' },
  },
  contentReview: {
    reviewedAt: '2026-09-08', sourceEffectiveAt: '2026-09-07',
    sourceEdition: { 'zh-tw': 'toolsliang 去背模型評估紀錄 007 與 MODNet、ONNX Runtime Web 一手來源（2026-09-07 查閱）', en: 'toolsliang background removal evaluation record 007, with the MODNet and ONNX Runtime Web primary sources (accessed September 7, 2026)' },
    sources: [
      { title: { 'zh-tw': 'MODNet 程式庫與 Apache-2.0 授權', en: 'MODNet repository and Apache-2.0 licence' }, url: 'https://github.com/ZHKKKe/MODNet/blob/master/LICENSE' },
      { title: { 'zh-tw': 'ONNX Runtime Web 執行提供者', en: 'ONNX Runtime Web execution providers' }, url: 'https://onnxruntime.ai/docs/execution-providers/' },
      { title: { 'zh-tw': 'W3C WebAssembly Core 2.0', en: 'W3C WebAssembly Core 2.0' }, url: 'https://www.w3.org/TR/wasm-core-2/' },
      { title: { 'zh-tw': 'PNG 圖片格式', en: 'PNG format' }, url: 'https://www.w3.org/TR/png-3/' },
    ],
  },
}
