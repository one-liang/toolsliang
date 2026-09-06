/**
 * Data contract for the Taiwan calendar tool: the four layers a calendar day is
 * assembled from, the vocabulary each sourced layer is allowed to use, the year
 * statuses an ingestion can end in, and the vectors an implementation has to
 * reproduce. The ingestion script, the calendar domain and the page belong to
 * the implementation ticket; this module only carries what was researched.
 * Every value is traceable to
 * docs/research/004-taiwan-calendar-sources-and-data-contract.md, and
 * tests/taiwan-calendar-reference.test.ts keeps the two from drifting apart.
 */

/**
 * The four layers a day is assembled from. They are listed separately because
 * they have different authorities and different update cadences: `civil` is
 * arithmetic and never changes, the other three carry a source edition.
 */
export const taiwanCalendarLayers = ['civil', 'lunar', 'solar-term', 'official'] as const

export type TaiwanCalendarLayer = typeof taiwanCalendarLayers[number]

/** ROC year = Gregorian year − 1911, valid from the first day of ROC year 1. */
export const rocEpochOffset = 1911
export const rocFirstGregorianYear = 1912

/**
 * Every calendar day, holiday and solar term in this contract is read in
 * Taiwan time. Taiwan has observed no daylight saving since 1979, so the offset
 * is a constant rather than a zone lookup — but it is never zero, and 2026 has
 * three solar terms whose UTC date falls a day earlier (see the vectors).
 */
export const taiwanCalendarTimeZone = 'Asia/Taipei'
export const taiwanCalendarUtcOffsetMinutes = 8 * 60

/**
 * How a day reads on the government agency office calendar. `weekend` and
 * `workday` come from the weekday alone; the other four are only ever set by a
 * whitelisted 備註 label.
 */
export const officialDayKinds = [
  'workday',
  'weekend',
  'national-holiday',
  'substitute-holiday',
  'bridge-holiday',
  'makeup-workday',
] as const

export type OfficialDayKind = typeof officialDayKinds[number]

/**
 * Stable English ids for the commemoration days and festivals the source
 * annotates. They are ids, not display copy: the source spells the same day
 * more than one way, and the display wording belongs to the content module.
 */
export const officialHolidayIds = [
  'founding-day',
  'peace-memorial-day',
  'childrens-day',
  'tomb-sweeping-day',
  'labour-day',
  'minor-new-years-eve',
  'lunar-new-years-eve',
  'spring-festival',
  'dragon-boat-festival',
  'mid-autumn-festival',
  'teachers-day',
  'national-day',
  'retrocession-day',
  'constitution-day',
] as const

export type OfficialHolidayId = typeof officialHolidayIds[number]

/** The only two values the source's 是否放假 column takes. */
export const dgpaHolidayFlags = { workday: '0', holiday: '2' } as const

export interface TaiwanCalendarNoteLabel {
  /** The 備註 cell verbatim, so a reworded source fails the whitelist. */
  label: string
  kind: OfficialDayKind
  holidays: readonly OfficialHolidayId[]
}

/**
 * Every 備註 wording seen across the ROC 106–116 editions. The source is not
 * consistent — 兒童節及民族掃墓節, 民族掃墓節 and 清明節 all name the same
 * festival, and 補行上班 and 調整上班 the same makeup workday — so the wording
 * is mapped to a stable kind and holiday id here rather than shown as-is. A
 * label outside this list is an ingestion failure, never a value to pass through.
 */
export const taiwanCalendarNoteLabels = [
  { label: '開國紀念日', kind: 'national-holiday', holidays: ['founding-day'] },
  { label: '和平紀念日', kind: 'national-holiday', holidays: ['peace-memorial-day'] },
  { label: '兒童節', kind: 'national-holiday', holidays: ['childrens-day'] },
  { label: '兒童節及民族掃墓節', kind: 'national-holiday', holidays: ['childrens-day', 'tomb-sweeping-day'] },
  { label: '民族掃墓節', kind: 'national-holiday', holidays: ['tomb-sweeping-day'] },
  { label: '清明節', kind: 'national-holiday', holidays: ['tomb-sweeping-day'] },
  { label: '勞動節', kind: 'national-holiday', holidays: ['labour-day'] },
  { label: '小年夜', kind: 'national-holiday', holidays: ['minor-new-years-eve'] },
  { label: '農曆除夕', kind: 'national-holiday', holidays: ['lunar-new-years-eve'] },
  { label: '春節', kind: 'national-holiday', holidays: ['spring-festival'] },
  { label: '端午節', kind: 'national-holiday', holidays: ['dragon-boat-festival'] },
  { label: '中秋節', kind: 'national-holiday', holidays: ['mid-autumn-festival'] },
  { label: '孔子誕辰紀念日/教師節', kind: 'national-holiday', holidays: ['teachers-day'] },
  { label: '孔子誕辰紀念日', kind: 'national-holiday', holidays: ['teachers-day'] },
  { label: '國慶日', kind: 'national-holiday', holidays: ['national-day'] },
  { label: '臺灣光復暨金門古寧頭大捷紀念日', kind: 'national-holiday', holidays: ['retrocession-day'] },
  { label: '行憲紀念日', kind: 'national-holiday', holidays: ['constitution-day'] },
  { label: '補假', kind: 'substitute-holiday', holidays: [] },
  { label: '調整放假', kind: 'bridge-holiday', holidays: [] },
  { label: '放假', kind: 'bridge-holiday', holidays: [] },
  { label: '補行上班', kind: 'makeup-workday', holidays: [] },
  { label: '調整上班', kind: 'makeup-workday', holidays: [] },
] as const satisfies readonly TaiwanCalendarNoteLabel[]

/** The lunar month and day ranges the CWA field spec publishes. */
export const lunarMonthRange = { min: 1, max: 12 } as const
export const lunarDayRange = { min: 1, max: 30 } as const

/** The twenty-four terms in the order the CWA calendar table tabulates them. */
export const solarTermNames = [
  '小寒', '大寒', '立春', '雨水', '驚蟄', '春分',
  '清明', '穀雨', '立夏', '小滿', '芒種', '夏至',
  '小暑', '大暑', '立秋', '處暑', '白露', '秋分',
  '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
] as const

export type SolarTermName = typeof solarTermNames[number]

/**
 * What a year's layer can be. `not-announced` and `conflict` both show no
 * dates, but they stay apart: one means nobody has decided yet, the other means
 * somebody decided and our sources disagree.
 */
export const calendarDataStatuses = [
  'published',
  'revised',
  'not-announced',
  'offline-outdated',
  'conflict',
] as const

export type CalendarDataStatus = typeof calendarDataStatuses[number]

/**
 * Ingestion failures, in the order the checks run. A maintainer reads these;
 * they never reach a visitor, because a year that hits one is not published.
 */
export const taiwanCalendarIngestionErrorCodes = [
  'unsupported-encoding',
  'missing-column',
  'incomplete-year',
  'unknown-flag',
  'unknown-label',
  'weekday-mismatch',
  'flag-kind-mismatch',
  'cross-layer-conflict',
  'edition-changed',
] as const

export type TaiwanCalendarIngestionErrorCode = typeof taiwanCalendarIngestionErrorCodes[number]

/**
 * What a visitor can be told, in the order the checks run: format before range,
 * range before announcement, announcement before offline. Saying "not
 * downloaded" first would suggest that going online reveals a year that does
 * not exist yet.
 */
export const taiwanCalendarViewErrorCodes = [
  'invalid-year',
  'year-out-of-range',
  'year-not-announced',
  'year-not-downloaded',
] as const

export type TaiwanCalendarViewErrorCode = typeof taiwanCalendarViewErrorCodes[number]

export interface RocConversionVector {
  date: string
  /** null before the ROC era begins, rather than a zero or negative year. */
  rocYear: number | null
  /** 1 is Monday and 7 is Sunday, as the CWA field spec numbers them — not Date.getDay(). */
  isoWeekday: number
}

/**
 * The 2026-12-31 and 2027-01-01 rows are two days of one ISO week: a Gregorian
 * year boundary does not restart the weekday count. The 1911-12-31 row is the
 * guard on the era boundary, and every row pins 7 = Sunday, which is where an
 * implementation reaching for Date.getDay() would be off by one.
 */
export const taiwanCalendarRocVectors = [
  { date: '2017-01-01', rocYear: 106, isoWeekday: 7 },
  { date: '2024-02-29', rocYear: 113, isoWeekday: 4 },
  { date: '2026-01-01', rocYear: 115, isoWeekday: 4 },
  { date: '2026-12-31', rocYear: 115, isoWeekday: 4 },
  { date: '2027-01-01', rocYear: 116, isoWeekday: 5 },
  { date: '2027-12-31', rocYear: 116, isoWeekday: 5 },
  { date: '1912-01-01', rocYear: 1, isoWeekday: 1 },
  { date: '1911-12-31', rocYear: null, isoWeekday: 7 },
] as const satisfies readonly RocConversionVector[]

export interface LunarDateVector {
  date: string
  /** 歲次, without the trailing 年 the sources print. */
  sexagenaryYear: string
  zodiac: string
  month: number
  leapMonth: boolean
  day: number
}

/**
 * Taken from the CWA calendar tables and confirmed day by day against the Hong
 * Kong Observatory conversion table. The set is chosen for the four things that
 * are easy to get wrong: the lunar year turns on the first day of the first
 * month rather than on 1 January, the eve of the new year can be the 29th or
 * the 30th, a leap month shares its number with the ordinary month before it,
 * and a Gregorian year boundary does not move the lunar month.
 */
export const taiwanCalendarLunarVectors = [
  { date: '2024-02-09', sexagenaryYear: '癸卯', zodiac: '兔', month: 12, leapMonth: false, day: 30 },
  { date: '2024-02-10', sexagenaryYear: '甲辰', zodiac: '龍', month: 1, leapMonth: false, day: 1 },
  { date: '2025-01-28', sexagenaryYear: '甲辰', zodiac: '龍', month: 12, leapMonth: false, day: 29 },
  { date: '2025-01-29', sexagenaryYear: '乙巳', zodiac: '蛇', month: 1, leapMonth: false, day: 1 },
  { date: '2025-07-24', sexagenaryYear: '乙巳', zodiac: '蛇', month: 6, leapMonth: false, day: 30 },
  { date: '2025-07-25', sexagenaryYear: '乙巳', zodiac: '蛇', month: 6, leapMonth: true, day: 1 },
  { date: '2025-08-22', sexagenaryYear: '乙巳', zodiac: '蛇', month: 6, leapMonth: true, day: 29 },
  { date: '2025-08-23', sexagenaryYear: '乙巳', zodiac: '蛇', month: 7, leapMonth: false, day: 1 },
  { date: '2025-12-31', sexagenaryYear: '乙巳', zodiac: '蛇', month: 11, leapMonth: false, day: 12 },
  { date: '2026-01-01', sexagenaryYear: '乙巳', zodiac: '蛇', month: 11, leapMonth: false, day: 13 },
  { date: '2026-02-15', sexagenaryYear: '乙巳', zodiac: '蛇', month: 12, leapMonth: false, day: 28 },
  { date: '2026-02-16', sexagenaryYear: '乙巳', zodiac: '蛇', month: 12, leapMonth: false, day: 29 },
  { date: '2026-02-17', sexagenaryYear: '丙午', zodiac: '馬', month: 1, leapMonth: false, day: 1 },
  { date: '2026-02-18', sexagenaryYear: '丙午', zodiac: '馬', month: 1, leapMonth: false, day: 2 },
  { date: '2026-02-19', sexagenaryYear: '丙午', zodiac: '馬', month: 1, leapMonth: false, day: 3 },
  { date: '2026-06-19', sexagenaryYear: '丙午', zodiac: '馬', month: 5, leapMonth: false, day: 5 },
  { date: '2026-09-25', sexagenaryYear: '丙午', zodiac: '馬', month: 8, leapMonth: false, day: 15 },
  { date: '2026-12-31', sexagenaryYear: '丙午', zodiac: '馬', month: 11, leapMonth: false, day: 23 },
  { date: '2027-02-06', sexagenaryYear: '丁未', zodiac: '羊', month: 1, leapMonth: false, day: 1 },
  { date: '2028-06-22', sexagenaryYear: '戊申', zodiac: '猴', month: 5, leapMonth: false, day: 30 },
  { date: '2028-06-23', sexagenaryYear: '戊申', zodiac: '猴', month: 5, leapMonth: true, day: 1 },
  { date: '2028-07-22', sexagenaryYear: '戊申', zodiac: '猴', month: 6, leapMonth: false, day: 1 },
] as const satisfies readonly LunarDateVector[]

export interface SolarTermVector {
  name: SolarTermName
  /** The calendar day in Taiwan time, which is the day the tool shows. */
  date: string
  /** hh:mm in Taiwan time; the tool never displays it, it only reads the date from it. */
  time: string
  /** The same instant's UTC calendar day; where it differs, a UTC-based implementation is wrong. */
  utcDate: string
}

/**
 * A whole year of terms from the CWA calendar table for ROC 115, agreeing to
 * the minute with the Hong Kong Observatory table, plus 清明 for the
 * neighbouring years. 民族掃墓節 falls on 清明 rather than on a fixed date, so
 * hard-coding 4 April or 5 April is wrong in half of these four years.
 */
export const taiwanCalendarSolarTermVectors = [
  { name: '小寒', date: '2026-01-05', time: '16:23', utcDate: '2026-01-05' },
  { name: '大寒', date: '2026-01-20', time: '09:45', utcDate: '2026-01-20' },
  { name: '立春', date: '2026-02-04', time: '04:02', utcDate: '2026-02-03' },
  { name: '雨水', date: '2026-02-18', time: '23:52', utcDate: '2026-02-18' },
  { name: '驚蟄', date: '2026-03-05', time: '21:59', utcDate: '2026-03-05' },
  { name: '春分', date: '2026-03-20', time: '22:46', utcDate: '2026-03-20' },
  { name: '清明', date: '2026-04-05', time: '02:40', utcDate: '2026-04-04' },
  { name: '穀雨', date: '2026-04-20', time: '09:39', utcDate: '2026-04-20' },
  { name: '立夏', date: '2026-05-05', time: '19:49', utcDate: '2026-05-05' },
  { name: '小滿', date: '2026-05-21', time: '08:37', utcDate: '2026-05-21' },
  { name: '芒種', date: '2026-06-05', time: '23:48', utcDate: '2026-06-05' },
  { name: '夏至', date: '2026-06-21', time: '16:25', utcDate: '2026-06-21' },
  { name: '小暑', date: '2026-07-07', time: '09:57', utcDate: '2026-07-07' },
  { name: '大暑', date: '2026-07-23', time: '03:13', utcDate: '2026-07-22' },
  { name: '立秋', date: '2026-08-07', time: '19:43', utcDate: '2026-08-07' },
  { name: '處暑', date: '2026-08-23', time: '10:19', utcDate: '2026-08-23' },
  { name: '白露', date: '2026-09-07', time: '22:41', utcDate: '2026-09-07' },
  { name: '秋分', date: '2026-09-23', time: '08:05', utcDate: '2026-09-23' },
  { name: '寒露', date: '2026-10-08', time: '14:29', utcDate: '2026-10-08' },
  { name: '霜降', date: '2026-10-23', time: '17:38', utcDate: '2026-10-23' },
  { name: '立冬', date: '2026-11-07', time: '17:52', utcDate: '2026-11-07' },
  { name: '小雪', date: '2026-11-22', time: '15:23', utcDate: '2026-11-22' },
  { name: '大雪', date: '2026-12-07', time: '10:53', utcDate: '2026-12-07' },
  { name: '冬至', date: '2026-12-22', time: '04:50', utcDate: '2026-12-21' },
  { name: '清明', date: '2024-04-04', time: '15:02', utcDate: '2024-04-04' },
  { name: '清明', date: '2025-04-04', time: '20:49', utcDate: '2025-04-04' },
  { name: '清明', date: '2027-04-05', time: '08:17', utcDate: '2027-04-05' },
] as const satisfies readonly SolarTermVector[]

export interface OfficialDayVector {
  date: string
  kind: OfficialDayKind
  holidays: readonly OfficialHolidayId[]
  /** The source's 備註 verbatim; empty when the cell was blank. */
  label: string
}

/**
 * Representative days from the ROC 106–116 editions. The 2025 rows follow the
 * 1141020 revision, not the edition it replaced. 2026 carries no makeup workday
 * at all — the directions deleted them in June 2025 — while 2024 and 2025 still
 * do, which is why the contract has to express both.
 *
 * Three rows exist to defeat a tempting shortcut. 2024-04-05 and 2025-04-03 are
 * the same situation (Children's Day landing on Tomb Sweeping Day) resolved in
 * opposite directions by Article 6, and 2027-12-31 is a substitute for a
 * holiday in the following year, whose office calendar is not announced yet.
 */
export const taiwanCalendarOfficialDayVectors = [
  { date: '2017-02-18', kind: 'makeup-workday', holidays: [], label: '調整上班' },
  { date: '2020-04-03', kind: 'bridge-holiday', holidays: [], label: '放假' },
  { date: '2023-01-27', kind: 'bridge-holiday', holidays: [], label: '調整放假' },
  { date: '2024-02-09', kind: 'national-holiday', holidays: ['lunar-new-years-eve'], label: '農曆除夕' },
  { date: '2024-02-10', kind: 'national-holiday', holidays: ['spring-festival'], label: '春節' },
  { date: '2024-02-17', kind: 'makeup-workday', holidays: [], label: '補行上班' },
  {
    date: '2024-04-04',
    kind: 'national-holiday',
    holidays: ['childrens-day', 'tomb-sweeping-day'],
    label: '兒童節及民族掃墓節',
  },
  { date: '2024-04-05', kind: 'substitute-holiday', holidays: [], label: '補假' },
  { date: '2025-02-08', kind: 'makeup-workday', holidays: [], label: '補行上班' },
  { date: '2025-04-03', kind: 'substitute-holiday', holidays: [], label: '補假' },
  { date: '2025-09-28', kind: 'national-holiday', holidays: ['teachers-day'], label: '孔子誕辰紀念日' },
  { date: '2025-09-29', kind: 'substitute-holiday', holidays: [], label: '補假' },
  { date: '2025-10-24', kind: 'substitute-holiday', holidays: [], label: '補假' },
  {
    date: '2025-10-25',
    kind: 'national-holiday',
    holidays: ['retrocession-day'],
    label: '臺灣光復暨金門古寧頭大捷紀念日',
  },
  { date: '2025-12-25', kind: 'national-holiday', holidays: ['constitution-day'], label: '行憲紀念日' },
  { date: '2026-01-01', kind: 'national-holiday', holidays: ['founding-day'], label: '開國紀念日' },
  { date: '2026-01-02', kind: 'workday', holidays: [], label: '' },
  { date: '2026-01-03', kind: 'weekend', holidays: [], label: '' },
  { date: '2026-02-15', kind: 'national-holiday', holidays: ['minor-new-years-eve'], label: '小年夜' },
  { date: '2026-02-16', kind: 'national-holiday', holidays: ['lunar-new-years-eve'], label: '農曆除夕' },
  { date: '2026-02-17', kind: 'national-holiday', holidays: ['spring-festival'], label: '春節' },
  { date: '2026-02-18', kind: 'national-holiday', holidays: ['spring-festival'], label: '春節' },
  { date: '2026-02-19', kind: 'national-holiday', holidays: ['spring-festival'], label: '春節' },
  { date: '2026-02-20', kind: 'substitute-holiday', holidays: [], label: '補假' },
  { date: '2026-02-27', kind: 'substitute-holiday', holidays: [], label: '補假' },
  { date: '2026-02-28', kind: 'national-holiday', holidays: ['peace-memorial-day'], label: '和平紀念日' },
  { date: '2026-04-03', kind: 'substitute-holiday', holidays: [], label: '補假' },
  { date: '2026-04-04', kind: 'national-holiday', holidays: ['childrens-day'], label: '兒童節' },
  { date: '2026-04-05', kind: 'national-holiday', holidays: ['tomb-sweeping-day'], label: '清明節' },
  { date: '2026-04-06', kind: 'substitute-holiday', holidays: [], label: '補假' },
  { date: '2026-05-01', kind: 'national-holiday', holidays: ['labour-day'], label: '勞動節' },
  { date: '2026-06-19', kind: 'national-holiday', holidays: ['dragon-boat-festival'], label: '端午節' },
  { date: '2026-09-25', kind: 'national-holiday', holidays: ['mid-autumn-festival'], label: '中秋節' },
  { date: '2026-09-28', kind: 'national-holiday', holidays: ['teachers-day'], label: '孔子誕辰紀念日/教師節' },
  { date: '2026-10-09', kind: 'substitute-holiday', holidays: [], label: '補假' },
  { date: '2026-10-10', kind: 'national-holiday', holidays: ['national-day'], label: '國慶日' },
  {
    date: '2026-10-25',
    kind: 'national-holiday',
    holidays: ['retrocession-day'],
    label: '臺灣光復暨金門古寧頭大捷紀念日',
  },
  { date: '2026-10-26', kind: 'substitute-holiday', holidays: [], label: '補假' },
  { date: '2026-12-25', kind: 'national-holiday', holidays: ['constitution-day'], label: '行憲紀念日' },
  { date: '2027-12-31', kind: 'substitute-holiday', holidays: [], label: '補假' },
] as const satisfies readonly OfficialDayVector[]

export interface CalendarEditionDiffSide {
  kind: OfficialDayKind
  label: string
}

export interface CalendarEditionDiffVector {
  date: string
  before: CalendarEditionDiffSide
  after: CalendarEditionDiffSide
}

/**
 * The complete difference between the ROC 114 office calendar first published
 * in July 2024 and the 1141020 revision. Five days changed after the year was
 * already on the platform, which is the whole reason a year carries an edition
 * and gets re-fetched rather than being ingested once.
 */
export const taiwanCalendarEditionDiffVectors = [
  {
    date: '2025-09-28',
    before: { kind: 'weekend', label: '' },
    after: { kind: 'national-holiday', label: '孔子誕辰紀念日' },
  },
  {
    date: '2025-09-29',
    before: { kind: 'workday', label: '' },
    after: { kind: 'substitute-holiday', label: '補假' },
  },
  {
    date: '2025-10-24',
    before: { kind: 'workday', label: '' },
    after: { kind: 'substitute-holiday', label: '補假' },
  },
  {
    date: '2025-10-25',
    before: { kind: 'weekend', label: '' },
    after: { kind: 'national-holiday', label: '臺灣光復暨金門古寧頭大捷紀念日' },
  },
  {
    date: '2025-12-25',
    before: { kind: 'workday', label: '' },
    after: { kind: 'national-holiday', label: '行憲紀念日' },
  },
] as const satisfies readonly CalendarEditionDiffVector[]
