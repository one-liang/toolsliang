import type { LocalizedCopy } from '../catalog'
import type { ToolFaqEntry } from '../faq'
import { compliantImageErrors, compliantImageStages } from '../compliant-product-image/content'
import { imageInputErrors } from '@/features/images/messages'
import { backgroundRemovalErrors, backgroundRemovalStages } from '../image-background-remover/content'
import { promoErrors } from '../brand-promo-image/content'
import { imageErrors } from '../image-compressor/content'
import { formatAssetSize } from '@/features/pwa/offline-assets'
import type { WorkbenchArchiveIssue } from './archive'
import type { WorkbenchAdmissionCode, WorkbenchItemStatus, WorkbenchQueueLimits } from './queue'
import type { WorkbenchBlockReason, WorkbenchPurpose, WorkbenchStep, WorkbenchStepState } from './session'

export const workbenchStepLabels: Record<WorkbenchStep, LocalizedCopy> = {
  import: { 'zh-tw': '匯入商品圖', en: 'Import the product image' },
  cutout: { 'zh-tw': '去背（選用）', en: 'Remove the background (optional)' },
  layout: { 'zh-tw': '版型與尺寸', en: 'Layout and size' },
  brand: { 'zh-tw': '品牌素材（選用）', en: 'Brand assets (optional)' },
  compress: { 'zh-tw': '壓縮容量（選用）', en: 'Compress for capacity (optional)' },
  output: { 'zh-tw': '輸出與下載', en: 'Output and download' },
}

export const workbenchStepSummaries: Record<WorkbenchStep, LocalizedCopy> = {
  import: {
    'zh-tw': '選一張商品圖開始。圖片只在這台裝置解碼，不會上傳。',
    en: 'Choose one product image to start. It is decoded on this device and never uploaded.',
  },
  cutout: {
    'zh-tw': '可選擇先去背再排版；略過也能繼續，先前成果不受影響。',
    en: 'Optionally remove the background before laying out. Skipping keeps everything you have already done.',
  },
  layout: {
    'zh-tw': '選擇輸出用途，再決定畫布尺寸、背景與商品位置。',
    en: 'Choose what the output is for, then set the canvas, the background, and where the product sits.',
  },
  brand: {
    'zh-tw': '在宣傳圖上疊加框版與 Logo；第一版不含文字與價籤。',
    en: 'Add a frame and a Logo to promotional artwork. Version one has no text or price tags.',
  },
  compress: {
    'zh-tw': '宣傳圖沒有通路規定的容量，可自行設定品質與最大尺寸再輸出；略過就沿用上一步的檔案。',
    en: 'Promotional artwork has no channel capacity rule, so set the quality and the largest size yourself, or skip and keep the previous step\u2019s file.',
  },
  output: {
    'zh-tw': '檢查結果後逐項下載，或把整批打包成一個封存檔。檔案只在你按下下載時才離開瀏覽器記憶體。',
    en: 'Review the results and download them one by one, or pack the whole batch into one archive. A file leaves browser memory only when you download it.',
  },
}

export const workbenchStepStateLabels: Record<WorkbenchStepState, LocalizedCopy> = {
  locked: { 'zh-tw': '尚未開放', en: 'Not open yet' },
  ready: { 'zh-tw': '可以開始', en: 'Ready' },
  running: { 'zh-tw': '處理中', en: 'Working' },
  done: { 'zh-tw': '已完成', en: 'Done' },
  skipped: { 'zh-tw': '已略過', en: 'Skipped' },
  failed: { 'zh-tw': '未完成', en: 'Did not finish' },
  unavailable: { 'zh-tw': '不適用', en: 'Not available' },
}

/**
 * Why a step is not offered. Never a failure, and never a reason to stop the run.
 *
 * A device that cannot run an engine says the same thing wherever it happens,
 * but a step the branch does not have owes its own reason: the brand step is
 * absent because a compliant main image may carry no overlay, and the compress
 * step because the channel already stated the capacity. One sentence covering
 * both would be true of neither.
 */
const capabilityBlockReason: LocalizedCopy = {
  'zh-tw': '這個瀏覽器無法在本機執行這個步驟，已只停用這一步；其餘步驟仍可正常使用。',
  en: 'This browser cannot run this step locally, so only this step is disabled. The rest of the workbench still works.',
}

const purposeBlockReasons: Partial<Record<WorkbenchStep, LocalizedCopy>> = {
  brand: {
    'zh-tw': '合規主圖不得加入框版、Logo 或促銷文字，因此這個步驟不適用。需要品牌素材請改選品牌宣傳圖。',
    en: 'A compliant main image may not carry a frame, a Logo, or promotional text, so this step does not apply. Switch to promotional artwork if you need brand assets.',
  },
  compress: {
    'zh-tw': '合規主圖的容量由通路規格決定，版型步驟已依該範圍輸出，再壓一次會離開規格，因此這個步驟不適用。',
    en: 'A compliant main image\u2019s file capacity comes from the channel specification, and the layout step already wrote inside that range. Compressing it again would leave the range, so this step does not apply.',
  },
}

export function workbenchBlockMessage(step: WorkbenchStep, reason: WorkbenchBlockReason, locale: keyof LocalizedCopy) {
  const message = reason === 'capability' ? capabilityBlockReason : purposeBlockReasons[step] ?? capabilityBlockReason

  return message[locale]
}

export const workbenchPurposeLabels: Record<WorkbenchPurpose, LocalizedCopy> = {
  compliant: { 'zh-tw': '合規主圖', en: 'Compliant main image' },
  promotional: { 'zh-tw': '品牌宣傳圖', en: 'Brand promo image' },
}

export const workbenchPurposeSummaries: Record<WorkbenchPurpose, LocalizedCopy> = {
  compliant: {
    'zh-tw': '依已核對的通路公開規格產生尺寸、背景與容量；不加入框版、Logo 或促銷文字，也不保證通路審核通過。',
    en: 'Sizes, backgrounds, and file capacity follow a reviewed public channel specification. No frame, Logo, or promotional text is added, and approval is never guaranteed.',
  },
  promotional: {
    'zh-tw': '自由設定畫布與背景，可再疊加框版與 Logo；這是宣傳用輸出，不可當成通路主圖。',
    en: 'Set the canvas and background freely, then add a frame and a Logo. This is promotional artwork, not a marketplace main image.',
  },
}

/**
 * A step reports its own engine's sentence.
 *
 * The three engines share code names — `unsupported_browser`, `memory_limit`,
 * `failed` — but not the same explanation: the cutout's is about running a
 * model, the layout's about drawing a canvas. Merging them into one lookup
 * would hand whichever module was spread last to every step, so each step keeps
 * the vocabulary of the tool it is borrowing.
 */
const sharedWorkbenchErrors: Record<string, LocalizedCopy> = {
  missing_step_input: {
    'zh-tw': '這一步的輸入已不存在，請回到前一步重新產生後再繼續。先前完成的步驟未變更。',
    en: 'The input for this step no longer exists. Go back a step, produce it again, and continue. Completed steps are unchanged.',
  },
  memory_limit: {
    'zh-tw': '可用記憶體不足以保留這一步的結果。請關閉其他分頁、縮小輸出尺寸後重試；先前完成的步驟未變更。',
    en: 'There is not enough memory to keep this step\u2019s result. Close other tabs or reduce the output size and retry; earlier steps are unchanged.',
  },
  failed: {
    'zh-tw': '這一步未完成。先前完成的步驟仍保留，可重試或略過後繼續。',
    en: 'This step did not finish. Everything you completed earlier is kept, so retry or skip and carry on.',
  },
}

/** What the download step can refuse, all of it decided before a byte is written. */
const archiveErrors: Record<string, LocalizedCopy> = {
  nothing_to_archive: {
    'zh-tw': '這批還沒有完成的輸出可以打包。完成至少一個項目後再下載封存檔。',
    en: 'This batch has no finished output to pack yet. Finish at least one item, then download the archive.',
  },
  archive_too_large: {
    'zh-tw': '這批輸出合計超過單一封存檔的上限。請先分批下載已完成的項目。',
    en: 'These outputs add up to more than one archive can hold. Download the finished items in smaller groups instead.',
  },
  unsupported_browser: {
    'zh-tw': '這個瀏覽器無法在本機打包封存檔，仍可逐項下載每個完成的輸出。',
    en: 'This browser cannot pack an archive locally. You can still download each finished output on its own.',
  },
}

export const workbenchStepErrors: Record<WorkbenchStep, Record<string, LocalizedCopy>> = {
  import: { ...imageInputErrors, ...sharedWorkbenchErrors },
  cutout: { ...backgroundRemovalErrors, ...sharedWorkbenchErrors },
  layout: { ...compliantImageErrors, ...sharedWorkbenchErrors },
  brand: { ...promoErrors, ...sharedWorkbenchErrors },
  compress: { ...imageErrors, ...sharedWorkbenchErrors },
  output: { ...archiveErrors, ...sharedWorkbenchErrors },
}

export function workbenchErrorMessage(step: WorkbenchStep, code: string, locale: keyof LocalizedCopy) {
  const messages = workbenchStepErrors[step]

  return (messages[code] ?? messages.failed!)[locale]
}

export const workbenchStages: Record<string, LocalizedCopy> = {
  ...compliantImageStages,
  ...backgroundRemovalStages,
  composing: { 'zh-tw': '組合品牌素材', en: 'Composing the brand assets' },
  rendering: { 'zh-tw': '繪製輸出畫布', en: 'Rendering the canvas' },
  archiving: { 'zh-tw': '在本機打包封存檔', en: 'Packing the archive on this device' },
}

/** The sentence that has to survive every redesign of this page. */
export const workbenchLocalNotice: LocalizedCopy = {
  'zh-tw': '整批商品圖、遮罩、框版、Logo、每一步的中間結果、最終輸出與封存檔都留在這台裝置；只有通路 preset 與去背模型會經由網路取得。',
  en: 'The whole batch — product images, mattes, frames, Logos, every intermediate result, the outputs, and the archive — stays on this device. Only channel presets and the background removal model come over the network.',
}

/**
 * What one item in the queue is called.
 *
 * §12.11 asks for accessible item labels generated locally and free of file
 * names. A position in the batch is all a merchant needs to tell two rows
 * apart, and it is the only thing here that does not come from their file.
 */
export function workbenchItemLabel(ordinal: number, locale: keyof LocalizedCopy) {
  return locale === 'en' ? `Item ${ordinal}` : `第 ${ordinal} 項`
}

export const workbenchItemStatusLabels: Record<WorkbenchItemStatus, LocalizedCopy> = {
  pending: { 'zh-tw': '等待處理', en: 'Waiting' },
  running: { 'zh-tw': '處理中', en: 'Working' },
  failed: { 'zh-tw': '未完成', en: 'Did not finish' },
  done: { 'zh-tw': '可以下載', en: 'Ready to download' },
}

/** The ceilings, in the words the merchant is refused with, so both come from one place. */
export function workbenchLimitsNotice(limits: WorkbenchQueueLimits, locale: keyof LocalizedCopy) {
  const size = formatAssetSize(limits.maxBytes, locale)

  return locale === 'en'
    ? `Up to ${limits.maxItems} images and ${size} in one batch on this device.`
    : `這台裝置一次最多 ${limits.maxItems} 張、合計 ${size}。`
}

export function workbenchAdmissionMessage(code: WorkbenchAdmissionCode, limits: WorkbenchQueueLimits, locale: keyof LocalizedCopy) {
  const size = formatAssetSize(limits.maxBytes, locale)
  const messages: Record<WorkbenchAdmissionCode, LocalizedCopy> = {
    too_many_items: {
      'zh-tw': `超過張數上限，多出來的圖片沒有加入。這台裝置一次最多 ${limits.maxItems} 張，移除幾張後可以再加。`,
      en: `That is more images than one batch holds, so the extra ones were not added. This device takes ${limits.maxItems} at a time; remove a few and add them again.`,
    },
    batch_too_large: {
      'zh-tw': `超過合計容量上限，放不下的圖片沒有加入。這台裝置一次最多 ${size}，移除幾張後可以再加。`,
      en: `That is more than one batch holds, so the images that did not fit were not added. This device takes ${size} at a time; remove a few and add them again.`,
    },
  }

  return messages[code][locale]
}

export const workbenchArchiveIssues: Record<WorkbenchArchiveIssue, LocalizedCopy> = {
  nothing_to_archive: archiveErrors.nothing_to_archive!,
  archive_too_large: archiveErrors.archive_too_large!,
}

/** The aggregate live summary: one sentence, every item accounted for. */
export function workbenchQueueSummary(progress: { total: number, done: number, failed: number, running: number, pending: number }, locale: keyof LocalizedCopy) {
  if (progress.total === 0) return locale === 'en' ? 'No images in this batch yet.' : '這批還沒有圖片。'

  return locale === 'en'
    ? `${progress.total} images: ${progress.done} ready to download, ${progress.running} working, ${progress.failed} did not finish, ${progress.pending} waiting.`
    : `共 ${progress.total} 張：${progress.done} 張可以下載、${progress.running} 張處理中、${progress.failed} 張未完成、${progress.pending} 張等待處理。`
}

export const productImageWorkbenchFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': '這個工作台和單獨的圖片工具有什麼不同？', en: 'How is the workbench different from the individual tools?' },
    body: {
      'zh-tw': '它用的是同一批本機引擎：去背用人像去背、版型與尺寸用合規主圖、框版與 Logo 用品牌宣傳圖。差別是中間結果留在瀏覽器記憶體裡直接交給下一步，不必反覆匯出再匯入。每個工具仍有自己的頁面，可以單獨使用。',
      en: 'It runs the same local engines: the portrait background remover, the compliant product image renderer, and the brand promo composer. The difference is that each result is handed to the next step in browser memory instead of being exported and imported again. Every tool still has its own page and works on its own.',
    },
  },
  {
    heading: { 'zh-tw': '去背可以處理商品圖嗎？', en: 'Can the cutout step handle product photos?' },
    body: {
      'zh-tw': '第一版只有人像去背模型，它只學過把人和背景分開；商品、動物或風景通常不可用。去背是選用步驟，可以略過，直接進入版型與尺寸。',
      en: 'Version one only ships the portrait matting model, which was trained to separate people from a background; products, animals, and scenery usually come out unusable. The cutout is optional, so you can skip it and go straight to layout.',
    },
  },
  {
    heading: { 'zh-tw': '某一步失敗或取消，前面的成果會不見嗎？', en: 'If a step fails or is cancelled, do I lose the earlier work?' },
    body: {
      'zh-tw': '不會。失敗與取消只影響那一步，先前完成的步驟仍然保留，可以重試、略過或回到前一步調整。重新執行某一步時，它之後的結果會被作廢並重新產生，避免拿舊結果當成新結果。',
      en: 'No. A failure or a cancellation affects only that step; everything completed earlier is kept, and you can retry, skip, or go back and adjust. Re-running a step discards the results after it so a stale result is never presented as the new one.',
    },
  },
  {
    heading: { 'zh-tw': '瀏覽器不支援某個步驟會怎樣？', en: 'What happens if my browser cannot run a step?' },
    body: {
      'zh-tw': '只有那一步會停用並說明原因，其餘步驟照常可用。例如無法在本機執行模型時，去背會停用，匯入、版型、品牌素材與輸出仍可完成。',
      en: 'Only that step is disabled, with the reason stated; the rest keeps working. If the model cannot run locally, for example, the cutout is disabled while import, layout, brand assets, and output still finish.',
    },
  },
  {
    heading: { 'zh-tw': '工作進度會被保存嗎？', en: 'Is my work saved?' },
    body: {
      'zh-tw': '不會。工作階段只存在於這個分頁，關閉或重新整理就會清空，也不會同步到雲端；離開前如果還有未完成的工作，瀏覽器會先提醒你。已保存的框版與 Logo 屬於本機資產，仍留在這台裝置。',
      en: 'No. The session lives in this tab only, is cleared when you close or reload it, and never syncs to the cloud; your browser warns you before you leave with unfinished work. Frames and Logos you saved earlier are local assets and stay on this device.',
    },
  },
  {
    heading: { 'zh-tw': '一次可以處理幾張？超過會怎樣？', en: 'How many images fit in one batch?' },
    body: {
      'zh-tw': '預設一次最多 20 張、合計 200 MiB，並依這台裝置回報的記憶體再往下調；實際數字會直接寫在匯入步驟裡。超過的圖片在加入時就被退回並說明原因，不會先收下再中途失敗，移除幾張後可以再加。單張仍受既有的 25 MiB、2,400 萬像素與單邊 8,192 像素上限限制。',
      en: 'The default is 20 images and 200 MiB combined, lowered further when the device reports less memory; the actual numbers are printed in the import step. Images beyond the limit are refused as you add them, with the reason stated, rather than accepted and failed halfway; remove a few and add them again. Each image is still held to the shared 25 MiB, 24 megapixel, and 8,192 pixel-per-side limits.',
    },
  },
  {
    heading: { 'zh-tw': '批次裡有一張失敗，其他張會受影響嗎？', en: 'If one image in the batch fails, what happens to the rest?' },
    body: {
      'zh-tw': '不會。每張圖片各自走自己的流程，失敗只記在那一張上，可以單獨重試或從佇列移除；其他張照常完成，也照常可以下載。取消也一樣：只有明確完成的項目會留下可下載的檔案。',
      en: 'Nothing. Each image runs its own pipeline, a failure is recorded on that image alone, and you can retry or remove just that one; the rest finish and stay downloadable. Cancelling behaves the same way — only items that explicitly finished keep a file you can download.',
    },
  },
  {
    heading: { 'zh-tw': '封存檔是在哪裡打包的？', en: 'Where is the archive built?' },
    body: {
      'zh-tw': '在這台裝置的瀏覽器裡。整批輸出會在背景執行緒打包成一個 ZIP，過程中不經過任何伺服器；封存檔裡的檔名只由用途與序號組成，也不寫入裝置時間。如果這個瀏覽器無法打包，工作台會直接說明，並讓你逐項下載。',
      en: 'In this browser, on this device. The finished outputs are packed into one ZIP on a background thread without any server involved; names inside it are built from the output\u2019s purpose and its position, and no device clock is written into the file. If this browser cannot pack an archive, the workbench says so and you download each output on its own.',
    },
  },
  {
    heading: { 'zh-tw': '輸出可以直接上架嗎？', en: 'Can I upload the output directly?' },
    body: {
      'zh-tw': '合規主圖分支會依已核對的通路公開規格產生尺寸與容量，並列出哪些規則由工具核對、哪些必須你自己確認；它是規格輔助，不保證通路審核通過。品牌宣傳圖分支是宣傳用輸出，不可當成通路主圖。',
      en: 'The compliant branch produces the size and capacity a reviewed public channel specification states, and lists which rules the tool checked and which you must judge yourself; it is specification guidance, not a guarantee of approval. The promotional branch is artwork and is not a marketplace main image.',
    },
  },
]
