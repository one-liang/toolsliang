import type { LocalizedCopy } from '../catalog'
import type { ToolFaqEntry } from '../faq'
import { heicMessage, imageInputErrors } from '@/features/images/messages'

export { heicMessage }
export const imageErrors: Record<string, LocalizedCopy> = {
  ...imageInputErrors,
  invalid_options: { 'zh-tw': '品質須為 0–100，寬高須為 1–8,192 的整數。', en: 'Quality must be 0–100; width and height must be whole numbers from 1–8,192.' },
  unsupported_browser: { 'zh-tw': '這個瀏覽器無法在背景處理圖片。請改用最新版瀏覽器後重試。', en: 'This browser cannot process images in the background. Retry in an up-to-date browser.' },
  unsupported_encoder: { 'zh-tw': '瀏覽器無法輸出此格式，請改選 PNG 或其他可用格式。原檔仍在此裝置。', en: 'This browser cannot produce this format. Choose PNG or another available format. Your original remains on this device.' },
  memory_limit: { 'zh-tw': '這張圖需要的記憶體超過這台裝置能提供的量。請縮小輸出尺寸或關閉其他分頁後重試。原檔未變更。', en: 'This image needs more memory than this device can spare. Reduce output dimensions or close other tabs and retry. Your original is unchanged.' },
  failed: { 'zh-tw': '圖片處理未完成。請重試、調低尺寸或在裝置上重新匯出圖片。原檔未變更。', en: 'Processing did not finish. Retry, reduce dimensions, or re-export the image on your device. Your original is unchanged.' },
}
/** This page keeps source dimensions, so its recovery advice cannot point at an output size the visitor no longer sets. */
export const compressorErrors: Record<string, LocalizedCopy> = {
  ...imageErrors,
  memory_limit: { 'zh-tw': '這張圖需要的記憶體超過這台裝置能提供的量。請關閉其他分頁後重試，或先在裝置上縮小圖片尺寸。原檔未變更。', en: 'This image needs more memory than this device can spare. Close other tabs and retry, or reduce the image dimensions on your device first. Your original is unchanged.' },
  failed: { 'zh-tw': '圖片處理未完成。請重試，或在裝置上重新匯出圖片。原檔未變更。', en: 'Processing did not finish. Retry, or re-export the image on your device. Your original is unchanged.' },
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
  { heading: { 'zh-tw': '壓縮一定會變小嗎？', en: 'Will the output always be smaller?' }, body: { 'zh-tw': '輸出維持原圖尺寸，JPEG 與 WebP 以建議品質 80 重新壓縮，並預設沿用原格式。格式不變時，輸出不會比原檔大：原圖若已經很精簡，重新壓縮只會變大，這時工具會沿用原圖內容，只拿掉拍攝資訊。換成其他格式時仍可能變大，例如把照片轉成 PNG；請比較實際大小再下載。', en: 'Output keeps the original dimensions, and JPEG and WebP are recompressed at a recommended quality of 80, keeping their format by default. With the same format, the output is never larger: if the original is already compact, recompressing would only make it bigger, so the tool keeps the original image and only removes its shooting details. Converting to another format can still produce a larger file, such as turning a photo into PNG; compare actual sizes before downloading.' } },
  { heading: { 'zh-tw': '照片方向、透明背景與拍攝資訊會怎麼處理？', en: 'What happens to orientation, transparency, and shooting details?' }, body: { 'zh-tw': '照片會先轉正再重新壓縮，不會帶上原圖的拍攝資訊、GPS 位置等資料；沿用原圖內容時同樣會拿掉。PNG 與 WebP 保留透明背景，JPEG 的透明區域會補成白色。動圖只處理第一格；顏色可能略有改變，不適合拿來取代原檔保存。', en: 'Photos are turned upright before recompressing, and the original’s shooting details, GPS location, and similar data are not carried over, including when the original image is kept. PNG and WebP keep transparency; JPEG fills transparent areas with white. Animated images use only the first frame. Colours may shift slightly, so keep the originals for archiving.' } },
  { heading: { 'zh-tw': '離線與瀏覽器有哪些限制？', en: 'What are the offline and browser limits?' }, body: { 'zh-tw': '成功處理過一次後，這個工具離線也能使用；你的圖片不會被存進離線資料。能讀取與輸出哪些格式依瀏覽器而定，無法處理時會保留原檔並讓你重試。一次處理一張，最多 25 MiB、2,400 萬像素、單邊 8,192 像素。', en: 'After one successful run, the tool works offline too; your images are never kept for offline use. Which formats can be read and produced depends on your browser, and a failure keeps your original and lets you retry. One image at a time, up to 25 MiB, 24 megapixels, and 8,192 pixels per side.' } },
]
