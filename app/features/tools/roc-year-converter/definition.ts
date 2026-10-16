import type { PublishedToolDefinition } from '@/features/tools/catalog'
import { rocYearContentReview } from './domain/sources'

export const rocYearConverterDefinition: PublishedToolDefinition = {
  slug: 'roc-year-converter', category: 'time-calendar', icon: 'calendar-days',
  availability: { state: 'published', publishedAt: '2026-10-15' },
  status: { kind: 'new', startsAt: '2026-10-15', endsAt: '2026-11-15' },
  name: { 'zh-tw': '民國西元對照', en: 'ROC / Gregorian Year Converter' },
  description: {
    'zh-tw': '民國年和西元年互相換算，附對照表。',
    en: 'Convert between ROC and Gregorian years, with a year-by-year table.',
  },
  aliases: {
    'zh-tw': ['民國年對照', '民國年換算', '西元轉民國', '民國轉西元'],
    en: ['ROC year converter', 'Minguo year converter', 'Taiwan year converter'],
  },
  keywords: {
    'zh-tw': ['民國', '西元', '年份', '民國前', '民國元年'],
    en: ['ROC year', 'Gregorian year', 'Minguo', 'Republic of China calendar'],
  },
  processingClass: 'instant', routeComponentKey: 'RocYearConverterWorkspace',
  offlineMode: 'ready', capabilities: ['javascript'],
  acceptedInput: {
    'zh-tw': '一個民國年或西元年，只填數字',
    en: 'One ROC or Gregorian year, as digits',
  },
  localProcessingStatement: {
    'zh-tw': '年份只在這台裝置換算，不會保存或送出。',
    en: 'The year is converted on this device only; nothing is stored or sent.',
  },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true },
  seo: {
    contentKey: 'roc-year-converter',
    title: { 'zh-tw': '民國西元對照：民國年與西元年換算', en: 'ROC / Gregorian Year Converter' },
    description: {
      'zh-tw': '輸入民國年查西元年，或輸入西元年查民國年；1911 年以前寫成民國前幾年，並附民國元年到今年之後 10 年的對照表。年份只在這台裝置換算，離線也能用。',
      en: 'Enter an ROC year to get the Gregorian year, or the other way round; years before 1912 are counted before the ROC era, with a table from ROC year 1 to ten years after this one. Everything stays on your device and works offline.',
    },
    answer: {
      'zh-tw': '西元年＝民國年＋1911。民國元年是西元 1912 年，所以民國 115 年是西元 2026 年；1911 年以前寫成民國前幾年，例如 1911 年是民國前 1 年，中間沒有 0 年。',
      en: 'Gregorian year = ROC year + 1911. ROC year 1 is 1912, so ROC year 115 is 2026; earlier years count backwards, so 1911 is 1 year before the ROC era, with no year 0 in between.',
    },
  },
  contentReview: rocYearContentReview,
}
