import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ToolPage from '@/pages/[locale]/tools/[slug].vue'
import { savedToolsGlobals, setTestRoute } from './support/nuxt-stubs'

let page: VueWrapper

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date('2026-12-31T16:00:00.250Z'))
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    locale: 'en-US', calendar: 'gregory', numberingSystem: 'latn', timeZone: 'Asia/Taipei',
  })
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
})

afterEach(() => {
  page?.unmount()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function openTool(locale = 'zh-tw') {
  setTestRoute({ path: `/${locale}/tools/device-time/`, params: { locale, slug: 'device-time' } })
  page = mount(ToolPage, { global: savedToolsGlobals() })
  await flushPromises()
  await vi.waitFor(() => expect(page.find('[data-device-clock]').exists()).toBe(true))
  return page
}

describe('裝置時間公開工具頁', () => {
  it('提供裝置日期、時間、時區及 offset，讀值不主動廣播', async () => {
    await openTool()
    expect(page.get('h1').text()).toBe('裝置時間')
    expect(page.get('[data-device-clock]').text()).toContain('2027年1月1日')
    expect(page.get('[data-device-clock] time').text()).toBe('00:00:00')
    expect(page.get('[data-device-clock] time').attributes('datetime')).toMatch(/^2026-12-31T16:00:00\.\d{3}Z$/)
    expect(page.get('[data-device-clock]').attributes('aria-live')).toBe('off')
    expect(page.get('[data-device-clock]').text()).toContain('Asia/Taipei')
    expect(page.get('[data-device-clock]').text()).toContain('UTC+08:00')
  })

  it('秒數依時鐘邊界更新，關閉秒數後直到下一分鐘才更新', async () => {
    await openTool()
    await vi.advanceTimersByTimeAsync(1000)
    expect(page.get('[data-device-clock] time').text()).toBe('00:00:01')
    await page.get('[data-seconds-toggle]').trigger('click')
    expect(page.get('[data-device-clock] time').text()).toBe('00:00')
    const datetime = page.get('[data-device-clock] time').attributes('datetime')
    await vi.advanceTimersByTimeAsync(58_000)
    expect(page.get('[data-device-clock] time').attributes('datetime')).toBe(datetime)
    await vi.advanceTimersByTimeAsync(1000)
    expect(page.get('[data-device-clock] time').text()).toBe('00:01')
  })

  it('背景頁面完全停止更新，回到前景立即校正裝置時鐘與時區', async () => {
    await openTool()
    const before = page.get('[data-device-clock]').text()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(120_000)
    expect(page.get('[data-device-clock]').text()).toBe(before)
    expect(vi.getTimerCount()).toBe(0)
    vi.setSystemTime(new Date('2027-01-02T05:06:07Z'))
    vi.mocked(Intl.DateTimeFormat.prototype.resolvedOptions).mockReturnValue({ locale: 'en-US', calendar: 'gregory', numberingSystem: 'latn', timeZone: 'America/New_York' })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(page.get('[data-device-clock] time').text()).toBe('00:06:07')
    expect(page.get('[data-device-clock]').text()).toContain('America/New_York')
    expect(page.get('[data-device-clock]').text()).toContain('UTC-05:00')
    page.unmount()
    expect(vi.getTimerCount()).toBe(0)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('複製目前顯示的資訊並可重試被拒絕的剪貼簿操作', async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(undefined)
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard)
    await openTool('en')
    await page.get('[data-copy-time]').trigger('click')
    await flushPromises()
    expect(page.get('[role="status"]').text()).toContain('Could not copy')
    await page.get('[data-copy-time]').trigger('click')
    await flushPromises()
    expect(page.get('[role="status"]').text()).toBe('Time information copied.')
    expect(writeText).toHaveBeenLastCalledWith('January 1, 2027\n00:00:00\nAsia/Taipei · UTC+08:00\nDevice time; not network-corrected.')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('無法讀取 Intl 時區時，提供基本時間與能力說明', async () => {
    vi.mocked(Intl.DateTimeFormat.prototype.resolvedOptions).mockImplementation(() => { throw new Error('unavailable') })
    await openTool()
    expect(page.get('[data-device-clock] time').text()).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(page.get('[data-clock-capability]').text()).toContain('基本本機時間')
  })

  it.each(['zh-tw', 'en'])('以 %s 提供可見 FAQ 並說明讀值與設定不保存', async (locale) => {
    await openTool(locale)
    expect(page.get('.tool-contract--faq').text()).toContain(locale === 'en' ? 'Why can device time be wrong?' : '為什麼裝置時間可能不準確？')
    expect(page.get('.tool-contract--faq').text()).toContain(locale === 'en' ? 'Seconds display is not saved' : '秒數顯示設定也不會保存')
  })
})
