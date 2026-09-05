import { groupNtdAmount } from './domain/convert'
import {
  ntdGoldenVectors,
  ntdInputRules,
  ntdPurposeRules,
  ntdPurposes,
  type NtdErrorCode,
  type NtdPurpose,
} from './domain/reference'
import { ntdCaveatKeys, ntdContentReview, type NtdCaveatKey } from './domain/sources'
import type { ToolFaqEntry } from '../faq'
import { hasLocalizedCopy, type LocaleCode, type LocalizedCopy } from '../catalog'

/**
 * Everything the NTD uppercase workspace and page say out loud. It sits beside
 * the converter rather than inside the component because the document boundary
 * is reviewed as content: the caveats keep the wording published in
 * docs/research/002-ntd-uppercase-rules-and-sources.md §7.1, the questions keep
 * the ones approved in §8, and the error messages keep §5.5. Bounds and worked
 * examples are read from the reviewed rules and vectors, never retyped, so a
 * sentence cannot promise a limit the converter does not enforce.
 */

const ntdCopyEntries = {
  purposeLegend: { 'zh-tw': '用途', en: 'Purpose' },
  purposeHint: {
    'zh-tw': '三種用途的寫法不同，請先選擇你要填寫的單據。',
    en: 'The three purposes are written differently, so pick the document you are filling in first.',
  },
  amountLabel: { 'zh-tw': '輸入金額（新臺幣）', en: 'Amount (NTD)' },
  amountHint: {
    'zh-tw': `可用千分位逗號，小數點後最多 ${ntdInputRules.maxDecimalDigits} 位。`,
    en: `Thousands separators are allowed, with at most ${ntdInputRules.maxDecimalDigits} decimal places.`,
  },
  amountPlaceholder: { 'zh-tw': '例如：12,850.50', en: 'e.g. 12,850.50' },
  resultLabel: { 'zh-tw': '轉換結果', en: 'Result' },
  resultEmpty: {
    'zh-tw': '選好用途並輸入金額後，這裡會顯示可以照抄的國字大寫。',
    en: 'Pick a purpose and enter an amount to see the wording you can copy.',
  },
  normalizedLabel: { 'zh-tw': '核對用數字金額', en: 'Amount in numerals' },
  roundedLabel: { 'zh-tw': '元以下四捨五入', en: 'Rounded half-up at 元' },
  copyLabel: { 'zh-tw': '複製結果', en: 'Copy result' },
  copiedLabel: { 'zh-tw': '已複製國字大寫', en: 'Wording copied' },
  copyFailedLabel: {
    'zh-tw': '無法自動複製，請手動選取結果文字後複製。',
    en: 'Copying automatically did not work; select the result text and copy it manually.',
  },
  clearLabel: { 'zh-tw': '清除', en: 'Clear' },
  purposeRulesTitle: { 'zh-tw': '這個用途的規則', en: 'Rules for this purpose' },
  limitLabel: { 'zh-tw': '金額上限', en: 'Upper limit' },
  fractionLabel: { 'zh-tw': '一元以下', en: 'Below one yuan' },
  internalZeroLabel: { 'zh-tw': '中間的零', en: 'Internal 零' },
  endingLabel: { 'zh-tw': '結尾', en: 'Ending' },
  caveatsTitle: { 'zh-tw': '抄寫前要知道', en: 'Before you copy this' },
  sourceLabel: { 'zh-tw': '規則依據', en: 'Rule source' },
  ruleVersionLabel: { 'zh-tw': '規則版本', en: 'Rule version' },
  treasuryZeroNote: {
    'zh-tw': '國庫署公開的例示只涵蓋單一單位交界；金額若在多個交界都是零，建議與付款機關再確認一次，核對時也請逐位讀，不要照口語讀。',
    en: 'The National Treasury Administration publishes an example for a single unit boundary only; when zeros fall on several boundaries, confirm the wording with the paying agency, and read it position by position rather than the way the number is said aloud.',
  },
  examplesEyebrow: { 'zh-tw': '用途差異', en: 'Purpose differences' },
  examplesTitle: { 'zh-tw': '同一筆金額的三種寫法', en: 'One amount, three ways to write it' },
  examplesIntro: {
    'zh-tw': '國庫付款憑單不寫中間的「零」，所以同一筆金額看起來會比另外兩種短。',
    en: 'A treasury voucher omits the internal 零, so the same amount reads shorter than it does for the other two purposes.',
  },
  examplesCaption: {
    'zh-tw': '同一筆金額在三種用途的國字大寫',
    en: 'The same amount written for each of the three purposes',
  },
  examplesAmountColumn: { 'zh-tw': '金額', en: 'Amount' },
  digitReferenceEyebrow: { 'zh-tw': '快速對照', en: 'Quick reference' },
  digitReferenceTitle: { 'zh-tw': '數字與國字對照', en: 'Number to formal Chinese numeral' },
  digitReferenceIntro: {
    'zh-tw': '可先從單一數字了解轉換結果使用的國字大寫。',
    en: 'Use this table to see how each digit appears in the converted result.',
  },
  digitReferenceCaption: {
    'zh-tw': '數字與國字大寫對照',
    en: 'Number and formal Chinese numeral reference',
  },
  numberColumn: { 'zh-tw': '數字', en: 'Number' },
  numeralColumn: { 'zh-tw': '國字大寫', en: 'Formal Chinese numeral' },
} satisfies Record<string, LocalizedCopy>

export type NtdCopyKey = keyof typeof ntdCopyEntries
export const ntdCopyKeys = Object.keys(ntdCopyEntries) as NtdCopyKey[]
export const ntdCopy: Record<NtdCopyKey, LocalizedCopy> = ntdCopyEntries

/** Section 7.1: shown next to the result, complete, in both locales. */
export const ntdCaveats: Record<NtdCaveatKey, LocalizedCopy> = {
  'no-legal-effect': {
    'zh-tw': '這裡的結果是文字對照參考，不是法律或會計審查，也不保證受款機構或金融機構一定接受。',
    en: 'This result is a wording reference, not legal or accounting review, and does not guarantee that a bank or receiving institution will accept it.',
  },
  'purpose-differs': {
    'zh-tw': '三種用途的寫法不同，抄寫前請先確認你要填的單據屬於哪一種。',
    en: 'The three purposes produce different wording; confirm which document you are filling in before copying the result.',
  },
  'cheque-yuan-only': {
    'zh-tw': '支票大寫金額寫到「元」為止，不計「角」「分」；金額有角分請先與收款人確認。',
    en: 'Cheque amounts are written to 元 only and do not carry 角 or 分; confirm the amount with the payee if it has a fractional part.',
  },
  'treasury-rounds-to-yuan': {
    'zh-tw': '國庫付款憑單金額至元為止、元以下四捨五入，換算後的金額可能與你輸入的不同。',
    en: 'Treasury voucher amounts stop at 元 and round half-up, so the converted amount can differ from what you entered.',
  },
  'treasury-omits-zero': {
    'zh-tw': '國庫付款憑單依國庫署規定不書寫中間的「零」，與一般會計寫法不同。',
    en: 'Treasury payment vouchers omit the internal 零 as required by the National Treasury Administration, unlike general accounting wording.',
  },
  'written-amount-governs': {
    'zh-tw': '票據上文字與號碼不符時，依票據法以文字為準，填寫後務必再核對一次大小寫金額。',
    en: 'Under the Negotiable Instruments Act the written amount governs when it differs from the numerals, so re-check both fields after filling them in.',
  },
  'local-processing': {
    'zh-tw': '金額只在你的瀏覽器換算，不會送出、不會保存。',
    en: 'Amounts are converted in your browser only; nothing is sent or stored.',
  },
}

/**
 * A caveat that only makes sense for one purpose appears with that purpose; the
 * rest are true of every wording and stay visible whichever purpose is picked.
 */
const purposeCaveatKeys: Record<NtdPurpose, NtdCaveatKey[]> = {
  accounting: [],
  cheque: ['cheque-yuan-only'],
  treasury: ['treasury-rounds-to-yuan', 'treasury-omits-zero'],
}

const ntdErrorCopy: Record<NtdErrorCode, LocalizedCopy> = {
  'empty': {
    'zh-tw': '請先輸入要換寫的新臺幣金額。',
    en: 'Enter the New Taiwan dollar amount you want to convert.',
  },
  'invalid-format': {
    'zh-tw': '只能輸入數字，可用小數點與千分位逗號，例如 1,234.56。',
    en: 'Enter digits only; a decimal point and thousands separators are allowed, for example 1,234.56.',
  },
  'exponent-notation': {
    'zh-tw': '不支援科學記號，請改寫成完整的數字。',
    en: 'Scientific notation is not supported; write the amount out in full.',
  },
  'negative': {
    'zh-tw': '國字大寫沒有標準的負數寫法，請輸入 0 或正數金額。',
    en: 'There is no standard formal Chinese wording for a negative amount; enter zero or a positive amount.',
  },
  'ambiguous-separator': {
    'zh-tw': '千分位要三位一組，例如 1,234,567；也可以直接移除逗號。',
    en: 'Thousands separators must group three digits, as in 1,234,567; you can also remove the commas.',
  },
  'too-many-decimals': {
    'zh-tw': '新臺幣最小到「分」，小數點後最多兩位。',
    en: 'The New Taiwan dollar goes down to 分, so enter at most two decimal places.',
  },
  'fraction-not-supported': {
    'zh-tw': '支票大寫金額寫到「元」為止，請先與收款人確認金額後再輸入整數。',
    en: 'A cheque amount is written to 元 only; confirm the amount with the payee, then enter a whole number.',
  },
  'out-of-range': {
    'zh-tw': '超過這個用途的上限，最多可換寫到 {limit} 元。',
    en: 'The amount exceeds this purpose\'s limit of {limit} 元.',
  },
}

/**
 * Which reviewed source governs each purpose. Section 4.1 records that no
 * regulation limits the numerals of general accounting, so its wording follows
 * cheque practice and cites the source that fixed that practice.
 */
const purposeSources: Record<NtdPurpose, { url: string, note: LocalizedCopy }> = {
  accounting: {
    url: 'https://www.twnch.org.tw/manual.html',
    note: {
      'zh-tw': '一般會計沒有法規限制可用的國字，寫法沿用票據實務。',
      en: 'No regulation limits the numerals used in general accounting, so this wording follows cheque practice.',
    },
  },
  cheque: {
    url: 'https://www.law.cbc.gov.tw/Law/ShowAll?LawID=LA06C001001&LawDataType=1',
    note: {
      'zh-tw': '支票寫法依中央銀行的支票使用須知。',
      en: 'Cheque wording follows the Central Bank instructions for treasury account deposit cheques.',
    },
  },
  treasury: {
    url: 'https://www.nta.gov.tw/singlehtml/296?cntId=nta_102_296',
    note: {
      'zh-tw': '國庫付款憑單寫法依財政部國庫署的國庫集中支付作業說明。',
      en: 'Treasury voucher wording follows the National Treasury Administration centralised payment guidance.',
    },
  },
}

/** Section 4: what each purpose changes, in the reviewed wording. */
const ntdPurposeSummaries: Record<NtdPurpose, Record<'fraction' | 'internalZero' | 'ending', LocalizedCopy>> = {
  accounting: {
    fraction: { 'zh-tw': '保留「角」與「分」', en: 'Keeps 角 and 分' },
    internalZero: { 'zh-tw': '中間的零照寫', en: 'Writes the internal 零' },
    ending: { 'zh-tw': '整數元才加「整」', en: 'Adds 整 only to a whole amount' },
  },
  cheque: {
    fraction: { 'zh-tw': '寫到「元」為止，有角分會請你先確認金額', en: 'Written to 元 only; an amount with 角 or 分 is sent back to you to confirm' },
    internalZero: { 'zh-tw': '中間的零照寫', en: 'Writes the internal 零' },
    ending: { 'zh-tw': '一律加「整」', en: 'Always closes with 整' },
  },
  treasury: {
    fraction: { 'zh-tw': '元以下四捨五入', en: 'Rounds half-up at 元' },
    internalZero: { 'zh-tw': '中間的零不書寫', en: 'Omits the internal 零' },
    ending: { 'zh-tw': '一律加「整」', en: 'Always closes with 整' },
  },
}

/**
 * The amounts the page compares across all three purposes. They are named here
 * but written by the reviewed vectors, so a worked example on the page is the
 * same string the converter's tests assert.
 */
const comparisonInputs = ['0', '101', '10215', '100000']

export interface NtdComparisonExample {
  input: string
  normalized: string
  wordings: Record<NtdPurpose, string>
}

export const ntdComparisonExamples: NtdComparisonExample[] = comparisonInputs.map(input => ({
  input,
  normalized: groupNtdAmount(input),
  wordings: Object.fromEntries(ntdPurposes.map(purpose => [purpose, wordingVector(input, purpose)])) as Record<NtdPurpose, string>,
}))

/** Section 8: the visible questions, and the only ones the page publishes as structured data. */
export const ntdFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': '新臺幣國字大寫怎麼寫？', en: 'How is an NTD amount written in formal Chinese?' },
    body: {
      'zh-tw': '以「新臺幣」開頭，數字寫成零、壹、貳、參、肆、伍、陸、柒、捌、玖，位數用拾、佰、仟，每四位再接萬、億、兆，最後寫「元」並以「整」或「角」「分」收尾。十位一律寫「壹拾」，被跳過的位置只寫一個「零」。',
      en: 'Start with 新臺幣, write the digits as 零壹貳參肆伍陸柒捌玖, mark positions with 拾, 佰 and 仟, add 萬, 億 or 兆 every four digits, then close with 元 followed by 整, or by 角 and 分. A ten is always 壹拾, and a skipped position takes a single 零.',
    },
  },
  {
    heading: { 'zh-tw': '支票的大寫金額有哪些限制？', en: 'What limits apply to a cheque amount?' },
    body: {
      'zh-tw': '依中央銀行「國庫專戶存款支票使用須知」（非現行法規），支票大寫金額限用壹、貳、參、肆、伍、陸、柒、捌、玖、拾、佰、仟、萬、億、零這十五個中文數字，緊接「新臺幣」書寫，金額填到「元」為止並加「整」。這份清單沒有「兆」，所以支票用途的上限是 999,999,999,999 元。',
      en: 'Under the Central Bank instructions for treasury account deposit cheques (no longer in force), a cheque amount uses only the fifteen numerals 壹貳參肆伍陸柒捌玖拾佰仟萬億零, follows 新臺幣 directly, stops at 元 and closes with 整. That list has no 兆, which is why the cheque purpose stops at NT$999,999,999,999.',
    },
  },
  {
    heading: { 'zh-tw': '為什麼支票不寫「角」「分」？', en: 'Why do cheques omit 角 and 分?' },
    body: {
      'zh-tw': '同一份須知寫明支票金額「角」「分」不計。票據上文字與號碼不符時以文字為準，所以這個工具不會替你把角分捨去或進位；輸入有角分的金額時，它會請你先與收款人確認，再輸入整數金額。',
      en: 'The same instructions state that a cheque amount does not carry 角 or 分. Because the written amount governs when it differs from the numerals, this tool never drops or rounds a fraction for you: it asks you to confirm the amount with the payee and enter a whole number instead.',
    },
  },
  {
    heading: { 'zh-tw': '國庫付款憑單為什麼不寫中間的「零」？', en: 'Why does a treasury voucher omit the internal 零?' },
    body: {
      'zh-tw': '財政部國庫署「國庫集中支付作業」明文規定「大寫中間之零不書寫」，並以 10,215 元應寫「壹萬貳佰壹拾伍元整」為例。這與一般會計寫法相反，而且公開的例示只涵蓋單一單位交界；金額若在多個交界都是零，建議與付款機關再確認一次。抄寫與核對時請逐位對照旁邊的阿拉伯數字金額，不要照口語讀。',
      en: 'The National Treasury Administration centralised payment guidance requires the internal 零 to be omitted, and gives NT$10,215 written as 壹萬貳佰壹拾伍元整 as its example. That is the opposite of general accounting wording, and the published example covers a single unit boundary only, so confirm the wording with the paying agency when zeros fall on several boundaries. Read the numerals beside the result position by position rather than the way the number is said aloud.',
    },
  },
  {
    heading: { 'zh-tw': '國庫付款憑單的金額怎麼取到元？', en: 'How is a treasury voucher amount rounded?' },
    body: {
      'zh-tw': '依國庫署規定「金額至元為止，元以下四捨五入」。四捨五入會改變你要填的數字，所以選擇這個用途時，工具會同時顯示捨入前與捨入後的金額，例如 12,850.5 元寫成「壹萬貳仟捌佰伍拾壹元整」。',
      en: 'The guidance says the amount stops at 元 and rounds half-up below it. Rounding changes the number you fill in, so this purpose shows the amount before and after rounding: NT$12,850.5 becomes 壹萬貳仟捌佰伍拾壹元整.',
    },
  },
  {
    heading: { 'zh-tw': '大寫金額和數字金額不一樣時以哪個為準？', en: 'Which governs when the words and numerals differ?' },
    body: {
      'zh-tw': '依《票據法》第 7 條，票據上記載金額的文字與號碼不符時，以文字為準；《國庫集中支付作業要點》也要求大小寫金額相符。填寫後請務必再核對一次兩欄金額。',
      en: 'Under Article 7 of the Negotiable Instruments Act the written amount governs when it differs from the numerals on a note, and the treasury payment directions likewise require the two to agree. Re-check both fields after filling them in.',
    },
  },
  {
    heading: { 'zh-tw': '「另」可以拿來代替「零」嗎？', en: 'Can 另 replace 零?' },
    body: {
      'zh-tw': '不行。臺灣票據交換所票據交換業務及票據信用管理補充規定明定金額大寫不得以「另」代替「零」，本工具只會輸出「零」。',
      en: 'No. The Taiwan Clearing House supplementary rules on clearing and note credit state that 另 must not stand in for 零 in a written amount, and this tool only ever writes 零.',
    },
  },
  {
    heading: { 'zh-tw': '這個工具的結果有法律效力嗎？', en: 'Does this result have legal effect?' },
    body: {
      'zh-tw': '沒有。這裡的結果是文字對照參考，不是法律或會計審查，也不保證受款機構或金融機構一定接受；請依你要填寫的單據規定書寫，並自行核對金額。',
      en: 'No. The result is a wording reference, not legal or accounting review, and it does not guarantee that a bank or receiving institution will accept it. Follow the rules of the document you are filling in, and check the amount yourself.',
    },
  },
  {
    heading: { 'zh-tw': '我輸入的金額會被上傳嗎？', en: 'Is my amount uploaded?' },
    body: {
      'zh-tw': '不會。金額、選擇的用途與轉換結果只留在這個瀏覽器分頁，不會被保存、不會寫進網址，也不會送到 toolsliang 或第三方服務。',
      en: 'No. The amount, the purpose you pick, and the wording stay in this browser tab; they are never stored, written into the URL, or sent to toolsliang or a third-party service.',
    },
  },
]

const ntdContentIssues = validateNtdContent()
if (ntdContentIssues.length) {
  throw new Error(`Invalid NTD uppercase content:\n${ntdContentIssues.join('\n')}`)
}

export function getNtdCopy(locale: LocaleCode): Record<NtdCopyKey, string> {
  return Object.fromEntries(
    ntdCopyKeys.map(key => [key, ntdCopy[key][locale]]),
  ) as Record<NtdCopyKey, string>
}

export function getNtdCaveats(locale: LocaleCode, purpose: NtdPurpose) {
  const shown = new Set<NtdCaveatKey>([
    ...ntdCaveatKeys.filter(key => !isPurposeCaveat(key)),
    ...purposeCaveatKeys[purpose],
  ])

  return ntdCaveatKeys
    .filter(key => shown.has(key))
    .map(key => ({ key, text: ntdCaveats[key][locale] }))
}

/** The message a refused amount gets, with the bound of the purpose that refused it. */
export function ntdErrorMessage(code: NtdErrorCode, purpose: NtdPurpose, locale: LocaleCode) {
  return ntdErrorCopy[code][locale].replace('{limit}', ntdPurposeLimit(purpose))
}

export function getNtdPurposeSummary(purpose: NtdPurpose, locale: LocaleCode) {
  const summary = ntdPurposeSummaries[purpose]
  const source = purposeSource(purpose)

  return {
    label: ntdPurposeRules[purpose].label[locale],
    limit: ntdPurposeLimit(purpose),
    fraction: summary.fraction[locale],
    internalZero: summary.internalZero[locale],
    ending: summary.ending[locale],
    sourceNote: purposeSources[purpose].note[locale],
    source: { title: source.title[locale], url: source.url },
  }
}

/** The cited source is always one the review already published, never a new link. */
function purposeSource(purpose: NtdPurpose) {
  const source = ntdContentReview.sources.find(item => item.url === purposeSources[purpose].url)
  if (!source) throw new Error(`The ${purpose} source is not in the reviewed source list`)

  return source
}

function ntdPurposeLimit(purpose: NtdPurpose) {
  return groupNtdAmount(ntdPurposeRules[purpose].maxAmount)
}

function isPurposeCaveat(key: NtdCaveatKey) {
  return ntdPurposes.some(purpose => purposeCaveatKeys[purpose].includes(key))
}

function wordingVector(input: string, purpose: NtdPurpose) {
  const vector = ntdGoldenVectors.find(item => item.input === input && item.purpose === purpose)
  if (!vector) throw new Error(`No reviewed ${purpose} vector for ${input}`)

  return vector.wording
}

export function validateNtdContent() {
  const issues: string[] = []

  for (const key of ntdCopyKeys) {
    if (!hasLocalizedCopy(ntdCopy[key])) issues.push(`[copy:${key}] requires both locales`)
  }

  for (const key of ntdCaveatKeys) {
    if (!hasLocalizedCopy(ntdCaveats[key])) issues.push(`[caveat:${key}] requires both locales`)
  }
  for (const key of Object.keys(ntdCaveats)) {
    if (!ntdCaveatKeys.includes(key as NtdCaveatKey)) issues.push(`[caveat:${key}] is not a reviewed caveat`)
  }

  for (const [code, copy] of Object.entries(ntdErrorCopy)) {
    if (!hasLocalizedCopy(copy)) issues.push(`[error:${code}] requires both locales`)
  }

  for (const purpose of ntdPurposes) {
    for (const [field, copy] of Object.entries(ntdPurposeSummaries[purpose])) {
      if (!hasLocalizedCopy(copy)) issues.push(`[purpose:${purpose}:${field}] requires both locales`)
    }
    if (!hasLocalizedCopy(purposeSources[purpose].note)) issues.push(`[purpose:${purpose}:sourceNote] requires both locales`)
    if (!ntdContentReview.sources.some(source => source.url === purposeSources[purpose].url)) {
      issues.push(`[purpose:${purpose}] cites a source outside the reviewed list`)
    }
  }

  const questions = new Set<string>()
  for (const [index, entry] of ntdFaq.entries()) {
    if (!hasLocalizedCopy(entry.heading) || !hasLocalizedCopy(entry.body)) {
      issues.push(`[faq:${index}] requires both locales`)
    }
    if (questions.has(entry.heading['zh-tw'])) issues.push(`[faq:${index}] duplicate question`)
    questions.add(entry.heading['zh-tw'])
  }

  return issues
}
