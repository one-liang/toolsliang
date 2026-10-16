import type { LocalizedCopy } from '../catalog'
import type { ToolFaqEntry } from '../faq'
import { backgroundRemovalErrors } from '../image-background-remover/content'
import { promoErrors } from '../brand-promo-image/content'
import { compressorErrors } from '../image-compressor/content'
import type { WorkbenchJobs, WorkbenchStage } from '@/composables/useProductWorkbench'

/**
 * Why one photo did not finish, in the words of the tool each job comes from:
 * the workbench runs their engines, so it can only fail the way they do.
 */
export const workbenchErrors: Record<string, LocalizedCopy> = {
  ...compressorErrors,
  ...promoErrors,
  ...backgroundRemovalErrors,
  failed: { 'zh-tw': '這張圖片沒有處理完成。請重試，或移除這張後繼續。原圖未變更。', en: 'This image did not finish. Retry, or remove it and carry on. Your original is unchanged.' },
}

export const workbenchJobLabels: Record<keyof WorkbenchJobs, LocalizedCopy> = {
  cutout: { 'zh-tw': '去背', en: 'Remove background' },
  compose: { 'zh-tw': '套版', en: 'Apply the layout' },
  compress: { 'zh-tw': '壓縮', en: 'Compress' },
}

/** One line under each job, saying what it does with the same settings as its own tool. */
export const workbenchJobHints: Record<keyof WorkbenchJobs, LocalizedCopy> = {
  cutout: { 'zh-tw': '只適用人像照片，同人像去背。', en: 'Portraits only, as in the background remover.' },
  compose: { 'zh-tw': '每張放進畫布上的商品圖層，同品牌宣傳圖。', en: 'Each photo goes in the canvas’s product layer, as in the brand promo image.' },
  compress: { 'zh-tw': '維持尺寸、建議品質，同圖片壓縮。', en: 'Same size at the recommended quality, as in the image compressor.' },
}

export const workbenchStages: Record<WorkbenchStage, LocalizedCopy> = {
  'preparing-model': { 'zh-tw': '準備去背', en: 'Getting the cutout ready' },
  'cutout': { 'zh-tw': '去背', en: 'Removing the background' },
  'compose': { 'zh-tw': '套版', en: 'Applying the layout' },
  'compress': { 'zh-tw': '壓縮', en: 'Compressing' },
}

export const productImageWorkbenchFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': '這個工作台和單獨的圖片工具有什麼不同？', en: 'How is the workbench different from the individual tools?' },
    body: {
      'zh-tw': '它做的事和單獨的工具一樣：去背同人像去背、套版同品牌宣傳圖、壓縮同圖片壓縮。差別是一次放入多張商品圖，勾選要做的事，按一次就整批完成，每一步的結果直接交給下一步，不必反覆下載再匯入。',
      en: 'It does the same work as the individual tools: the cutout matches the portrait background remover, the layout matches the brand promo image, and compression matches the image compressor. The difference is that you add a batch of product photos, tick what to do, and one press finishes them all, each result going straight to the next job instead of being downloaded and imported again.',
    },
  },
  {
    heading: { 'zh-tw': '去背可以處理商品圖嗎？', en: 'Can the cutout handle product photos?' },
    body: {
      'zh-tw': '目前只有人像去背模型，它只學過把人和背景分開；商品、動物或風景通常不可用。去背預設關閉，需要時再勾選。',
      en: 'For now there is only the portrait model, which was trained to separate people from a background; products, animals, and scenery usually come out unusable. The cutout is off by default; tick it when you need it.',
    },
  },
  {
    heading: { 'zh-tw': '版面要怎麼排？', en: 'How do I lay out the image?' },
    body: {
      'zh-tw': '和品牌宣傳圖一樣：在畫布上直接拖曳、縮放與調整上下層，可以加入背景、框版與 Logo。目前顯示的商品圖放在商品圖層裡，每一張都會放進同一個位置、用同樣的大小。',
      en: 'As in the brand promo image: drag, scale, and reorder layers right on the canvas, and add a background, frame, and Logo. The photo on screen sits in the product layer, and every photo goes in the same place at the same size.',
    },
  },
  {
    heading: { 'zh-tw': '一次可以處理幾張？有一張失敗會怎樣？', en: 'How many images fit, and what if one fails?' },
    body: {
      'zh-tw': '一次最多 20 張、合計 200 MiB，記憶體較少的裝置會更少；每張最多 25 MiB、2,400 萬像素、單邊 8,192 像素。圖片一張一張依序處理，失敗只記在那一張上，可以單獨重試或移除，其他張照常完成。',
      en: 'Up to 20 images and 200 MiB in all, fewer on devices with less memory; each up to 25 MiB, 24 megapixels, and 8,192 pixels per side. The images are processed one after another, and a failure is recorded on that image alone, which you can retry or remove while the rest finish.',
    },
  },
  {
    heading: { 'zh-tw': '工作進度會被保存嗎？', en: 'Is my work saved?' },
    body: {
      'zh-tw': '不會。圖片、版面與結果只存在於這個分頁，關閉或重新整理就會清空，也不會同步到雲端；離開前如果還有未完成的工作，瀏覽器會先提醒你。',
      en: 'No. Images, the layout, and results live in this tab only, are cleared when you close or reload it, and never sync to the cloud; your browser warns you before you leave with unfinished work.',
    },
  },
  {
    heading: { 'zh-tw': '下載的檔案叫什麼？在哪裡打包？', en: 'What are the downloads called, and where are they packed?' },
    body: {
      'zh-tw': '檔名只由「product-image」與序號組成，不沿用原始檔名。多張時可以逐張下載，或在這台裝置的瀏覽器裡打包成一個 ZIP，過程不經過任何伺服器，也不寫入裝置時間。',
      en: 'Names are made only of “product-image” and a number, never the original file names. Several can be downloaded one by one or packed into one ZIP in this browser on this device, without any server and without writing the device clock into the file.',
    },
  },
]
