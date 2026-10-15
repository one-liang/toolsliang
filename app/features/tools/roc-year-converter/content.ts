import {
  rocFirstGregorianYear,
  rocYearOffset,
  rocYearSupportedRange,
  type RocEraYear,
  type RocYearDirection,
  type RocYearInputErrorCode,
  type RocYearPair,
} from './domain/convert'
import type { ToolFaqEntry } from '../faq'
import { hasLocalizedCopy, type LocaleCode, type LocalizedCopy } from '../catalog'

/**
 * Everything the year converter says out loud, in words a visitor who has
 * never seen a formula can follow. Numbers inside a sentence come from the
 * conversion constants, so a bound or the 1911 offset can never be retyped
 * into a message it does not match.
 */

const { roc: rocRange, gregorian: gregorianRange } = rocYearSupportedRange

const rocYearCopyEntries = {
  directionLegend: { 'zh-tw': '你手上的是哪一種年份', en: 'Which year do you have?' },
  directionRoc: { 'zh-tw': '民國年', en: 'ROC year' },
  directionGregorian: { 'zh-tw': '西元年', en: 'Gregorian year' },
  rocInputLabel: { 'zh-tw': '民國年份', en: 'ROC year number' },
  gregorianInputLabel: { 'zh-tw': '西元年份', en: 'Gregorian year number' },
  rocInputHint: {
    'zh-tw': '只填數字，例如 115；民國元年填 1。',
    en: 'Digits only, for example 115. ROC year 1 is entered as 1.',
  },
  gregorianInputHint: {
    'zh-tw': '只填數字，例如 2026；1911 年以前也查得到。',
    en: 'Digits only, for example 2026. Years before 1912 work too.',
  },
  resultLabel: { 'zh-tw': '對照結果', en: 'Result' },
  resultEmpty: {
    'zh-tw': '輸入年份後，這裡會顯示對照結果。',
    en: 'Enter a year and its match appears here.',
  },
  firstYearNote: {
    'zh-tw': '民國 1 年也叫民國元年，是中華民國成立的那一年。',
    en: 'ROC year 1 is the year the Republic of China was founded.',
  },
  beforeRocNote: {
    'zh-tw': '1912 年是民國元年，在那之前的年份從 1911 年往前數，寫成「民國前幾年」。',
    en: 'ROC year 1 is 1912; earlier years count backwards from it, so 1911 is 1 year before the ROC era.',
  },
  currentYearBadge: { 'zh-tw': '今年', en: 'This year' },
  matchBadge: { 'zh-tw': '你查的年份', en: 'Your year' },
  tableTitle: { 'zh-tw': '民國西元對照表', en: 'ROC and Gregorian year table' },
  tableFormula: {
    'zh-tw': `換算方式：西元年＝民國年＋${rocYearOffset}；民國年＝西元年－${rocYearOffset}。`,
    en: `How it works: Gregorian year = ROC year + ${rocYearOffset}; ROC year = Gregorian year − ${rocYearOffset}.`,
  },
  rocColumn: { 'zh-tw': '民國', en: 'ROC' },
  gregorianColumn: { 'zh-tw': '西元', en: 'Gregorian' },
} satisfies Record<string, LocalizedCopy>

export type RocYearCopyKey = keyof typeof rocYearCopyEntries
export const rocYearCopyKeys = Object.keys(rocYearCopyEntries) as RocYearCopyKey[]
export const rocYearCopy: Record<RocYearCopyKey, LocalizedCopy> = rocYearCopyEntries

/** The visible questions, and the only ones the page publishes as structured data. */
export const rocYearFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': '民國年怎麼換成西元年？', en: 'How do I turn an ROC year into a Gregorian year?' },
    body: {
      'zh-tw': `把民國年加上 ${rocYearOffset} 就是西元年，例如民國 115 年加 ${rocYearOffset} 是西元 2026 年。反過來，西元年減掉 ${rocYearOffset} 就是民國年。`,
      en: `Add ${rocYearOffset} to the ROC year: ROC year 115 plus ${rocYearOffset} is 2026. The other way round, subtract ${rocYearOffset} from the Gregorian year.`,
    },
  },
  {
    heading: { 'zh-tw': '為什麼是加 1911？', en: 'Why 1911?' },
    body: {
      'zh-tw': `中華民國在西元 ${rocFirstGregorianYear} 年成立，這一年訂為民國元年，也就是民國 1 年。所以兩種年份永遠差 ${rocYearOffset}。`,
      en: `The Republic of China was founded in ${rocFirstGregorianYear}, and that year is ROC year 1, so the two numbers always differ by ${rocYearOffset}.`,
    },
  },
  {
    heading: { 'zh-tw': '1911 年以前要怎麼寫？', en: 'How are years before 1912 written?' },
    body: {
      'zh-tw': `寫成「民國前幾年」。民國元年的前一年（西元 ${rocFirstGregorianYear - 1} 年）是民國前 1 年，再往前是民國前 2 年，依此類推，所以民國年沒有 0。算法是用 ${rocFirstGregorianYear} 減掉西元年，例如西元 1900 年是民國前 12 年。`,
      en: `As years before the ROC era. The year before ROC year 1, ${rocFirstGregorianYear - 1}, is 1 year before the ROC era, the one before that is 2 years before, and so on, so there is no year 0 in between: subtract the Gregorian year from ${rocFirstGregorianYear}. For example, 1900 is 12 years before the ROC era.`,
    },
  },
  {
    heading: { 'zh-tw': '月份和日期也要換算嗎？', en: 'Do months and days change too?' },
    body: {
      'zh-tw': '不用。民國紀年只換年份，月和日跟西元一樣，例如民國 115 年 3 月 1 日就是 2026 年 3 月 1 日。要查放假日、補班日或農曆，請用台灣行事曆。',
      en: 'No. Only the year number differs; the month and day stay the same, so 1 March of ROC year 115 is 1 March 2026. For holidays, makeup workdays, or lunar dates, use the Taiwan Calendar.',
    },
  },
  {
    heading: { 'zh-tw': '我輸入的年份會被保存或送出嗎？', en: 'Is the year I enter saved or sent anywhere?' },
    body: {
      'zh-tw': '不會。換算就在這台裝置上完成，輸入的年份不會被保存，也不會送到 toolsliang 或其他地方；沒有網路時也能用。',
      en: 'No. The conversion happens on this device; the year you enter is never stored or sent to toolsliang or anywhere else, and the tool works without a connection.',
    },
  },
]

const rocYearContentIssues = validateRocYearContent()
if (rocYearContentIssues.length) {
  throw new Error(`Invalid ROC year content:\n${rocYearContentIssues.join('\n')}`)
}

export function getRocYearCopy(locale: LocaleCode): Record<RocYearCopyKey, string> {
  return Object.fromEntries(
    rocYearCopyKeys.map(key => [key, rocYearCopy[key][locale]]),
  ) as Record<RocYearCopyKey, string>
}

/** How the ROC era names a year. Never produces a year 0: the domain cannot hold one. */
export function formatRocEraYear(year: RocEraYear, locale: LocaleCode) {
  if (year.era === 'roc') return locale === 'en' ? `ROC year ${year.year}` : `民國 ${year.year} 年`
  if (locale === 'en') return `${year.yearsBefore} ${year.yearsBefore === 1 ? 'year' : 'years'} before the ROC era`
  return `民國前 ${year.yearsBefore} 年`
}

export function formatGregorianYear(year: number, locale: LocaleCode) {
  return locale === 'en' ? `${year}` : `西元 ${year} 年`
}

/** The headline is the year the visitor did not type; the equation repeats both, input first. */
export function describeRocYearPair(pair: RocYearPair, direction: RocYearDirection, locale: LocaleCode) {
  const roc = formatRocEraYear(pair.roc, locale)
  const gregorian = formatGregorianYear(pair.gregorian, locale)
  const [from, to] = direction === 'roc-to-gregorian' ? [roc, gregorian] : [gregorian, roc]
  const note = pair.roc.era === 'before-roc'
    ? rocYearCopy.beforeRocNote[locale]
    : pair.roc.year === 1 ? rocYearCopy.firstYearNote[locale] : ''

  return { headline: to, equation: `${from} ＝ ${to}`, note }
}

export function describeCurrentYear(pair: RocYearPair, locale: LocaleCode) {
  return locale === 'en'
    ? `This year is ${pair.gregorian}, ${formatRocEraYear(pair.roc, locale)}.`
    : `今年是${formatRocEraYear(pair.roc, locale)}（${formatGregorianYear(pair.gregorian, locale)}）。`
}

/** A table row under its column headings: the era is in the heading, so a cell is the number and its unit. */
export function describeTableRow(pair: RocYearPair, locale: LocaleCode) {
  if (locale === 'en') {
    const roc = pair.roc.era === 'roc' ? String(pair.roc.year) : `${pair.roc.yearsBefore} before`
    return { roc, gregorian: String(pair.gregorian) }
  }
  const roc = pair.roc.era === 'roc' ? `${pair.roc.year} 年` : `前 ${pair.roc.yearsBefore} 年`
  return { roc, gregorian: `${pair.gregorian} 年` }
}

/** Which years the table spans, so a visitor knows before scrolling whether their year is in it. */
export function describeTableRange(rows: RocYearPair[], locale: LocaleCode) {
  const first = rows[0]!
  const last = rows.at(-1)!
  return locale === 'en'
    ? `From ${formatRocEraYear(first.roc, locale)} (${first.gregorian}) to ${formatRocEraYear(last.roc, locale)} (${last.gregorian}). This year is marked.`
    : `從${formatRocEraYear(first.roc, locale)}到${formatRocEraYear(last.roc, locale)}（西元 ${first.gregorian} 到 ${last.gregorian} 年），今年那一列有標示。`
}

export function describeOutsideTable(pair: RocYearPair, direction: RocYearDirection, locale: LocaleCode) {
  const year = direction === 'roc-to-gregorian'
    ? formatRocEraYear(pair.roc, locale)
    : formatGregorianYear(pair.gregorian, locale)
  return locale === 'en'
    ? `${year} is outside this table; the answer is under Result.`
    : `${year}不在這張表的範圍內，換算結果請看「對照結果」。`
}

/**
 * An empty field is not a mistake, so it has no message: the result panel
 * already says what to do. Every other code names what to change.
 */
export function rocYearErrorMessage(code: RocYearInputErrorCode, direction: RocYearDirection, locale: LocaleCode) {
  const message = errorCopy(code, direction)
  return message ? message[locale] : ''
}

function errorCopy(code: RocYearInputErrorCode, direction: RocYearDirection): LocalizedCopy | undefined {
  const roc = direction === 'roc-to-gregorian'
  switch (code) {
    case 'empty':
      return undefined
    case 'not-a-number':
      return roc
        ? { 'zh-tw': '請只填數字，例如 115。', en: 'Use digits only, for example 115.' }
        : { 'zh-tw': '請只填數字，例如 2026。', en: 'Use digits only, for example 2026.' }
    case 'not-whole':
      return { 'zh-tw': '年份是整數，請拿掉小數點。', en: 'A year is a whole number; remove the decimal point.' }
    case 'roc-zero':
      return {
        'zh-tw': `民國沒有 0 年：民國 1 年（民國元年）就是西元 ${rocFirstGregorianYear} 年，它的前一年是民國前 1 年（西元 ${rocFirstGregorianYear - 1} 年）。`,
        en: `The ROC era has no year 0: ROC year 1 is ${rocFirstGregorianYear}, and the year before it, ${rocFirstGregorianYear - 1}, is 1 year before the ROC era.`,
      }
    case 'below-range':
      return roc
        ? {
            'zh-tw': `民國年從 1 開始。要查 ${rocFirstGregorianYear - 1} 年以前，請改選「西元年」再輸入。`,
            en: `ROC years start at 1. For ${rocFirstGregorianYear - 1} and earlier, choose “Gregorian year” and enter it there.`,
          }
        : gregorianRangeCopy()
    case 'above-range':
      return roc
        ? {
            'zh-tw': `民國年請填 ${rocRange.min} 到 ${rocRange.max} 之間的數字。`,
            en: `Enter an ROC year from ${rocRange.min} to ${rocRange.max}.`,
          }
        : gregorianRangeCopy()
  }
}

function gregorianRangeCopy(): LocalizedCopy {
  return {
    'zh-tw': `西元年請填 ${gregorianRange.min} 到 ${gregorianRange.max} 之間的數字。`,
    en: `Enter a Gregorian year from ${gregorianRange.min} to ${gregorianRange.max}.`,
  }
}

export function validateRocYearContent() {
  const issues: string[] = []

  for (const key of rocYearCopyKeys) {
    if (!hasLocalizedCopy(rocYearCopy[key])) issues.push(`[copy:${key}] requires both locales`)
  }

  const questions = new Set<string>()
  for (const [index, entry] of rocYearFaq.entries()) {
    if (!hasLocalizedCopy(entry.heading) || !hasLocalizedCopy(entry.body)) {
      issues.push(`[faq:${index}] requires both locales`)
    }
    if (questions.has(entry.heading['zh-tw'])) issues.push(`[faq:${index}] duplicate question`)
    questions.add(entry.heading['zh-tw'])
  }

  return issues
}
