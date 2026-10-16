import {
  copy,
  getCategory,
  localeUrl,
  publishedTools,
  siteOrigin,
  type LocaleCode,
  type LocalizedCopy,
  type PublishedToolDefinition,
} from '@/features/tools/catalog'

/** A short heading plus the sentence that backs it, both fully localized. */
interface LocalizedSection {
  heading: LocalizedCopy
  body: LocalizedCopy
}

/**
 * The order the landing page walks the categories in. It is a page decision,
 * not the catalog's: the image tools open the page because they carry the most
 * tools, and the single-tool categories close it as the small blocks.
 */
export const landingCategoryOrder = [
  'image-commerce',
  'document',
  'time-calendar',
  'calculation',
  'random-selection',
] as const

export type LandingCategoryId = typeof landingCategoryOrder[number]

const landingCopy = {
  heroTitleLead: { 'zh-tw': '免費線上工具，', en: 'Free online tools.' },
  heroTitleTail: { 'zh-tw': '一頁辦好一件事', en: 'One page, one job done.' },
  heroIntro: {
    'zh-tw': '金額轉國字大寫、PDF 簽名、人像去背、查台灣行事曆：找到工具，馬上開始。',
    en: 'Cheque wording, PDF signatures, portrait cutouts, Taiwan’s holiday calendar: find the tool and start.',
  },
  heroBrowseAll: { 'zh-tw': '瀏覽全部工具', en: 'Browse all tools' },
  heroDeckLabel: { 'zh-tw': '工具實際產出的範例', en: 'Examples of what the tools produce' },
  catalogTitle: { 'zh-tw': '{count} 個工具，{categories} 種日常', en: '{count} tools for {categories} everyday jobs' },
  faqTitle: { 'zh-tw': '常見問題', en: 'Questions' },
  closeTitle: { 'zh-tw': '今天要辦哪件事？', en: 'What needs doing today?' },
  closeAction: { 'zh-tw': '看全部工具', en: 'See every tool' },
  seoTitle: {
    'zh-tw': '免費線上工具｜國字大寫、PDF 簽名、人像去背、台灣行事曆',
    en: 'Free online tools: cheque wording, PDF signature, background remover',
  },
  seoDescription: {
    'zh-tw': 'toolsliang 提供免費線上工具：新臺幣國字大寫、PDF 手寫簽名、人像去背、圖片壓縮、台灣行事曆與 BMI 計算。不用註冊，檔案不上傳，打開就能用。',
    en: 'Free online tools from toolsliang: NTD cheque wording, PDF handwritten signatures, portrait background removal, image compression, Taiwan’s holiday calendar and BMI. No sign-up, no uploads.',
  },
  organizationDescription: {
    'zh-tw': 'toolsliang 是台灣優先的免費線上工具網站，工具內容留在使用者裝置。',
    en: 'toolsliang is a Taiwan-first site of free online tools that keeps tool content on the visitor’s device.',
  },
} satisfies Record<string, LocalizedCopy>

export type LandingCopyKey = keyof typeof landingCopy
export const landingCopyKeys = Object.keys(landingCopy) as LandingCopyKey[]

/** One line per category that says what the block is for, in the visitor's words. */
const landingCategoryPitches: Record<LandingCategoryId, LocalizedCopy> = {
  'image-commerce': {
    'zh-tw': '商品圖、人像去背、壓縮，一次處理完。',
    en: 'Product shots, portrait cutouts and compression in one pass.',
  },
  'document': {
    'zh-tw': '支票金額寫成國字，PDF 直接簽名。',
    en: 'Write cheque amounts in words and sign PDFs.',
  },
  'time-calendar': {
    'zh-tw': '放假、補班、農曆與節氣，一眼看清。',
    en: 'Holidays, make-up workdays and lunar dates at a glance.',
  },
  'calculation': {
    'zh-tw': '輸入身高體重，馬上知道 BMI。',
    en: 'Enter height and weight, get your BMI.',
  },
  'random-selection': {
    'zh-tw': '貼上名單，等機率抽出一位。',
    en: 'Paste a list and draw one name, every entry equally likely.',
  },
}

/**
 * Landing-only one-liners. The catalog descriptions each restate where the
 * work happens, which is right on a tool page and repetitive eleven times in a
 * row; the landing page says that once and lets each line name the job.
 */
const landingToolTaglines: Record<string, LocalizedCopy> = {
  'product-image-workbench': {
    'zh-tw': '去背、合規尺寸、框版 Logo 一次跑完',
    en: 'Cutout, compliant sizing and frames in one run',
  },
  'image-background-remover': {
    'zh-tw': '把人像從背景分離，輸出透明 PNG',
    en: 'Lift a person off the background as a transparent PNG',
  },
  'image-compressor': {
    'zh-tw': '調整品質、尺寸與格式，比較後再下載',
    en: 'Tune quality, size and format, compare, then download',
  },
  'brand-promo-image': {
    'zh-tw': '幫商品圖加上背景、框版與 Logo',
    en: 'Add backgrounds, frames and Logos to product shots',
  },
  'ntd-uppercase': {
    'zh-tw': '金額轉國字大寫，支票、會計、國庫用途都有',
    en: 'Amounts in Chinese numerals for cheques, books and treasury forms',
  },
  'pdf-signature': {
    'zh-tw': '手寫、打字或匯入簽名，放到 PDF 任一頁',
    en: 'Draw, type or import a signature onto any PDF page',
  },
  'taiwan-calendar': {
    'zh-tw': '國定假日、補班日、農曆與節氣',
    en: 'Public holidays, make-up workdays, lunar dates and solar terms',
  },
  'custom-calendar': {
    'zh-tw': '在台灣行事曆加上自己的休假與排班',
    en: 'Add your own days off and shifts to the Taiwan calendar',
  },
  'device-time': {
    'zh-tw': '這台裝置的時間、時區與 UTC 時差',
    en: 'Your device’s time, time zone and UTC offset',
  },
  'bmi-calculator': {
    'zh-tw': '依身高體重算成人 BMI，對照國健署分級',
    en: 'Adult BMI against Taiwan’s official categories',
  },
  'random-picker': {
    'zh-tw': '從名單等機率抽出，也能用輪盤',
    en: 'Equal-chance draws from a list, with an optional wheel',
  },
  'roc-year-converter': {
    'zh-tw': '民國年、西元年互查，附逐年對照表',
    en: 'ROC and Gregorian years both ways, with a year table',
  },
}

/**
 * The FAQ is where the page states its boundaries, each once: price and sign-up,
 * the privacy boundary, and phones. Nothing above it repeats them.
 */
const landingFaq: LocalizedSection[] = [
  {
    heading: { 'zh-tw': 'toolsliang 的工具要付費嗎？', en: 'Do the tools cost anything?' },
    body: {
      'zh-tw': '不用。所有工具都免費，不需要註冊或登入就能使用。',
      en: 'No. Every tool is free and works without signing up or logging in.',
    },
  },
  {
    heading: { 'zh-tw': '檔案會被上傳到伺服器嗎？', en: 'Are my files uploaded to a server?' },
    body: {
      'zh-tw': '不會。檔案、文字與數值都在你的瀏覽器裡處理，toolsliang 沒有接收這些內容的伺服器。',
      en: 'No. Files, text and numbers are processed in your browser, and toolsliang has no server that receives them.',
    },
  },
  {
    heading: { 'zh-tw': '手機可以用嗎？', en: 'Do the tools work on a phone?' },
    body: {
      'zh-tw': '可以。每個工具頁都能在手機、平板與電腦的瀏覽器開啟；人像去背第一次使用時會先下載模型，需要等一下。',
      en: 'Yes. Every tool page opens in phone, tablet and desktop browsers. The portrait background remover downloads its model the first time you use it, which takes a moment.',
    },
  },
]

/** The last question lists the tools themselves, so it can never drift from the catalog. */
const toolListQuestion: LocalizedCopy = { 'zh-tw': 'toolsliang 有哪些工具？', en: 'Which tools does toolsliang offer?' }

export interface LandingToolEntry {
  slug: string
  name: string
  tagline: string
}

export interface LandingCategory {
  id: LandingCategoryId
  name: string
  pitch: string
  tools: LandingToolEntry[]
}

const landingContentIssues = validateLandingContent()
if (landingContentIssues.length) {
  throw new Error(`Invalid landing content:\n${landingContentIssues.join('\n')}`)
}

export function getLandingCopy(locale: LocaleCode): Record<LandingCopyKey, string> {
  const counts = landingCounts()
  return Object.fromEntries(
    landingCopyKeys.map(key => [key, fill(copy(landingCopy[key], locale), counts)]),
  ) as Record<LandingCopyKey, string>
}

export function getLandingCategories(locale: LocaleCode): LandingCategory[] {
  return landingCategoryOrder
    .map(id => ({ id, tools: landingTools(id) }))
    .filter(category => category.tools.length)
    .map(({ id, tools }) => ({
      id,
      name: copy(getCategory(id)!.name, locale),
      pitch: copy(landingCategoryPitches[id], locale),
      tools: tools.map(tool => ({
        slug: tool.slug,
        name: copy(tool.name, locale),
        tagline: copy(landingToolTaglines[tool.slug]!, locale),
      })),
    }))
}

export function getLandingFaq(locale: LocaleCode) {
  const names = getLandingCategories(locale).flatMap(category => category.tools.map(tool => tool.name))
  const listed = locale === 'en'
    ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
    : `${names.slice(0, -1).join('、')}與${names.at(-1)}`

  return [
    ...localizeSections(landingFaq, locale),
    {
      heading: copy(toolListQuestion, locale),
      body: locale === 'en'
        ? `There are ${names.length} tools today: ${listed}. Each one has its own page.`
        : `目前有 ${names.length} 個工具：${listed}。每個工具都有自己的頁面。`,
    },
  ]
}

function landingTools(categoryId: LandingCategoryId): PublishedToolDefinition[] {
  return publishedTools.filter(tool => tool.category === categoryId)
}

function landingCounts() {
  const categories = landingCategoryOrder.filter(id => landingTools(id).length)
  return { count: String(publishedTools.length), categories: String(categories.length) }
}

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

function localizeSections(sections: LocalizedSection[], locale: LocaleCode) {
  return sections.map(section => ({
    heading: copy(section.heading, locale),
    body: copy(section.body, locale),
  }))
}

/**
 * Search runs entirely in the browser, so the graph deliberately omits a
 * `SearchAction`: advertising one would promise a server endpoint that this
 * product must never have.
 */
export function buildLandingStructuredData(locale: LocaleCode): Record<string, unknown> {
  const text = getLandingCopy(locale)
  const language = locale === 'en' ? 'en' : 'zh-Hant-TW'
  const landingUrl = localeUrl(locale, '/')
  const organizationId = `${siteOrigin}/#organization`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${landingUrl}#website`,
        name: 'toolsliang',
        url: landingUrl,
        inLanguage: language,
        description: text.seoDescription,
        publisher: { '@id': organizationId },
      },
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'toolsliang',
        url: `${siteOrigin}/`,
        description: text.organizationDescription,
      },
      {
        '@type': 'FAQPage',
        '@id': `${landingUrl}#faq`,
        inLanguage: language,
        mainEntity: getLandingFaq(locale).map(entry => ({
          '@type': 'Question',
          name: entry.heading,
          acceptedAnswer: { '@type': 'Answer', text: entry.body },
        })),
      },
    ],
  }
}

export function validateLandingContent() {
  const issues: string[] = []
  const hasLocalizedCopy = (value: LocalizedCopy | undefined) => Boolean(value?.['zh-tw']?.trim() && value.en?.trim())

  for (const key of landingCopyKeys) {
    if (!hasLocalizedCopy(landingCopy[key])) issues.push(`[copy:${key}] requires both locales`)
  }

  for (const id of landingCategoryOrder) {
    if (!getCategory(id)) issues.push(`[category:${id}] is not a catalog category`)
    if (!hasLocalizedCopy(landingCategoryPitches[id])) issues.push(`[category:${id}] requires a pitch in both locales`)
  }

  for (const tool of publishedTools) {
    if (!landingCategoryOrder.includes(tool.category as LandingCategoryId)) {
      issues.push(`[tool:${tool.slug}] category ${tool.category} has no place on the landing page`)
    }
    if (!hasLocalizedCopy(landingToolTaglines[tool.slug])) issues.push(`[tool:${tool.slug}] requires a tagline in both locales`)
  }

  for (const [index, section] of landingFaq.entries()) {
    if (!hasLocalizedCopy(section.heading) || !hasLocalizedCopy(section.body)) {
      issues.push(`[faq:${index}] requires both locales`)
    }
  }

  return issues
}
