/**
 * Everything the tool says out loud.
 *
 * The eight sentences T24 fixed in §10 of the decision record are imported from
 * the domain module rather than retyped here: they may be placed, never
 * rewritten. §10.2 of the same record lists the wording that would turn
 * "stamping a picture" into "this document is now in force"; the tests hold
 * every surface below to that list.
 */
import { pdfSignatureDisclosures, pdfSignatureLimits, type PdfSignatureFailureCode, type PdfSignatureStage } from './domain/reference'
import type { LocalizedCopy } from '../catalog'
import type { ToolFaqEntry } from '../faq'

const maxMegabytes = pdfSignatureLimits.maxBytes / (1024 * 1024)

/**
 * One sentence per failure, each ending somewhere the visitor can go next. Every
 * one of them says the file on the device is untouched, because that is the
 * first thing a person wonders when a tool refuses their document.
 */
export const pdfSignatureErrors: Record<PdfSignatureFailureCode, LocalizedCopy> = {
  unsupported_browser: {
    'zh-tw': '這個瀏覽器無法在本機開啟並編輯 PDF。請改用支援背景處理與畫布輸出的最新版瀏覽器後重試。原檔未變更。',
    en: 'This browser cannot open and edit a PDF locally. Retry in an up-to-date browser with background processing and canvas output. Your original is unchanged.',
  },
  not_a_pdf: {
    'zh-tw': '這個檔案不是 PDF。請改選 PDF 檔後重試；原檔未變更。',
    en: 'That file is not a PDF. Choose a PDF and retry; nothing about your file was changed.',
  },
  damaged_pdf: {
    'zh-tw': pdfSignatureDisclosures['damaged-file-refused']['zh-tw'] + '請改用沒有損壞的檔案，或用原本的程式重新輸出一份。原檔未變更。',
    en: `${pdfSignatureDisclosures['damaged-file-refused'].en} Use an undamaged copy, or export the file again from the program that made it. Your original is unchanged.`,
  },
  password_required: {
    'zh-tw': '這份 PDF 需要開啟密碼。請輸入密碼後再開啟；密碼只在這台裝置上使用，不會被傳送或保存。原檔未變更。',
    en: 'This PDF needs its open password. Enter it to continue; the password is used on this device only and is never sent or stored. Your original is unchanged.',
  },
  password_rejected: {
    'zh-tw': '密碼不正確，檔案沒有被開啟。請重新輸入；原檔未變更。',
    en: 'That password did not open the file. Try again; nothing about your original was changed.',
  },
  unsupported_encryption: {
    'zh-tw': '這份 PDF 使用工具尚未支援的保護方式，已停止處理。請用原本的程式移除保護後再試。原檔未變更。',
    en: 'This PDF uses a protection method the tool does not support, so it was not processed. Remove the protection in the program that made it and retry. Your original is unchanged.',
  },
  modification_not_permitted: {
    'zh-tw': '這份 PDF 的權限設定不允許修改頁面內容，因此無法加上簽名。請向檔案提供者索取可編輯的版本。原檔未變更。',
    en: 'This PDF\'s own permissions do not allow its page content to be changed, so no signature can be added. Ask whoever sent it for an editable copy. Your original is unchanged.',
  },
  too_many_pages: {
    'zh-tw': `頁數超過本機處理上限 ${pdfSignatureLimits.maxPages} 頁。請先拆分檔案後再簽名；原檔未變更。`,
    en: `This document has more than the local limit of ${pdfSignatureLimits.maxPages} pages. Split it first and sign the part you need; your original is unchanged.`,
  },
  too_large: {
    'zh-tw': `檔案超過本機處理上限 ${maxMegabytes} MiB，尚未讀取內容。請改用較小的檔案；原檔未變更。`,
    en: `The file is larger than the local limit of ${maxMegabytes} MiB, so nothing was read. Use a smaller file; your original is unchanged.`,
  },
  insufficient_memory: {
    'zh-tw': '可用記憶體不足以在本機處理這份 PDF。請關閉其他分頁或改用較小的檔案後重試；原檔未變更。',
    en: 'There is not enough memory to handle this PDF locally. Close other tabs or use a smaller file and retry; your original is unchanged.',
  },
  export_failed: {
    'zh-tw': '簽名未能寫入這份 PDF，沒有產生任何檔案。請重試或改用另一份檔案；原檔未變更。',
    en: 'The signature could not be written into this PDF and no file was produced. Retry, or try another document; your original is unchanged.',
  },
  export_unreadable: {
    'zh-tw': '產生的檔案無法重新開啟，已丟棄不提供下載。請改用沒有損壞的檔案後重試；原檔未變更。',
    en: 'The file that came out could not be opened again, so it was discarded instead of offered. Try an undamaged document; your original is unchanged.',
  },
  cancelled: {
    'zh-tw': '已取消。可以重新開啟同一份檔案，放置好的簽名會保留；原檔未變更。',
    en: 'Cancelled. You can open the same file again and your placements are kept; nothing about your original was changed.',
  },
}

/** The signature itself is an image, so it has its own small vocabulary. */
export const signatureInputErrors: Record<string, LocalizedCopy> = {
  unsupported_heic: {
    'zh-tw': '不支援 HEIC／HEIF 的簽名圖片。請改用透明背景的 PNG 或 WebP。',
    en: 'HEIC/HEIF signature images are not supported. Use a PNG or WebP with a transparent background.',
  },
  unsupported_format: {
    'zh-tw': '這個檔案不是可用的圖片。請改用透明背景的 PNG 或 WebP。',
    en: 'That file is not a usable image. Use a PNG or WebP with a transparent background.',
  },
  signature_needs_alpha: {
    'zh-tw': '簽名圖片需要透明背景，JPEG 會在頁面上蓋出一個白框。請改用 PNG 或 WebP。',
    en: 'A signature image needs a transparent background; a JPEG would cover the page with a solid block. Use a PNG or WebP.',
  },
  signature_is_opaque: {
    'zh-tw': '這張圖片沒有任何透明區域，放到頁面上會遮住底下的內容。請改用去背後的簽名圖。',
    en: 'This image has no transparent area, so it will hide whatever is under it. Use a signature image with its background removed.',
  },
  signature_empty: {
    'zh-tw': '還沒有簽名。請在簽名板上寫下簽名、輸入文字或匯入透明圖片。',
    en: 'There is no signature yet. Draw one on the pad, type one, or import a transparent image.',
  },
  signature_unreadable: {
    'zh-tw': '這個保存的簽名讀不回來，可能已經損壞。請刪除後重新建立一個。',
    en: 'That saved signature could not be read back and may be damaged. Delete it and make a new one.',
  },
  multiple_files: {
    'zh-tw': '一次只能選一個檔案。',
    en: 'Choose one file at a time.',
  },
}

/** The five stages §12.12 fixes, named for the progress line. */
export const pdfSignatureStageLabels: Record<PdfSignatureStage, LocalizedCopy> = {
  read: { 'zh-tw': '讀取檔案', en: 'Reading the file' },
  parse: { 'zh-tw': '解析頁面', en: 'Reading the pages' },
  preview: { 'zh-tw': '產生頁面預覽', en: 'Drawing the page' },
  apply: { 'zh-tw': '套用簽名', en: 'Placing the signature' },
  write: { 'zh-tw': '寫出新的 PDF', en: 'Writing the new PDF' },
}

export const pdfSignatureFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': 'PDF 會被傳送到伺服器嗎？', en: 'Is my PDF sent to a server?' },
    body: {
      'zh-tw': `不會。${pdfSignatureDisclosures['local-processing']['zh-tw']}工具沒有任何可以接收檔案的端點，關閉分頁就會清掉工作內容。`,
      en: `No. ${pdfSignatureDisclosures['local-processing'].en} There is no endpoint here that could receive a file, and closing the tab clears the workspace.`,
    },
  },
  {
    heading: { 'zh-tw': '這等於在 PDF 上簽名生效嗎？', en: 'Does this make the document signed and in force?' },
    body: {
      'zh-tw': `${pdfSignatureDisclosures['not-a-digital-signature']['zh-tw']}${pdfSignatureDisclosures['no-identity-verification']['zh-tw']}需要憑證式簽章時，請改用發證機構提供的工具。`,
      en: `${pdfSignatureDisclosures['not-a-digital-signature'].en} ${pdfSignatureDisclosures['no-identity-verification'].en} When a certificate-based signature is required, use the tool your certificate authority provides.`,
    },
  },
  {
    heading: { 'zh-tw': '有密碼的 PDF 可以用嗎？', en: 'Can I use a password-protected PDF?' },
    body: {
      'zh-tw': `可以，輸入開啟密碼即可。${pdfSignatureDisclosures['password-stays-on-device']['zh-tw']}${pdfSignatureDisclosures['decrypted-export']['zh-tw']}如果檔案的權限設定不允許修改內容，工具會直接說明而不嘗試繞過。`,
      en: `Yes, with its open password. ${pdfSignatureDisclosures['password-stays-on-device'].en} ${pdfSignatureDisclosures['decrypted-export'].en} If the file's own permissions forbid changing its content, the tool says so instead of working around it.`,
    },
  },
  {
    heading: { 'zh-tw': '保存的簽名放在哪裡？', en: 'Where is a saved signature kept?' },
    body: {
      'zh-tw': `${pdfSignatureDisclosures['saved-signature-is-local']['zh-tw']}你可以在「本機資產」頁面隨時更名、匯出備份或刪除；不保存時，簽名會隨分頁關閉消失。`,
      en: `${pdfSignatureDisclosures['saved-signature-is-local'].en} You can rename, back up, or delete it from the saved-assets page at any time; if you do not save it, the signature goes away with the tab.`,
    },
  },
  {
    heading: { 'zh-tw': '輸出的檔案會有什麼變化？', en: 'What changes in the file I download?' },
    body: {
      'zh-tw': `${pdfSignatureDisclosures['original-pages-untouched']['zh-tw']}未加密的檔案以增量更新寫出，沒有簽名的頁面維持原本的位元組；每一份輸出都會先重新開啟確認讀得到，讀不到就不提供下載。`,
      en: `${pdfSignatureDisclosures['original-pages-untouched'].en} An unencrypted file is written as an incremental update, so the pages you did not sign keep their original bytes, and every export is opened again before it is offered — if it cannot be read, it is not handed over.`,
    },
  },
  {
    heading: { 'zh-tw': '有哪些限制？', en: 'What are the limits?' },
    body: {
      'zh-tw': `單次最多 ${pdfSignatureLimits.maxPages} 頁、${maxMegabytes} MiB，且依裝置可用記憶體可能更低。簽名一律轉成帶透明度的 PNG 疊在頁面上，不會嵌入字型，也不會改寫頁面原有的文字；表單欄位、XFA 表單與加了憑證簽章的檔案不在支援範圍。`,
      en: `Up to ${pdfSignatureLimits.maxPages} pages and ${maxMegabytes} MiB at a time, and less on a device with less memory. Every signature becomes a transparent PNG placed over the page — no font is embedded and no existing text is rewritten. Form fields, XFA forms, and files that already carry a certificate-based signature are out of scope.`,
    },
  },
]
