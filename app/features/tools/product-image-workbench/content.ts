import type { LocalizedCopy } from '../catalog'
import type { ToolFaqEntry } from '../faq'
import { compliantImageErrors, compliantImageStages } from '../compliant-product-image/content'
import { imageInputErrors } from '@/features/images/messages'
import { backgroundRemovalErrors, backgroundRemovalStages } from '../image-background-remover/content'
import { promoErrors } from '../brand-promo-image/content'
import type { WorkbenchBlockReason, WorkbenchPurpose, WorkbenchStep, WorkbenchStepState } from './session'

export const workbenchStepLabels: Record<WorkbenchStep, LocalizedCopy> = {
  import: { 'zh-tw': '匯入商品圖', en: 'Import the product image' },
  cutout: { 'zh-tw': '去背（選用）', en: 'Remove the background (optional)' },
  layout: { 'zh-tw': '版型與尺寸', en: 'Layout and size' },
  brand: { 'zh-tw': '品牌素材（選用）', en: 'Brand assets (optional)' },
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
  output: {
    'zh-tw': '檢查結果後下載。檔案只在你按下下載時才離開瀏覽器記憶體。',
    en: 'Review the result and download it. The file leaves browser memory only when you download it.',
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

/** Why a step is not offered. Never a failure, and never a reason to stop the run. */
export const workbenchBlockReasons: Record<WorkbenchBlockReason, LocalizedCopy> = {
  purpose: {
    'zh-tw': '合規主圖不得加入框版、Logo 或促銷文字，因此這個步驟不適用。需要品牌素材請改選品牌宣傳圖。',
    en: 'A compliant main image may not carry a frame, a Logo, or promotional text, so this step does not apply. Switch to promotional artwork if you need brand assets.',
  },
  capability: {
    'zh-tw': '這個瀏覽器無法在本機執行這個步驟，已只停用這一步；其餘步驟仍可正常使用。',
    en: 'This browser cannot run this step locally, so only this step is disabled. The rest of the workbench still works.',
  },
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

export const workbenchStepErrors: Record<WorkbenchStep, Record<string, LocalizedCopy>> = {
  import: { ...imageInputErrors, ...sharedWorkbenchErrors },
  cutout: { ...backgroundRemovalErrors, ...sharedWorkbenchErrors },
  layout: { ...compliantImageErrors, ...sharedWorkbenchErrors },
  brand: { ...promoErrors, ...sharedWorkbenchErrors },
  output: { ...sharedWorkbenchErrors },
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
}

/** The sentence that has to survive every redesign of this page. */
export const workbenchLocalNotice: LocalizedCopy = {
  'zh-tw': '商品圖、遮罩、框版、Logo、每一步的中間結果與最終輸出都留在這台裝置；只有通路 preset 與去背模型會經由網路取得。',
  en: 'Product images, mattes, frames, Logos, every intermediate result, and the final output stay on this device. Only channel presets and the background removal model come over the network.',
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
    heading: { 'zh-tw': '輸出可以直接上架嗎？', en: 'Can I upload the output directly?' },
    body: {
      'zh-tw': '合規主圖分支會依已核對的通路公開規格產生尺寸與容量，並列出哪些規則由工具核對、哪些必須你自己確認；它是規格輔助，不保證通路審核通過。品牌宣傳圖分支是宣傳用輸出，不可當成通路主圖。',
      en: 'The compliant branch produces the size and capacity a reviewed public channel specification states, and lists which rules the tool checked and which you must judge yourself; it is specification guidance, not a guarantee of approval. The promotional branch is artwork and is not a marketplace main image.',
    },
  },
]
