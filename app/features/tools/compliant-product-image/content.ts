import type { LocalizedCopy } from '../catalog'
import { imageInputErrors } from '@/features/images/messages'
import type { OutputSizeIssue } from './domain/render'

/**
 * What the workbench's layout step says out loud: its errors, its stages and
 * why a canvas cannot be produced. The channel presets, rule labels, sources
 * and caveats that used to live here were removed with them (ADR-0022).
 */

export const compliantImageErrors: Record<string, LocalizedCopy> = {
  ...imageInputErrors,
  invalid_options: {
    'zh-tw': '輸出設定超出可以處理的範圍，請依欄位說明調整後重試。',
    en: 'These output settings are outside what can be produced. Adjust the fields as described and retry.',
  },
  unsupported_browser: {
    'zh-tw': '這個瀏覽器無法在背景處理圖片。請改用最新版瀏覽器後重試。原圖未變更。',
    en: 'This browser cannot process images in the background. Retry in an up-to-date browser. Your original is unchanged.',
  },
  unsupported_encoder: {
    'zh-tw': '這個瀏覽器無法輸出所選格式，請改選其他可用格式。原圖仍在此裝置。',
    en: 'This browser cannot write the chosen format. Pick another available format. Your original remains on this device.',
  },
  memory_limit: {
    'zh-tw': '預估超過本機記憶體預算，或可用記憶體不足。請縮小輸出尺寸或關閉其他分頁後重試。原圖未變更。',
    en: 'Not enough memory, or the estimated working set exceeds the local budget. Reduce the output size or close other tabs and retry. Your original is unchanged.',
  },
  processing_timeout: {
    'zh-tw': '本機處理超過預期時間，已停止。請改用較小的圖片或較小的輸出尺寸後重試。原圖未變更。',
    en: 'Local processing took longer than expected and was stopped. Use a smaller image or a smaller output size and retry. Your original is unchanged.',
  },
  encode_failed: {
    'zh-tw': '輸出編碼未完成。請重試、改選格式或縮小輸出尺寸。原圖未變更。',
    en: 'Writing the output did not finish. Retry, choose another format, or reduce the output size. Your original is unchanged.',
  },
  failed: {
    'zh-tw': '這次輸出未完成。請重試、調整輸出設定，或在裝置上重新匯出圖片。原圖未變更。',
    en: 'This output did not finish. Retry, adjust the settings, or re-export the image on your device. Your original is unchanged.',
  },
}

/** Stages: decode, fit, render, encode. */
export const compliantImageStages: Record<string, LocalizedCopy> = {
  'reading': { 'zh-tw': '讀取圖片', en: 'Reading image' },
  'decoding': { 'zh-tw': '解碼圖片', en: 'Decoding image' },
  'fitting': { 'zh-tw': '計算裁切與縮放', en: 'Fitting the crop' },
  'rendering': { 'zh-tw': '繪製輸出畫布', en: 'Rendering the canvas' },
  'encoding': { 'zh-tw': '編碼輸出檔案', en: 'Encoding the output' },
  'preparing-download': { 'zh-tw': '準備下載', en: 'Preparing download' },
}

/** Why a requested canvas cannot be produced. */
export const compliantImageSizeIssues: Record<OutputSizeIssue, LocalizedCopy> = {
  'too-small': {
    'zh-tw': '寬和高都要是至少 1 像素的整數，請調整輸出尺寸。',
    en: 'Width and height must be whole numbers of at least 1 pixel. Adjust the output size.',
  },
  'too-large': {
    'zh-tw': '尺寸超過本機處理的上限，請縮小輸出尺寸。',
    en: 'Larger than this device can process. Reduce the output size.',
  },
  'too-many-pixels': {
    'zh-tw': '總像素超過本機處理的上限，請縮小輸出尺寸。',
    en: 'Too many pixels for this device to process. Reduce the output size.',
  },
}
