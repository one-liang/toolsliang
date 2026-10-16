import { describe, expect, it } from 'vitest'
import {
  gregorianToRoc,
  lookUpYear,
  rocFirstGregorianYear,
  rocToGregorian,
  rocYearOffset,
  rocYearSupportedRange,
  rocYearTableRows,
} from '@/features/tools/roc-year-converter/domain/convert'

describe('ROC year conversion', () => {
  it('counts 1912 as ROC year 1 and adds 1911 to every ROC year', () => {
    expect(rocYearOffset).toBe(1911)
    expect(rocFirstGregorianYear).toBe(1912)
    expect(rocToGregorian({ era: 'roc', year: 1 })).toBe(1912)
    expect(gregorianToRoc(1912)).toEqual({ era: 'roc', year: 1 })
    expect(rocToGregorian({ era: 'roc', year: 115 })).toBe(2026)
    expect(gregorianToRoc(2026)).toEqual({ era: 'roc', year: 115 })
  })

  it('counts the years before 1912 backwards, so 1911 is 1 year before and never year 0', () => {
    expect(gregorianToRoc(1911)).toEqual({ era: 'before-roc', yearsBefore: 1 })
    expect(gregorianToRoc(1910)).toEqual({ era: 'before-roc', yearsBefore: 2 })
    expect(gregorianToRoc(1900)).toEqual({ era: 'before-roc', yearsBefore: 12 })
    expect(rocToGregorian({ era: 'before-roc', yearsBefore: 1 })).toBe(1911)
  })

  it('round-trips every supported Gregorian year without ever naming year 0', () => {
    for (let gregorian = rocYearSupportedRange.gregorian.min; gregorian <= rocYearSupportedRange.gregorian.max; gregorian += 1) {
      const roc = gregorianToRoc(gregorian)
      expect(rocToGregorian(roc)).toBe(gregorian)
      if (roc.era === 'roc') expect(roc.year).toBeGreaterThan(0)
      else expect(roc.yearsBefore).toBeGreaterThan(0)
    }
  })

  it('looks up both directions from what a visitor types', () => {
    expect(lookUpYear('1', 'roc-to-gregorian')).toEqual({
      state: 'ready', direction: 'roc-to-gregorian', pair: { gregorian: 1912, roc: { era: 'roc', year: 1 } },
    })
    expect(lookUpYear('115', 'roc-to-gregorian')).toMatchObject({ state: 'ready', pair: { gregorian: 2026 } })
    expect(lookUpYear('2026', 'gregorian-to-roc')).toMatchObject({ state: 'ready', pair: { roc: { era: 'roc', year: 115 } } })
    expect(lookUpYear('1912', 'gregorian-to-roc')).toMatchObject({ state: 'ready', pair: { roc: { era: 'roc', year: 1 } } })
    expect(lookUpYear('1911', 'gregorian-to-roc')).toMatchObject({ state: 'ready', pair: { roc: { era: 'before-roc', yearsBefore: 1 } } })
  })

  it('reads full-width digits typed with a Chinese input method, and surrounding spaces', () => {
    expect(lookUpYear('１１５', 'roc-to-gregorian')).toMatchObject({ state: 'ready', pair: { gregorian: 2026 } })
    expect(lookUpYear(' 2026 ', 'gregorian-to-roc')).toMatchObject({ state: 'ready', pair: { roc: { year: 115 } } })
    expect(lookUpYear('115.0', 'roc-to-gregorian')).toMatchObject({ state: 'ready', pair: { gregorian: 2026 } })
  })

  it('refuses ROC year 0 with its own reason instead of answering it', () => {
    expect(lookUpYear('0', 'roc-to-gregorian')).toEqual({ state: 'error', direction: 'roc-to-gregorian', code: 'roc-zero' })
    expect(lookUpYear('０', 'roc-to-gregorian')).toMatchObject({ code: 'roc-zero' })
    expect(lookUpYear('-0', 'roc-to-gregorian')).toMatchObject({ code: 'roc-zero' })
  })

  it('names what is wrong with a value it cannot use', () => {
    expect(lookUpYear('', 'roc-to-gregorian')).toMatchObject({ state: 'error', code: 'empty' })
    expect(lookUpYear('   ', 'gregorian-to-roc')).toMatchObject({ state: 'error', code: 'empty' })
    expect(lookUpYear('民國115年', 'roc-to-gregorian')).toMatchObject({ code: 'not-a-number' })
    expect(lookUpYear('1e3', 'gregorian-to-roc')).toMatchObject({ code: 'not-a-number' })
    expect(lookUpYear('2,026', 'gregorian-to-roc')).toMatchObject({ code: 'not-a-number' })
    expect(lookUpYear('115.5', 'roc-to-gregorian')).toMatchObject({ code: 'not-whole' })
    expect(lookUpYear('-5', 'roc-to-gregorian')).toMatchObject({ code: 'below-range' })
    expect(lookUpYear('0', 'gregorian-to-roc')).toMatchObject({ code: 'below-range' })
    expect(lookUpYear(String(rocYearSupportedRange.roc.max + 1), 'roc-to-gregorian')).toMatchObject({ code: 'above-range' })
    expect(lookUpYear('10000', 'gregorian-to-roc')).toMatchObject({ code: 'above-range' })
  })

  it('keeps the supported bounds on four-digit Gregorian years', () => {
    expect(lookUpYear(String(rocYearSupportedRange.roc.max), 'roc-to-gregorian')).toMatchObject({ pair: { gregorian: 9999 } })
    expect(lookUpYear('1', 'gregorian-to-roc')).toMatchObject({ pair: { roc: { era: 'before-roc', yearsBefore: 1911 } } })
  })

  it('lists ROC year 1 up to ten years after the current year, one row per year', () => {
    const rows = rocYearTableRows(2026)

    expect(rows[0]).toEqual({ gregorian: 1912, roc: { era: 'roc', year: 1 } })
    expect(rows.at(-1)).toEqual({ gregorian: 2036, roc: { era: 'roc', year: 125 } })
    expect(rows).toHaveLength(125)
    expect(rows.find(row => row.gregorian === 2026)?.roc).toEqual({ era: 'roc', year: 115 })
    expect(rows.every(row => row.roc.era === 'roc' && row.roc.year > 0)).toBe(true)
  })

  it('follows the clock it is given rather than a year fixed at build time', () => {
    expect(rocYearTableRows(2030).at(-1)?.gregorian).toBe(2040)
    expect(rocYearTableRows(1900), '裝置時鐘早於 1912 年時仍至少列出民國元年').toEqual([{ gregorian: 1912, roc: { era: 'roc', year: 1 } }])
  })
})
