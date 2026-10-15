import type { ToolFaqEntry } from '../faq'
import type { LocalizedCopy } from '../catalog'
import { imageErrors } from '../image-compressor/content'
export const promoErrors: Record<string, LocalizedCopy> = {
  ...imageErrors,
  invalid_options: { 'zh-tw': '請檢查數字：寬高須為 1–8,192 的整數且合計不超過 2,400 萬像素，位置 −100–100%、縮放 1–400%、不透明度 0–100%。', en: 'Check the numbers: whole-number dimensions from 1–8,192 and at most 24 megapixels, position −100–100%, scale 1–400%, opacity 0–100%.' },
  missing_asset: { 'zh-tw': '找不到這個圖層的圖片。請重新加入，或移除這個圖層後再產生 PNG。', en: 'This layer’s image is missing. Add it again, or remove the layer before making the PNG.' },
  layer_limit: { 'zh-tw': '最多 12 個圖層；請先移除不需要的圖層。', en: 'Up to 12 layers are supported. Remove an unused layer first.' },
  session_limit: { 'zh-tw': '這次加入的圖片合計已達 100 MiB。請重新載入頁面，改用較小的圖片開始。', en: 'The images added this time have reached 100 MiB in total. Reload the page and start again with smaller images.' },
}
export const brandPromoImageFaq: ToolFaqEntry[] = [
  { heading: { 'zh-tw': '可以加入文字或價籤嗎？', en: 'Can I add text or price tags?' }, body: { 'zh-tw': '第一版僅支援商品圖、背景、框版與 Logo 圖層，不提供文字、價籤、雲端模板或多人協作。', en: 'Version one supports product images, backgrounds, frames, and Logo layers, without text, price tags, cloud templates, or collaboration.' } },
  { heading: { 'zh-tw': '做好的組合會保存下來嗎？', en: 'Is my composition kept?' }, body: { 'zh-tw': '不會。圖片與圖層只在這個頁面開著時存在，關掉或重新載入就會清空；需要的成品請先下載 PNG。以前在這個工具保存的框版、Logo 與背景仍留在這台裝置，可到本機資產頁查看與刪除。', en: 'No. Images and layers exist only while this page is open, and closing or reloading it clears them, so download the PNG you need first. Frames, Logos, and backgrounds saved in this tool earlier are still on this device; review or delete them on the local assets page.' } },
  { heading: { 'zh-tw': '可以直接當通路主圖嗎？', en: 'Is the output a compliant marketplace main image?' }, body: { 'zh-tw': '這是品牌宣傳圖，不保證通路主圖審核通過。請自行確認素材與 Logo 使用權；不同瀏覽器處理顏色的方式略有不同，輸出的顏色可能有些微差異。', en: 'This is promotional artwork, with no guarantee of marketplace approval. Check your rights to use images and Logos. Browsers handle colour slightly differently, so output colours may vary a little.' } },
]
