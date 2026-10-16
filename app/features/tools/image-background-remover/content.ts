import type { LocalizedCopy } from '../catalog'
import type { ToolFaqEntry } from '../faq'
import { backgroundRemovalAssets } from './domain/model'
import { imageInputErrors } from '@/features/images/messages'
import { formatAssetSize } from '@/features/pwa/offline-assets'

/** What the first use stores on the device, so a visitor on mobile data knows the cost before choosing a photo. */
const firstUseSize = (locale: keyof LocalizedCopy) => formatAssetSize(backgroundRemovalAssets.reduce((total, asset) => total + asset.bytes, 0), locale)

/**
 * The single sentence that has to reach a visitor before anything else: T18
 * found no redistributable model that handles products, so version one is a
 * people-only tool and never claims otherwise.
 */
export const portraitScopeNotice: LocalizedCopy = {
  'zh-tw': '僅適用人像照片；商品、動物與風景不在模型處理範圍。',
  en: 'For photos of people only; products, animals, and scenery are outside this model’s scope.',
}

export const backgroundRemovalErrors: Record<string, LocalizedCopy> = {
  ...imageInputErrors,
  unsupported_browser: { 'zh-tw': '這個瀏覽器無法在本機執行去背模型。請改用最新版的 Chrome、Edge、Firefox 或 Safari 後重試。原圖未變更。', en: 'This browser cannot run the background removal model on your device. Retry in an up-to-date Chrome, Edge, Firefox, or Safari. Your original is unchanged.' },
  model_download_failed: { 'zh-tw': '找不到已下載的模型或推論資源，請重新下載後再試一次。原圖未變更。', en: 'The downloaded model or runtime could not be found. Download it again and retry. Your original is unchanged.' },
  model_digest_mismatch: { 'zh-tw': '已下載的模型與公布的指紋不符，已停止使用。請重新下載模型後再試一次。', en: 'The downloaded model does not match the published fingerprint and was not used. Download it again and retry.' },
  insufficient_memory: { 'zh-tw': '可用記憶體不足以在本機完成去背。請關閉其他分頁、改用較小的圖片後重試。原圖未變更。', en: 'There is not enough memory to finish locally. Close other tabs or use a smaller image and retry. Your original is unchanged.' },
  inference_failed: { 'zh-tw': '模型未能完成這張圖片。請重試，或改用另一張人像照片。原圖未變更。', en: 'The model did not finish this image. Retry, or try another portrait photo. Your original is unchanged.' },
  insufficient_storage: { 'zh-tw': '這台裝置的可用儲存空間不足以保存模型。請先清出空間後再下載。', en: 'There is not enough storage on this device to keep the model. Free up space and download again.' },
  processing_timeout: { 'zh-tw': '去背在本機花的時間超過預期，已停止。請改用較小的圖片後重試。原圖未變更。', en: 'Local processing took longer than expected and was stopped. Try a smaller image. Your original is unchanged.' },
  failed: { 'zh-tw': '去背未完成。請重試或改用另一張人像照片。原圖未變更。', en: 'Background removal did not finish. Retry or try another portrait photo. Your original is unchanged.' },
}

/**
 * Why the first-use files are not ready yet, in the remover's own words. The
 * workspace gets them ready without being asked, so a visitor only reads one
 * of these after choosing to start, and each ends with the one thing to do:
 * press 重試. None of them talks about downloading — that is how the files
 * arrive, not something the visitor has to manage.
 */
export const modelPreparationIssues: Record<'offline' | 'failed' | 'digest-mismatch' | 'insufficient_storage', LocalizedCopy> = {
  'offline': { 'zh-tw': '目前沒有網路。第一次使用要先連上網路準備去背功能，用過一次後，離線也能使用。連上網路後請按「重試」。原圖未變更。', en: 'You are offline. The first use needs an internet connection to get background removal ready; after you use it once, it works offline too. Reconnect, then select Try again. Your original is unchanged.' },
  'failed': { 'zh-tw': '去背功能沒有準備完成，可能是網路中斷了。請確認網路後按「重試」。原圖未變更。', en: 'Background removal could not get ready, possibly because the connection dropped. Check your connection, then select Try again. Your original is unchanged.' },
  'digest-mismatch': { 'zh-tw': '收到的檔案不完整或已損壞，已經捨棄不用。請按「重試」重新準備。原圖未變更。', en: 'The files received were incomplete or damaged, so they were discarded. Select Try again to get them ready again. Your original is unchanged.' },
  'insufficient_storage': { 'zh-tw': '這台裝置的儲存空間不足，無法準備去背功能。請清出一些空間後按「重試」。原圖未變更。', en: 'This device does not have enough free storage to get background removal ready. Free up some space, then select Try again. Your original is unchanged.' },
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
    heading: { 'zh-tw': '第一次使用為什麼要等一下？', en: 'Why does the first use take a moment?' },
    body: {
      'zh-tw': `去背在你的裝置上進行，所以第一次使用時，要先把去背功能需要的檔案（約 ${firstUseSize('zh-tw')}）存到這台裝置，會用到一些網路流量。選好照片時就會開始準備；按「開始去背」時如果還沒準備好，會顯示進度，完成後自動接著去背，過程中可以隨時取消。這些檔案只從本站取得，確認內容正確才會使用，你的照片不會被傳出去。用過一次後，離線也能使用。`,
      en: `Background removal runs on your device, so the first use stores the files it needs (about ${firstUseSize('en')}) on this device, which uses some data. Getting ready starts as soon as you choose a photo; if it is not finished when you select Remove background, you see the progress and the cutout continues on its own. You can cancel at any time. The files come only from this site and are checked before use, and your photo is never sent anywhere. After you use it once, it works offline too.`,
    },
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
    body: { 'zh-tw': '支援單張 JPEG、PNG 或 WebP，最多 25 MiB、2,400 萬像素、單邊 8,192 像素，輸出一律為透明 PNG。不支援 iPhone HEIC／HEIF。用過一次後，離線也能使用；你的照片不會被存起來給離線使用。', en: 'One JPEG, PNG, or WebP at a time, up to 25 MiB, 24 megapixels, and 8,192 pixels per side; the output is always a transparent PNG. HEIC/HEIF from iPhone is not supported. After you use it once, it works offline too, and your photos are never stored for offline use.' },
  },
]
