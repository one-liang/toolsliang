import { describe, expect, it } from 'vitest'
import {
  describeCurrentYear,
  describeOutsideTable,
  describeRocYearPair,
  describeTableRange,
  describeTableRow,
  formatRocEraYear,
  rocYearCopy,
  rocYearCopyKeys,
  rocYearErrorMessage,
  rocYearFaq,
  validateRocYearContent,
} from '@/features/tools/roc-year-converter/content'
import {
  gregorianToRoc,
  rocYearTableRows,
  type RocYearDirection,
  type RocYearInputErrorCode,
} from '@/features/tools/roc-year-converter/domain/convert'
import { rocYearContentReview } from '@/features/tools/roc-year-converter/domain/sources'
import { getTool, supportedLocales } from '@/features/tools/catalog'

const directions: RocYearDirection[] = ['roc-to-gregorian', 'gregorian-to-roc']
const codes: RocYearInputErrorCode[] = ['empty', 'not-a-number', 'not-whole', 'roc-zero', 'below-range', 'above-range']

function pair(gregorian: number) {
  return { gregorian, roc: gregorianToRoc(gregorian) }
}

function everyVisibleString() {
  const tool = getTool('roc-year-converter')!
  const rows = rocYearTableRows(2026)
  return supportedLocales.flatMap(locale => [
    ...rocYearCopyKeys.map(key => rocYearCopy[key][locale]),
    ...rocYearFaq.flatMap(entry => [entry.heading[locale], entry.body[locale]]),
    ...directions.flatMap(direction => codes.map(code => rocYearErrorMessage(code, direction, locale))),
    ...[1, 1911, 1912, 2026].flatMap(year => directions.flatMap(direction => Object.values(describeRocYearPair(pair(year), direction, locale)))),
    ...[1900, 2050].flatMap(year => directions.map(direction => describeOutsideTable(pair(year), direction, locale))),
    describeCurrentYear(pair(2026), locale),
    describeTableRange(rows, locale),
    ...rows.flatMap(row => Object.values(describeTableRow(row, locale))),
    tool.name[locale], tool.description[locale], tool.acceptedInput[locale], tool.localProcessingStatement[locale],
    tool.seo.title[locale], tool.seo.description[locale], tool.seo.answer[locale],
    tool.contentReview.sourceEdition[locale], ...tool.contentReview.sources.map(source => source.title[locale]),
  ])
}

describe('ROC year converter content', () => {
  it('passes its own validation', () => {
    expect(validateRocYearContent()).toEqual([])
  })

  it('writes years the way Taiwan writes them, in both locales', () => {
    expect(formatRocEraYear({ era: 'roc', year: 115 }, 'zh-tw')).toBe('民國 115 年')
    expect(formatRocEraYear({ era: 'before-roc', yearsBefore: 1 }, 'zh-tw')).toBe('民國前 1 年')
    expect(formatRocEraYear({ era: 'roc', year: 115 }, 'en')).toBe('ROC year 115')
    expect(formatRocEraYear({ era: 'before-roc', yearsBefore: 1 }, 'en')).toBe('1 year before the ROC era')
    expect(formatRocEraYear({ era: 'before-roc', yearsBefore: 12 }, 'en')).toBe('12 years before the ROC era')
  })

  it('leads with the year the visitor did not type, and repeats both in the equation', () => {
    expect(describeRocYearPair(pair(2026), 'roc-to-gregorian', 'zh-tw')).toEqual({
      headline: '西元 2026 年', equation: '民國 115 年 ＝ 西元 2026 年', note: '',
    })
    expect(describeRocYearPair(pair(1911), 'gregorian-to-roc', 'zh-tw')).toMatchObject({
      headline: '民國前 1 年', equation: '西元 1911 年 ＝ 民國前 1 年',
    })
    expect(describeRocYearPair(pair(1912), 'roc-to-gregorian', 'zh-tw').note).toContain('民國元年')
    expect(describeRocYearPair(pair(1911), 'gregorian-to-roc', 'zh-tw').note).toContain('民國前幾年')
  })

  it('never shows an ROC year 0 anywhere on the page', () => {
    for (const value of everyVisibleString()) {
      expect(value, `不得出現民國 0 年：${value}`).not.toMatch(/民國\s*0\s*年/)
      expect(value).not.toMatch(/ROC year 0\b/)
    }
  })

  it('explains every refused value in both locales, and stays quiet for an empty field', () => {
    for (const locale of supportedLocales) {
      for (const direction of directions) {
        expect(rocYearErrorMessage('empty', direction, locale), '空白不是錯誤').toBe('')
        for (const code of codes.filter(item => item !== 'empty')) {
          expect(rocYearErrorMessage(code, direction, locale).trim(), `${locale}/${direction}/${code}`).not.toBe('')
        }
      }
    }
    expect(rocYearErrorMessage('roc-zero', 'roc-to-gregorian', 'zh-tw')).toContain('民國元年')
    expect(rocYearErrorMessage('below-range', 'roc-to-gregorian', 'zh-tw'), '負的民國年要引導改查西元年').toContain('西元年')
  })

  it('states the plain rule — Gregorian year equals ROC year plus 1911 — next to the table and in the sources', () => {
    expect(rocYearCopy.tableFormula['zh-tw']).toContain('西元年＝民國年＋1911')
    expect(rocYearContentReview.sourceEdition['zh-tw']).toContain('西元年＝民國年＋1911')
    expect(rocYearContentReview.sourceEffectiveAt).toBe('1912-01-01')
  })

  it('cites government sources only, over HTTPS', () => {
    const hosts = rocYearContentReview.sources.map(source => new URL(source.url))
    expect(hosts.length).toBeGreaterThanOrEqual(3)
    for (const url of hosts) {
      expect(url.protocol).toBe('https:')
      expect(url.hostname, `${url.hostname} 必須是政府網域`).toMatch(/\.gov\.tw$|\.moe\.edu\.tw$/)
    }
  })

  it('keeps technical vocabulary off the page', () => {
    const technical = /JavaScript|API|Intl|Date\(|algorithm|演算法|程式|瀏覽器 API|localStorage|ECMAScript|parse/i
    for (const value of everyVisibleString()) {
      expect(value).not.toMatch(technical)
    }
  })
})
