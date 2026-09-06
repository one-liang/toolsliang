import type { LocalizedCopy, PublishedToolDefinition } from '@/features/tools/catalog'

/**
 * Document boundary for the Taiwan calendar tool: which datasets it ingests,
 * under which licence, on which cadence, and which caveats have to sit next to
 * the calendar. Separated from the data contract because it changes whenever a
 * source is re-reviewed, not when a day kind or a vector changes.
 */

/** Names the reviewed set of source decisions the tool follows, by review date. */
export const taiwanCalendarReferenceVersion = 'taiwan-calendar-2026-09-06'

export const taiwanCalendarDatasetIds = [
  'dgpa-office-calendar',
  'cwa-calendar-table',
  'hko-lunar-calendar',
] as const

export type TaiwanCalendarDatasetId = typeof taiwanCalendarDatasetIds[number]

export interface TaiwanCalendarDataset {
  id: TaiwanCalendarDatasetId
  name: LocalizedCopy
  publisher: LocalizedCopy
  licence: LocalizedCopy
  licenceUrl: string
  url: string
  /** What the source itself says about how often it republishes. */
  cadence: LocalizedCopy
  /** Years confirmed obtainable on the review date, not years the source claims. */
  coverage: { firstYear: number, lastYear: number }
  /**
   * When the data is read. `build-time` bakes it into a versioned static asset;
   * `runtime` would have the browser fetch it, which ADR-0001 rules out because
   * the year a visitor is looking at would then leave their device. The field is
   * a decision that could have gone the other way, so tests can assert on it.
   */
  ingestion: TaiwanCalendarIngestion
}

export type TaiwanCalendarIngestion = 'build-time' | 'runtime'

/**
 * The three datasets the calendar answers to. The Open Government Data Licence
 * makes attribution a condition of the licence rather than a courtesy, so every
 * row here has to be reachable from the tool page — see §7.2 of the decision
 * record for what has to be shown.
 */
export const taiwanCalendarDatasets = [
  {
    id: 'dgpa-office-calendar',
    name: {
      'zh-tw': '中華民國政府行政機關辦公日曆表（政府資料開放平臺資料集 14718）',
      en: 'Government agency office calendar of the Republic of China (data.gov.tw dataset 14718)',
    },
    publisher: {
      'zh-tw': '行政院人事行政總處',
      en: 'Directorate-General of Personnel Administration, Executive Yuan',
    },
    licence: {
      'zh-tw': '政府資料開放授權條款－第 1 版',
      en: 'Open Government Data License, version 1.0',
    },
    licenceUrl: 'https://data.gov.tw/license',
    url: 'https://data.gov.tw/dataset/14718',
    cadence: {
      'zh-tw': '每年 6 月 30 日前公告次年，特殊情形延後至 8 月 31 日前；已公告年度仍可能發布修正版。',
      en: 'The next year is announced by 30 June, or by 31 August in exceptional cases; an announced year can still be reissued.',
    },
    coverage: { firstYear: 2017, lastYear: 2027 },
    ingestion: 'build-time',
  },
  {
    id: 'cwa-calendar-table',
    name: {
      'zh-tw': '日曆資料表（國農曆對照、節氣、朔望兩弦、日月食）',
      en: 'Calendar data tables (lunar conversion, solar terms, moon phases, eclipses)',
    },
    publisher: {
      'zh-tw': '交通部中央氣象署',
      en: 'Central Weather Administration, Ministry of Transportation and Communications',
    },
    licence: {
      'zh-tw': '政府資料開放授權條款－第 1 版',
      en: 'Open Government Data License, version 1.0',
    },
    licenceUrl: 'https://data.gov.tw/license',
    url: 'https://www.cwa.gov.tw/V8/C/D/calendar_data.html',
    cadence: {
      'zh-tw': '未來年次的農曆日序、節氣與閏月時點每年 2 月底前滾動檢核並公布。',
      en: 'Lunar dates, solar terms, and leap months for future years are reviewed and republished by the end of February each year.',
    },
    coverage: { firstYear: 2020, lastYear: 2028 },
    ingestion: 'build-time',
  },
  {
    id: 'hko-lunar-calendar',
    name: {
      'zh-tw': '公曆與農曆對照表、二十四節氣的日期及時間資料',
      en: 'Gregorian-Lunar Calendar Conversion Table and the dates and times of the 24 solar terms',
    },
    publisher: {
      'zh-tw': '香港天文台',
      en: 'Hong Kong Observatory',
    },
    licence: {
      'zh-tw': 'DATA.GOV.HK 使用條款',
      en: 'DATA.GOV.HK Terms and Conditions of Use',
    },
    licenceUrl: 'https://data.gov.hk/en/terms-and-conditions',
    url: 'https://data.gov.hk/tc-data/dataset/hk-hko-rss-gregorian-lunar-calendar-conversion-table',
    cadence: {
      'zh-tw': '每年更新；本站只用它交叉核對農曆日序，不作為權威。',
      en: 'Updated annually; used here only to cross-check lunar dates, never as the authority.',
    },
    coverage: { firstYear: 2023, lastYear: 2028 },
    ingestion: 'build-time',
  },
] as const satisfies readonly TaiwanCalendarDataset[]

function coverageOf(id: TaiwanCalendarDatasetId) {
  const dataset = taiwanCalendarDatasets.find(candidate => candidate.id === id)
  if (!dataset) throw new Error(`No reviewed dataset ${id}`)

  return { datasetId: dataset.id, ...dataset.coverage }
}

/**
 * What each sourced layer actually covered on the review date. The astronomical
 * layer runs a year further than the official one, which is exactly why a year
 * can hold a lunar date and still owe its holidays. Both ranges are read back
 * off the datasets so the years are written down once.
 */
export const taiwanCalendarCoverage = {
  official: coverageOf('dgpa-office-calendar'),
  astronomical: coverageOf('cwa-calendar-table'),
} as const

/** A year page needs every sourced layer, so the publishable range is their intersection. */
export const taiwanCalendarPublishableYears = {
  firstYear: Math.max(...Object.values(taiwanCalendarCoverage).map(range => range.firstYear)),
  lastYear: Math.min(...Object.values(taiwanCalendarCoverage).map(range => range.lastYear)),
} as const

/**
 * Every caveat must appear next to the calendar, in both locales. Four of them
 * exist because the data genuinely moves: an announced year can be reissued,
 * future lunar and solar-term values are refined, an unannounced year is simply
 * absent, and an offline device shows whatever it downloaded last.
 */
export const taiwanCalendarCaveatKeys = [
  'government-agency-scope',
  'not-yet-announced',
  'astronomical-may-shift',
  'edition-may-change',
  'offline-may-be-outdated',
  'no-personal-events',
] as const

export type TaiwanCalendarCaveatKey = typeof taiwanCalendarCaveatKeys[number]

/**
 * The catalog entry's content review. The editions named here are the ones the
 * ingestion actually baked, which is narrower than what the sources publish:
 * the astronomical layer is only taken where its table can be read and checked
 * field by field (see §3.2 of the decision record).
 */
export const taiwanCalendarContentReview: PublishedToolDefinition['contentReview'] = {
  reviewedAt: '2026-09-06',
  sourceEdition: {
    'zh-tw': '中華民國 109 至 116 年政府行政機關辦公日曆表（政府資料開放平臺 2026-07-15 更新，114 年採 1141020 修正版）與中央氣象署中華民國 109 至 116 年日曆資料表',
    en: 'Government agency office calendars for ROC years 109–116 (data.gov.tw, updated 15 July 2026; ROC 114 as reissued on 20 October 2025) and Central Weather Administration calendar data tables for ROC years 109–116',
  },
  sourceEffectiveAt: '2026-07-15',
  sources: [
    {
      title: {
        'zh-tw': '政府資料開放平臺：中華民國政府行政機關辦公日曆表',
        en: 'data.gov.tw: Government agency office calendar of the Republic of China',
      },
      url: 'https://data.gov.tw/dataset/14718',
    },
    {
      title: {
        'zh-tw': '交通部中央氣象署：日曆資料表',
        en: 'Central Weather Administration: calendar data tables',
      },
      url: 'https://www.cwa.gov.tw/V8/C/D/calendar_data.html',
    },
    {
      title: {
        'zh-tw': '氣象資料開放平臺：日曆資料—國農曆對照（A-A0087-001）',
        en: 'CWA Open Data: calendar data — Gregorian/lunar conversion (A-A0087-001)',
      },
      url: 'https://opendata.cwa.gov.tw/dataset/astronomy/A-A0087-001',
    },
    {
      title: {
        'zh-tw': '氣象資料開放平臺：日曆資料—節氣日期（A-A0087-003）',
        en: 'CWA Open Data: calendar data — solar term dates (A-A0087-003)',
      },
      url: 'https://opendata.cwa.gov.tw/dataset/astronomy/A-A0087-003',
    },
    {
      title: {
        'zh-tw': '全國法規資料庫：紀念日及節日實施條例',
        en: 'Laws & Regulations Database: Act on Commemoration Days and Holidays',
      },
      url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0020095',
    },
    {
      title: {
        'zh-tw': '行政院人事行政總處：政府機關配合紀念日與節日補假及調整放假處理要點',
        en: 'DGPA: Directions for substitute holidays and adjusted holidays in government agencies',
      },
      url: 'https://www.dgpa.gov.tw/information?uid=84&pid=12576',
    },
    {
      title: {
        'zh-tw': '行政院人事行政總處新聞稿：修正 114 年並核定 115 年政府行政機關辦公日曆表',
        en: 'DGPA press release: 2025 office calendar amended and 2026 office calendar approved',
      },
      url: 'https://www.dgpa.gov.tw/information?uid=82&pid=12574',
    },
    {
      title: {
        'zh-tw': '政府資料開放授權條款－第 1 版',
        en: 'Open Government Data License, version 1.0',
      },
      url: 'https://data.gov.tw/license',
    },
    {
      title: {
        'zh-tw': 'DATA.GOV.HK：公曆與農曆對照表',
        en: 'DATA.GOV.HK: Gregorian-Lunar Calendar Conversion Table',
      },
      url: 'https://data.gov.hk/tc-data/dataset/hk-hko-rss-gregorian-lunar-calendar-conversion-table',
    },
    {
      title: {
        'zh-tw': '香港天文台：二十四節氣的日期及時間資料',
        en: 'Hong Kong Observatory: dates and times of the 24 solar terms',
      },
      url: 'https://www.hko.gov.hk/tc/gts/astronomy/Solar_Term.htm',
    },
    {
      title: {
        'zh-tw': 'DATA.GOV.HK 使用條款',
        en: 'DATA.GOV.HK Terms and Conditions of Use',
      },
      url: 'https://data.gov.hk/en/terms-and-conditions',
    },
  ],
}
