import { describe, expect, it } from 'vitest'
import {
  describeCalendarBreak,
  getBmiDemo,
  getCalendarDemo,
  getNtdDemo,
  pickerDemoNames,
  pickerDemoWinnerIndex,
  wheelLabelPlacements,
} from '@/features/landing/demos'
import { supportedLocales } from '@/features/tools/catalog'

describe('landing demonstrations', () => {
  it('writes the cheque example with the NTD converter itself', () => {
    expect(getNtdDemo()).toEqual({ amount: '128,500', wording: '新臺幣壹拾貳萬捌仟伍佰元整' })
  })

  it('reads the February 2026 holiday run from the shipped calendar data', () => {
    const calendar = getCalendarDemo()
    const breakDates = calendar.weeks.flat().filter(cell => cell?.inBreak).map(cell => cell!.date)

    expect(calendar.weeks).toHaveLength(4)
    expect(calendar.breakHoliday).toBe('spring-festival')
    expect(breakDates).toEqual([
      '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18',
      '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22',
    ])
    expect(describeCalendarBreak(calendar.breakHoliday, calendar.breakLength, 'zh-tw')).toBe('春節連假 9 天')
    expect(describeCalendarBreak(calendar.breakHoliday, calendar.breakLength, 'en')).toBe('Lunar New Year: 9 days off in a row')
  })

  it('places the BMI example on the official band it belongs to', () => {
    for (const locale of supportedLocales) {
      const bmi = getBmiDemo(locale)
      const current = bmi.bands.find(band => band.current)!

      expect(bmi.display).toBe('22.5')
      expect(current.id).toBe('healthy-weight')
      expect(bmi.categoryName).toBe(current.name)
      expect(bmi.position).toBeGreaterThanOrEqual(current.from)
      expect(bmi.position).toBeLessThan(current.to)
      expect(bmi.bands.map(band => band.range)).toEqual(['< 18.5', '18.5–24', '24–27', '≥ 27'])
    }
  })

  it('draws from a placeholder list with a fixed landing name', () => {
    for (const locale of supportedLocales) {
      expect(pickerDemoNames[locale][pickerDemoWinnerIndex]).toBeTruthy()
    }
  })

  it('rests the wheel with the drawn name under the pointer and every name upright', () => {
    const count = pickerDemoNames['zh-tw'].length
    const { restingRotation, labels } = wheelLabelPlacements(count, pickerDemoWinnerIndex, 68)
    const winner = labels[pickerDemoWinnerIndex]!

    expect(((winner.start + winner.end) / 2 + restingRotation) % 360).toBe(270)
    for (const label of labels) {
      expect(Math.abs(label.restingTilt), '輪盤停下時名字不得倒置或直立').toBeLessThan(90)
    }
  })
})
