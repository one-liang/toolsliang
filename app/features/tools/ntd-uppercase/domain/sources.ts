import type { ToolContentReview } from '@/features/tools/catalog'

/**
 * Document boundary for the NTD uppercase tool: which sources the page cites
 * and which caveats the page has to state. Separated from the wording
 * constants because it changes whenever a source is re-reviewed, not when a
 * character, range or purpose rule changes.
 */

/** Names the reviewed set of rules the tool follows, by review date. */
export const ntdReferenceVersion = 'ntd-uppercase-2026-09-05'

/**
 * Every caveat still has to reach the page, in both locales. The three
 * purposes produce different wording for the same amount, so the tool has to
 * say which one is selected and what that choice changed. Since #82 the
 * workspace says it through the purpose hint and the rules of the selected
 * purpose; the rest is in the before-you-start answer and the FAQ.
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
export const ntdContentReview: ToolContentReview = {
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
      description: {
        'zh-tw': '票據上的金額文字與數字不符時，以文字為準。',
        en: 'When the amount in words and the amount in numerals on a note disagree, the words govern.',
      },
      url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0380028',
    },
    {
      title: {
        'zh-tw': '全國法規資料庫：票據法施行細則第 3 條',
        en: 'Laws & Regulations Database: Enforcement Rules of the Negotiable Instruments Act, Article 3',
      },
      description: {
        'zh-tw': '用機器印出、防止塗改的數字金額，在什麼條件下可以視同文字。',
        en: 'When an amount printed in numerals by a machine that prevents alteration counts as written in words.',
      },
      url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0380029',
    },
    {
      title: {
        'zh-tw': '臺灣票據交換所：票據交換業務手冊（票據交換業務及票據信用管理補充規定）',
        en: 'Taiwan Clearing House: clearing operations manual (supplementary rules on clearing and note credit)',
      },
      description: {
        'zh-tw': '金額大寫不得用「另」代替「零」；一般會計沒有法規限制可用的國字，寫法沿用這套票據實務。',
        en: 'A written amount may not use 另 for 零; general accounting has no rule of its own on numerals, so its wording follows this cheque practice.',
      },
      url: 'https://www.twnch.org.tw/manual.html',
    },
    {
      title: {
        'zh-tw': '財政部國庫署：國庫集中支付作業',
        en: 'National Treasury Administration: centralised treasury payment operations',
      },
      description: {
        'zh-tw': '國庫付款憑單金額寫到元為止、元以下四捨五入，而且不寫中間的「零」。',
        en: 'Treasury voucher amounts stop at 元, round half-up below it, and leave out the internal 零.',
      },
      url: 'https://www.nta.gov.tw/singlehtml/296?cntId=nta_102_296',
    },
    {
      title: {
        'zh-tw': '財政部主管法規：國庫集中支付作業要點',
        en: 'Ministry of Finance: Directions for Centralised Treasury Payment Operations',
      },
      description: {
        'zh-tw': '付款憑單上的大寫與數字金額必須相符，也不得塗改。',
        en: 'The written and numeric amounts on a payment voucher must agree and must not be altered.',
      },
      url: 'https://law-out.mof.gov.tw/LawContent.aspx?id=GL009063',
    },
    {
      title: {
        'zh-tw': '財政部主管法規：國庫支票管理辦法',
        en: 'Ministry of Finance: Regulations Governing the Administration of Treasury Cheques',
      },
      description: {
        'zh-tw': '國庫支票上必須寫中文大寫金額。',
        en: 'A treasury cheque has to carry its amount in formal Chinese.',
      },
      url: 'https://law-out.mof.gov.tw/LawContent.aspx?id=FL005816',
    },
    {
      title: {
        'zh-tw': '中央銀行法規：國庫專戶存款支票使用須知（非現行法規）',
        en: 'Central Bank regulations: Instructions for treasury account deposit cheques (no longer in force)',
      },
      description: {
        'zh-tw': '支票大寫可用的十五個國字，以及只寫到「元」為止的規定；它已不是現行法規，支票用途沿用它的寫法作為參考。',
        en: 'The fifteen numerals a cheque amount may use and the rule that it stops at 元; no longer in force, it remains the wording reference for the cheque purpose.',
      },
      url: 'https://www.law.cbc.gov.tw/Law/ShowAll?LawID=LA06C001001&LawDataType=1',
    },
  ],
}
