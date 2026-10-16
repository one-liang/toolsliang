import type { LocaleCode, LocalizedCopy } from '../tools/catalog'
import { formatStoredSize } from '../shell/local-assets/usage'
import type { ImageArchiveIssue } from './archive'
import type { ImageBatchLimits, ImageBatchRefusal, ImageBatchStatus } from './batch'

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

/** The ceilings a batch is refused at, in the words the refusal uses, so both come from one place. */
export function imageBatchLimitsNotice(limits: ImageBatchLimits, locale: LocaleCode) {
  const size = formatStoredSize(limits.maxBytes, locale)

  return locale === 'en'
    ? `Up to ${limits.maxItems} images and ${size} at a time on this device.`
    : `這台裝置一次最多 ${limits.maxItems} 張、合計 ${size}。`
}

export function imageBatchRefusalMessage(code: ImageBatchRefusal, limits: ImageBatchLimits, locale: LocaleCode) {
  const size = formatStoredSize(limits.maxBytes, locale)
  const messages: Record<ImageBatchRefusal, LocalizedCopy> = {
    too_many_items: {
      'zh-tw': `超過張數上限，沒有加入。這台裝置一次最多 ${limits.maxItems} 張，移除幾張後可以再加。`,
      en: `More images than one batch holds, so these were not added. This device takes ${limits.maxItems} at a time; remove a few and add them again.`,
    },
    batch_too_large: {
      'zh-tw': `超過合計容量上限，沒有加入。這台裝置一次最多 ${size}，移除幾張後可以再加。`,
      en: `More than one batch holds, so these were not added. This device takes ${size} at a time; remove a few and add them again.`,
    },
  }

  return messages[code][locale]
}

export const imageBatchStatusLabels: Record<ImageBatchStatus, LocalizedCopy> = {
  pending: { 'zh-tw': '等待處理', en: 'Waiting' },
  running: { 'zh-tw': '處理中', en: 'Working' },
  done: { 'zh-tw': '完成', en: 'Done' },
  failed: { 'zh-tw': '失敗', en: 'Failed' },
}

/** What packing a batch into one ZIP can run into, its own refusals included. */
export const imageArchiveErrors: Record<ImageArchiveIssue | 'unsupported_browser' | 'memory_limit' | 'failed', LocalizedCopy> = {
  nothing_to_archive: {
    'zh-tw': '還沒有完成的圖片可以打包。',
    en: 'No finished images to pack yet.',
  },
  archive_too_large: {
    'zh-tw': '這批圖片合計超過一個 ZIP 能放的大小，請改成逐張下載。',
    en: 'These images add up to more than one ZIP can hold. Download them one by one instead.',
  },
  unsupported_browser: {
    'zh-tw': '這個瀏覽器無法在這台裝置上打包 ZIP，請改成逐張下載。',
    en: 'This browser cannot pack a ZIP on this device. Download the images one by one instead.',
  },
  memory_limit: {
    'zh-tw': '這台裝置的記憶體不夠打包這批圖片，請改成逐張下載，或移除幾張後再試。',
    en: 'This device ran out of memory packing these images. Download them one by one, or remove a few and try again.',
  },
  failed: {
    'zh-tw': 'ZIP 沒有打包完成，請再試一次或改成逐張下載。',
    en: 'The ZIP was not packed. Try again, or download the images one by one.',
  },
}
