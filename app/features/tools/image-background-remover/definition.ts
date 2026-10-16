import type { PublishedToolDefinition } from '../catalog'
import { backgroundRemovalAssets } from './domain/model'

export const imageBackgroundRemoverDefinition: PublishedToolDefinition = {
  slug: 'image-background-remover', category: 'image-commerce', icon: 'image',
  availability: { state: 'published', publishedAt: '2026-09-08' },
  status: { kind: 'new', startsAt: '2026-09-08', endsAt: '2026-10-08' },
  name: { 'zh-tw': '人像去背', en: 'Portrait Background Remover' },
  description: { 'zh-tw': '在裝置上把一張或多張人像從背景分離，下載透明 PNG。', en: 'Separate people from the background of one photo or a batch on your device and download transparent PNGs.' },
  aliases: { 'zh-tw': ['人像去背', '照片去背', '透明背景'], en: ['remove background', 'portrait cutout', 'transparent background'] },
  keywords: { 'zh-tw': ['人像', '去背', '透明', 'PNG', '本機'], en: ['portrait', 'background', 'transparent', 'PNG', 'local'] },
  processingClass: 'worker', routeComponentKey: 'ImageBackgroundRemoverWorkspace',
  offlineMode: 'requires-first-download', offlineAssets: backgroundRemovalAssets,
  capabilities: ['javascript', 'web-worker', 'wasm'],
  acceptedInput: { 'zh-tw': '一次一張或多張含人像的 JPEG、PNG、WebP，最多 20 張、合計 200 MiB；每張最多 25 MiB、2,400 萬像素、單邊 8,192 像素。不支援 HEIC／HEIF，也不處理商品或風景。', en: 'One or more JPEG, PNG, or WebP photos containing a person, up to 20 and 200 MiB in all; each up to 25 MiB, 24 megapixels, and 8,192 pixels per side. HEIC/HEIF is not supported, and products or scenery are out of scope.' },
  localProcessingStatement: { 'zh-tw': '模型在你的瀏覽器裡執行，圖片、遮罩與輸出不會傳送或自動保存。', en: 'The model runs inside your browser; images, mattes, and output are never sent or automatically saved.' },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true, workspace: 'wide' },
  seo: {
    contentKey: 'image-background-remover',
    title: { 'zh-tw': '人像去背：在瀏覽器本機去背並下載透明 PNG', en: 'Portrait Background Remover: local cutouts, transparent PNG' },
    description: { 'zh-tw': '人像照片不離開裝置。AI 模型在瀏覽器本機執行，分離人物與背景後逐張或打包下載透明 PNG；用過一次後離線也能使用，不支援 HEIC／HEIF，也不處理商品圖。', en: 'Keep portrait photos on your device. An AI model runs locally in your browser to separate people from the background and download transparent PNGs one by one or as a ZIP. It works offline after you use it once; HEIC/HEIF and product photos are not supported.' },
    answer: { 'zh-tw': '這是人像去背：模型只學過把人和背景分開，商品、動物與風景不在範圍內。第一次使用時，選好照片就會自動準備去背功能，用過一次後，離線也能使用；髮絲、半透明與低對比邊緣不保證準確，請檢查邊緣後再使用。', en: 'This is portrait matting: the model was trained to separate people from a background, so products, animals, and scenery are out of scope. On first use it gets ready on its own as soon as you choose a photo, and after you use it once it works offline too. Hair, semi-transparent areas, and low-contrast edges are not guaranteed, so check the edges before using the result.' },
  },
}
