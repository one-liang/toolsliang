import type { PublishedToolDefinition } from '@/features/tools/catalog'

/**
 * Document boundary for the NTD uppercase tool: which sources the page cites
 * and which caveats have to sit next to the result. Separated from the wording
 * constants because it changes whenever a source is re-reviewed, not when a
 * character, range or purpose rule changes.
 */

/** Names the reviewed set of rules the tool follows, by review date. */
export const ntdReferenceVersion = 'ntd-uppercase-2026-09-05'

/**
 * Every caveat must appear next to the result, in both locales. The three
 * purposes produce different wording for the same amount, so the tool has to
 * say which one is selected and what that choice changed.
 */
export const ntdCaveatKeys = [
  'no-legal-effect',
  'purpose-differs',
  'cheque-yuan-only',
  'treasury-rounds-to-yuan',
  'treasury-omits-zero',
  'written-amount-governs',
  'local-processing',
] as const

export type NtdCaveatKey = typeof ntdCaveatKeys[number]

/** Replaces the catalog entry's placeholder review once the tool page is rebuilt. */
export const ntdContentReview: PublishedToolDefinition['contentReview'] = {
  reviewedAt: '2026-09-05',
  sourceEdition: {
    'zh-tw': '票據法（1987 年 6 月 29 日修正）、臺灣票據交換所票據交換業務及票據信用管理補充規定（2009 年 10 月 14 日）與財政部國庫署國庫集中支付作業說明（2023 年 11 月 10 日更新）',
    en: 'Negotiable Instruments Act (amended June 29, 1987), Taiwan Clearing House supplementary rules on clearing and note credit (October 14, 2009), and National Treasury Administration centralised payment guidance (updated November 10, 2023)',
  },
  sourceEffectiveAt: '2023-11-10',
  sources: [
    {
      title: {
        'zh-tw': '全國法規資料庫：票據法第 7 條',
        en: 'Laws & Regulations Database: Negotiable Instruments Act, Article 7',
      },
      url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0380028',
    },
    {
      title: {
        'zh-tw': '全國法規資料庫：票據法施行細則第 3 條',
        en: 'Laws & Regulations Database: Enforcement Rules of the Negotiable Instruments Act, Article 3',
      },
      url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0380029',
    },
    {
      title: {
        'zh-tw': '臺灣票據交換所：票據交換業務手冊（票據交換業務及票據信用管理補充規定）',
        en: 'Taiwan Clearing House: clearing operations manual (supplementary rules on clearing and note credit)',
      },
      url: 'https://www.twnch.org.tw/manual.html',
    },
    {
      title: {
        'zh-tw': '財政部國庫署：國庫集中支付作業',
        en: 'National Treasury Administration: centralised treasury payment operations',
      },
      url: 'https://www.nta.gov.tw/singlehtml/296?cntId=nta_102_296',
    },
    {
      title: {
        'zh-tw': '財政部主管法規：國庫集中支付作業要點',
        en: 'Ministry of Finance: Directions for Centralised Treasury Payment Operations',
      },
      url: 'https://law-out.mof.gov.tw/LawContent.aspx?id=GL009063',
    },
    {
      title: {
        'zh-tw': '財政部主管法規：國庫支票管理辦法',
        en: 'Ministry of Finance: Regulations Governing the Administration of Treasury Cheques',
      },
      url: 'https://law-out.mof.gov.tw/LawContent.aspx?id=FL005816',
    },
    {
      title: {
        'zh-tw': '中央銀行法規：國庫專戶存款支票使用須知（非現行法規）',
        en: 'Central Bank regulations: Instructions for treasury account deposit cheques (no longer in force)',
      },
      url: 'https://www.law.cbc.gov.tw/Law/ShowAll?LawID=LA06C001001&LawDataType=1',
    },
  ],
}
