import type { PublishedToolDefinition } from '../catalog'

/**
 * `offlineMode` is `ready` on purpose. The workbench itself needs nothing but
 * the App Shell cache: import, layout, brand assets and output all run offline
 * after the first load. Only the optional cutout needs the portrait model, and
 * that download is offered inside the step that needs it, so a visitor is never
 * told the whole tool requires megabytes it may never use.
 */
export const productImageWorkbenchDefinition: PublishedToolDefinition = {
  slug: 'product-image-workbench', category: 'image-commerce', icon: 'shopping-bag',
  availability: { state: 'published', publishedAt: '2026-09-09' },
  status: { kind: 'new', startsAt: '2026-09-09', endsAt: '2026-10-09' },
  name: { 'zh-tw': '商品圖工作台', en: 'Product Image Workbench' },
  description: { 'zh-tw': '把去背、合規尺寸與品牌素材串成一次本機作業。', en: 'Run cutout, compliant sizing, and brand assets as one local pass.' },
  aliases: { 'zh-tw': ['商品圖流程', '上架圖工作台'], en: ['product image pipeline', 'listing image workbench'] },
  keywords: { 'zh-tw': ['去背', '主圖', '框版', 'Logo', '通路規格'], en: ['cutout', 'main image', 'frame', 'Logo', 'channel preset'] },
  processingClass: 'worker', routeComponentKey: 'ProductImageWorkbenchWorkspace', offlineMode: 'ready',
  capabilities: ['javascript', 'web-worker'],
  acceptedInput: { 'zh-tw': '單張 JPEG、PNG 或 WebP 商品圖，另可加入框版與 Logo；每張最多 25 MiB、2,400 萬像素、單邊 8,192 像素。不支援 HEIC／HEIF。', en: 'One JPEG, PNG, or WebP product image, plus an optional frame and Logo; each up to 25 MiB, 24 megapixels, and 8,192 pixels per side. HEIC/HEIF is not supported.' },
  localProcessingStatement: { 'zh-tw': '商品圖、遮罩、框版、Logo、每一步的中間結果與輸出都留在這台裝置，不會上傳，也不會自動保存。', en: 'Product images, mattes, frames, Logos, every intermediate result, and the output stay on this device. Nothing is uploaded or saved automatically.' },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true },
  seo: {
    contentKey: 'product-image-workbench',
    title: { 'zh-tw': '商品圖工作台：本機完成去背、合規尺寸與品牌素材', en: 'Product Image Workbench: local cutout, compliant sizing, brand assets' },
    description: { 'zh-tw': '在瀏覽器裡把商品圖依序完成去背、通路合規尺寸與框版 Logo，中間結果不必重複匯出匯入，圖片與輸出都不離開裝置。', en: 'Take a product image through cutout, channel-compliant sizing, and frame or Logo composition in the browser, without exporting and importing between steps. Images and output never leave your device.' },
    answer: { 'zh-tw': '工作台把三個既有的本機引擎串成一次作業：人像去背、合規主圖的尺寸與背景、品牌宣傳圖的框版與 Logo。合規主圖與品牌宣傳圖是兩條分支，合規分支不加入框版、Logo 或促銷文字，也不保證通路審核通過。任何步驟失敗或取消都只影響那一步，先前成果保留；瀏覽器不支援某個步驟時只停用該步驟。', en: 'The workbench chains three engines that already run locally: portrait matting, compliant sizing and background, and promotional frame or Logo composition. Compliant and promotional outputs are separate branches; the compliant branch adds no frame, Logo, or promotional text and never guarantees channel approval. A failed or cancelled step affects only that step, and an unsupported step is disabled on its own.' },
  },
  contentReview: {
    reviewedAt: '2026-09-09', sourceEffectiveAt: '2026-09-09',
    sourceEdition: { 'zh-tw': 'toolsliang 圖片工具組合決策與商品圖工作台第一版規格', en: 'toolsliang image tool composition decisions and Product Image Workbench v1 specification' },
    sources: [
      { title: { 'zh-tw': '獨立圖片工具可組合為商品圖工作台', en: 'Independent image tools compose into a product image workbench' }, url: 'https://github.com/one-liang/toolsliang/blob/develop/docs/adr/0004-compose-image-tools-into-a-workbench.md' },
      { title: { 'zh-tw': '合規主圖與品牌宣傳圖是不同輸出目的', en: 'Compliant and promotional product images are different outputs' }, url: 'https://github.com/one-liang/toolsliang/blob/develop/docs/adr/0012-separate-compliant-and-promotional-product-images.md' },
      { title: { 'zh-tw': '工具內容只在使用者裝置上處理', en: 'Tool content is processed on the user device only' }, url: 'https://github.com/one-liang/toolsliang/blob/develop/docs/adr/0001-tool-content-stays-on-device.md' },
    ],
  },
}
