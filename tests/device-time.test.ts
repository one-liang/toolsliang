import { describe, expect, it, vi } from 'vitest'
import { formatDeviceTime } from '@/features/tools/device-time/domain/format'

describe('裝置時間格式化', () => {
  it('依指定時區跨越年度日界線並提供機器可讀時間', () => {
    expect(formatDeviceTime({
      instant: Date.parse('2026-12-31T16:00:00Z'), locale: 'zh-tw',
      timeZone: 'Asia/Taipei', offsetMinutes: 480, showSeconds: true,
    })).toEqual({
      ok: true, date: '2027年1月1日', time: '00:00:00',
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
      .toEqual({ ok: true, date: '2027-01-01', time: '00:00', timeZone: undefined, offset: 'UTC+08:00', datetime: '2026-12-31T16:00:01.000Z', reduced: true })
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
})
