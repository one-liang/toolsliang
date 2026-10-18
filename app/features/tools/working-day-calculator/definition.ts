import type { PublishedToolDefinition } from '@/features/tools/catalog'
import { workingDayContentReview } from './domain/sources'

/**
 * Its aliases carry the words a visitor searches with — 工作日, 營業日 — even
 * though the tool itself only ever says 工作天 (CONTEXT.md): a search term is
 * matched, not spoken.
 */
export const workingDayCalculatorDefinition: PublishedToolDefinition = {
  slug: 'working-day-calculator', category: 'time-calendar', icon: 'calendar-range',
  availability: { state: 'published', publishedAt: '2026-10-18' },
  status: { kind: 'new', startsAt: '2026-10-18', endsAt: '2026-11-18' },
  name: { 'zh-tw': '工作天計算', en: 'Working Day Calculator' },
  description: {
    'zh-tw': '往後或往前數 N 個工作天，或算兩個日期之間有幾個工作天。',
    en: 'Count working days forward or back, or between two dates, on Taiwan’s office calendar.',
  },
  aliases: {
    'zh-tw': ['工作天計算機', '工作日計算', '營業日計算', '上班日計算', '幾個工作天'],
    en: ['business day calculator', 'working days between dates', 'Taiwan working days'],
  },
  keywords: {
    'zh-tw': ['工作天', '補假', '補班', '連假', '期限'],
    en: ['working day', 'business day', 'holiday', 'makeup workday', 'deadline'],
  },
  processingClass: 'instant', routeComponentKey: 'WorkingDayCalculatorWorkspace',
  offlineMode: 'ready', capabilities: ['javascript'],
  acceptedInput: {
    'zh-tw': '一個起算日與天數，或兩個日期',
    en: 'A start date and a number of days, or two dates',
  },
  localProcessingStatement: {
    'zh-tw': '辦公日曆表已隨網站提供，你輸入的日期和天數只在這台裝置計算，不會保存或送出。',
    en: 'The office calendar comes with the site; the dates and number you enter are worked out on this device only, never stored or sent.',
  },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true },
  seo: {
    contentKey: 'working-day-calculator',
    title: { 'zh-tw': '工作天計算：往後、往前數工作天或算兩日期間的工作天', en: 'Working Day Calculator for Taiwan' },
    description: {
      'zh-tw': '依政府行政機關辦公日曆表，算出某天往後或往前第 N 個工作天，或兩個日期之間有幾個工作天；國定假日、補假、調整放假會自動跳過，補班日照算，並列出跳過了哪些日子。日期只在這台裝置計算，離線也能用。',
      en: 'Work out the date N working days after or before a day, or how many working days lie between two dates, on Taiwan’s government agency office calendar. National holidays, substitute days, and adjusted days off are skipped, makeup workdays count, and the days passed over are listed. Everything stays on your device and works offline.',
    },
    answer: {
      'zh-tw': '工作天是政府行政機關辦公日曆表上要上班的日子，包括上班日與補班日。往後或往前數時起算日不算，從下一天開始算第 1 天；數兩個日期之間時頭尾都算。主管機關尚未公告的年份不會給答案。這不是民間公司的出勤，也不是法定期間的計算。',
      en: 'A working day is a day of work on Taiwan’s government agency office calendar: a workday or a makeup workday. Counting forward or back, the start date does not count and day 1 is the next day; counting between two dates, both dates count. A year the authority has not announced gets no answer. It is not a company’s schedule, and not a statutory period calculation.',
    },
  },
  contentReview: workingDayContentReview,
}
