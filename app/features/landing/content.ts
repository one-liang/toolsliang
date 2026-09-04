import {
  copy,
  getTool,
  localeUrl,
  resolvePublishedTools,
  siteOrigin,
  type LocaleCode,
  type LocalizedCopy,
} from '@/features/tools/catalog'

/** A short heading plus the sentence that backs it, both fully localized. */
interface LocalizedSection {
  heading: LocalizedCopy
  body: LocalizedCopy
}

/**
 * Editorial highlight for the landing page. It is a curated shortlist, never a
 * personalised or aggregated ranking, so it stays a plain slug list that the
 * registry validates instead of a computed popularity score.
 */
const featuredToolSlugs = ['ntd-uppercase']

const landingCopy = {
  heroEyebrow: { 'zh-tw': '台灣的本機工具站', en: 'Local-first tools from Taiwan' },
  heroTitle: {
    'zh-tw': '事情在這裡處理完，內容不用交出去。',
    en: 'Get the job done without handing your content over.',
  },
  heroIntro: {
    'zh-tw': 'toolsliang 把電商上架、辦公文件與日常計算需要的小工具放在同一個地方。檔案、文字與數值都在你的瀏覽器裡處理，不會上傳。',
    en: 'toolsliang gathers the small utilities you need for online storefronts, office documents, and everyday numbers. Files, text, and values are processed in your browser and never uploaded.',
  },
  heroSearchNote: {
    'zh-tw': '搜尋只在這個瀏覽器內比對工具名稱與關鍵字，查詢文字不會送出。',
    en: 'Search matches tool names and keywords inside this browser only; your query is never sent anywhere.',
  },
  heroBrowseAll: { 'zh-tw': '瀏覽全部工具', en: 'Browse all tools' },
  privacyEyebrow: { 'zh-tw': '本機處理', en: 'Local processing' },
  privacyTitle: { 'zh-tw': '內容只留在這台裝置', en: 'Your content stays on this device' },
  privacyBody: {
    'zh-tw': 'toolsliang 沒有把工具內容送到伺服器的路徑。檔案、文字、數值與處理結果都在瀏覽器內完成，離開頁面後也不會留在平台上。',
    en: 'toolsliang has no path that sends tool content to a server. Files, text, values, and results are handled in the browser, and nothing is kept on the platform after you leave.',
  },
  featuredEyebrow: { 'zh-tw': '熱門工具', en: 'Popular tools' },
  featuredTitle: { 'zh-tw': '先從這幾個工具開始', en: 'Start with these tools' },
  featuredIntro: {
    'zh-tw': '這是編輯挑選的常用入口，不依個人使用紀錄排序。',
    en: 'An editorial selection of common entry points, not ranked by your personal activity.',
  },
  catalogEyebrow: { 'zh-tw': '工具分類', en: 'Tool categories' },
  catalogTitle: { 'zh-tw': '依照任務找工具', en: 'Find a tool by task' },
  catalogIntro: {
    'zh-tw': '每個工具都有自己的頁面與專注工作區；在這裡先看它負責哪一件事。',
    en: 'Every tool has its own page and focused workspace; here you can see what each one handles.',
  },
  faqEyebrow: { 'zh-tw': '常見問題', en: 'Common questions' },
  faqTitle: { 'zh-tw': '使用前想先知道的事', en: 'What people ask before starting' },
  faqIntro: {
    'zh-tw': '以下說明適用於目前所有已發布的工具。',
    en: 'These answers apply to every published tool today.',
  },
  seoTitle: { 'zh-tw': '在瀏覽器完成的實用工具', en: 'Private browser tools' },
  seoDescription: {
    'zh-tw': 'toolsliang 集合電商、辦公與日常需要的本機工具。檔案、文字與數值都在瀏覽器內處理，不上傳到伺服器或第三方。',
    en: 'toolsliang gathers local-first utilities for commerce, office, and everyday tasks. Files, text, and values are processed in your browser, never uploaded to a server or third party.',
  },
  organizationDescription: {
    'zh-tw': 'toolsliang 是台灣優先的萬用工具網站，工具內容留在使用者裝置。',
    en: 'toolsliang is a Taiwan-first utility site that keeps tool content on the visitor’s device.',
  },
} satisfies Record<string, LocalizedCopy>

export type LandingCopyKey = keyof typeof landingCopy
export const landingCopyKeys = Object.keys(landingCopy) as LandingCopyKey[]

const landingPrivacyPoints: LocalizedSection[] = [
  {
    heading: { 'zh-tw': '檔案不上傳', en: 'Files are not uploaded' },
    body: {
      'zh-tw': '你選擇的檔案與圖片只在瀏覽器記憶體中處理，不會傳到 toolsliang 或第三方服務。',
      en: 'The files and images you choose are handled in browser memory, never sent to toolsliang or a third-party service.',
    },
  },
  {
    heading: { 'zh-tw': '搜尋留在本機', en: 'Search stays local' },
    body: {
      'zh-tw': '首頁搜尋比對的是隨頁面一起載入的工具資料，查詢文字不會送到搜尋或分析服務。',
      en: 'The home page searches tool data that loads with the page; your query never reaches a search or analytics service.',
    },
  },
  {
    heading: { 'zh-tw': '匿名就能使用', en: 'Anonymous by default' },
    body: {
      'zh-tw': '所有工具不需要註冊或登入；登入只用來同步語言、主題與常用工具等偏好。',
      en: 'Every tool works without an account; signing in only syncs preferences such as language, theme, and saved tools.',
    },
  },
]

const landingFaq: LocalizedSection[] = [
  {
    heading: { 'zh-tw': 'toolsliang 是什麼？', en: 'What is toolsliang?' },
    body: {
      'zh-tw': 'toolsliang 是台灣優先的萬用工具網站，提供電商上架、辦公文件、日常計算與本機抽選等工具，每個工具都有自己的頁面。',
      en: 'toolsliang is a Taiwan-first utility site with tools for online storefronts, office documents, everyday calculations, and local random selection. Each tool has its own page.',
    },
  },
  {
    heading: { 'zh-tw': '我的檔案、文字與數值會被上傳嗎？', en: 'Are my files, text, and values uploaded?' },
    body: {
      'zh-tw': '不會。工具內容與處理結果都在你的瀏覽器完成，toolsliang 沒有接收這些內容的伺服器路徑。',
      en: 'No. Tool content and results are handled in your browser, and toolsliang has no server path that receives them.',
    },
  },
  {
    heading: { 'zh-tw': '搜尋工具時會把查詢文字送出去嗎？', en: 'Does searching send my query anywhere?' },
    body: {
      'zh-tw': '不會。搜尋比對的是隨頁面載入的工具資料，查詢文字與點選紀錄都不會送到搜尋或分析服務。',
      en: 'No. Search matches tool data loaded with the page; neither your query nor what you click is sent to a search or analytics service.',
    },
  },
  {
    heading: { 'zh-tw': '需要註冊或登入才能使用工具嗎？', en: 'Do I need an account to use the tools?' },
    body: {
      'zh-tw': '不需要。所有工具都可以匿名使用；登入只用來跨裝置同步語言、主題與常用工具等偏好，不會同步工具內容。',
      en: 'No. Every tool works anonymously. Signing in only syncs preferences such as language, theme, and saved tools across devices — never tool content.',
    },
  },
]

const landingContentIssues = validateLandingContent()
if (landingContentIssues.length) {
  throw new Error(`Invalid landing content:\n${landingContentIssues.join('\n')}`)
}

export function getFeaturedTools() {
  return resolvePublishedTools(featuredToolSlugs)
}

export function getLandingCopy(locale: LocaleCode): Record<LandingCopyKey, string> {
  return Object.fromEntries(
    landingCopyKeys.map(key => [key, copy(landingCopy[key], locale)]),
  ) as Record<LandingCopyKey, string>
}

export function getLandingPrivacyPoints(locale: LocaleCode) {
  return localizeSections(landingPrivacyPoints, locale)
}

export function getLandingFaq(locale: LocaleCode) {
  return localizeSections(landingFaq, locale)
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
  const hasLocalizedCopy = (value: LocalizedCopy) => Boolean(value['zh-tw']?.trim() && value.en?.trim())

  for (const key of landingCopyKeys) {
    if (!hasLocalizedCopy(landingCopy[key])) issues.push(`[copy:${key}] requires both locales`)
  }

  const seen = new Set<string>()
  for (const slug of featuredToolSlugs) {
    if (seen.has(slug)) issues.push(`[featured:${slug}] duplicate highlight`)
    seen.add(slug)
    if (!getTool(slug)) issues.push(`[featured:${slug}] highlight must reference a published tool`)
  }
  if (!featuredToolSlugs.length) issues.push('[featured] requires at least one published highlight')

  for (const [label, sections] of [['privacy', landingPrivacyPoints], ['faq', landingFaq]] as const) {
    for (const [index, section] of sections.entries()) {
      if (!hasLocalizedCopy(section.heading) || !hasLocalizedCopy(section.body)) {
        issues.push(`[${label}:${index}] requires both locales`)
      }
    }
  }

  return issues
}
