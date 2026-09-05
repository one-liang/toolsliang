import { bmiContentReview } from './bmi-calculator/domain/sources'
import { ntdContentReview } from './ntd-uppercase/domain/sources'
import { randomPickerContentReview } from './random-picker/domain/sources'

export type LocaleCode = 'zh-tw' | 'en'
export type ToolStatus = 'new' | 'pro' | 'hot'
export type ToolProcessingClass = 'instant' | 'worker'
export type ToolOfflineMode = 'ready' | 'requires-first-download' | 'online-to-prepare'
export type ToolCapability = 'javascript' | 'web-worker' | 'wasm' | 'webgl' | 'webgpu'

/** Every canonical URL, hreflang, sitemap entry and structured-data @id derives from this origin. */
export const siteOrigin = 'https://toolsliang.com'
export const supportedLocales: LocaleCode[] = ['zh-tw', 'en']
/** Root of every large first-party engine, model or font a tool downloads on first use. */
export const offlineAssetPathPrefix = '/assets/offline'
export const toolIcons = [
  'banknote', 'calculator', 'calendar-days', 'dices', 'shopping-bag',
  'file-text', 'image', 'crop', 'braces', 'table', 'type', 'case-sensitive',
] as const

export type ToolIcon = typeof toolIcons[number]

export interface LocalizedCopy {
  'zh-tw': string
  en: string
}

export interface LocalizedTerms {
  'zh-tw': string[]
  en: string[]
}

/**
 * A large engine, model or font a tool downloads on first use. The version is
 * part of the URL so a cache entry always names the exact bytes it holds, and a
 * superseded version can be swept without touching the current one.
 */
export interface ToolOfflineAsset {
  id: string
  version: string
  url: string
  bytes: number
  label: LocalizedCopy
}

export interface ToolStatusMetadata {
  kind: ToolStatus
  startsAt?: string
  endsAt?: string
  source?: string
}

interface ToolDefinitionBase {
  slug: string
  /**
   * Slugs this tool was published under before. A device that saved the old id
   * keeps reaching the tool, and the URL contract of ADR-0011 stays stable.
   */
  formerSlugs?: string[]
  category: string
  icon: ToolIcon
  name: LocalizedCopy
  description: LocalizedCopy
  aliases: LocalizedTerms
  keywords: LocalizedTerms
  status?: ToolStatusMetadata
}

export interface PublishedToolDefinition extends ToolDefinitionBase {
  availability: {
    state: 'published'
    publishedAt: string
  }
  processingClass: ToolProcessingClass
  routeComponentKey: string
  offlineMode: ToolOfflineMode
  offlineAssets?: ToolOfflineAsset[]
  capabilities: ToolCapability[]
  acceptedInput: LocalizedCopy
  localProcessingStatement: LocalizedCopy
  pagePresentation: {
    showHeadingIcon: boolean
    showLocalProcessingStatement: boolean
  }
  seo: {
    contentKey: string
    title: LocalizedCopy
    description: LocalizedCopy
    answer: LocalizedCopy
  }
  contentReview: {
    reviewedAt: string
    sourceEdition: LocalizedCopy
    sourceEffectiveAt: string
    sources: Array<{
      title: LocalizedCopy
      url: string
    }>
  }
}

export interface UnpublishedToolDefinition extends ToolDefinitionBase {
  availability: {
    state: 'unpublished'
    reason: LocalizedCopy
  }
}

export type ToolDefinition = PublishedToolDefinition | UnpublishedToolDefinition

export interface ToolCategory {
  id: string
  icon: ToolIcon
  name: LocalizedCopy
  description: LocalizedCopy
}

export const toolCategories: ToolCategory[] = [
  {
    id: 'calculation', icon: 'calculator',
    name: { 'zh-tw': '計算工具', en: 'Calculators' },
    description: { 'zh-tw': '處理日常數值、單位與健康參考計算。', en: 'Handle everyday values, units, and reference calculations.' },
  },
  {
    id: 'time-calendar', icon: 'calendar-days',
    name: { 'zh-tw': '時間與行事曆', en: 'Time & calendars' },
    description: { 'zh-tw': '查看裝置時間並整理台灣行事曆。', en: 'Check device time and work with Taiwan calendars.' },
  },
  {
    id: 'random-selection', icon: 'dices',
    name: { 'zh-tw': '本機抽選', en: 'Local random selection' },
    description: { 'zh-tw': '在單一裝置上進行隨機抽取。', en: 'Run random selections on one device.' },
  },
  {
    id: 'image-commerce', icon: 'shopping-bag',
    name: { 'zh-tw': '圖片與商務素材', en: 'Images & commerce' },
    description: { 'zh-tw': '在本機準備圖片與商務視覺素材。', en: 'Prepare images and commerce visuals locally.' },
  },
  {
    id: 'document', icon: 'file-text',
    name: { 'zh-tw': '文件與金額', en: 'Documents & amounts' },
    description: { 'zh-tw': '整理日常文件內容與台灣常用格式。', en: 'Format everyday documents and Taiwan-specific content.' },
  },
]

const registeredTools: ToolDefinition[] = [
  {
    slug: 'bmi-calculator', category: 'calculation', icon: 'calculator',
    availability: { state: 'published', publishedAt: '2026-09-05' },
    status: { kind: 'new', startsAt: '2026-09-05', endsAt: '2026-10-05' },
    name: { 'zh-tw': 'BMI 計算', en: 'BMI Calculator' },
    description: {
      'zh-tw': '依身高與體重估算成人 BMI。',
      en: 'Estimate adult BMI from height and weight.',
    },
    aliases: {
      'zh-tw': ['BMI 計算機', '身體質量指數'],
      en: ['BMI calculator', 'body mass index'],
    },
    keywords: {
      'zh-tw': ['身高', '體重', '健康體位'],
      en: ['height', 'weight', 'healthy weight'],
    },
    processingClass: 'instant',
    routeComponentKey: 'BmiCalculatorWorkspace',
    offlineMode: 'ready',
    capabilities: ['javascript'],
    acceptedInput: {
      'zh-tw': '公制或英制的成人身高與體重',
      en: 'An adult height and weight, in metric or imperial units',
    },
    pagePresentation: {
      showHeadingIcon: false,
      showLocalProcessingStatement: true,
    },
    localProcessingStatement: {
      'zh-tw': '身高、體重與結果只在此裝置計算，不會保存或送出。',
      en: 'Height, weight, and the result are calculated on this device; nothing is stored or sent.',
    },
    seo: {
      contentKey: 'bmi-calculator',
      title: { 'zh-tw': 'BMI 計算', en: 'BMI Calculator' },
      description: {
        'zh-tw': '在瀏覽器依身高與體重計算成人 BMI，對照國民健康署分級，身高體重不離開裝置。',
        en: 'Calculate adult BMI from height and weight in your browser, with Taiwan\'s official categories and no data leaving your device.',
      },
      answer: {
        'zh-tw': 'BMI ＝ 體重（公斤）÷ 身高（公尺）÷ 身高（公尺），結果對照國民健康署成人健康體位標準。',
        en: 'BMI = weight (kg) ÷ height (m) ÷ height (m), read against the Health Promotion Administration adult standard.',
      },
    },
    contentReview: bmiContentReview,
  },
  {
    slug: 'ntd-uppercase', category: 'document', icon: 'banknote',
    availability: { state: 'published', publishedAt: '2026-09-03' },
    status: { kind: 'new', startsAt: '2026-09-03', endsAt: '2026-10-03' },
    name: { 'zh-tw': '新臺幣國字大寫', en: 'NTD Uppercase' },
    description: {
      'zh-tw': '依所選用途將新臺幣數字金額轉為國字大寫。',
      en: 'Convert New Taiwan dollar amounts to formal Chinese wording for the purpose you pick.',
    },
    aliases: {
      'zh-tw': ['新臺幣國字大寫', '國字金額'],
      en: ['Taiwan dollar uppercase', 'Chinese amount wording'],
    },
    keywords: {
      'zh-tw': ['支票', '會計', '國庫', '金額'],
      en: ['cheque', 'accounting', 'treasury', 'amount'],
    },
    processingClass: 'instant',
    routeComponentKey: 'NtdUppercaseWorkspace',
    offlineMode: 'ready',
    capabilities: ['javascript'],
    acceptedInput: {
      'zh-tw': '一筆新臺幣數字金額，小數點後最多兩位',
      en: 'One New Taiwan dollar amount, with at most two decimal places',
    },
    pagePresentation: {
      showHeadingIcon: false,
      showLocalProcessingStatement: false,
    },
    localProcessingStatement: {
      'zh-tw': '金額、用途與轉換結果只在此裝置處理。',
      en: 'The amount, the purpose, and the wording are processed only on this device.',
    },
    seo: {
      contentKey: 'ntd-uppercase',
      title: { 'zh-tw': '新臺幣國字大寫', en: 'NTD Uppercase' },
      description: {
        'zh-tw': '在瀏覽器將新臺幣金額寫成國字大寫，可選一般會計、支票填寫參考或國庫付款憑單規則，金額與結果不離開裝置。',
        en: 'Write New Taiwan dollar amounts in formal Chinese in your browser, using accounting, cheque-reference, or treasury-voucher rules, with nothing leaving your device.',
      },
      answer: {
        'zh-tw': '先選一般會計、支票填寫參考或國庫付款憑單，再輸入金額，工具會依該用途的規則在本機寫出國字大寫，並附上可逐字核對的數字金額。',
        en: 'Pick the accounting, cheque-reference, or treasury-voucher purpose, enter an amount, and the tool writes the formal Chinese wording locally, beside the numerals to check it against.',
      },
    },
    contentReview: ntdContentReview,
  },
  {
    slug: 'random-picker', category: 'random-selection', icon: 'dices',
    availability: { state: 'published', publishedAt: '2026-09-05' },
    status: { kind: 'new', startsAt: '2026-09-05', endsAt: '2026-10-05' },
    name: { 'zh-tw': '本機抽選與抽籤輪盤', en: 'Local Random Draw & Wheel' },
    description: {
      'zh-tw': '在這台裝置上等機率抽出一名或多名。',
      en: 'Draw one or several names with equal chances, on this device.',
    },
    aliases: {
      'zh-tw': ['抽籤', '隨機抽人', '名單抽選'],
      en: ['random picker', 'name picker', 'draw wheel'],
    },
    keywords: {
      'zh-tw': ['抽籤', '輪盤', '名單', '隨機'],
      en: ['draw', 'wheel', 'shuffle', 'random'],
    },
    processingClass: 'instant',
    routeComponentKey: 'RandomPickerWorkspace',
    offlineMode: 'ready',
    capabilities: ['javascript'],
    acceptedInput: {
      'zh-tw': '一份候選名單，一行一個項目，最多 10,000 筆',
      en: 'A candidate list, one entry per line, up to 10,000 entries',
    },
    pagePresentation: {
      showHeadingIcon: false,
      showLocalProcessingStatement: true,
    },
    localProcessingStatement: {
      'zh-tw': '名單、抽選設定與結果只在此裝置處理，不保存也不送出。',
      en: 'The list, the settings, and the result are handled on this device only; nothing is stored or sent.',
    },
    seo: {
      contentKey: 'random-picker',
      title: { 'zh-tw': '本機抽選與抽籤輪盤', en: 'Local Random Draw & Wheel' },
      description: {
        'zh-tw': '在瀏覽器等機率抽出一名或多名，可用名單或輪盤呈現，名單與結果不離開裝置，也不會被保存。',
        en: 'Draw one or several entries with equal chances in your browser, as a list or a wheel, with nothing leaving your device and nothing stored.',
      },
      answer: {
        'zh-tw': '貼上名單後選擇重複項目策略與抽出人數，工具以瀏覽器的密碼學隨機來源搭配拒絕取樣與 Fisher–Yates 抽出不重複的中選名單；輪盤只是呈現方式，不影響結果，且結果無法由第三方稽核。',
        en: 'Paste a list, pick how repeats are treated and how many to draw, and the tool uses the browser\'s cryptographic randomness with rejection sampling and a Fisher–Yates shuffle to draw without repeats; the wheel only presents that result, and no third party can audit it.',
      },
    },
    contentReview: randomPickerContentReview,
  },
  {
    slug: 'document-counter', category: 'document', icon: 'file-text',
    availability: { state: 'unpublished', reason: { 'zh-tw': '工具尚未完成。', en: 'This tool is not ready yet.' } },
    name: { 'zh-tw': '文件字數統計', en: 'Document counter' },
    description: { 'zh-tw': '計算中文字、英文單字、段落與閱讀時間。', en: 'Count characters, words, paragraphs, and reading time.' },
    aliases: { 'zh-tw': [], en: [] }, keywords: { 'zh-tw': [], en: [] },
  },
  {
    slug: 'image-resizer', category: 'image-commerce', icon: 'image',
    availability: { state: 'unpublished', reason: { 'zh-tw': '工具尚未完成。', en: 'This tool is not ready yet.' } },
    name: { 'zh-tw': '圖片尺寸調整', en: 'Image resizer' },
    description: { 'zh-tw': '批次調整圖片尺寸，內容不離開裝置。', en: 'Resize image batches without files leaving your device.' },
    aliases: { 'zh-tw': [], en: [] }, keywords: { 'zh-tw': [], en: [] },
  },
  {
    slug: 'image-cropper', category: 'image-commerce', icon: 'crop', status: { kind: 'pro' },
    availability: { state: 'unpublished', reason: { 'zh-tw': '工具尚未完成。', en: 'This tool is not ready yet.' } },
    name: { 'zh-tw': '圖片裁切', en: 'Image cropper' },
    description: { 'zh-tw': '依社群、證件與自訂比例快速裁切。', en: 'Crop for social, ID, and custom aspect ratios.' },
    aliases: { 'zh-tw': [], en: [] }, keywords: { 'zh-tw': [], en: [] },
  },
  {
    slug: 'json-formatter', category: 'document', icon: 'braces',
    availability: { state: 'unpublished', reason: { 'zh-tw': '工具尚未完成。', en: 'This tool is not ready yet.' } },
    name: { 'zh-tw': 'JSON 格式化', en: 'JSON formatter' },
    description: { 'zh-tw': '格式化、壓縮並找出 JSON 語法問題。', en: 'Format, minify, and locate JSON syntax issues.' },
    aliases: { 'zh-tw': [], en: [] }, keywords: { 'zh-tw': [], en: [] },
  },
  {
    slug: 'csv-viewer', category: 'document', icon: 'table',
    availability: { state: 'unpublished', reason: { 'zh-tw': '工具尚未完成。', en: 'This tool is not ready yet.' } },
    name: { 'zh-tw': 'CSV 檢視器', en: 'CSV viewer' },
    description: { 'zh-tw': '在本機快速預覽欄位與資料列。', en: 'Preview columns and rows locally.' },
    aliases: { 'zh-tw': [], en: [] }, keywords: { 'zh-tw': [], en: [] },
  },
  {
    slug: 'text-counter', category: 'document', icon: 'type',
    availability: { state: 'unpublished', reason: { 'zh-tw': '工具尚未完成。', en: 'This tool is not ready yet.' } },
    name: { 'zh-tw': '文字計數器', en: 'Text counter' },
    description: { 'zh-tw': '即時計算字元、行數與去除空白後長度。', en: 'Count characters, lines, and trimmed length instantly.' },
    aliases: { 'zh-tw': [], en: [] }, keywords: { 'zh-tw': [], en: [] },
  },
  {
    slug: 'case-converter', category: 'document', icon: 'case-sensitive',
    availability: { state: 'unpublished', reason: { 'zh-tw': '工具尚未完成。', en: 'This tool is not ready yet.' } },
    name: { 'zh-tw': '英文大小寫轉換', en: 'Case converter' },
    description: { 'zh-tw': '轉換標題、句首、camelCase 與 kebab-case。', en: 'Convert title, sentence, camel, and kebab case.' },
    aliases: { 'zh-tw': [], en: [] }, keywords: { 'zh-tw': [], en: [] },
  },
]

const toolRegistryIssues = validateToolRegistry(registeredTools)
if (toolRegistryIssues.length) {
  throw new Error(`Invalid tool registry:\n${toolRegistryIssues.join('\n')}`)
}

export const publishedTools = registeredTools.filter(isPublishedTool)
export const publishedToolCategories = categoriesForTools(publishedTools)
/** Registered but not yet public. Tests assert these never reach an indexable surface. */
export const unpublishedToolSlugs = registeredTools.filter(tool => !isPublishedTool(tool)).map(tool => tool.slug)

export function copy<T extends LocalizedCopy>(value: T, locale: LocaleCode) {
  return value[locale]
}

export function formatReviewDate(value: string, locale: LocaleCode) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en' : 'zh-TW', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

/** The bilingual completeness rule every registry and content module validates against. */
export function hasLocalizedCopy(value: LocalizedCopy | undefined) {
  return Boolean(value?.['zh-tw']?.trim() && value.en?.trim())
}

export function isSupportedLocale(value: string): value is LocaleCode {
  return supportedLocales.some(locale => locale === value)
}

export function getCategory(id: string) {
  return toolCategories.find(category => category.id === id)
}

export function getVisibleStatus(status: ToolStatusMetadata | undefined, now = new Date()) {
  if (!status) return undefined
  if (status.kind !== 'new') return status.kind

  const date = now.toISOString().slice(0, 10)
  if (status.startsAt && date < status.startsAt) return undefined
  if (status.endsAt && date > status.endsAt) return undefined
  return status.kind
}

export function getTool(slug: string) {
  return publishedTools.find(tool => tool.slug === slug)
}

export function toolsByCategory(categoryId: string) {
  return publishedTools.filter(tool => tool.category === categoryId)
}

export function categoriesForTools(tools: PublishedToolDefinition[]) {
  return toolCategories.filter(category => tools.some(tool => tool.category === category.id))
}

export function searchTools(query: string, locale: LocaleCode) {
  const localeTag = locale === 'en' ? 'en' : 'zh-TW'
  const normalizedQuery = query.trim().toLocaleLowerCase(localeTag)
  if (!normalizedQuery) return []

  return publishedTools
    .map((tool, index) => {
      const normalize = (value: string) => value.toLocaleLowerCase(localeTag)
      const name = normalize(copy(tool.name, locale))
      const aliases = tool.aliases[locale].map(normalize)
      const keywords = tool.keywords[locale].map(normalize)
      const description = normalize(copy(tool.description, locale))
      const category = getCategory(tool.category)
      const categoryTerms = category
        ? [normalize(copy(category.name, locale)), normalize(copy(category.description, locale))]
        : []

      let rank = Number.POSITIVE_INFINITY
      if (name === normalizedQuery) rank = 0
      else if (name.startsWith(normalizedQuery)) rank = 1
      else if ([name, ...aliases, ...keywords, ...categoryTerms].some(term => term.includes(normalizedQuery))) rank = 2
      else if (description.includes(normalizedQuery)) rank = 3

      return { index, rank, tool }
    })
    .filter(result => Number.isFinite(result.rank))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(result => result.tool)
}

export function localeUrl(locale: LocaleCode, path: string) {
  return `${siteOrigin}/${locale}${path}`
}

export function getPublicToolRoutes() {
  return supportedLocales.flatMap(locale => publishedTools.map(tool => `/${locale}/tools/${tool.slug}/`))
}

/**
 * Localized pages that are not a single tool. Prerendering and the sitemap read
 * the same list so an indexable route can never exist without server-rendered
 * metadata, or vice versa.
 */
export function getPublicPageRoutes() {
  return supportedLocales.flatMap(locale => [
    `/${locale}/`,
    `/${locale}/tools/`,
    `/${locale}/design-system/`,
  ])
}

/** Turns a slug list — saved on a device, or curated for the landing page — into published tools. */
export function resolvePublishedTools(slugs: string[]) {
  return slugs
    .map(slug => findPublishedTool(slug, publishedTools))
    .filter((tool): tool is PublishedToolDefinition => Boolean(tool))
}

/**
 * The current slug of a tool a device saved earlier, or nothing when the tool
 * was withdrawn. Saved lists are cleaned against this answer, so a stale device
 * record can never produce a dead navigation target. No registered tool has been
 * renamed yet, so `tools` lets a test exercise the rename path the registry
 * cannot show on its own.
 */
export function resolveToolSlug(slug: string, tools: PublishedToolDefinition[] = publishedTools) {
  return findPublishedTool(slug, tools)?.slug
}

function findPublishedTool(slug: string, tools: PublishedToolDefinition[]) {
  return tools.find(tool => tool.slug === slug)
    ?? tools.find(tool => tool.formerSlugs?.includes(slug))
}

export function getUnavailableCapabilities(
  requirements: ToolCapability[],
  available: Partial<Record<ToolCapability, boolean>>,
) {
  return requirements.filter(requirement => !available[requirement])
}

export function validateToolRegistry(definitions: ToolDefinition[] = registeredTools) {
  const issues: string[] = []
  const slugs = new Set<string>()
  const registeredSlugs = new Set(definitions.map(definition => definition.slug))
  const formerSlugs = new Set<string>()
  const categoryIds = new Set(toolCategories.map(category => category.id))
  const iconKeys = new Set<string>(toolIcons)

  for (const tool of definitions) {
    const prefix = `[${tool.slug || 'missing-slug'}]`

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tool.slug)) issues.push(`${prefix} slug must be stable English kebab-case`)
    if (slugs.has(tool.slug)) issues.push(`${prefix} duplicate slug`)
    slugs.add(tool.slug)

    for (const formerSlug of tool.formerSlugs ?? []) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formerSlug)) issues.push(`${prefix} former slug must be stable English kebab-case: ${formerSlug}`)
      if (registeredSlugs.has(formerSlug)) issues.push(`${prefix} former slug must not collide with a registered slug: ${formerSlug}`)
      if (formerSlugs.has(formerSlug)) issues.push(`${prefix} duplicate former slug: ${formerSlug}`)
      formerSlugs.add(formerSlug)
    }

    if (!categoryIds.has(tool.category)) issues.push(`${prefix} unknown category: ${tool.category}`)
    if (!iconKeys.has(tool.icon)) issues.push(`${prefix} unknown icon: ${tool.icon}`)
    if (!hasLocalizedCopy(tool.name)) issues.push(`${prefix} missing localized name`)
    if (!hasLocalizedCopy(tool.description)) issues.push(`${prefix} missing localized description`)

    if (tool.status?.kind === 'new') {
      if (!isIsoDate(tool.status.startsAt) || !isIsoDate(tool.status.endsAt) || tool.status.startsAt! > tool.status.endsAt!) {
        issues.push(`${prefix} NEW status requires a valid startsAt/endsAt range`)
      }
    }
    if (tool.status?.kind === 'hot' && !tool.status.source?.trim()) {
      issues.push(`${prefix} HOT status requires a source`)
    }

    if (!isPublishedTool(tool)) continue

    const published = tool as Partial<PublishedToolDefinition> & Pick<PublishedToolDefinition, 'availability'>
    if (!isIsoDate(published.availability.publishedAt)) issues.push(`${prefix} published tool requires publishedAt`)
    if (!published.routeComponentKey?.trim()) issues.push(`${prefix} published tool requires a workspace component key`)
    if (!published.capabilities?.length) issues.push(`${prefix} published tool requires capability metadata`)
    issues.push(...validateOfflineRegistration(prefix, published))
    if (!hasLocalizedCopy(published.acceptedInput)) issues.push(`${prefix} published tool requires accepted input copy`)
    if (!hasLocalizedCopy(published.localProcessingStatement)) issues.push(`${prefix} published tool requires local-processing copy`)
    if (!published.seo?.contentKey?.trim() || !hasLocalizedCopy(published.seo.title) || !hasLocalizedCopy(published.seo.description) || !hasLocalizedCopy(published.seo.answer)) {
      issues.push(`${prefix} published tool requires complete SEO/AEO metadata`)
    }
    if (
      !isIsoDate(published.contentReview?.reviewedAt)
      || !isIsoDate(published.contentReview?.sourceEffectiveAt)
      || !hasLocalizedCopy(published.contentReview?.sourceEdition)
      || !published.contentReview?.sources?.length
      || published.contentReview.sources.some(source => !hasLocalizedCopy(source.title) || !isHttpsUrl(source.url))
    ) {
      issues.push(`${prefix} published tool requires content/source review metadata`)
    }
  }

  return issues
}


/**
 * Offline capability and cache version are one decision: a tool is either
 * usable straight from the App Shell cache, or it names the exact versioned
 * first-party assets it must download first. Nothing in between can be
 * explained honestly to a visitor before they start work.
 */
function validateOfflineRegistration(prefix: string, tool: Partial<PublishedToolDefinition>) {
  const issues: string[] = []
  const assets = tool.offlineAssets ?? []
  const seen = new Set<string>()

  if (tool.offlineMode === 'ready' && assets.length) {
    issues.push(`${prefix} an offline ready tool must not require a downloaded asset`)
  }
  if (tool.offlineMode !== 'ready' && !assets.length) {
    issues.push(`${prefix} a tool that is not offline ready must declare at least one versioned offline asset`)
  }

  for (const asset of assets) {
    if (seen.has(asset.id)) issues.push(`${prefix} duplicate offline asset id: ${asset.id}`)
    seen.add(asset.id)

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.id)) issues.push(`${prefix} offline asset id must be stable English kebab-case: ${asset.id}`)
    if (!isFirstPartyVersionedAssetUrl(asset.url, asset.version)) {
      issues.push(`${prefix} offline asset ${asset.id} must serve its version from a first-party versioned URL`)
    }
    if (!(asset.bytes > 0)) issues.push(`${prefix} offline asset ${asset.id} requires a positive size`)
    if (!asset.label?.['zh-tw']?.trim() || !asset.label.en?.trim()) issues.push(`${prefix} offline asset ${asset.id} requires a localized label`)
  }

  return issues
}

/** Versioned application assets come from a toolsliang-controlled origin only, never a third-party CDN. */
function isFirstPartyVersionedAssetUrl(url: string, version: string) {
  return Boolean(version?.trim())
    && url.startsWith(`${offlineAssetPathPrefix}/`)
    && url.includes(version)
}

function isPublishedTool(tool: ToolDefinition): tool is PublishedToolDefinition {
  return tool.availability.state === 'published'
}

function isIsoDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:'
  }
  catch {
    return false
  }
}
