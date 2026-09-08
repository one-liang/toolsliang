import type { LocalizedCopy } from '../catalog'
import type { ToolFaqEntry } from '../faq'
import { imageInputErrors } from '@/features/images/messages'

/**
 * The single sentence that has to reach a visitor before anything else: T18
 * found no redistributable model that handles products, so version one is a
 * people-only tool and never claims otherwise.
 */
export const portraitScopeNotice: LocalizedCopy = {
  'zh-tw': '這個工具使用人像去背模型，只針對照片中的人處理。商品、動物或風景不在它的訓練範圍，結果通常不可用。',
  en: 'This tool runs a portrait matting model, so it only separates people from a background. Products, animals, and scenery are outside what it was trained on and usually come out unusable.',
}

export const backgroundRemovalErrors: Record<string, LocalizedCopy> = {
  ...imageInputErrors,
  unsupported_browser: { 'zh-tw': '這個瀏覽器無法在本機執行去背模型。請改用支援 WebAssembly 與背景處理的最新版瀏覽器後重試。原圖未變更。', en: 'This browser cannot run the background removal model locally. Retry in an up-to-date browser with WebAssembly and background processing. Your original is unchanged.' },
  model_download_failed: { 'zh-tw': '找不到已下載的模型或推論資源，請重新下載後再試一次。原圖未變更。', en: 'The downloaded model or runtime could not be found. Download it again and retry. Your original is unchanged.' },
  model_digest_mismatch: { 'zh-tw': '已下載的模型與公布的指紋不符，已停止使用。請重新下載模型後再試一次。', en: 'The downloaded model does not match the published fingerprint and was not used. Download it again and retry.' },
  insufficient_memory: { 'zh-tw': '可用記憶體不足以在本機完成去背。請關閉其他分頁、改用較小的圖片後重試。原圖未變更。', en: 'There is not enough memory to finish locally. Close other tabs or use a smaller image and retry. Your original is unchanged.' },
  inference_failed: { 'zh-tw': '模型未能完成這張圖片。請重試，或改用另一張人像照片。原圖未變更。', en: 'The model did not finish this image. Retry, or try another portrait photo. Your original is unchanged.' },
  insufficient_storage: { 'zh-tw': '這台裝置的可用儲存空間不足以保存模型。請先清出空間後再下載。', en: 'There is not enough storage on this device to keep the model. Free up space and download again.' },
  processing_timeout: { 'zh-tw': '去背在本機花的時間超過預期，已停止。請改用較小的圖片後重試。原圖未變更。', en: 'Local processing took longer than expected and was stopped. Try a smaller image. Your original is unchanged.' },
  failed: { 'zh-tw': '去背未完成。請重試或改用另一張人像照片。原圖未變更。', en: 'Background removal did not finish. Retry or try another portrait photo. Your original is unchanged.' },
}

export const backgroundRemovalStages: Record<string, LocalizedCopy> = {
  'reading': { 'zh-tw': '讀取圖片', en: 'Reading image' },
  'decoding': { 'zh-tw': '解碼圖片', en: 'Decoding image' },
  'preparing-model': { 'zh-tw': '載入本機模型', en: 'Loading the local model' },
  'inference': { 'zh-tw': '在本機推論', en: 'Running locally' },
  'mask': { 'zh-tw': '套用遮罩', en: 'Applying the matte' },
  'encoding': { 'zh-tw': '輸出透明 PNG', en: 'Writing the transparent PNG' },
  'preparing-download': { 'zh-tw': '準備下載', en: 'Preparing download' },
}

export const imageBackgroundRemoverFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': '圖片會傳送到伺服器嗎？', en: 'Are my images sent to a server?' },
    body: { 'zh-tw': '不會。模型在你的瀏覽器裡執行，原圖、遮罩、預覽與輸出只在裝置記憶體處理；只有你主動下載才會保存輸出。關閉工具會清除工作內容。', en: 'No. The model runs inside your browser. The source image, the matte, the previews, and the output stay in device memory, and the output is saved only when you download it. Closing the tool clears the workspace.' },
  },
  {
    heading: { 'zh-tw': '為什麼第一次使用要下載？', en: 'Why does the first use need a download?' },
    body: { 'zh-tw': '因為推論在本機進行，模型權重與推論 runtime 必須先下載到這台裝置。兩個檔案都由本站提供、下載後比對 SHA-256 指紋，之後就會留在瀏覽器快取，離線也能重複使用。下載過程隨時可以取消。', en: 'Because inference happens on your device, the model weights and the inference runtime have to be downloaded first. Both files are served by this site and checked against a published SHA-256 fingerprint, then kept in the browser cache so later runs work offline. The download can be cancelled at any time.' },
  },
  {
    heading: { 'zh-tw': '可以處理商品圖嗎？', en: 'Can it handle product photos?' },
    body: portraitScopeNotice,
  },
  {
    heading: { 'zh-tw': '結果會有哪些限制？', en: 'What are the known limits?' },
    body: { 'zh-tw': '髮絲、半透明區域（玻璃、薄紗、煙霧）與前後景亮度接近的邊緣都可能不準確；半透明區域的透明度是目前所有候選模型共同的弱點。同一張圖在不同瀏覽器的邊緣也可能略有差異。請務必先放大檢查再使用結果。', en: 'Individual hairs, semi-transparent areas such as glass, sheer fabric, or smoke, and edges where foreground and background have similar brightness can all be inaccurate; semi-transparency is a weakness shared by every model evaluated. Edges can also differ slightly between browsers. Zoom in and check the result before you use it.' },
  },
  {
    heading: { 'zh-tw': '支援哪些格式與離線使用？', en: 'Which formats are supported, and does it work offline?' },
    body: { 'zh-tw': '支援單張 JPEG、PNG 或 WebP，最多 25 MiB、2,400 萬像素、單邊 8,192 像素，輸出一律為透明 PNG。不支援 iPhone HEIC／HEIF。模型下載完成後，即使離線也能繼續去背；圖片本身永遠不會進入快取。', en: 'One JPEG, PNG, or WebP at a time, up to 25 MiB, 24 megapixels, and 8,192 pixels per side; the output is always a transparent PNG. HEIC/HEIF from iPhone is not supported. Once the model is downloaded the tool keeps working offline, and your images never enter the cache.' },
  },
]
