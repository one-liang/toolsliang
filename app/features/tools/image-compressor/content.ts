import type { LocalizedCopy } from '../catalog'
import type { ToolFaqEntry } from '../faq'

export const heicMessage = { 'zh-tw': '第一版不支援 iPhone HEIC／HEIF，請先在裝置上轉為 JPEG、PNG 或 WebP。', en: 'HEIC/HEIF from iPhone is not supported in version one. Convert it to JPEG, PNG, or WebP on your device first.' }
export const imageErrors: Record<string, LocalizedCopy> = {
  unsupported_heic: heicMessage,
  unsupported_format: { 'zh-tw': '請選擇真正的 JPEG、PNG 或 WebP 圖片，修改副檔名不會轉換格式。', en: 'Choose a JPEG, PNG, or WebP image. Renaming an extension does not convert a file.' },
  too_large: { 'zh-tw': '圖片超過本機處理上限（25 MiB、2,400 萬像素、單邊 8,192 像素）。請先在裝置上縮小圖片。', en: 'This image exceeds the local limits (25 MiB, 24 megapixels, 8,192 pixels per side). Resize it on your device first.' },
  invalid_options: { 'zh-tw': '品質須為 0–100，寬高須為 1–8,192 的整數。', en: 'Quality must be 0–100; width and height must be whole numbers from 1–8,192.' },
  unsupported_browser: { 'zh-tw': '此瀏覽器無法提供背景圖片處理。請使用支援 Worker 與 OffscreenCanvas 的瀏覽器後重試。', en: 'Background image processing is unavailable. Retry in a browser with Worker and OffscreenCanvas support.' },
  unsupported_encoder: { 'zh-tw': '瀏覽器無法輸出此格式，請改選 PNG 或其他可用格式。原檔仍在此裝置。', en: 'This encoder is unavailable. Choose PNG or another available format. Your original remains on this device.' },
  memory_limit: { 'zh-tw': '預估超過本機記憶體預算，或可用記憶體不足。請縮小輸出尺寸或關閉其他分頁後重試。原檔未變更。', en: 'Not enough memory or the estimated working set exceeds the local budget. Reduce output dimensions or close other tabs and retry. Your original is unchanged.' },
  corrupt_image: { 'zh-tw': '無法讀取圖片結構，請在裝置上重新匯出 JPEG、PNG 或 WebP 後重試。原檔未變更。', en: 'The image structure could not be read. Re-export JPEG, PNG, or WebP on your device and retry. Your original is unchanged.' },
  multiple_files: { 'zh-tw': '一次只能處理一張圖片，請重新選擇。', en: 'Choose one image at a time.' },
  failed: { 'zh-tw': '圖片處理未完成。請重試、調低尺寸或在裝置上重新匯出圖片。原檔未變更。', en: 'Processing did not finish. Retry, reduce dimensions, or re-export the image on your device. Your original is unchanged.' },
}
export const imageStages: Record<string, LocalizedCopy> = {
  reading: { 'zh-tw': '讀取圖片', en: 'Reading image' },
  decoding: { 'zh-tw': '解碼圖片', en: 'Decoding image' },
  processing: { 'zh-tw': '調整尺寸', en: 'Resizing image' },
  encoding: { 'zh-tw': '編碼圖片', en: 'Encoding image' },
  'preparing-download': { 'zh-tw': '準備下載', en: 'Preparing download' },
}
export const imageCompressorFaq: ToolFaqEntry[] = [
  { heading: { 'zh-tw': '圖片會傳送到伺服器嗎？', en: 'Are my images sent to a server?' }, body: { 'zh-tw': '不會。原檔、檔名、預覽與輸出只在裝置記憶體處理；只有你主動下載才會保存輸出。關閉工具會清除工作內容。', en: 'No. Files, filenames, previews, and output stay in device memory. Output is saved only when you download it. Closing the tool clears the workspace.' } },
  { heading: { 'zh-tw': '支援 iPhone HEIC／HEIF 嗎？', en: 'Does this support iPhone HEIC/HEIF?' }, body: heicMessage },
  { heading: { 'zh-tw': '壓縮一定會變小嗎？', en: 'Will the output always be smaller?' }, body: { 'zh-tw': '不一定。JPEG 與 WebP 品質調整通常是有損編碼；PNG 不使用品質參數。縮小尺寸也會改變像素。結果可能比原檔大，請比較實際大小再下載。', en: 'No. JPEG and WebP quality settings use lossy encoding; PNG ignores quality. Resizing also changes pixels. Output can be larger than the original; compare actual sizes before downloading.' } },
  { heading: { 'zh-tw': '方向、透明度與中繼資料如何處理？', en: 'What happens to orientation, transparency, and metadata?' }, body: { 'zh-tw': '依圖片方向資料校正後重新編碼，不複製原始 EXIF、GPS 或其他中繼資料。PNG／WebP 保留透明度，JPEG 以白色填補透明區。動畫僅處理第一幀；色彩描述檔可能改變，不適合作為原檔封存。', en: 'Orientation is applied before re-encoding. Source EXIF, GPS, and other metadata are not copied. PNG/WebP preserve transparency; JPEG fills transparent areas with white. Animation uses only the first frame. Color profiles may change; keep originals for archival use.' } },
  { heading: { 'zh-tw': '離線與瀏覽器有哪些限制？', en: 'What are the offline and browser limits?' }, body: { 'zh-tw': '首次成功處理後，公開程式資產可由 PWA 快取供離線重用；圖片不會進入快取。解碼與編碼依瀏覽器能力而異，無法處理時會保留原檔並提供重試。一次處理一張，最多 25 MiB、2,400 萬像素、單邊 8,192 像素。', en: 'After a successful first run, public application assets can be reused offline through the PWA cache. Images are never cached. Codec availability varies by browser. Failures keep your original and allow retry. One image at a time, up to 25 MiB, 24 megapixels, and 8,192 pixels per side.' } },
]
