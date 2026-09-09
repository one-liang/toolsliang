import type { ToolFaqEntry } from '../faq'
import type { LocalizedCopy } from '../catalog'
import { imageErrors } from '../image-compressor/content'
export const promoErrors: Record<string, LocalizedCopy> = {
  ...imageErrors,
  invalid_options: { 'zh-tw': '請檢查數字：寬高須為 1–8,192 的整數且合計不超過 2,400 萬像素，位置 −100–100%、縮放 1–400%、不透明度 0–100%。', en: 'Check the numbers: whole-number dimensions from 1–8,192 and at most 24 megapixels, position −100–100%, scale 1–400%, opacity 0–100%.' },
  missing_asset: { 'zh-tw': '找不到這個圖層的資產。請重新匯入或移除圖層後再輸出；已保存資產不會被刪除。', en: 'This layer’s asset is missing. Import it again or remove the layer before exporting; saved assets are untouched.' },
  layer_limit: { 'zh-tw': '最多 12 個圖層；請先移除不需要的圖層。', en: 'Up to 12 layers are supported. Remove an unused layer first.' },
  session_limit: { 'zh-tw': '這次作業素材已達 100 MiB；請重新載入後以較小圖片開始。已保存資產仍保留。', en: 'This session has reached 100 MiB of source assets. Reload and start with smaller images. Saved assets remain.' },
}
export const brandPromoImageFaq: ToolFaqEntry[] = [
  { heading: { 'zh-tw': '可以加入文字或價籤嗎？', en: 'Can I add text or price tags?' }, body: { 'zh-tw': '第一版僅支援商品圖、背景、框版與 Logo 圖層，不提供文字、價籤、雲端模板或多人協作。', en: 'Version one supports product images, backgrounds, frames, and Logo layers, without text, price tags, cloud templates, or collaboration.' } },
  { heading: { 'zh-tw': '保存的素材放在哪裡？', en: 'Where do saved assets go?' }, body: { 'zh-tw': '只有主動保存的素材留在這台裝置的瀏覽器資料庫，不會同步。清除瀏覽器資料、無痕模式或儲存空間回收可能讓資產消失；可到本機資產頁匯出備份與管理容量。圖層配置不自動保存。', en: 'Explicitly saved assets stay in this device’s browser database and never sync. Clearing browser data, private browsing, or storage reclamation may remove them. Export a backup and manage space on the local assets page. Layer layouts are not saved automatically.' } },
  { heading: { 'zh-tw': '可以直接當通路主圖嗎？', en: 'Is the output a compliant marketplace main image?' }, body: { 'zh-tw': '這是品牌宣傳圖，不保證通路主圖審核通過。請自行確認素材與 Logo 使用權；瀏覽器算繪與色彩管理可能使輸出色彩略有差異。', en: 'This is promotional artwork, with no guarantee of marketplace approval. Check your rights to use images and Logos. Browser rendering and color management may affect output colors.' } },
]
