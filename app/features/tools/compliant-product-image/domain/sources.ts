import type { LocalizedCopy, PublishedToolDefinition } from '@/features/tools/catalog'

/**
 * Document boundary for the compliant product image tool: which channel
 * specifications it restates, how they were obtained, which channels were left
 * out and why, and which caveats have to sit next to a preset. Separated from
 * the data contract because it changes whenever a source is re-read, not when a
 * rule or a vector changes.
 */

/** Names the reviewed set of source decisions the tool follows, by review date. */
export const compliantImageReferenceVersion = 'compliant-product-image-2026-09-07'

/**
 * How much of a page can be taken at face value. Only a `policy` page can be
 * read as requirements throughout; anything lower has to be read sentence by
 * sentence, because channels mix rules with photography advice.
 */
export const compliantImageSourceTiers = ['policy', 'help', 'developer-doc', 'editorial'] as const

export type CompliantImageSourceTier = typeof compliantImageSourceTiers[number]

/**
 * Whether a maintainer can read the page again in ninety days. Only
 * `static-html` clears the bar: the other three cannot be re-checked without
 * signing in or working around the channel's own access rules.
 */
export const compliantImageRetrievabilityLevels = [
  'static-html',
  'requires-javascript',
  'requires-sign-in',
  'automated-access-restricted',
] as const

export type CompliantImageRetrievability = typeof compliantImageRetrievabilityLevels[number]

/**
 * None of these pages is published under an open licence, so the only lawful
 * basis for using them is the one every row records: cite the verifiable
 * numbers, quote the single sentence each rule came from, and link out. The
 * tool never reproduces, mirrors or caches a channel's page.
 */
export const compliantImageSourceUsage = 'quotation-and-outbound-link' as const

export interface CompliantImageSource {
  id: string
  publisher: LocalizedCopy
  title: LocalizedCopy
  url: string
  tier: CompliantImageSourceTier
  retrievability: CompliantImageRetrievability
  /** What the publisher allows. Recorded per source because it is not derivable. */
  licence: LocalizedCopy
  /** The publisher's terms page, only where this review could open one. */
  termsUrl?: string
  usage: typeof compliantImageSourceUsage
  /** The day the page was read end to end, not the day the channel published it. */
  checkedAt: string
}

/**
 * The four pages this review read. Every one of them returned complete static
 * HTML to an ordinary request on the check date, and none of them sits behind a
 * `Disallow` rule in its site's robots.txt.
 */
export const compliantImageSources = [
  {
    id: 'google-merchant-image-link',
    publisher: { 'zh-tw': 'Google', en: 'Google' },
    title: {
      'zh-tw': '產品資料規格：圖片連結 [image_link]',
      en: 'Product data specification: image link [image_link]',
    },
    url: 'https://support.google.com/merchants/answer/6324350',
    tier: 'policy',
    retrievability: 'static-html',
    licence: {
      'zh-tw': '著作權為 Google 所有，非開放授權；適用 Google 服務條款。',
      en: 'Copyright Google, not openly licensed; the Google Terms of Service apply.',
    },
    termsUrl: 'https://policies.google.com/terms',
    usage: compliantImageSourceUsage,
    checkedAt: '2026-09-07',
  },
  {
    id: 'amazon-product-photos',
    publisher: { 'zh-tw': 'Amazon', en: 'Amazon' },
    title: {
      'zh-tw': 'Amazon 商品攝影建議與規定（原題「6 tips for taking product photos in 2025」，2024-12-04 發佈）',
      en: '6 tips for taking product photos in 2025 (published 4 December 2024)',
    },
    url: 'https://sell.amazon.com/blog/product-photos',
    tier: 'editorial',
    retrievability: 'static-html',
    licence: {
      'zh-tw': '著作權為 Amazon 所有，非開放授權；適用 Amazon 使用條件。',
      en: 'Copyright Amazon, not openly licensed; the Amazon Conditions of Use apply.',
    },
    termsUrl: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=508088',
    usage: compliantImageSourceUsage,
    checkedAt: '2026-09-07',
  },
  {
    id: 'momo-store-publish-rules',
    publisher: {
      'zh-tw': '富邦媒體科技（momo 商店規則中心）',
      en: 'Fubon Multimedia Technology (momo store rules centre)',
    },
    title: {
      'zh-tw': '如何在 momo 發布商品',
      en: 'How to publish a product on momo',
    },
    url: 'https://rules.momo.com.tw/goods/00021/',
    tier: 'help',
    retrievability: 'static-html',
    licence: {
      'zh-tw': '著作權為富邦媒體科技所有，非開放授權；頁面頁尾載明保留所有權利，未另設公開條款頁。',
      en: 'Copyright Fubon Multimedia Technology, not openly licensed; the page footer reserves all rights and publishes no separate terms page.',
    },
    usage: compliantImageSourceUsage,
    checkedAt: '2026-09-07',
  },
  {
    id: 'ruten-store-faq',
    publisher: { 'zh-tw': '露天市集', en: 'Ruten' },
    title: {
      'zh-tw': '幫助中心：賣場經營相關問題',
      en: 'Help centre: running your store',
    },
    url: 'https://www.ruten.com.tw/help/seller/2883/',
    tier: 'help',
    retrievability: 'static-html',
    licence: {
      'zh-tw': '著作權為露天市集國際資訊所有，非開放授權；適用露天市集網站條款。',
      en: 'Copyright Ruten, not openly licensed; the Ruten site policies apply.',
    },
    termsUrl: 'https://www.ruten.com.tw/help/category/member/policy/',
    usage: compliantImageSourceUsage,
    checkedAt: '2026-09-07',
  },
] as const satisfies readonly CompliantImageSource[]

/** The ids above, so a preset cannot cite a source this review never read. */
export type CompliantImageSourceId = typeof compliantImageSources[number]['id']

/**
 * Why a channel is not in the first version. `conflicting-sources` and
 * `source-withdrawn` are unused today; they are part of the exclusion policy
 * this ticket had to define, and the re-check flow needs them the first time a
 * channel contradicts itself or takes a page down.
 */
export const compliantImageExclusionReasons = [
  'requires-javascript',
  'requires-sign-in',
  'automated-access-restricted',
  'no-public-specification',
  'conflicting-sources',
  'source-withdrawn',
] as const

export type CompliantImageExclusionReason = typeof compliantImageExclusionReasons[number]

export interface CompliantImageExcludedChannel {
  id: string
  name: LocalizedCopy
  reason: CompliantImageExclusionReason
  /** The page that proves the reason, so a re-evaluation starts from evidence. */
  evidenceUrl: string
  recheckAt: string
}

/**
 * Channels the tool must be able to talk about without shipping a preset for
 * them. Shopee is the largest Taiwan marketplace and its absence is the first
 * thing a merchant will notice, so the page answers the question rather than
 * leaving a gap.
 */
export const compliantImageExcludedChannels = [
  {
    id: 'shopee-tw',
    name: { 'zh-tw': '蝦皮購物（台灣）', en: 'Shopee Taiwan' },
    reason: 'requires-javascript',
    evidenceUrl: 'https://seller.shopee.tw/edu/article/258',
    recheckAt: '2026-12-07',
  },
  {
    id: 'ebay',
    name: { 'zh-tw': 'eBay', en: 'eBay' },
    reason: 'automated-access-restricted',
    evidenceUrl: 'https://www.ebay.com/robots.txt',
    recheckAt: '2026-12-07',
  },
  {
    id: 'meta-commerce',
    name: { 'zh-tw': 'Meta 商品目錄', en: 'Meta commerce catalog' },
    reason: 'automated-access-restricted',
    evidenceUrl: 'https://developers.facebook.com/robots.txt',
    recheckAt: '2026-12-07',
  },
  {
    id: 'pchome-store',
    name: { 'zh-tw': 'PChome 商店街', en: 'PChome Store Street' },
    reason: 'no-public-specification',
    evidenceUrl: 'https://boss.pcstore.com.tw/onlineshop.htm',
    recheckAt: '2026-12-07',
  },
  {
    id: 'yahoo-tw',
    name: { 'zh-tw': 'Yahoo 奇摩拍賣', en: 'Yahoo Taiwan Auctions' },
    reason: 'requires-javascript',
    evidenceUrl: 'https://tw.help.yahoo.com/kb/auctions',
    recheckAt: '2026-12-07',
  },
  {
    id: 'momo-supplier',
    name: { 'zh-tw': 'momo 購物網供應商', en: 'momo shopping supplier programme' },
    reason: 'requires-sign-in',
    evidenceUrl: 'https://corp.momo.com.tw/stakeholder/supplier',
    recheckAt: '2026-12-07',
  },
] as const satisfies readonly CompliantImageExcludedChannel[]

/**
 * Every caveat must be visible while a preset is selected, in both locales.
 * They are separate keys rather than one paragraph because they answer
 * different questions, and the page has to be able to place them next to the
 * control each one qualifies.
 */
export const compliantImageCaveatKeys = [
  'no-approval-guarantee',
  'not-official-partner',
  'source-and-review-date',
  'channel-may-change',
  'manual-rules-not-checked',
  'unspecified-fields-not-inferred',
  'expired-preset-disabled',
  'local-processing',
] as const

export type CompliantImageCaveatKey = typeof compliantImageCaveatKeys[number]

/** Fills the Tool Definition's content review once T21 publishes the tool page. */
export const compliantImageContentReview: PublishedToolDefinition['contentReview'] = {
  reviewedAt: '2026-09-07',
  sourceEdition: {
    'zh-tw': 'Google 產品資料規格、Amazon 商品攝影說明、momo 商店規則中心與露天市集幫助中心，均於 2026-09-07 查核',
    en: 'Google product data specification, Amazon product photo guidance, the momo store rules centre and the Ruten help centre, all reviewed on 2026-09-07',
  },
  sourceEffectiveAt: '2026-09-07',
  sources: [
    {
      title: {
        'zh-tw': 'Google 產品資料規格：圖片連結 [image_link]',
        en: 'Google product data specification: image link [image_link]',
      },
      url: 'https://support.google.com/merchants/answer/6324350',
    },
    {
      title: {
        'zh-tw': 'Amazon：6 tips for taking product photos in 2025',
        en: 'Amazon: 6 tips for taking product photos in 2025',
      },
      url: 'https://sell.amazon.com/blog/product-photos',
    },
    {
      title: {
        'zh-tw': 'momo 商店規則中心：如何在 momo 發布商品',
        en: 'momo store rules centre: how to publish a product on momo',
      },
      url: 'https://rules.momo.com.tw/goods/00021/',
    },
    {
      title: {
        'zh-tw': '露天市集幫助中心：賣場經營相關問題',
        en: 'Ruten help centre: running your store',
      },
      url: 'https://www.ruten.com.tw/help/seller/2883/',
    },
  ],
}
