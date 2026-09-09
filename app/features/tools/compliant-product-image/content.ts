import type { LocaleCode, LocalizedCopy } from '../catalog'
import type { ToolFaqEntry } from '../faq'
import { imageInputErrors } from '@/features/images/messages'
import type { RuleDisposition } from './domain/preset'
import type { OutputSizeIssue } from './domain/render'
import { byteUnitFactor } from './domain/reference'
import type {
  CompliantImageChannelId,
  CompliantImageFormat,
  CompliantImagePresetRule,
  CompliantImageRole,
  CompliantImageViewNoticeCode,
  ConstraintKind,
  PresetCoverage,
  PresetStatus,
  RuleAuthority,
  RuleVerification,
} from './domain/reference'
import type { CompliantImageCaveatKey, CompliantImageExclusionReason } from './domain/sources'

/**
 * Everything this tool says out loud.
 *
 * Two of these tables are not written here at all — they are transcribed. The
 * caveats and the view notices are fixed word for word by §7.1 and §5.6 of
 * `docs/research/005-compliant-product-image-presets-and-sources.md`, and
 * `tests/compliant-product-image-content.test.ts` compares them against the
 * record, so a sentence cannot be softened in the interface without failing.
 * The same test keeps §7.3's forbidden wording out of every string below: this
 * tool restates what a channel published and never claims a channel will accept
 * anything.
 */

/** §7.1 — every one of these has to be visible while a preset is selected. */
export const compliantImageCaveats: Record<CompliantImageCaveatKey, LocalizedCopy> = {
  'no-approval-guarantee': {
    'zh-tw': '規格輔助，不保證通路審核通過。',
    en: 'Specification guidance, not a guarantee of channel approval.',
  },
  'not-official-partner': {
    'zh-tw': 'toolsliang 與各通路沒有合作或授權關係，preset 只整理通路自己公開的規格。',
    en: 'toolsliang has no partnership or endorsement from any channel; presets only restate each channel\'s own published specification.',
  },
  'source-and-review-date': {
    'zh-tw': '每個 preset 都標示來源網址與查核日期，實際規定以通路當下的公告為準。',
    en: 'Every preset shows its source URL and review date; the channel\'s current announcement always governs.',
  },
  'channel-may-change': {
    'zh-tw': '通路可能在沒有通知的情況下改變規格，查核日期之後的變動不會自動反映。',
    en: 'Channels can change specifications without notice, and changes after the review date are not reflected automatically.',
  },
  'manual-rules-not-checked': {
    'zh-tw': '背景、商品佔比、文字與浮水印等規則工具無法自動判定，只會列出來提醒你。',
    en: 'Background, product occupancy, text and watermark rules cannot be judged automatically and are listed as reminders only.',
  },
  'unspecified-fields-not-inferred': {
    'zh-tw': '通路沒有公開的欄位維持空白，不會套用其他通路的數值。',
    en: 'Fields a channel does not publish stay empty and never borrow a value from another channel.',
  },
  'expired-preset-disabled': {
    'zh-tw': '超過查核效期的 preset 會停用，不會拿舊規格繼續判定輸出。',
    en: 'A preset past its review deadline is disabled rather than used with stale rules.',
  },
  'local-processing': {
    'zh-tw': '商品圖片、裁切參數、預覽與輸出只在這台裝置上處理。',
    en: 'Product images, crop settings, previews and outputs are processed only on this device.',
  },
}

/** §5.6 — in the order the checks run, from "does it exist" to "what about the rules". */
export const compliantImageNotices: Record<CompliantImageViewNoticeCode, LocalizedCopy> = {
  'preset-unknown': {
    'zh-tw': '找不到這個通路規格。',
    en: 'This channel preset does not exist.',
  },
  'preset-retired': {
    'zh-tw': '這個通路規格已停止維護，不再用來檢查輸出。',
    en: 'This channel preset is no longer maintained and is not used to check output.',
  },
  'preset-expired': {
    'zh-tw': '這個通路規格已超過查核效期，暫時停用；請直接查看通路的最新公告。',
    en: 'This channel preset is past its review deadline and is disabled; check the channel announcement instead.',
  },
  'preset-review-due': {
    'zh-tw': '這個通路規格已到重新查核時間，內容可能落後於通路公告。',
    en: 'This channel preset is due for review and may lag behind the channel announcement.',
  },
  'rule-not-in-force': {
    'zh-tw': '這條規則自指定日期起才生效，目前不列入檢查。',
    en: 'This rule only takes effect on the stated date and is not checked yet.',
  },
  'rules-need-your-check': {
    'zh-tw': '有些規則要靠你自己確認，工具沒有替你檢查。',
    en: 'Some rules are yours to confirm; the tool has not checked them for you.',
  },
}

export const compliantImageErrors: Record<string, LocalizedCopy> = {
  ...imageInputErrors,
  preset_unavailable: {
    'zh-tw': '這個通路規格目前停用，無法用來產生輸出。請改選其他通路，或直接查看通路的最新公告。原圖未變更。',
    en: 'This channel preset is disabled and cannot be used to produce an output. Pick another channel or read the channel announcement. Your original is unchanged.',
  },
  invalid_options: {
    'zh-tw': '輸出設定超出這個通路允許的範圍，請依欄位說明調整後重試。',
    en: 'These output settings fall outside what this channel allows. Adjust the fields as described and retry.',
  },
  unsupported_browser: {
    'zh-tw': '這個瀏覽器無法在背景處理圖片。請改用支援 Worker 與 OffscreenCanvas 的瀏覽器後重試。原圖未變更。',
    en: 'This browser cannot process images in the background. Retry in a browser with Worker and OffscreenCanvas support. Your original is unchanged.',
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

/** §12.9 stages: validate the preset, decode, fit, render, encode. */
export const compliantImageStages: Record<string, LocalizedCopy> = {
  'validating-preset': { 'zh-tw': '檢查通路規格', en: 'Checking the channel preset' },
  'reading': { 'zh-tw': '讀取圖片', en: 'Reading image' },
  'decoding': { 'zh-tw': '解碼圖片', en: 'Decoding image' },
  'fitting': { 'zh-tw': '計算裁切與縮放', en: 'Fitting the crop' },
  'rendering': { 'zh-tw': '繪製輸出畫布', en: 'Rendering the canvas' },
  'encoding': { 'zh-tw': '編碼輸出檔案', en: 'Encoding the output' },
  'preparing-download': { 'zh-tw': '準備下載', en: 'Preparing download' },
}

/** Why a requested canvas cannot be produced, said in terms of the channel's own rule. */
export const compliantImageSizeIssues: Record<OutputSizeIssue, LocalizedCopy> = {
  'too-small': {
    'zh-tw': '尺寸小於這個通路允許的下限，請放大輸出尺寸。',
    en: 'Smaller than this channel allows. Increase the output size.',
  },
  'not-exact': {
    'zh-tw': '這個通路只接受一種尺寸，寬與高不能修改。',
    en: 'This channel accepts one size only; width and height cannot be changed.',
  },
  'ratio': {
    'zh-tw': '長寬比不在這個通路允許的範圍內，請調整寬或高。',
    en: 'The aspect ratio is outside what this channel allows. Adjust the width or the height.',
  },
  'longest-side': {
    'zh-tw': '長邊不在這個通路允許的範圍內，請調整較長的一邊。',
    en: 'The longest side is outside what this channel allows. Adjust the longer side.',
  },
  'too-large': {
    'zh-tw': '尺寸超過這個通路或本機處理的上限，請縮小輸出尺寸。',
    en: 'Larger than this channel or this device allows. Reduce the output size.',
  },
  'too-many-pixels': {
    'zh-tw': '總像素超過這個通路或本機處理的上限，請縮小輸出尺寸。',
    en: 'Too many pixels for this channel or this device. Reduce the output size.',
  },
}

export const presetStatusLabels: Record<PresetStatus, LocalizedCopy> = {
  'active': { 'zh-tw': '在查核效期內', en: 'Within its review period' },
  'review-due': { 'zh-tw': '待重新查核', en: 'Due for review' },
  'expired': { 'zh-tw': '已過效期，停用', en: 'Past its deadline, disabled' },
  'retired': { 'zh-tw': '已停止維護', en: 'No longer maintained' },
}

/** The seven answers a check can give one rule; together they account for all of them. */
export const ruleDispositionLabels: Record<RuleDisposition, LocalizedCopy> = {
  'passed': { 'zh-tw': '已檢查並通過', en: 'Checked and met' },
  'failed': { 'zh-tw': '已檢查，未通過', en: 'Checked and not met' },
  'advisory': { 'zh-tw': '未達成的建議', en: 'Recommendation not met' },
  'assisted': { 'zh-tw': '工具只提供輔助，由你判斷', en: 'Tool assists, you decide' },
  'manual': { 'zh-tw': '需要你自行確認', en: 'Yours to confirm' },
  'out-of-scope': { 'zh-tw': '本工具不做這件事', en: 'This tool does not do this' },
  'scheduled': { 'zh-tw': '尚未生效', en: 'Not in force yet' },
}

export const ruleAuthorityLabels: Record<RuleAuthority, LocalizedCopy> = {
  requirement: { 'zh-tw': '規範', en: 'Requirement' },
  recommendation: { 'zh-tw': '建議', en: 'Recommendation' },
  permission: { 'zh-tw': '通路允許', en: 'Permitted by the channel' },
}

export const ruleVerificationLabels: Record<RuleVerification, LocalizedCopy> = {
  'automatic': { 'zh-tw': '工具可自動判定', en: 'Judged by the tool' },
  'assisted': { 'zh-tw': '工具提供輔助', en: 'Assisted by the tool' },
  'manual': { 'zh-tw': '由你自行確認', en: 'Confirmed by you' },
  'out-of-scope': { 'zh-tw': '不在工具範圍', en: 'Outside this tool' },
}

export const constraintKindLabels: Record<ConstraintKind, LocalizedCopy> = {
  'dimension-exact': { 'zh-tw': '固定尺寸', en: 'Exact dimensions' },
  'dimension-range': { 'zh-tw': '尺寸範圍', en: 'Dimension range' },
  'longest-side-range': { 'zh-tw': '長邊範圍', en: 'Longest side range' },
  'aspect-ratio-exact': { 'zh-tw': '固定長寬比', en: 'Exact aspect ratio' },
  'aspect-ratio-range': { 'zh-tw': '長寬比範圍', en: 'Aspect ratio range' },
  'megapixel-max': { 'zh-tw': '像素上限', en: 'Megapixel limit' },
  'byte-range': { 'zh-tw': '檔案大小', en: 'File size' },
  'format-set': { 'zh-tw': '可用格式', en: 'Allowed formats' },
  'chroma-model': { 'zh-tw': '色度模型', en: 'Chroma model' },
  'count-range': { 'zh-tw': '圖片張數', en: 'Number of images' },
  'occupancy-min': { 'zh-tw': '商品佔比', en: 'Product occupancy' },
  'safe-area-inset': { 'zh-tw': '安全區留白', en: 'Safe area inset' },
  'overlay-area-max': { 'zh-tw': '疊加元素上限', en: 'Overlay limit' },
  'background': { 'zh-tw': '背景', en: 'Background' },
  'metadata-preservation': { 'zh-tw': '中繼資料保留', en: 'Metadata to keep' },
  'placement-allowance': { 'zh-tw': '允許的擺放位置', en: 'Allowed placement' },
  'prohibition': { 'zh-tw': '禁止事項', en: 'Prohibition' },
}

export const compliantImageCoverageLabels: Record<PresetCoverage, LocalizedCopy> = {
  full: {
    'zh-tw': '來源同時載明尺寸、容量與格式',
    en: 'The source states dimensions, capacity and formats',
  },
  partial: {
    'zh-tw': '來源未公開全部欄位，缺的部分留空',
    en: 'The source does not publish every field; what is missing stays empty',
  },
}

/** §4.1 — the reviewed channels, named the way the record names them. */
export const compliantImageChannelLabels: Record<CompliantImageChannelId, LocalizedCopy> = {
  'google-merchant-center': {
    'zh-tw': 'Google 購物（Merchant Center 產品資料）',
    en: 'Google Shopping (Merchant Center product data)',
  },
  'amazon': { 'zh-tw': 'Amazon 商品頁圖片', en: 'Amazon product page images' },
  'momo-store': { 'zh-tw': 'momo 商店（賣家自行上架）', en: 'momo store (seller-published)' },
  'ruten': { 'zh-tw': '露天市集', en: 'Ruten' },
}

/** §4.2 — one channel can rule two roles in opposite directions, so the role is named. */
export const compliantImageRoleLabels: Record<CompliantImageRole, LocalizedCopy> = {
  main: { 'zh-tw': '商品頁的主要商品圖', en: 'The main image on a product page' },
  ad: { 'zh-tw': '通路自己的廣告與推薦版位用圖', en: 'The channel\'s own ad and recommendation slots' },
  variant: { 'zh-tw': '商品規格（款式）選項圖', en: 'The variant (option) image' },
}

/** §3.3 — why a channel a merchant expects to see has no preset. */
export const compliantImageExclusionLabels: Record<CompliantImageExclusionReason, LocalizedCopy> = {
  'requires-javascript': {
    'zh-tw': '規格頁需要執行 JavaScript 才讀得到，無法穩定重查。',
    en: 'The specification page only renders with JavaScript, so it cannot be re-checked reliably.',
  },
  'requires-sign-in': {
    'zh-tw': '規格頁需要登入才看得到。',
    en: 'The specification is behind a sign-in.',
  },
  'automated-access-restricted': {
    'zh-tw': '網站自己的存取規則不允許自動取得該頁。',
    en: 'The site\'s own access rules do not allow fetching that page automatically.',
  },
  'no-public-specification': {
    'zh-tw': '通路沒有公開可引用的圖片規格。',
    en: 'The channel publishes no citable image specification.',
  },
  'conflicting-sources': {
    'zh-tw': '通路自己的說法互相矛盾，收斂前不納入。',
    en: 'The channel contradicts itself; it stays out until that is resolved.',
  },
  'source-withdrawn': {
    'zh-tw': '原本引用的頁面已被撤下。',
    en: 'The page this preset cited has been taken down.',
  },
}

const positionLabels: Record<string, LocalizedCopy> = {
  'bottom-left': { 'zh-tw': '左下', en: 'bottom left' },
  'bottom-right': { 'zh-tw': '右下', en: 'bottom right' },
  'empty-area': { 'zh-tw': '空白處', en: 'an empty area' },
}

const formatNames: Record<CompliantImageFormat, string> = {
  jpeg: 'JPEG', png: 'PNG', webp: 'WebP', gif: 'GIF', bmp: 'BMP', tiff: 'TIFF',
}

function number(value: number, locale: LocaleCode) {
  return new Intl.NumberFormat(locale === 'en' ? 'en' : 'zh-TW').format(value)
}

/** Every channel writes pixel counts plain — `1000 px * 1000 px` — so the page does too. */
function pixels(value: number) {
  return String(value)
}

/** Sources write capacity in decimal kB (§ byteUnitFactor), so the page reads it back the same way. */
function kilobytes(value: number, locale: LocaleCode) {
  return `${number(value / byteUnitFactor, locale)} kB`
}

function join(parts: string[], locale: LocaleCode) {
  return parts.join(locale === 'en' ? ', ' : '、')
}

/**
 * One rule, written as a sentence a merchant can act on. It never says whether
 * an output meets the rule — that is `checkOutputAgainstPreset`'s answer — and
 * the page always shows `rule.quote` beside it, so the channel's own wording
 * stays one glance away.
 */
export function describeRuleValue(rule: CompliantImagePresetRule, locale: LocaleCode): string {
  const en = locale === 'en'

  switch (rule.kind) {
    case 'dimension-exact':
      return en
        ? `Exactly ${pixels(rule.value.width)} × ${pixels(rule.value.height)} px`
        : `尺寸須為 ${pixels(rule.value.width)} × ${pixels(rule.value.height)} 像素`
    case 'dimension-range': {
      const { minWidth, maxWidth, minHeight, maxHeight } = rule.value
      const parts: string[] = []
      if (minWidth !== undefined) parts.push(en ? `width at least ${pixels(minWidth)} px` : `寬度至少 ${pixels(minWidth)} 像素`)
      if (maxWidth !== undefined) parts.push(en ? `width at most ${pixels(maxWidth)} px` : `寬度最多 ${pixels(maxWidth)} 像素`)
      if (minHeight !== undefined) parts.push(en ? `height at least ${pixels(minHeight)} px` : `高度至少 ${pixels(minHeight)} 像素`)
      if (maxHeight !== undefined) parts.push(en ? `height at most ${pixels(maxHeight)} px` : `高度最多 ${pixels(maxHeight)} 像素`)
      return join(parts, locale)
    }
    case 'longest-side-range': {
      const { min, max } = rule.value
      if (min !== undefined && max !== undefined) return en ? `Longest side ${pixels(min)}–${pixels(max)} px` : `長邊 ${pixels(min)}–${pixels(max)} 像素`
      if (min !== undefined) return en ? `Longest side at least ${pixels(min)} px` : `長邊至少 ${pixels(min)} 像素`
      return en ? `Longest side at most ${pixels(max!)} px` : `長邊最多 ${pixels(max!)} 像素`
    }
    case 'aspect-ratio-exact':
      return rule.value.ratio === 1
        ? (en ? 'Square (1:1)' : '正方形（1:1）')
        : (en ? `Aspect ratio ${rule.value.ratio} (width ÷ height)` : `長寬比 ${rule.value.ratio}（寬 ÷ 高）`)
    case 'aspect-ratio-range': {
      const { min, max } = rule.value
      const scope = en ? ' (width ÷ height)' : '（寬 ÷ 高）'
      if (min !== undefined && max !== undefined) return en ? `Aspect ratio ${min}–${max}${scope}` : `長寬比 ${min}–${max}${scope}`
      if (min !== undefined) return en ? `Aspect ratio at least ${min}${scope}` : `長寬比至少 ${min}${scope}`
      return en ? `Aspect ratio at most ${max}${scope}` : `長寬比最多 ${max}${scope}`
    }
    case 'megapixel-max':
      return en
        ? `At most ${pixels(rule.value.max)} megapixels`
        : `最多 ${pixels(rule.value.max)} 百萬像素`
    case 'byte-range': {
      const { min, max } = rule.value
      const size = (value: number) => kilobytes(value, locale)
      if (min !== undefined && max !== undefined) return en ? `File size ${size(min)}–${size(max)}` : `檔案大小 ${size(min)}–${size(max)}`
      if (min !== undefined) return en ? `File size at least ${size(min)}` : `檔案大小至少 ${size(min)}`
      return en ? `File size at most ${size(max!)}` : `檔案大小最多 ${size(max!)}`
    }
    case 'format-set': {
      const names = rule.value.formats.map(format => formatNames[format])
      return en ? `Formats: ${names.join(', ')}` : `可用格式：${names.join('、')}`
    }
    case 'chroma-model':
      return en ? `Chroma model ${rule.value.model}` : `色度模型須為 ${rule.value.model}`
    case 'count-range': {
      const { min, max } = rule.value
      if (min !== undefined && max !== undefined) return en ? `${min}–${max} images per product` : `每則商品 ${min}–${max} 張圖片`
      if (min !== undefined) return en ? `At least ${min} image(s) per product` : `每則商品至少 ${min} 張圖片`
      return en ? `At most ${max} images per product` : `每則商品最多 ${max} 張圖片`
    }
    case 'occupancy-min':
      return en
        ? `The product fills at least ${Math.round(rule.value.ratio * 100)}% of the frame`
        : `商品須佔畫面 ${Math.round(rule.value.ratio * 100)}% 以上`
    case 'safe-area-inset': {
      const { top, right, bottom, left } = rule.value
      const percentages = [top, right, bottom, left].map(value => `${Math.round(value * 100)}%`).join(' / ')
      return en ? `Keep-out margins (top/right/bottom/left): ${percentages}` : `四邊留白（上／右／下／左）：${percentages}`
    }
    case 'overlay-area-max':
      return en
        ? `Overlaid elements at most ${Math.round(rule.value.ratio * 100)}% of the frame`
        : `疊加元素最多佔畫面 ${Math.round(rule.value.ratio * 100)}%`
    case 'background':
      return rule.value.mode === 'pure-white'
        ? (en
            ? `Pure white background (RGB ${(rule.value.rgb ?? [255, 255, 255]).join(', ')})`
            : `純白背景（RGB ${(rule.value.rgb ?? [255, 255, 255]).join('、')}）`)
        : (en ? 'A solid colour background' : '純色背景')
    case 'metadata-preservation':
      return en
        ? `Metadata to keep: ${rule.value.tags.join(', ')}`
        : `須保留的中繼資料：${rule.value.tags.join('、')}`
    case 'placement-allowance': {
      const names = rule.value.positions.map(position => positionLabels[position]?.[locale] ?? position)
      return en ? `Allowed placement: ${names.join(', ')}` : `允許放置於：${names.join('、')}`
    }
    case 'prohibition':
      return en ? 'Prohibited by the source wording quoted below' : '來源原文明列的禁止事項，見下方引文'
  }
}

/** §7.4 — the only questions this page may ask, answered from the sections it names. */
export const compliantProductImageFaq: ToolFaqEntry[] = [
  {
    heading: {
      'zh-tw': '合規主圖工具會保證商品圖被通路接受嗎？',
      en: 'Does the compliant product image tool guarantee that a channel will accept my image?',
    },
    body: {
      'zh-tw': '不會。這個工具只按照通路自己公開的規格協助你調整尺寸、比例、格式與容量，並把它無法判定的規則列出來。toolsliang 與各通路沒有合作或授權關係，實際規定以通路當下的公告為準。',
      en: 'No. The tool only helps you match the dimensions, ratio, format and capacity a channel publishes for itself, and lists the rules it cannot judge. toolsliang has no partnership with any channel, and the channel\'s current announcement always governs.',
    },
  },
  {
    heading: {
      'zh-tw': 'preset 的規格是從哪裡來的？',
      en: 'Where do the preset specifications come from?',
    },
    body: {
      'zh-tw': '來自四份公開頁面：Google 產品資料規格、Amazon 商品攝影說明、momo 商店規則中心與露天市集幫助中心。每個 preset 旁邊都標出來源標題、可點擊的原始網址與查核日期，每條規則也附上讀到它的那一句原文。',
      en: 'From four public pages: the Google product data specification, Amazon\'s product photo guidance, the momo store rules centre and the Ruten help centre. Every preset shows its source title, a link to the original page and the date it was read, and every rule carries the sentence it was read from.',
    },
  },
  {
    heading: {
      'zh-tw': '為什麼有些台灣通路沒有 preset？',
      en: 'Why do some Taiwan channels have no preset?',
    },
    body: {
      'zh-tw': '因為它們的規格頁沒辦法穩定引用：有的要執行 JavaScript 才讀得到，有的要登入，有的網站自己的存取規則不允許自動取得，有的根本沒有公開圖片規格。與其猜一組數字，這個工具寧可說沒有——頁面上列出被排除的通路、原因與重新評估的日期。',
      en: 'Because their specification pages cannot be cited reliably: some need JavaScript, some need a sign-in, some sites\' own access rules disallow automated fetching, and some publish no image specification at all. Rather than invent numbers, the tool says so — the page lists each excluded channel, the reason and the date it will be looked at again.',
    },
  },
  {
    heading: {
      'zh-tw': 'preset 過期的時候會怎麼樣？',
      en: 'What happens when a preset passes its review deadline?',
    },
    body: {
      'zh-tw': '每個 preset 從查核日算起 90 天內是有效的；之後 30 天仍可使用，但會標示待重新查核。超過寬限期就會停用，工具不會拿舊規格繼續判定輸出，而是請你直接看通路的最新公告。通路收攤或來源被撤下時，preset 會標為已停止維護。',
      en: 'A preset is current for 90 days after the day its source was read. For another 30 days it still works but is flagged as due for review. Past that it is disabled — the tool stops judging outputs with stale rules and points you at the channel\'s announcement instead. If a channel closes or takes its page down, the preset is marked as no longer maintained.',
    },
  },
  {
    heading: {
      'zh-tw': '哪些規則工具沒辦法自動判定？',
      en: 'Which rules can the tool not judge automatically?',
    },
    body: {
      'zh-tw': '只有尺寸、長寬比、格式、總像素與檔案大小能從一個輸出檔案直接讀出來。商品佔比與背景是否純色只提供輔助框與填色，由你判斷；促銷文字、邊框、浮水印與每則商品的圖片張數只能提醒你自行確認；浮水印與 Logo 的擺放位置則不在這個工具的範圍。每次輸出後，這些規則都會逐條列出來。',
      en: 'Only dimensions, aspect ratio, format, total pixels and file size can be read off one output file. Product occupancy and whether the background is a solid colour get a guide frame and a fill colour, but you decide; promotional text, borders, watermarks and how many images a listing needs are reminders only; watermark and logo placement is outside this tool entirely. Every one of them is listed after each render.',
    },
  },
  {
    heading: {
      'zh-tw': '我的商品圖片會被傳到伺服器嗎？',
      en: 'Is my product image sent to a server?',
    },
    body: {
      'zh-tw': '不會，也不會被送到任何地方。原圖、檔名、裁切參數、預覽與輸出只在這台裝置的瀏覽器記憶體處理，只有你主動下載才會保存輸出。通路規格已隨網站打包，使用時不會再連到任何通路，關閉工具即清除工作內容。',
      en: 'No — they are never sent anywhere. The source image, its filename, the crop settings, the previews and the output stay in this device\'s browser memory, and the output is saved only when you download it. The channel presets ship with the site, so nothing is fetched from a channel while you work, and closing the tool clears the workspace.',
    },
  },
]
