import { describe, expect, it, vi } from 'vitest'
import { formatDeviceTime } from '@/features/tools/device-time/domain/format'
import {
  defaultHourCycle, HOUR_CYCLE_STORAGE_KEY, normalizeHourCycle, persistHourCycle, readStoredHourCycle,
  type ClockConvention,
} from '@/features/tools/device-time/domain/hour-cycle'

describe('裝置時間格式化', () => {
  it('依指定時區跨越年度日界線並提供機器可讀時間', () => {
    expect(formatDeviceTime({
      instant: Date.parse('2026-12-31T16:00:00Z'), locale: 'zh-tw',
      timeZone: 'Asia/Taipei', offsetMinutes: 480, showSeconds: true,
    })).toEqual({
      ok: true, date: '2027年1月1日', time: '00:00:00',
      timeParts: [{ type: 'clock', value: '00:00:00' }], hourCycle: 'h23',
      timeZone: 'Asia/Taipei', offset: 'UTC+08:00',
      datetime: '2026-12-31T16:00:00.000Z', reduced: false,
    })
  })

  it.each([
    ['2026-03-08T06:59:59Z', 'America/New_York', '01:59:59', 'UTC-05:00'],
    ['2026-03-08T07:00:00Z', 'America/New_York', '03:00:00', 'UTC-04:00'],
    ['2026-11-01T05:59:59Z', 'America/New_York', '01:59:59', 'UTC-04:00'],
    ['2026-11-01T06:00:00Z', 'America/New_York', '01:00:00', 'UTC-05:00'],
    ['2026-01-01T00:00:00Z', 'Asia/Kathmandu', '05:45:00', 'UTC+05:45'],
    ['2026-01-01T00:00:00Z', 'Pacific/Marquesas', '14:30:00', 'UTC-09:30'],
    ['2026-01-01T00:00:00Z', 'UTC', '00:00:00', 'UTC+00:00'],
  ])('依瀏覽器時區資料處理 DST 與非整點 offset：%s %s', (instant, timeZone, time, offset) => {
    expect(formatDeviceTime({ instant: Date.parse(instant), timeZone, locale: 'en', offsetMinutes: 0, showSeconds: true }))
      .toMatchObject({ ok: true, time, offset, reduced: false })
  })

  it('以英文顯示閏日並可省略秒數', () => {
    expect(formatDeviceTime({ instant: Date.parse('2024-02-29T23:59:59Z'), timeZone: 'UTC', locale: 'en', offsetMinutes: 0, showSeconds: false }))
      .toMatchObject({ date: 'February 29, 2024', time: '23:59' })
  })

  it('時區不可用時依注入的裝置 offset 顯示基本本機時間', () => {
    expect(formatDeviceTime({ instant: Date.parse('2026-12-31T16:00:01Z'), locale: 'zh-tw', offsetMinutes: 480, showSeconds: false }))
      .toEqual({ ok: true, date: '2027-01-01', time: '00:00', timeParts: [{ type: 'clock', value: '00:00' }], hourCycle: 'h23', timeZone: undefined, offset: 'UTC+08:00', datetime: '2026-12-31T16:00:01.000Z', reduced: true })
  })

  it('Intl parts 不可用時仍顯示基本時間，不丟出瀏覽器例外', () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockImplementation(() => { throw new Error('unsupported') })
    try {
      expect(formatDeviceTime({ instant: 0, locale: 'en', timeZone: 'UTC', offsetMinutes: -210, showSeconds: true }))
        .toMatchObject({ ok: true, date: '1969-12-31', time: '20:30:00', offset: 'UTC-03:30', reduced: true })
    }
    finally { spy.mockRestore() }
  })

  it.each([NaN, Infinity, 9e15])('對無效裝置時間回傳穩定錯誤：%s', (instant) => {
    expect(formatDeviceTime({ instant, locale: 'en', offsetMinutes: 0, showSeconds: true }))
      .toEqual({ ok: false, error: 'invalid-time' })
  })

  it.each([
    ['zh-tw', '2031-07-08T09:10:11Z', '下午5:10:11', [{ type: 'dayPeriod', value: '下午' }, { type: 'clock', value: '5:10:11' }]],
    ['zh-tw', '2031-07-07T16:00:00Z', '上午12:00:00', [{ type: 'dayPeriod', value: '上午' }, { type: 'clock', value: '12:00:00' }]],
    ['zh-tw', '2031-07-08T04:00:00Z', '下午12:00:00', [{ type: 'dayPeriod', value: '下午' }, { type: 'clock', value: '12:00:00' }]],
    ['en', '2031-07-08T09:10:11Z', '5:10:11 PM', [{ type: 'clock', value: '5:10:11' }, { type: 'literal', value: ' ' }, { type: 'dayPeriod', value: 'PM' }]],
    ['en', '2031-07-07T16:00:00Z', '12:00:00 AM', [{ type: 'clock', value: '12:00:00' }, { type: 'literal', value: ' ' }, { type: 'dayPeriod', value: 'AM' }]],
  ] as const)('12 小時制以 %s 寫出上午／下午或 AM／PM：%s', (locale, instant, time, timeParts) => {
    expect(formatDeviceTime({ instant: Date.parse(instant), locale, timeZone: 'Asia/Taipei', offsetMinutes: 480, showSeconds: true, hourCycle: 'h12' }))
      .toMatchObject({ ok: true, time, timeParts, hourCycle: 'h12', reduced: false })
  })

  it('12 小時制關閉秒數時只省略秒，不改變上午／下午', () => {
    expect(formatDeviceTime({ instant: Date.parse('2031-07-08T01:05:09Z'), locale: 'zh-tw', timeZone: 'Asia/Taipei', offsetMinutes: 480, showSeconds: false, hourCycle: 'h12' }))
      .toMatchObject({ time: '上午9:05' })
  })

  it.each([
    ['zh-tw', 480, '2026-12-31T16:00:01Z', '上午12:00:01'],
    ['zh-tw', 480, '2027-01-01T05:30:00Z', '下午1:30:00'],
    ['en', -210, '1970-01-01T00:00:00Z', '8:30:00 PM'],
    ['en', 0, '2026-01-01T11:59:59Z', '11:59:59 AM'],
  ] as const)('時區不可用時，12 小時制仍依語系寫出上午／下午：%s %s', (locale, offsetMinutes, instant, time) => {
    expect(formatDeviceTime({ instant: Date.parse(instant), locale, offsetMinutes, showSeconds: true, hourCycle: 'h12' }))
      .toMatchObject({ ok: true, time, hourCycle: 'h12', reduced: true })
  })
})

describe('12／24 小時制偏好', () => {
  const conventions = (device: ClockConvention | undefined, pages: Record<string, ClockConvention> = {
    'zh-TW': { locale: 'zh-TW', hourCycle: 'h12' }, 'en-US': { locale: 'en-US', hourCycle: 'h12' },
  }) => (tag?: string) => tag ? pages[tag] : device

  it.each([
    ['en', { locale: 'en-GB', hourCycle: 'h23' }, 'h23'],
    ['en', { locale: 'en-US', hourCycle: 'h12' }, 'h12'],
    ['zh-tw', { locale: 'zh-CN', hourCycle: 'h23' }, 'h23'],
    ['zh-tw', { locale: 'zh-TW', hourCycle: 'h23' }, 'h23'],
    ['zh-tw', { locale: 'en-GB', hourCycle: 'h23' }, 'h12'],
    ['en', { locale: 'zh-TW', hourCycle: 'h12' }, 'h12'],
    ['en', { locale: 'en-AU', hour12: false }, 'h23'],
    ['en', { locale: 'en-US', hourCycle: 'h11' }, 'h12'],
    ['zh-tw', { locale: 'zh-HK', hourCycle: 'h24' }, 'h23'],
  ] as const)('預設依語系與裝置設定：%s 頁面、裝置 %o → %s', (locale, device, expected) => {
    expect(defaultHourCycle(locale, conventions(device))).toBe(expected)
  })

  it('讀不到任何慣例時回到 24 小時制', () => {
    expect(defaultHourCycle('zh-tw', () => undefined)).toBe('h23')
    expect(defaultHourCycle('en', conventions({ locale: 'en-US' }, {}))).toBe('h23')
  })

  it('只在使用者切換後寫入，並拒絕無法辨識的值', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    expect(readStoredHourCycle(storage)).toBeNull()
    expect(values.size).toBe(0)
    expect(persistHourCycle(storage, 'h12')).toBe(true)
    expect(values.get(HOUR_CYCLE_STORAGE_KEY)).toBe('h12')
    expect(readStoredHourCycle(storage)).toBe('h12')
    values.set(HOUR_CYCLE_STORAGE_KEY, '12')
    expect(readStoredHourCycle(storage)).toBeNull()
    expect(normalizeHourCycle('h24')).toBeNull()
  })

  it('儲存空間被封鎖時安全降級為預設', () => {
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
    expect(readStoredHourCycle(blocked)).toBeNull()
    expect(persistHourCycle(blocked, 'h23')).toBe(false)
    expect(readStoredHourCycle(null)).toBeNull()
  })
})
