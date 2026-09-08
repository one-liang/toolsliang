import type { LocalizedCopy } from '../tools/catalog'

/**
 * What every image tool says about the file itself. A visitor who is refused by
 * one image tool must read the same sentence from the next one, so these live
 * beside the shared validator rather than in each tool's own copy.
 */
export const heicMessage: LocalizedCopy = {
  'zh-tw': '第一版不支援 iPhone HEIC／HEIF，請先在裝置上轉為 JPEG、PNG 或 WebP。',
  en: 'HEIC/HEIF from iPhone is not supported in version one. Convert it to JPEG, PNG, or WebP on your device first.',
}

export const imageInputErrors: Record<string, LocalizedCopy> = {
  unsupported_heic: heicMessage,
  unsupported_format: { 'zh-tw': '請選擇真正的 JPEG、PNG 或 WebP 圖片，修改副檔名不會轉換格式。', en: 'Choose a JPEG, PNG, or WebP image. Renaming an extension does not convert a file.' },
  too_large: { 'zh-tw': '圖片超過本機處理上限（25 MiB、2,400 萬像素、單邊 8,192 像素）。請先在裝置上縮小圖片。', en: 'This image exceeds the local limits (25 MiB, 24 megapixels, 8,192 pixels per side). Resize it on your device first.' },
  corrupt_image: { 'zh-tw': '無法讀取圖片結構，請在裝置上重新匯出 JPEG、PNG 或 WebP 後重試。原檔未變更。', en: 'The image structure could not be read. Re-export JPEG, PNG, or WebP on your device and retry. Your original is unchanged.' },
  multiple_files: { 'zh-tw': '一次只能處理一張圖片，請重新選擇。', en: 'Choose one image at a time.' },
}
