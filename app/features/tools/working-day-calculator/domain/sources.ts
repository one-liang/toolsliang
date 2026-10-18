import type { ToolContentReview } from '@/features/tools/catalog'
import { rocEpochOffset } from '../../taiwan-calendar/domain/reference'
import { taiwanCalendarPublishableYears } from '../../taiwan-calendar/domain/sources'

/**
 * Where a working day comes from (ADR-0025): the same office calendar the
 * Taiwan Calendar ships, the act and the directions that decide its days off,
 * the licence that makes crediting it a condition, and the Civil Code article
 * that explains why a statutory period is not a count of working days.
 */

/**
 * The years a count can be answered in: the years the Taiwan Calendar
 * publishes, which are exactly the years this build ships. Kept here rather than
 * read off the shipped files so the tool registry, which Nuxt also reads while
 * loading its configuration, never pulls in the year loader.
 */
export const workingDayCoverage = taiwanCalendarPublishableYears

const firstRocYear = workingDayCoverage.firstYear - rocEpochOffset
const lastRocYear = workingDayCoverage.lastYear - rocEpochOffset

/**
 * The caveats that sit next to every answer. Three are the Taiwan Calendar's
 * own, word for word, because the data and its limits are the same; the other
 * three are what counting adds: a statutory period is not a count, an
 * unannounced year gets no answer, and the dates typed stay on the device.
 */
export const workingDayCaveatKeys = [
  'government-agency-scope',
  'not-a-statutory-period',
  'not-yet-announced',
  'edition-may-change',
  'offline-may-be-outdated',
  'dates-stay-on-device',
] as const

export type WorkingDayCaveatKey = typeof workingDayCaveatKeys[number]

export const workingDayContentReview: ToolContentReview = {
  reviewedAt: '2026-10-18',
  sourceEdition: {
    'zh-tw': `中華民國 ${firstRocYear} 至 ${lastRocYear} 年政府行政機關辦公日曆表（政府資料開放平臺 2026-07-15 更新，114 年採 1141020 修正版）`,
    en: `Government agency office calendars for ROC years ${firstRocYear}–${lastRocYear} (data.gov.tw, updated 15 July 2026; ROC 114 as reissued on 20 October 2025)`,
  },
  sourceEffectiveAt: '2026-07-15',
  sources: [
    {
      title: {
        'zh-tw': '政府資料開放平臺：中華民國政府行政機關辦公日曆表',
        en: 'data.gov.tw: Government agency office calendar of the Republic of China',
      },
      description: {
        'zh-tw': '哪一天是工作天、哪一天放假，都以這份辦公日曆表為準。',
        en: 'Which days are working days and which are days off follows this office calendar.',
      },
      url: 'https://data.gov.tw/dataset/14718',
    },
    {
      title: {
        'zh-tw': '全國法規資料庫：紀念日及節日實施條例',
        en: 'Laws & Regulations Database: Act on Commemoration Days and Holidays',
      },
      description: {
        'zh-tw': '哪些紀念日與節日要放假，以及放假日遇到週末要補假。',
        en: 'Which commemoration days and festivals are days off, and that one falling on a weekend gets a substitute day.',
      },
      url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0020095',
    },
    {
      title: {
        'zh-tw': '行政院人事行政總處：政府機關配合紀念日與節日補假及調整放假處理要點',
        en: 'DGPA: Directions for substitute holidays and adjusted holidays in government agencies',
      },
      description: {
        'zh-tw': '補假與調整放假怎麼排，包括 115 年起不再補班。',
        en: 'How substitute and adjusted days off are arranged, including the end of makeup workdays from 2026.',
      },
      url: 'https://www.dgpa.gov.tw/information?uid=84&pid=12576',
    },
    {
      title: {
        'zh-tw': '全國法規資料庫：民法第 122 條',
        en: 'Laws & Regulations Database: Civil Code, Article 122',
      },
      description: {
        'zh-tw': '法定期間的最後一天遇到休息日才往後順延，和數工作天是不同的規則，所以這個工具不算法定期間。',
        en: 'A statutory period only moves when its last day falls on a day of rest, which is a different rule from counting working days, so this tool does not compute statutory periods.',
      },
      url: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000001&flno=122',
    },
    {
      title: {
        'zh-tw': '政府資料開放授權條款－第 1 版',
        en: 'Open Government Data License, version 1.0',
      },
      description: {
        'zh-tw': '使用辦公日曆表的條件；本站依此標示資料提供機關。',
        en: 'The terms for using the office calendar; this site credits the providing agency under them.',
      },
      url: 'https://data.gov.tw/license',
    },
  ],
}
