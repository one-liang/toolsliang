import type { PublishedToolDefinition } from '../catalog'

/**
 * `offlineMode` is `ready` on purpose. The workbench itself needs nothing but
 * the App Shell cache: the layout, the compression and the downloads all run
 * offline after the first load. Only the optional cutout needs the portrait
 * model, and it is fetched when the cutout is ticked with photos chosen, so a
 * visitor is never told the whole tool requires megabytes it may never use.
 */
export const productImageWorkbenchDefinition: PublishedToolDefinition = {
  slug: 'product-image-workbench', category: 'image-commerce', icon: 'shopping-bag',
  availability: { state: 'published', publishedAt: '2026-09-09' },
  status: { kind: 'new', startsAt: '2026-09-09', endsAt: '2026-10-09' },
  name: { 'zh-tw': '商品圖工作台', en: 'Product Image Workbench' },
  description: { 'zh-tw': '一次放入多張商品圖，勾選去背、套版、壓縮，按一次就整批完成。', en: 'Add a batch of product photos, tick cutout, layout, or compression, and finish them all with one press.' },
  aliases: { 'zh-tw': ['商品圖流程', '上架圖工作台'], en: ['product image pipeline', 'listing image workbench'] },
  keywords: { 'zh-tw': ['去背', '套版', '框版', 'Logo', '壓縮'], en: ['cutout', 'layout', 'frame', 'Logo', 'compression'] },
  processingClass: 'worker', routeComponentKey: 'ProductImageWorkbenchWorkspace', offlineMode: 'ready',
  capabilities: ['javascript', 'web-worker'],
  acceptedInput: { 'zh-tw': '一次一張或多張 JPEG、PNG、WebP 商品圖，最多 20 張、合計 200 MiB，另可加入背景、框版與 Logo；每張最多 25 MiB、2,400 萬像素、單邊 8,192 像素。不支援 HEIC／HEIF。', en: 'One or more JPEG, PNG, or WebP product photos, up to 20 and 200 MiB in all, plus an optional background, frame, and Logo; each up to 25 MiB, 24 megapixels, and 8,192 pixels per side. HEIC/HEIF is not supported.' },
  localProcessingStatement: { 'zh-tw': '商品圖、遮罩、框版、Logo、每一步的中間結果與輸出都留在這台裝置，不會上傳，也不會自動保存。', en: 'Product images, mattes, frames, Logos, every intermediate result, and the output stay on this device. Nothing is uploaded or saved automatically.' },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true, workspace: 'wide' },
  seo: {
    contentKey: 'product-image-workbench',
    title: { 'zh-tw': '商品圖工作台：本機完成去背、套版與壓縮', en: 'Product Image Workbench: local cutout, layout, and compression' },
    description: { 'zh-tw': '在瀏覽器裡一次把多張商品圖去背、套上背景框版與 Logo、壓縮，在畫布上直接排版，中間結果不必重複匯出匯入，圖片與輸出都不離開裝置。', en: 'Take a batch of product photos through cutout, a background, frame, and Logo layout you arrange on a canvas, and compression in the browser, without exporting and importing between jobs. Images and output never leave your device.' },
    answer: { 'zh-tw': '工作台把三件事串成一次作業，全部在這台裝置上完成：人像去背、套上背景框版與 Logo，以及壓縮檔案大小，每一件都和人像去背、品牌宣傳圖、圖片壓縮的做法相同。勾選要做的事，按一次就依序處理每一張；某一張失敗只影響那一張，可以單獨重試。瀏覽器做不到的那一件會停用並說明。', en: 'The workbench chains three jobs into one pass, all on this device: portrait cutout, your background, frame, and Logo, and compression to a smaller file, each done as in the background remover, the brand promo image, and the image compressor. Tick what to do and one press works through every photo; a failure affects only that photo, which you can retry. A job this browser cannot do is disabled with the reason.' },
  },
}
