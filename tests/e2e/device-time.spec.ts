import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { gotoHydrated, waitForHydration } from './support/hydration'
import { inspectNetworkRequest, inspectWebSocketFrame } from './support/privacy-boundary'

const instant = '2031-07-08T09:10:11Z'
/**
 * The fake clock has to start before the instant it pauses at. `pauseAt` fast-forwards
 * and refuses to move backwards, and the installed clock keeps running in real time
 * until then: starting exactly at the instant failed whenever the page read the clock
 * (the workspace's own one-second tick) between the two calls.
 */
const clockStart = Date.parse(instant) - 60_000
// Sub-pixel layout can report a 44px target as 43.99994; the same tolerance as the App Shell gate.
const TOUCH_TARGET_TOLERANCE_PX = 0.001
const canaries = [
  { label: '裝置時間', value: '5:10:11' },
  { label: '裝置日期', value: '2031年7月8日' },
  { label: '英文裝置日期', value: 'July 8, 2031' },
  { label: '裝置時間戳', value: instant },
  { label: '裝置時區', value: 'Asia/Taipei' },
  { label: '裝置 UTC 時差', value: 'UTC+08:00' },
]

test.use({ timezoneId: 'Asia/Taipei' })

for (const locale of ['zh-tw', 'en'] as const) {
  test(`${locale} 裝置時間可由目錄找到，SSR metadata 與 FAQ 完整`, async ({ page, request }) => {
    const route = `/${locale}/tools/device-time/`
    const response = await request.get(route)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(locale === 'en' ? 'Why can device time be wrong?' : '為什麼裝置時間可能不準確？')
    expect(html).not.toContain('data-device-clock')
    expect(html).not.toContain('2031-07-08')
    await gotoHydrated(page, `/${locale}/tools/`)
    await page.locator('.tool-card').filter({ hasText: locale === 'en' ? 'Device Time' : '裝置時間' }).click()
    await expect(page).toHaveURL(new RegExp(`${route}$`))
    await expect(page.locator('[data-device-clock] time')).toBeVisible()
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://toolsliang.com${route}`)
    for (const [lang, prefix] of [['zh-Hant-TW', 'zh-tw'], ['en', 'en'], ['x-default', 'zh-tw']]) {
      await expect(page.locator(`link[hreflang="${lang}"]`)).toHaveAttribute('href', `https://toolsliang.com/${prefix}/tools/device-time/`)
    }
    const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}')['@graph']
    const faq = graph.find((item: { '@type': string }) => item['@type'] === 'FAQPage')
    expect(faq.mainEntity).toHaveLength(4)
    for (const entry of faq.mainEntity) {
      await expect(page.locator('.tool-contract--faq')).toContainText(entry.name)
      await expect(page.locator('.tool-contract--faq')).toContainText(entry.acceptedAnswer.text)
    }
    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).toContain(`https://toolsliang.com${route}`)
  })

  test(`${locale} 鍵盤、複製回饋與本機隱私邊界`, async ({ page, context }, testInfo) => {
    const findings: string[] = []
    context.on('request', request => findings.push(...inspectNetworkRequest({
      url: request.url(), method: request.method(), headers: request.headers(), body: request.postData(),
    }, canaries, { allowedOrigins: ['http://127.0.0.1:4173'] })))
    page.on('websocket', (socket) => {
      findings.push(...inspectNetworkRequest({ url: socket.url(), method: 'WEBSOCKET', headers: {}, body: null }, canaries, { allowedOrigins: ['http://127.0.0.1:4173'] }))
      socket.on('framesent', event => findings.push(...inspectWebSocketFrame(socket.url(), event.payload, canaries, { allowedOrigins: ['http://127.0.0.1:4173'] })))
    })
    page.on('pageerror', () => findings.push('未捕捉例外'))
    page.on('console', message => {
      if (message.type() === 'error' || canaries.some(canary => message.text().includes(canary.value))) findings.push('主控台錯誤或工具內容')
    })
    await page.addInitScript(() => {
      let attempts = 0
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async (value: string) => {
          if (++attempts === 1) throw new Error('denied')
          Object.assign(window, { copiedTime: value })
        },
      } })
    })
    await gotoHydrated(page, `/${locale}/tools/device-time/`)
    await page.locator('[data-device-clock]').waitFor()
    await page.clock.install({ time: clockStart })
    await page.clock.pauseAt(new Date(instant))
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    const clock = page.locator('[data-device-clock]')
    // An en-US device: the English page keeps its 12-hour clock, the Chinese page writes zh-TW's 下午.
    await expect(clock.locator('time')).toHaveText(locale === 'en' ? '5:10:11 PM' : '下午5:10:11')
    await expect(clock).toContainText('Asia/Taipei')
    await expect(clock).toContainText('UTC+08:00')
    await expect(clock).toHaveAttribute('aria-live', 'off')
    const toggle = page.getByRole('button', { name: locale === 'en' ? 'Show seconds' : '顯示秒數', exact: true })
    await toggle.focus()
    await page.keyboard.press('Space')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(clock.locator('time')).toHaveText(locale === 'en' ? '5:10 PM' : '下午5:10')
    await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
    await expect(page.locator('[data-fullscreen-open]')).toBeFocused()
    await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
    const copy = page.getByRole('button', { name: locale === 'en' ? 'Copy time information' : '複製時間資訊' })
    await expect(copy).toBeFocused()
    expect(await copy.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page.locator('.device-time [role="status"]')).toContainText(locale === 'en' ? 'Could not copy' : '無法複製')
    await page.keyboard.press('Enter')
    await expect(page.locator('.device-time [role="status"]')).toHaveText(locale === 'en' ? 'Time information copied.' : '已複製時間資訊。')
    expect(await page.evaluate(() => Reflect.get(window, 'copiedTime'))).toContain(`${locale === 'en' ? '5:10 PM' : '下午5:10'}\nAsia/Taipei · UTC+08:00`)
    expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 })
    expect(findings).toEqual([])
  })

  test(`${locale} 響應式、light/dark、文字間距及 WCAG 2.2 AA`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoHydrated(page, `/${locale}/tools/device-time/`)
    await expect(page.locator('[data-device-clock]')).toBeVisible()
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect.poll(() => page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }))).toEqual({ viewport: width, content: width })
      for (const control of await page.locator('.device-time button').all()) {
        const box = await control.boundingBox()
        expect(box!.width + TOUCH_TARGET_TOLERANCE_PX).toBeGreaterThanOrEqual(44)
        expect(box!.height + TOUCH_TARGET_TOLERANCE_PX).toBeGreaterThanOrEqual(44)
      }
    }
    await page.setViewportSize({ width: 375, height: 812 })
    await page.locator('[data-copy-time]').focus()
    await expect.poll(async () => {
      const button = await page.locator('[data-copy-time]').boundingBox()
      const navigation = await page.locator('.mobile-nav').boundingBox()
      return button!.y + button!.height <= navigation!.y
    }).toBe(true)
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: locale === 'en' ? 'Toggle color theme' : '切換色彩模式' }).click()
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
      if (testInfo.project.name === 'chromium') await page.screenshot({ path: `artifacts/device-time-${locale}-${theme}-375.png`, fullPage: true })
    }
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.locator('body').evaluate(element => element.style.zoom = '2')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('背景停止更新、回到前景校正', async ({ page }) => {
  await page.clock.install({ time: clockStart })
  await page.clock.pauseAt(new Date(instant))
  await gotoHydrated(page, '/en/tools/device-time/')
  await page.locator('[data-hour-cycle="h23"]').check()
  const clock = page.locator('[data-device-clock] time')
  await expect(clock).toHaveText('17:10:11')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.runFor(120_000)
  await expect(clock).toHaveText('17:10:11')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(clock).toHaveText('17:12:11')
})

test('單次更新符合 16ms 預算', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/device-time/')
  await expect(page.locator('[data-device-clock]')).toBeVisible()
  const durations = await page.evaluate(async () => {
    const samples: number[] = []
    for (let i = 0; i < 12; i++) {
      const start = performance.now()
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      samples.push(performance.now() - start)
    }
    return samples
  })
  expect(Math.max(...durations)).toBeLessThanOrEqual(16)
})

test('Intl 時區失效時顯示基本本機時間與說明', async ({ page }) => {
  await page.addInitScript(() => {
    Intl.DateTimeFormat.prototype.resolvedOptions = () => { throw new Error('unsupported') }
  })
  await gotoHydrated(page, '/en/tools/device-time/')
  await expect(page.locator('[data-clock-capability]')).toContainText('basic local time')
  await expect(page.locator('[data-device-clock] time')).toHaveText(/^\d{2}:\d{2}:\d{2}$/)
})

test('裝置時間首次載入後可離線重新啟動，快取不保存讀值', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service Worker 生命週期只在 Chromium 可驗證')
  await gotoHydrated(page, '/zh-tw/tools/device-time/')
  await expect(page.locator('[data-device-clock]')).toBeVisible()
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-device-clock] time')).toHaveText(/^[上下]午\d{1,2}:\d{2}:\d{2}$/)
    await page.locator('[data-seconds-toggle]').click()
    await expect(page.locator('[data-device-clock] time')).toHaveText(/^[上下]午\d{1,2}:\d{2}$/)
    const cached = await page.evaluate(async () => {
      const results: string[] = []
      for (const name of await caches.keys()) {
        const cache = await caches.open(name)
        for (const request of await cache.keys()) {
          if (request.url.includes('/tools/device-time/')) results.push(await (await cache.match(request))!.text())
        }
      }
      return results
    })
    expect(cached.length).toBeGreaterThan(0)
    expect(cached.every(html => !html.includes('data-device-clock'))).toBe(true)
  }
  finally { await context.setOffline(false) }
})

const HOUR_CYCLE_STORAGE_KEY = 'toolsliang-device-time-hour-cycle'
const twelveHour = { 'zh-tw': /^[上下]午\d{1,2}:\d{2}:\d{2}$/, 'en': /^\d{1,2}:\d{2}:\d{2} [AP]M$/ }
const twentyFourHour = /^\d{2}:\d{2}:\d{2}$/

for (const locale of ['zh-tw', 'en'] as const) {
  test(`${locale} 鍵盤切換 12／24 小時制，重新整理與全螢幕都沿用，只保存介面偏好`, async ({ page }) => {
    await gotoHydrated(page, `/${locale}/tools/device-time/`)
    const time = page.locator('[data-device-clock] time')
    const h12 = page.locator('[data-hour-cycle="h12"]')
    const h23 = page.locator('[data-hour-cycle="h23"]')
    await expect(h12).toBeChecked()
    await expect(time).toHaveText(twelveHour[locale])
    expect(await page.evaluate(() => localStorage.length), '使用者切換前不寫入').toBe(0)
    await h12.focus()
    await page.keyboard.press('ArrowRight')
    await expect(h23).toBeChecked()
    await expect(time).toHaveText(twentyFourHour)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForHydration(page)
    await expect(h23).toBeChecked()
    await expect(time).toHaveText(twentyFourHour)
    await page.locator('[data-fullscreen-open]').click()
    await expect(page.locator('[data-device-clock-fullscreen] time')).toHaveText(twentyFourHour)
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({ [HOUR_CYCLE_STORAGE_KEY]: 'h23' })
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
  })
}

test.describe('預設跟隨裝置設定', () => {
  test.use({ locale: 'en-GB' })

  test('英文頁面跟隨 en-GB 裝置的 24 小時制，中文頁面仍依 zh-TW 寫出上午／下午', async ({ page }) => {
    await gotoHydrated(page, '/en/tools/device-time/')
    await expect(page.locator('[data-hour-cycle="h23"]')).toBeChecked()
    await expect(page.locator('[data-device-clock] time')).toHaveText(twentyFourHour)
    await gotoHydrated(page, '/zh-tw/tools/device-time/')
    await expect(page.locator('[data-hour-cycle="h12"]')).toBeChecked()
    await expect(page.locator('[data-device-clock] time')).toHaveText(twelveHour['zh-tw'])
    expect(await page.evaluate(() => localStorage.length)).toBe(0)
  })
})

/** iPhone Safari has no element full screen; this is what the page sees there. */
async function withoutFullscreenApi(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { configurable: true, get: () => false })
    Reflect.deleteProperty(Element.prototype, 'requestFullscreen')
  })
}

for (const mode of ['browser', 'in-page'] as const) {
  test(`鍵盤進入與離開全螢幕，離開後焦點回到按鈕（${mode === 'browser' ? '瀏覽器全螢幕' : '頁面內滿版'}）`, async ({ page, browserName }) => {
    if (mode === 'in-page') await withoutFullscreenApi(page)
    await gotoHydrated(page, '/zh-tw/tools/device-time/')
    const open = page.locator('[data-fullscreen-open]')
    const view = page.locator('[data-device-clock-fullscreen]')
    const exit = page.locator('[data-fullscreen-exit]')
    await expect(open).toBeEnabled()
    await open.focus()
    await page.keyboard.press('Enter')
    await expect(view).toBeVisible()
    await expect(view).toHaveAttribute('role', 'dialog')
    await expect(view).toContainText('裝置時間')
    await expect(view).toContainText('未經網路校時')
    await expect(view).toContainText('Asia/Taipei · UTC+08:00')
    await expect(view.locator('time')).toHaveText(twelveHour['zh-tw'])
    await expect(exit).toBeFocused()
    const isFullscreen = () => page.evaluate(() => document.fullscreenElement?.hasAttribute('data-device-clock-fullscreen') ?? false)
    if (mode === 'in-page') expect(await isFullscreen()).toBe(false)
    // Headless Chromium grants element full screen; the other engines may fall back to the in-page layer.
    else if (browserName === 'chromium') await expect.poll(isFullscreen).toBe(true)
    expect(await view.evaluate(element => {
      const box = element.getBoundingClientRect()
      return [box.left, box.top, Math.round(box.width), Math.round(box.height)]
    })).toEqual([0, 0, ...await page.evaluate(() => [innerWidth, innerHeight])])
    await page.keyboard.press('Tab')
    await expect(exit, '焦點留在全螢幕畫面內').toBeFocused()
    await page.keyboard.press('Escape')
    await expect(view).toHaveCount(0)
    await expect(open).toBeFocused()
    await expect.poll(isFullscreen).toBe(false)
    await page.keyboard.press('Space')
    await expect(exit).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(view).toHaveCount(0)
    await expect(open).toBeFocused()
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull()
  })
}

const fullscreenLayouts = [
  { name: '手機直式', width: 375, height: 812 },
  { name: '手機橫式', width: 812, height: 375 },
  { name: '桌面', width: 1440, height: 900 },
]

for (const locale of ['zh-tw', 'en'] as const) {
  test(`${locale} 全螢幕字體依視窗縮放，手機直式、橫式與桌面都不溢出`, async ({ page }, testInfo) => {
    await withoutFullscreenApi(page)
    // 12:59:59 in Taipei is the longest reading either hour cycle can show.
    await page.clock.install({ time: Date.parse('2031-07-08T04:58:59Z') })
    await page.clock.pauseAt(new Date('2031-07-08T04:59:59Z'))
    await gotoHydrated(page, `/${locale}/tools/device-time/`)
    for (const hourCycle of ['h12', 'h23'] as const) {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.locator(`[data-hour-cycle="${hourCycle}"]`).check()
      await page.locator('[data-fullscreen-open]').click()
      const view = page.locator('[data-device-clock-fullscreen]')
      await expect(view.locator('time')).toHaveText(hourCycle === 'h23' ? '12:59:59' : locale === 'en' ? '12:59:59 PM' : '下午12:59:59')
      const sizes: number[] = []
      for (const layout of fullscreenLayouts) {
        await page.setViewportSize(layout)
        const metrics = await view.evaluate((element) => {
          const outside = [...element.querySelectorAll('header, p, time, button')].filter((child) => {
            const box = child.getBoundingClientRect()
            return box.left < 0 || box.top < 0 || box.right > innerWidth + .5 || box.bottom > innerHeight + .5
          }).map(child => child.className)
          return {
            outside,
            scroll: [element.scrollWidth <= element.clientWidth, element.scrollHeight <= element.clientHeight],
            fontSize: Number.parseFloat(getComputedStyle(element.querySelector('time')!).fontSize),
          }
        })
        expect(metrics.outside, `${layout.name} ${hourCycle} 沒有元素超出視窗`).toEqual([])
        expect(metrics.scroll, `${layout.name} ${hourCycle} 沒有捲動溢出`).toEqual([true, true])
        sizes.push(metrics.fontSize)
        if (testInfo.project.name === 'chromium' && hourCycle === 'h12') {
          await page.screenshot({ path: `artifacts/device-time-fullscreen-${locale}-${layout.width}x${layout.height}.png` })
        }
      }
      expect(sizes[0], '手機直式仍大於頁面上的時鐘').toBeGreaterThan(40)
      expect(sizes[1]).toBeGreaterThan(sizes[0]!)
      expect(sizes[2]).toBeGreaterThan(sizes[1]!)
      await page.keyboard.press('Escape')
      await expect(view).toHaveCount(0)
    }
  })
}

test('全螢幕畫面在 375px light/dark 通過 WCAG 2.2 AA', async ({ page }, testInfo) => {
  await withoutFullscreenApi(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoHydrated(page, '/zh-tw/tools/device-time/')
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: '切換色彩模式' }).click()
    await page.locator('[data-fullscreen-open]').click()
    await expect(page.locator('[data-fullscreen-exit]')).toBeFocused()
    const exitBox = await page.locator('[data-fullscreen-exit]').boundingBox()
    expect(exitBox!.width + TOUCH_TARGET_TOLERANCE_PX).toBeGreaterThanOrEqual(44)
    expect(exitBox!.height + TOUCH_TARGET_TOLERANCE_PX).toBeGreaterThanOrEqual(44)
    expect((await new AxeBuilder({ page }).include('[data-device-clock-fullscreen]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    if (testInfo.project.name === 'chromium') await page.screenshot({ path: `artifacts/device-time-fullscreen-zh-tw-${theme}-375.png` })
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-device-clock-fullscreen]')).toHaveCount(0)
  }
})
