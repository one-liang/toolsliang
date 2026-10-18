import { describeDayMark, taiwanCalendarCaveats, weekdayNames } from '../taiwan-calendar/content'
import { rocEpochOffset } from '../taiwan-calendar/domain/reference'
import type { CalendarLayerEdition } from '../taiwan-calendar/domain/dataset'
import type {
  SkippedDay,
  WorkingDayCountErrorCode,
  WorkingDayDirection,
  WorkingDayRefusal,
  WorkingDaySpan,
  WorkingDayStep,
} from './domain/count'
import { workingDayCaveatKeys, workingDayCoverage, type WorkingDayCaveatKey } from './domain/sources'
import type { ToolFaqEntry } from '../faq'
import { hasLocalizedCopy, type LocaleCode, type LocalizedCopy } from '../catalog'

/**
 * Everything the working day calculator says out loud. A working day is the
 * term CONTEXT.md defines — a workday or makeup workday on the government
 * agency office calendar — and the copy never calls it 營業日 or 工作日. The
 * covered years are read from the shipped data, so no sentence can promise a
 * year the tool cannot count.
 */

const { firstYear, lastYear } = workingDayCoverage

export type WorkingDayMode = WorkingDayDirection | 'between'
export const workingDayModes: WorkingDayMode[] = ['forward', 'backward', 'between']

const workingDayCopyEntries = {
  modeLegend: { 'zh-tw': '要算什麼', en: 'What do you want to work out?' },
  modeForward: { 'zh-tw': '往後數', en: 'Count forward' },
  modeBackward: { 'zh-tw': '往前數', en: 'Count back' },
  modeBetween: { 'zh-tw': '數區間', en: 'Days between' },
  startLabel: { 'zh-tw': '起算日', en: 'Start date' },
  startHint: { 'zh-tw': '預設是今天；起算日那天不算。', en: 'Today by default; the start date itself is not counted.' },
  countLabel: { 'zh-tw': '幾個工作天', en: 'Number of working days' },
  countHint: { 'zh-tw': '只填數字，例如 5。', en: 'Digits only, for example 5.' },
  fromLabel: { 'zh-tw': '開始日', en: 'From' },
  toLabel: { 'zh-tw': '結束日', en: 'To' },
  betweenHint: { 'zh-tw': '頭尾兩天都算，哪個日期先填都可以。', en: 'Both dates count, and either can come first.' },
  coverageHint: {
    'zh-tw': `目前可以算 ${firstYear} 至 ${lastYear} 年的工作天。`,
    en: `Working days can be counted from ${firstYear} to ${lastYear}.`,
  },
  resultLabel: { 'zh-tw': '計算結果', en: 'Result' },
  resultEmpty: {
    'zh-tw': '填好日期和天數，這裡會顯示答案。',
    en: 'Fill in the date and the number of days, and the answer appears here.',
  },
  resultEmptyBetween: {
    'zh-tw': '填好兩個日期，這裡會顯示答案。',
    en: 'Fill in both dates, and the answer appears here.',
  },
  loadingLabel: { 'zh-tw': '正在準備辦公日曆表…', en: 'Preparing the office calendar…' },
  makeupNote: {
    'zh-tw': '這天是補班日（週六上班），辦公日曆表把它算成要上班的日子。',
    en: 'This is a makeup workday (a Saturday worked), which the office calendar counts as a day of work.',
  },
  breakdownSummary: { 'zh-tw': '明細：途中跳過了哪些日子', en: 'Breakdown: the days passed over' },
  skippedTitle: { 'zh-tw': '跳過的放假日', en: 'Days off skipped' },
  skippedNone: {
    'zh-tw': '途中沒有國定假日、補假或調整放假。',
    en: 'No national, substitute, or adjusted holiday on the way.',
  },
  makeupTitle: { 'zh-tw': '途中的補班日（算成工作天）', en: 'Makeup workdays on the way (counted as working days)' },
  calendarLinkPrefix: { 'zh-tw': '要看是哪幾天放假，請開', en: 'To see which days are off, open the ' },
  calendarLinkText: { 'zh-tw': '台灣行事曆', en: 'Taiwan Calendar' },
  calendarLinkSuffix: { 'zh-tw': '。', en: '.' },
  dataVersionLabel: { 'zh-tw': '資料版本', en: 'Dataset edition' },
  revisedTag: { 'zh-tw': '修正版', en: 'reissued' },
  licencePrefix: { 'zh-tw': '依', en: 'Provided under the ' },
  licenceSuffix: { 'zh-tw': '提供。', en: '.' },
  editionDetailsLabel: { 'zh-tw': '資料日期與使用須知', en: 'Dataset dates and notes' },
  caveatsTitle: { 'zh-tw': '使用須知', en: 'Before you rely on these dates' },
  editionsTitle: { 'zh-tw': '各年度的版本與日期', en: 'Each year, its edition and dates' },
  publishedAtLabel: { 'zh-tw': '來源發布或更新日', en: 'Source published' },
  retrievedAtLabel: { 'zh-tw': '本站擷取日', en: 'Retrieved by this site' },
} satisfies Record<string, LocalizedCopy>

export type WorkingDayCopyKey = keyof typeof workingDayCopyEntries
export const workingDayCopyKeys = Object.keys(workingDayCopyEntries) as WorkingDayCopyKey[]
export const workingDayCopy: Record<WorkingDayCopyKey, LocalizedCopy> = workingDayCopyEntries

/**
 * The three caveats about the data itself are the Taiwan Calendar's, word for
 * word; the other three are what counting adds.
 */
export const workingDayCaveats: Record<WorkingDayCaveatKey, LocalizedCopy> = {
  'government-agency-scope': taiwanCalendarCaveats['government-agency-scope'],
  'not-a-statutory-period': {
    'zh-tw': '這不是法定期間或訴訟期限的計算：那類期限通常是數日曆天，最後一天遇到休息日才順延。',
    en: 'This is not a statutory period or court deadline calculator: those usually count calendar days and only move when the last day falls on a day of rest.',
  },
  'not-yet-announced': {
    'zh-tw': '要用到主管機關尚未公告的年份時，這個工具會停下來說明數到哪裡，不會先猜。',
    en: 'When a count needs a year the authority has not announced, this tool stops and says how far it got instead of guessing.',
  },
  'edition-may-change': taiwanCalendarCaveats['edition-may-change'],
  'offline-may-be-outdated': taiwanCalendarCaveats['offline-may-be-outdated'],
  'dates-stay-on-device': {
    'zh-tw': '你輸入的日期和天數只在這台裝置計算，不會被保存或送出。',
    en: 'The dates and the number you enter are worked out on this device only; nothing is stored or sent.',
  },
}

/** The visible questions, and the only ones the page publishes as structured data. */
export const workingDayFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': '工作天怎麼算？', en: 'How are working days counted?' },
    body: {
      'zh-tw': '工作天是政府行政機關辦公日曆表上要上班的日子，包括一般的上班日和補班日；週末、國定假日、補假與調整放假都會跳過。往後或往前數時，起算日那天不算，從它的下一天（往前數就是上一天）開始算第 1 天；數兩個日期之間有幾個工作天時，頭尾兩天只要是工作天都算進去。',
      en: 'A working day is a day of work on the government agency office calendar: an ordinary workday or a makeup workday. Weekends, national holidays, substitute days, and adjusted days off are skipped. Counting forward or back, the start date itself does not count, so day 1 is the next day (or the day before, counting back). Counting the days between two dates, both dates count if they are working days.',
    },
  },
  {
    heading: { 'zh-tw': '補班日算不算工作天？', en: 'Does a makeup workday count?' },
    body: {
      'zh-tw': '算。補班日是辦公日曆表安排要上班的週六，政府機關那天照常上班。行政院在 114 年 6 月修正處理要點後，115 年（2026 年）起的辦公日曆表已經沒有補班日；2025 年以前的年度仍然有，這個工具照實計算。',
      en: 'Yes. A makeup workday is a Saturday the office calendar schedules as a day of work, so government agencies are open. Since the directions were amended in June 2025, the office calendar has no makeup workdays from 2026; years up to 2025 still have them, and this tool counts them as they are.',
    },
  },
  {
    heading: { 'zh-tw': '民間公司或學校可以用這個結果嗎？', en: 'Can a company or school use this result?' },
    body: {
      'zh-tw': '只能當參考。這裡的工作天只反映行政院人事行政總處公告的政府行政機關辦公日曆表；民間公司要不要比照調整放假或補班由各公司決定，學校與各行業也另有規定。用在公司或學校的時程時，請以自己單位公告的行事曆為準。',
      en: 'Only as a guide. The working days here follow only the government agency office calendar announced by the Directorate-General of Personnel Administration; each company decides whether to follow its adjusted days off and makeup workdays, and schools and industries set their own schedules. For a company or school timetable, go by the calendar your own organisation announces.',
    },
  },
  {
    heading: { 'zh-tw': '可以拿來算法定期間或訴訟期限嗎？', en: 'Can I use it for a statutory period or court deadline?' },
    body: {
      'zh-tw': '不行。訴願、上訴或催告這類法定期間通常是數日曆天，最後一天遇到星期日、紀念日或其他休息日，才順延到休息日的下一天（例如民法第 122 條），和數工作天是不同的規則。法定期間請依相關法規，或向主管機關或律師確認。',
      en: 'No. Statutory periods such as those for an administrative appeal, a court appeal, or a formal demand usually count calendar days, and only move to the next day when the last day falls on a Sunday, a commemoration day, or another day of rest (Civil Code Article 122, for example). That is a different rule from counting working days; check the law that applies, or ask the authority or a lawyer.',
    },
  },
  {
    heading: { 'zh-tw': '為什麼算不到還沒公告的年份？', en: 'Why can it not count into a year that has not been announced?' },
    body: {
      'zh-tw': `辦公日曆表由行政院人事行政總處每年 6 月 30 日前公告次年，特殊情形延到 8 月 31 日前。還沒公告的年份不知道哪幾天放假，這個工具不猜，而是告訴你數到哪一天、第幾個工作天落在還沒公告的年份。目前可以算 ${firstYear} 至 ${lastYear} 年。`,
      en: `The Directorate-General of Personnel Administration announces the next year's office calendar by 30 June, or by 31 August in exceptional cases. Until then nobody knows which days are off, so this tool does not guess: it tells you the last day it could count and which working day falls in the unannounced year. Working days can be counted from ${firstYear} to ${lastYear}.`,
    },
  },
  {
    heading: { 'zh-tw': '春節連假、補假會自動跳過嗎？', en: 'Are the Lunar New Year break and substitute days skipped?' },
    body: {
      'zh-tw': '會。國定假日、補假和為了連假調整出來的放假日都會跳過，展開明細就能看到跳過了哪些日子。例如 2026-02-13（五）往後數 3 個工作天，會跳過 2/14 到 2/22 的春節連假與補假，答案是 2026-02-25（三）。',
      en: 'Yes. National holidays, substitute days, and the days off adjusted to make a long weekend are all skipped, and the breakdown lists which ones. For example, 3 working days after Friday 13 February 2026 skips the Lunar New Year break and its substitute day from 14 to 22 February, landing on Wednesday 25 February 2026.',
    },
  },
  {
    heading: { 'zh-tw': '我輸入的日期會被送出嗎？', en: 'Are the dates I enter sent anywhere?' },
    body: {
      'zh-tw': '不會。辦公日曆表已經跟著網站一起提供，計算就在這台裝置上完成；你輸入的日期和天數不會被保存，也不會送到 toolsliang 或其他地方。打開過一次之後，沒有網路也能用。',
      en: 'No. The office calendar comes with the site and the counting happens on this device; the dates and number you enter are never stored or sent to toolsliang or anywhere else. Once you have opened the tool, it also works without a connection.',
    },
  },
]

const workingDayContentIssues = validateWorkingDayContent()
if (workingDayContentIssues.length) {
  throw new Error(`Invalid working day content:\n${workingDayContentIssues.join('\n')}`)
}

export function getWorkingDayCopy(locale: LocaleCode): Record<WorkingDayCopyKey, string> {
  return Object.fromEntries(
    workingDayCopyKeys.map(key => [key, workingDayCopy[key][locale]]),
  ) as Record<WorkingDayCopyKey, string>
}

export function getWorkingDayCaveats(locale: LocaleCode) {
  return workingDayCaveatKeys.map(key => ({ key, text: workingDayCaveats[key][locale] }))
}

export function workingDayModeLabel(mode: WorkingDayMode, locale: LocaleCode) {
  const key = mode === 'forward' ? 'modeForward' : mode === 'backward' ? 'modeBackward' : 'modeBetween'
  return workingDayCopy[key][locale]
}

function partsOf(date: string) {
  return date.split('-').map(Number) as [number, number, number]
}

function weekdayOf(date: string) {
  const [year, month, day] = partsOf(date)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** A date as it is written on a form: the digits, then the weekday. */
export function formatWorkingDayDate(date: string, locale: LocaleCode) {
  if (locale === 'en') {
    const [year, month, day] = partsOf(date)
    return new Date(Date.UTC(year, month - 1, day))
      .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      .replace(/,/g, '')
  }
  return `${date}（${weekdayNames['zh-tw'][weekdayOf(date)]}）`
}

/** The same date in the ROC era, the way an official form asks for it. */
export function formatRocDate(date: string, locale: LocaleCode) {
  const [year, month, day] = partsOf(date)
  const roc = year - rocEpochOffset
  if (roc < 1) return ''
  return locale === 'en' ? `ROC year ${roc}, ${month}/${day}` : `民國 ${roc} 年 ${month} 月 ${day} 日`
}

function workingDays(count: number, locale: LocaleCode) {
  return locale === 'en' ? `${count} working ${count === 1 ? 'day' : 'days'}` : `${count} 個工作天`
}

export function describeStep(result: Extract<WorkingDayStep, { ok: true }>, locale: LocaleCode) {
  const start = formatWorkingDayDate(result.start, locale)
  const count = workingDays(result.count, locale)
  const rule = locale === 'en'
    ? `${count} ${result.direction === 'forward' ? 'after' : 'before'} ${start}, not counting the start date.`
    : `從 ${start}${result.direction === 'forward' ? '往後' : '往前'}數 ${count}，不含起算日。`

  return {
    headline: formatWorkingDayDate(result.date, locale),
    roc: formatRocDate(result.date, locale),
    rule,
    note: result.landsOnMakeupWorkday ? workingDayCopy.makeupNote[locale] : '',
  }
}

export function describeSpan(result: Extract<WorkingDaySpan, { ok: true }>, locale: LocaleCode) {
  const from = formatWorkingDayDate(result.from, locale)
  const to = formatWorkingDayDate(result.to, locale)
  const rule = locale === 'en'
    ? `From ${from} to ${to}, both dates included: ${result.calendarDays} calendar ${result.calendarDays === 1 ? 'day' : 'days'}.`
    : `${from}到 ${to}，頭尾兩天都算，共 ${result.calendarDays} 個日曆天。`

  return { headline: workingDays(result.workingDays, locale), rule }
}

/** A skipped day by its reviewed name: the holiday it carries, or the kind of day off it is. */
export function describeSkippedDay(day: SkippedDay, locale: LocaleCode) {
  const name = describeDayMark({ kind: day.kind, holidays: day.holidays, label: '' }, locale)
  return locale === 'en' ? `${formatWorkingDayDate(day.date, locale)}: ${name}` : `${formatWorkingDayDate(day.date, locale)}${name}`
}

export function describeWeekendDays(count: number, locale: LocaleCode) {
  if (!count) return ''
  return locale === 'en'
    ? `${count} weekend ${count === 1 ? 'day' : 'days'} skipped as well.`
    : `另外跳過 ${count} 天週末。`
}

/**
 * Why there is no answer, and how far the count got. The year named is the one
 * the first unjudged day falls in, which is the year a visitor would have to
 * wait for — never a date the tool made up.
 */
export function describeRefusal(refusal: Pick<WorkingDayRefusal, 'reason' | 'blockedAt'> & Partial<WorkingDayRefusal>, mode: WorkingDayMode, locale: LocaleCode) {
  const year = Number(refusal.blockedAt.slice(0, 4))
  const reason = refusalReason(refusal.reason, year, locale)

  if (mode === 'between') {
    return locale === 'en'
      ? `This range includes ${year}. ${reason}`
      : `這段期間包含 ${year} 年。${reason}`
  }

  const reached = refusal.reached ?? 0
  const next = reached + 1
  if (!reached || !refusal.lastCounted) {
    return locale === 'en'
      ? `Working day 1 would fall in ${year}. ${reason}`
      : `第 1 個工作天要用到 ${year} 年。${reason}`
  }

  const last = formatWorkingDayDate(refusal.lastCounted, locale)
  return locale === 'en'
    ? `Counted up to ${last}, working day ${reached}; working day ${next} would fall in ${year}. ${reason}`
    : `數到 ${last}是第 ${reached} 個工作天；第 ${next} 個要用到 ${year} 年。${reason}`
}

function refusalReason(reason: WorkingDayRefusal['reason'], year: number, locale: LocaleCode) {
  switch (reason) {
    case 'not-announced':
      return locale === 'en'
        ? `The office calendar for ${year} has not been announced yet, and this page will not guess it.`
        : `${year} 年的辦公日曆表主管機關尚未公告，這裡不會先猜。`
    case 'out-of-range':
      return locale === 'en'
        ? `Only the office calendars for ${firstYear} to ${lastYear} are available here.`
        : `這裡只提供 ${firstYear} 至 ${lastYear} 年的辦公日曆表。`
    case 'not-downloaded':
      return locale === 'en'
        ? `You are offline and this device has not downloaded ${year} yet; open the tool once online and it will be kept.`
        : `目前離線，這台裝置還沒下載過 ${year} 年的資料；連線後再開一次就會保存起來。`
  }
}

/** An empty field is not a mistake, so it has no message: the result panel already says what to do. */
export function workingDayCountErrorMessage(code: WorkingDayCountErrorCode, locale: LocaleCode) {
  switch (code) {
    case 'empty':
      return ''
    case 'not-a-number':
      return locale === 'en' ? 'Use digits only, for example 5.' : '請只填數字，例如 5。'
    case 'not-whole':
      return locale === 'en' ? 'A number of days is whole; remove the decimal point.' : '工作天數是整數，請拿掉小數點。'
    case 'below-one':
      return locale === 'en' ? 'Enter 1 or more.' : '請填 1 以上的數字。'
  }
}

/**
 * The years this device has, as one stretch of ROC years, and the reissued
 * ones named — the full edition of each year is in the details below the line.
 */
export function describeEditionYears(editions: Array<{ year: number, edition: CalendarLayerEdition }>, locale: LocaleCode) {
  if (!editions.length) return ''
  const first = editions[0]!.year - rocEpochOffset
  const last = editions.at(-1)!.year - rocEpochOffset
  const revised = editions.filter(entry => entry.edition.status === 'revised').map(entry => entry.year - rocEpochOffset)
  const span = first === last ? String(first) : locale === 'en' ? `${first}–${last}` : `${first} 至 ${last}`

  if (locale === 'en') {
    return `ROC years ${span}${revised.length ? ` (ROC ${revised.join(', ')} ${workingDayCopy.revisedTag.en})` : ''}`
  }
  return `民國 ${span} 年${revised.length ? `（${revised.join('、')} 年為${workingDayCopy.revisedTag['zh-tw']}）` : ''}`
}

export function validateWorkingDayContent() {
  const issues: string[] = []

  for (const key of workingDayCopyKeys) {
    if (!hasLocalizedCopy(workingDayCopy[key])) issues.push(`[copy:${key}] requires both locales`)
  }
  for (const key of workingDayCaveatKeys) {
    if (!hasLocalizedCopy(workingDayCaveats[key])) issues.push(`[caveat:${key}] requires both locales`)
  }

  const questions = new Set<string>()
  for (const [index, entry] of workingDayFaq.entries()) {
    if (!hasLocalizedCopy(entry.heading) || !hasLocalizedCopy(entry.body)) issues.push(`[faq:${index}] requires both locales`)
    if (questions.has(entry.heading['zh-tw'])) issues.push(`[faq:${index}] duplicate question`)
    questions.add(entry.heading['zh-tw'])
  }

  return issues
}
