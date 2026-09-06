import type { LunarDate, OfficialDay, SolarTerm } from './domain/calendar'
import {
  officialDayKinds,
  rocEpochOffset,
  officialHolidayIds,
  solarTermNames,
  taiwanCalendarViewErrorCodes,
  type OfficialDayKind,
  type OfficialHolidayId,
  type SolarTermName,
  type TaiwanCalendarViewErrorCode,
} from './domain/reference'
import {
  taiwanCalendarCaveatKeys,
  taiwanCalendarPublishableYears,
  type TaiwanCalendarCaveatKey,
} from './domain/sources'
import type { ToolFaqEntry } from '../faq'
import { hasLocalizedCopy, type LocaleCode, type LocalizedCopy } from '../catalog'

/**
 * Everything the Taiwan calendar says out loud. It sits beside the calendar
 * domain rather than inside the component because the wording is reviewed as
 * content: the disclaimers keep section 7.1 of
 * docs/research/004-taiwan-calendar-sources-and-data-contract.md verbatim, the
 * refusals keep section 5.6, the questions keep section 7.4, and section 7.3
 * forbids a set of phrases that would claim more authority than this tool has.
 *
 * A day's Chinese name travels into the English page rather than being replaced
 * by a translation: 補假 and 清明 are what the source calls them, and an English
 * reader looking at a Taiwanese calendar needs the name they will see elsewhere.
 * The published year range is read from the coverage so a sentence can never
 * promise a year the datasets do not hold.
 */

const { firstYear, lastYear } = taiwanCalendarPublishableYears

const taiwanCalendarCopyEntries = {
  yearLabel: { 'zh-tw': '年份', en: 'Year' },
  yearHint: {
    'zh-tw': `目前收錄 ${firstYear}–${lastYear} 年，每一年都附上採用的官方版本。`,
    en: `Years ${firstYear}–${lastYear} are included, each with the official edition it is built from.`,
  },
  previousMonth: { 'zh-tw': '上個月', en: 'Previous month' },
  nextMonth: { 'zh-tw': '下個月', en: 'Next month' },
  todayLabel: { 'zh-tw': '回到今天', en: 'Back to today' },
  todayBadge: { 'zh-tw': '今天', en: 'Today' },
  gridLabel: { 'zh-tw': '月曆', en: 'Month grid' },
  gridHint: {
    'zh-tw': '用方向鍵在日期之間移動，Enter 或空白鍵開啟當日詳情。',
    en: 'Move between days with the arrow keys; Enter or Space opens the day.',
  },
  agendaLabel: { 'zh-tw': '本月標示日期', en: 'Marked days this month' },
  agendaEmpty: {
    'zh-tw': '這個月沒有放假日、補班日或節氣。',
    en: 'This month has no holiday, makeup workday, or solar term.',
  },
  detailLabel: { 'zh-tw': '日期詳情', en: 'Day details' },
  detailEmpty: {
    'zh-tw': '選一個日期，這裡會顯示它的民國年、農曆、節氣與官方日別。',
    en: 'Pick a day and its ROC year, lunar date, solar term, and official day kind appear here.',
  },
  dateLabel: { 'zh-tw': '日期', en: 'Date' },
  weekdayLabel: { 'zh-tw': '星期', en: 'Weekday' },
  lunarLabel: { 'zh-tw': '農曆', en: 'Lunar date' },
  solarTermLabel: { 'zh-tw': '節氣', en: 'Solar term' },
  officialLabel: { 'zh-tw': '辦公日曆表', en: 'Office calendar' },
  sourceNoteLabel: { 'zh-tw': '來源備註原文', en: 'Source annotation' },
  legendLabel: { 'zh-tw': '標示說明', en: 'What the marks mean' },
  loadingLabel: { 'zh-tw': '正在準備這一年的資料…', en: 'Preparing this year…' },
  dataVersionLabel: { 'zh-tw': '資料版本', en: 'Dataset edition' },
  dataContractLabel: { 'zh-tw': '資料契約版本', en: 'Data contract version' },
  publishedAtLabel: { 'zh-tw': '來源發布或更新日', en: 'Source published' },
  retrievedAtLabel: { 'zh-tw': '本站擷取日', en: 'Retrieved by this site' },
  licenceLabel: { 'zh-tw': '授權', en: 'Licence' },
  crossCheckLabel: {
    'zh-tw': '交叉核對來源：用來獨立驗證農曆日序與節氣日期，本站不以它作為權威。',
    en: 'Cross-check source: used to verify the lunar dates and solar term days independently, never as the authority here.',
  },
  revisedLabel: { 'zh-tw': '主管機關已發布修正版，本頁採用的是修正後的版本。', en: 'The authority reissued this year; this page uses the reissued edition.' },
  caveatsTitle: { 'zh-tw': '看日期前要知道', en: 'Before you rely on these dates' },
  sourcesTitle: { 'zh-tw': '這一年的資料來源', en: 'Where this year comes from' },
} satisfies Record<string, LocalizedCopy>

export type TaiwanCalendarCopyKey = keyof typeof taiwanCalendarCopyEntries
export const taiwanCalendarCopyKeys = Object.keys(taiwanCalendarCopyEntries) as TaiwanCalendarCopyKey[]
export const taiwanCalendarCopy: Record<TaiwanCalendarCopyKey, LocalizedCopy> = taiwanCalendarCopyEntries

/** Sunday first, the way both sources lay a month out. */
export const weekdayNames: Record<LocaleCode, string[]> = {
  'zh-tw': ['日', '一', '二', '三', '四', '五', '六'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

export const weekdayFullNames: Record<LocaleCode, string[]> = {
  'zh-tw': ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

export const officialDayKindLabels: Record<OfficialDayKind, LocalizedCopy> = {
  'workday': { 'zh-tw': '上班日', en: 'Workday' },
  'weekend': { 'zh-tw': '例假日', en: 'Weekend' },
  'national-holiday': { 'zh-tw': '國定放假日', en: 'National holiday' },
  'substitute-holiday': { 'zh-tw': '補假', en: 'Substitute holiday (補假)' },
  'bridge-holiday': { 'zh-tw': '調整放假', en: 'Adjusted holiday (調整放假)' },
  'makeup-workday': { 'zh-tw': '補班日', en: 'Makeup workday (補班)' },
}

export const officialHolidayLabels: Record<OfficialHolidayId, LocalizedCopy> = {
  'founding-day': { 'zh-tw': '開國紀念日', en: 'Founding Day (開國紀念日)' },
  'peace-memorial-day': { 'zh-tw': '和平紀念日', en: 'Peace Memorial Day (和平紀念日)' },
  'childrens-day': { 'zh-tw': '兒童節', en: 'Children\'s Day (兒童節)' },
  'tomb-sweeping-day': { 'zh-tw': '民族掃墓節', en: 'Tomb Sweeping Day (民族掃墓節)' },
  'labour-day': { 'zh-tw': '勞動節', en: 'Labour Day (勞動節)' },
  'minor-new-years-eve': { 'zh-tw': '小年夜', en: 'Minor New Year\'s Eve (小年夜)' },
  'lunar-new-years-eve': { 'zh-tw': '農曆除夕', en: 'Lunar New Year\'s Eve (農曆除夕)' },
  'spring-festival': { 'zh-tw': '春節', en: 'Spring Festival (春節)' },
  'dragon-boat-festival': { 'zh-tw': '端午節', en: 'Dragon Boat Festival (端午節)' },
  'mid-autumn-festival': { 'zh-tw': '中秋節', en: 'Mid-Autumn Festival (中秋節)' },
  'teachers-day': { 'zh-tw': '孔子誕辰紀念日／教師節', en: 'Confucius\'s Birthday / Teachers\' Day (教師節)' },
  'national-day': { 'zh-tw': '國慶日', en: 'National Day (國慶日)' },
  'retrocession-day': { 'zh-tw': '臺灣光復暨金門古寧頭大捷紀念日', en: 'Taiwan Retrocession and Guningtou Victory Memorial Day (臺灣光復暨金門古寧頭大捷紀念日)' },
  'constitution-day': { 'zh-tw': '行憲紀念日', en: 'Constitution Day (行憲紀念日)' },
}

const solarTermGloss: Record<SolarTermName, string> = {
  '小寒': 'Minor Cold', '大寒': 'Major Cold', '立春': 'Start of Spring', '雨水': 'Rain Water',
  '驚蟄': 'Awakening of Insects', '春分': 'Spring Equinox', '清明': 'Qingming', '穀雨': 'Grain Rain',
  '立夏': 'Start of Summer', '小滿': 'Grain Buds', '芒種': 'Grain in Ear', '夏至': 'Summer Solstice',
  '小暑': 'Minor Heat', '大暑': 'Major Heat', '立秋': 'Start of Autumn', '處暑': 'End of Heat',
  '白露': 'White Dew', '秋分': 'Autumn Equinox', '寒露': 'Cold Dew', '霜降': 'Frost Descent',
  '立冬': 'Start of Winter', '小雪': 'Minor Snow', '大雪': 'Major Snow', '冬至': 'Winter Solstice',
}

export const solarTermLabels = Object.fromEntries(
  solarTermNames.map(name => [name, { 'zh-tw': name, en: `${name} (${solarTermGloss[name]})` }]),
) as Record<SolarTermName, LocalizedCopy>

const lunarMonthNames = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const lunarDayNames = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]
const zodiacGloss: Record<string, string> = {
  鼠: 'Rat', 牛: 'Ox', 虎: 'Tiger', 兔: 'Rabbit', 龍: 'Dragon', 蛇: 'Snake',
  馬: 'Horse', 羊: 'Goat', 猴: 'Monkey', 雞: 'Rooster', 狗: 'Dog', 豬: 'Pig',
}

/** Section 7.1, verbatim. Rewording one of these is a content review, not an edit. */
export const taiwanCalendarCaveats: Record<TaiwanCalendarCaveatKey, LocalizedCopy> = {
  'government-agency-scope': {
    'zh-tw': '這裡的放假日與補班日只反映行政院人事行政總處公告的政府行政機關辦公日曆表；學校、公司與各行業的實際出勤另有規定。',
    en: 'The holidays and makeup workdays here reflect only the government agency office calendar announced by the Directorate-General of Personnel Administration; schools, companies, and individual industries set their own schedules.',
  },
  'not-yet-announced': {
    'zh-tw': '主管機關尚未公告的年度不會顯示放假日，這個工具不預測還沒決定的假期。',
    en: 'A year the responsible authority has not announced shows no holidays; this tool does not predict decisions that have not been made.',
  },
  'astronomical-may-shift': {
    'zh-tw': '未來年度的農曆日序、節氣與閏月時點會隨天文計算微調，中央氣象署每年 2 月底前滾動檢核。',
    en: 'Lunar dates, solar terms, and leap months in future years are adjusted as the astronomical calculation is refined; the Central Weather Administration reviews them by the end of February each year.',
  },
  'edition-may-change': {
    'zh-tw': '已公告的年度仍可能被修正，民國 114 年就在年中新增了三個放假日；請以這裡標示的資料版本為準。',
    en: 'An announced year can still be revised — 2025 gained three holidays mid-year — so read the dataset edition shown here.',
  },
  'offline-may-be-outdated': {
    'zh-tw': '離線時顯示的是這台裝置先前下載的版本，可能不是最新版。',
    en: 'Offline, you are reading the version this device downloaded earlier, which may not be the latest.',
  },
  'no-personal-events': {
    'zh-tw': '這個工具不需要也不儲存任何個人行程；你選的年份與篩選只留在這台裝置。',
    en: 'This tool neither needs nor stores any personal event; the year and filters you pick stay on this device.',
  },
}

/** Section 5.6, verbatim, with the numbers filled in from the coverage. */
const taiwanCalendarViewErrorCopy: Record<TaiwanCalendarViewErrorCode, LocalizedCopy> = {
  'invalid-year': {
    'zh-tw': '請輸入西元年份，例如 2026。',
    en: 'Enter a Gregorian year, for example 2026.',
  },
  'year-out-of-range': {
    'zh-tw': '目前提供 {firstYear} 至 {lastYear} 年，{year} 年不在範圍內。',
    en: 'Years {firstYear} to {lastYear} are available; {year} is outside that range.',
  },
  'year-not-announced': {
    'zh-tw': '{year} 年的辦公日曆表主管機關尚未公告，這裡不會先猜。',
    en: 'The office calendar for {year} has not been announced yet, and this page will not guess it.',
  },
  'year-not-downloaded': {
    'zh-tw': '目前離線，這台裝置還沒下載過 {year} 年的資料；連線後再開一次就會保存起來。',
    en: 'You are offline and this device has not downloaded {year} yet; open it once online and it will be kept.',
  },
}

/** Section 7.4: the visible questions, and the only ones the page marks up. */
export const taiwanCalendarFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': '放假日的資料是哪裡來的？', en: 'Where do the holidays come from?' },
    body: {
      'zh-tw': '來自行政院人事行政總處編製、行政院核定的「中華民國政府行政機關辦公日曆表」，經政府資料開放平臺以 CSV 發布。每一天的日別都對應到那份表格的一格備註，這一頁把採用的版本、來源發布日與本站擷取日一起標出來，讓你可以回到來源核對同一份檔案。',
      en: 'From the government agency office calendar compiled by the Directorate-General of Personnel Administration and approved by the Executive Yuan, published as CSV on Taiwan\'s open data platform. Every day here maps to one annotated cell of that table, and this page shows the edition, the source publication date, and the date this site retrieved it so you can check the same file at the source.',
    },
  },
  {
    heading: { 'zh-tw': '農曆與節氣是誰算的？', en: 'Who calculates the lunar dates and solar terms?' },
    body: {
      'zh-tw': '交通部中央氣象署每年出版的日曆資料表。這個工具不自己推算農曆或節氣，只採用氣象署公布的值，並以香港天文台的對照表逐日交叉核對；兩邊對不起來的年度不會發布。節氣的時刻以臺灣時判定，因為用世界時判斷會讓部分節氣早一天。',
      en: 'The Central Weather Administration, in the calendar data tables it publishes each year. This tool never computes a lunar date or a solar term itself: it uses the administration\'s published values and cross-checks every day against the Hong Kong Observatory conversion table, and a year where the two disagree is not published. Terms are read in Taiwan time, because reading them in UTC moves some of them a day earlier.',
    },
  },
  {
    heading: { 'zh-tw': '為什麼看不到明年的假日？', en: 'Why can I not see next year\'s holidays?' },
    body: {
      'zh-tw': '因為主管機關還沒公告。辦公日曆表每年 6 月 30 日前公告次年，特殊情形可延後到 8 月 31 日前。還沒公告的年度，這一頁會直接說「尚未公告」，不會沿用前一年，也不會替行政機關預測；農曆與節氣即使已經算得出來，也不能推導出那一年怎麼放假。',
      en: 'Because the authority has not announced it. The office calendar for the following year is announced by 30 June, or by 31 August in exceptional cases. Until then this page says so plainly instead of reusing last year or predicting on the government\'s behalf: the lunar dates and solar terms of that year may already be known, but they do not determine how it will be given off.',
    },
  },
  {
    heading: { 'zh-tw': '已經公布的假日還會改嗎？', en: 'Can an announced holiday still change?' },
    body: {
      'zh-tw': '會。民國 114 年就是實例：原本公布的版本裡沒有孔子誕辰紀念日、臺灣光復紀念日與行憲紀念日的假，1141020 修正版新增了這三個放假日，連帶多了兩個補假。因此每一年都標出目前採用的版本字串，修正過的年度會另外註明；請以這裡標示的版本為準。',
      en: 'Yes. 2025 is the example: the edition first published gave no day off for Confucius\'s Birthday, Retrocession Day, or Constitution Day, and the reissue of 20 October 2025 added all three plus two substitute holidays. That is why every year names the edition it is built from, and a reissued year says so.',
    },
  },
  {
    heading: { 'zh-tw': '以後還會有補班嗎？', en: 'Will there still be makeup workdays?' },
    body: {
      'zh-tw': '行政院在 114 年 6 月 13 日修正的處理要點刪除了補行上班，因此 115 年起的辦公日曆表沒有補班日；114 年以前的年度仍然有，這一頁照實顯示。這個工具不預測未來年度會不會恢復，只反映各年度公告的內容。',
      en: 'The directions revised on 13 June 2025 deleted makeup workdays, so the office calendars from 2026 onwards have none, while the earlier years still do and this page shows them as they were. The tool does not predict whether a future year will bring them back; it only reflects what each year announced.',
    },
  },
  {
    heading: { 'zh-tw': '清明節是不是固定在 4 月 5 日？', en: 'Is Tomb Sweeping Day always on 5 April?' },
    body: {
      'zh-tw': '不是。民族掃墓節放在當年的清明節氣那一天，而清明是天文計算的結果，會落在 4 月 4 日或 4 月 5 日。2024 與 2025 年是 4 月 4 日，2026 與 2027 年是 4 月 5 日；把日期寫死，四年裡會錯兩年。',
      en: 'No. Tomb Sweeping Day falls on the Qingming solar term, and Qingming is an astronomical result that lands on 4 or 5 April. It was 4 April in 2024 and 2025 and is 5 April in 2026 and 2027, so a hard-coded date would be wrong in half of those four years.',
    },
  },
  {
    heading: { 'zh-tw': '除夕是不是一定是十二月三十？', en: 'Is Lunar New Year\'s Eve always the 30th?' },
    body: {
      'zh-tw': '不是。除夕是正月初一的前一天，而農曆月有大小月之分，所以它可能是十二月三十，也可能是十二月廿九。2024 年的除夕是十二月三十，2025 年就是十二月廿九。',
      en: 'No. It is the day before the first day of the first lunar month, and a lunar month has either 29 or 30 days, so the eve can be the 30th or the 29th. It was the 30th in 2024 and the 29th in 2025.',
    },
  },
  {
    heading: { 'zh-tw': '這個行事曆能當公司或學校的出勤依據嗎？', en: 'Can I use this as my company or school schedule?' },
    body: {
      'zh-tw': '不能。這裡只反映政府行政機關的辦公日曆表；公司、學校與各行業的出勤另有規定，勞工的休假依勞動基準法與各事業單位的約定，學校依主管教育行政機關的規定。要確認自己的上班或上課日，請以所屬單位公告為準。',
      en: 'No. This reflects only the office calendar of government agencies. Companies, schools, and individual industries set their own attendance: employees follow the Labor Standards Act and their employer\'s agreement, and schools follow their education authority. Check the announcement of your own organisation for the days you actually work or study.',
    },
  },
  {
    heading: { 'zh-tw': '離線時看到的是最新的嗎？', en: 'Is what I see offline up to date?' },
    body: {
      'zh-tw': '不一定。離線時看到的是這台裝置先前下載的版本，如果來源在那之後發布了修正版，你不會知道。每一年都標出採用的版本與本站擷取日，離線時請對照那兩個值；還沒下載過的年度會直接說明，不會給你一張空白的月曆。',
      en: 'Not necessarily. Offline you are reading whatever this device downloaded earlier, and a reissue published since then will not have reached you. Every year shows the edition it uses and the date this site retrieved it, so you can tell; a year this device has never downloaded says so rather than showing an empty grid.',
    },
  },
  {
    heading: { 'zh-tw': '我的行程會被上傳嗎？', en: 'Are my events uploaded?' },
    body: {
      'zh-tw': '這個工具不接受任何個人行程，所以沒有可以上傳的東西。年份與選到的日期只留在這個瀏覽器分頁裡，不會寫進網址、不會被保存，也不會送到 toolsliang 或第三方服務；行事曆資料在建置時就已經打包進這個網站，開啟頁面後不會向任何來源發出請求。',
      en: 'The tool accepts no personal event, so there is nothing to upload. The year and the day you select stay in this browser tab: they are never written into the URL, stored, or sent to toolsliang or a third-party service. The calendar data is baked into the site at build time, so opening the page makes no request to any source.',
    },
  },
]

const taiwanCalendarContentIssues = validateTaiwanCalendarContent()
if (taiwanCalendarContentIssues.length) {
  throw new Error(`Invalid Taiwan calendar content:\n${taiwanCalendarContentIssues.join('\n')}`)
}

export function getTaiwanCalendarCopy(locale: LocaleCode): Record<TaiwanCalendarCopyKey, string> {
  return Object.fromEntries(
    taiwanCalendarCopyKeys.map(key => [key, taiwanCalendarCopy[key][locale]]),
  ) as Record<TaiwanCalendarCopyKey, string>
}

/**
 * All six disclaimers, always. Section 10.1 of the decision record is explicit
 * that `edition-may-change` has to be permanently visible — it is the one risk
 * a visitor cannot discover for themselves — so only its emphasis is
 * conditional, and section 7.1 asks for that emphasis on a reissued year.
 */
export function getTaiwanCalendarCaveats(locale: LocaleCode, year: { revised: boolean }) {
  return taiwanCalendarCaveatKeys.map(key => ({
    key,
    text: taiwanCalendarCaveats[key][locale],
    emphasised: key === 'edition-may-change' && year.revised,
  }))
}

export function taiwanCalendarViewErrorMessage(
  code: TaiwanCalendarViewErrorCode,
  year: number,
  locale: LocaleCode,
) {
  return taiwanCalendarViewErrorCopy[code][locale]
    .replace('{year}', Number.isFinite(year) ? String(year) : '')
    .replace('{firstYear}', String(firstYear))
    .replace('{lastYear}', String(lastYear))
}

/** How a year reads in a year picker: Gregorian, and the ROC year beside it. */
export function describeYearOption(year: number, locale: LocaleCode) {
  return locale === 'en' ? String(year) : `${year}（民國 ${year - rocEpochOffset} 年）`
}

/** The Gregorian date and its ROC year, which are one fact and always read together. */
export function describeCivilDate(date: string, rocYear: number | null, locale: LocaleCode) {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const roc = rocYear === null ? '' : locale === 'en' ? `ROC ${rocYear}` : `民國 ${rocYear} 年`

  if (locale === 'en') {
    const written = new Date(Date.UTC(year, month - 1, day))
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    return roc ? `${written} (${roc})` : written
  }

  return roc ? `${year} 年 ${month} 月 ${day} 日（${roc}）` : `${year} 年 ${month} 月 ${day} 日`
}

/** What fits under a day number: the lunar month on its first day, else the day. */
export function describeLunarDayMark(lunar: LunarDate, locale: LocaleCode) {
  if (locale === 'en') return `${lunar.leapMonth ? 'L' : ''}${lunar.month}/${lunar.day}`

  const day = lunarDayNames[lunar.day - 1]!
  return lunar.day === 1 ? `${lunar.leapMonth ? '閏' : ''}${lunarMonthNames[lunar.month - 1]!}` : day
}

/** The holidays a day carries, or what kind of adjusted day it is — never both. */
export function describeDayMark(official: OfficialDay, locale: LocaleCode) {
  if (official.kind === 'workday' || official.kind === 'weekend') return ''

  return holidayNames(official, locale) || officialDayKindLabels[official.kind][locale]
}

export function describeLunarDate(lunar: LunarDate, locale: LocaleCode) {
  const month = lunarMonthNames[lunar.month - 1]!
  const day = lunarDayNames[lunar.day - 1]!

  if (locale === 'en') {
    const leap = lunar.leapMonth ? 'leap ' : ''
    return `${lunar.sexagenaryYear} (${zodiacGloss[lunar.zodiac] ?? lunar.zodiac}) year, ${leap}${ordinal(lunar.month)} lunar month, day ${lunar.day}`
  }

  return `${lunar.sexagenaryYear}年（${lunar.zodiac}）${lunar.leapMonth ? '閏' : ''}${month}${day}`
}

/**
 * What a day is, in reviewed words. The source's own 備註 is never shown here:
 * the same festival is spelled three ways across editions, so the day names the
 * holiday it carries and keeps the raw cell for the day-detail panel.
 */
export function describeOfficialDay(official: OfficialDay, locale: LocaleCode) {
  const kind = officialDayKindLabels[official.kind][locale]
  const holidays = holidayNames(official, locale)
  if (!holidays) return kind

  return locale === 'en' ? `${holidays} (${kind})` : `${holidays}（${kind}）`
}

/** The reviewed names of the holidays a day carries, never the source's 備註. */
function holidayNames(official: OfficialDay, locale: LocaleCode) {
  return official.holidays
    .map(holiday => officialHolidayLabels[holiday][locale])
    .join(locale === 'en' ? ' and ' : '、')
}

export function describeSolarTerm(term: SolarTerm, locale: LocaleCode) {
  return solarTermLabels[term.name][locale]
}

function ordinal(value: number) {
  const suffix = value % 10 === 1 && value !== 11 ? 'st' : value % 10 === 2 && value !== 12 ? 'nd' : value % 10 === 3 && value !== 13 ? 'rd' : 'th'
  return `${value}${suffix}`
}

export function validateTaiwanCalendarContent() {
  const issues: string[] = []

  for (const key of taiwanCalendarCopyKeys) {
    if (!hasLocalizedCopy(taiwanCalendarCopy[key])) issues.push(`[copy:${key}] requires both locales`)
  }
  for (const locale of ['zh-tw', 'en'] as const) {
    if (weekdayNames[locale].length !== 7) issues.push(`[weekday:${locale}] requires seven names`)
    if (weekdayFullNames[locale].length !== 7) issues.push(`[weekday-full:${locale}] requires seven names`)
  }
  for (const key of taiwanCalendarCaveatKeys) {
    if (!hasLocalizedCopy(taiwanCalendarCaveats[key])) issues.push(`[caveat:${key}] requires both locales`)
  }
  for (const key of Object.keys(taiwanCalendarCaveats)) {
    if (!taiwanCalendarCaveatKeys.includes(key as TaiwanCalendarCaveatKey)) issues.push(`[caveat:${key}] is not a reviewed caveat`)
  }
  for (const code of taiwanCalendarViewErrorCodes) {
    if (!hasLocalizedCopy(taiwanCalendarViewErrorCopy[code])) issues.push(`[error:${code}] requires both locales`)
  }
  for (const kind of officialDayKinds) {
    if (!hasLocalizedCopy(officialDayKindLabels[kind])) issues.push(`[day-kind:${kind}] requires both locales`)
  }
  for (const holiday of officialHolidayIds) {
    if (!hasLocalizedCopy(officialHolidayLabels[holiday])) issues.push(`[holiday:${holiday}] requires both locales`)
  }
  for (const term of solarTermNames) {
    if (!hasLocalizedCopy(solarTermLabels[term])) issues.push(`[solar-term:${term}] requires both locales`)
  }

  const questions = new Set<string>()
  for (const [index, entry] of taiwanCalendarFaq.entries()) {
    if (!hasLocalizedCopy(entry.heading) || !hasLocalizedCopy(entry.body)) issues.push(`[faq:${index}] requires both locales`)
    if (questions.has(entry.heading['zh-tw'])) issues.push(`[faq:${index}] duplicate question`)
    questions.add(entry.heading['zh-tw'])
  }

  return issues
}
