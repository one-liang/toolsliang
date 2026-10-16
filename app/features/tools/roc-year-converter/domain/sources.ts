import type { PublishedToolDefinition } from '@/features/tools/catalog'

/**
 * Where the ROC era is defined, all read on the review date from government
 * sites: the Ministry of Education dictionary gives the definition and the year
 * 1912, the Office of the President states 1912 as ROC year 1, and the
 * Department of Household Registration's age table writes the years before it
 * as "民國前 N" — the form this tool uses for 1911 and earlier. The edition line
 * is the plain-language rule those sources add up to, because it is the one
 * sentence a visitor needs to check any answer by hand.
 */
export const rocYearContentReview: PublishedToolDefinition['contentReview'] = {
  reviewedAt: '2026-10-15',
  sourceEdition: {
    'zh-tw': '民國紀年以中華民國成立的 1912 年為民國元年，所以西元年＝民國年＋1911；1911 年以前寫成「民國前幾年」。',
    en: 'The ROC era counts 1912, the year the Republic of China was founded, as ROC year 1, so the Gregorian year is the ROC year plus 1911; years before 1912 are written as years before the ROC era.',
  },
  sourceEffectiveAt: '1912-01-01',
  sources: [
    {
      title: {
        'zh-tw': '教育部《重編國語辭典修訂本》：「民國」',
        en: 'Ministry of Education, Revised Mandarin Chinese Dictionary: “民國”',
      },
      description: {
        'zh-tw': '「民國」紀年的意思，以及它從西元 1912 年起算，都依這個詞條。',
        en: 'What the ROC era means, and that it starts from 1912, follow this entry.',
      },
      url: 'https://dict.revised.moe.edu.tw/dictView.jsp?ID=31797',
    },
    {
      title: {
        'zh-tw': '中華民國總統府：國父－中華民國簡介',
        en: 'Office of the President: Dr. Sun Yat-sen and the founding of the Republic of China',
      },
      description: {
        'zh-tw': '中華民國在 1912 年成立、這一年就是民國元年，依總統府的這份簡介。',
        en: 'That the Republic of China was founded in 1912, which is ROC year 1, follows this page from the Office of the President.',
      },
      url: 'https://www.president.gov.tw/Page/49',
    },
    {
      title: {
        'zh-tw': '內政部戶政司：年歲對照表',
        en: 'Department of Household Registration, Ministry of the Interior: Year comparison table',
      },
      description: {
        'zh-tw': '1911 年以前寫成「民國前幾年」的寫法，依戶政司的這份對照表。',
        en: 'Writing 1911 and earlier as years before the ROC era follows this table from the Department of Household Registration.',
      },
      url: 'https://www.ris.gov.tw/documents/html/8/1/219.html',
    },
  ],
}
