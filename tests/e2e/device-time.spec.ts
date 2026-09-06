import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { gotoHydrated } from './support/hydration'
import { inspectNetworkRequest, inspectWebSocketFrame } from './support/privacy-boundary'

const instant = '2031-07-08T09:10:11Z'
const canaries = [
  { label: '裝置時間', value: '17:10:11' },
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
    await page.clock.install({ time: new Date(instant) })
    await page.clock.pauseAt(new Date(instant))
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    const clock = page.locator('[data-device-clock]')
    await expect(clock.locator('time')).toHaveText('17:10:11')
    await expect(clock).toContainText('Asia/Taipei')
    await expect(clock).toContainText('UTC+08:00')
    await expect(clock).toHaveAttribute('aria-live', 'off')
    const toggle = page.getByRole('button', { name: locale === 'en' ? 'Show seconds' : '顯示秒數', exact: true })
    await toggle.focus()
    await page.keyboard.press('Space')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(clock.locator('time')).toHaveText('17:10')
    await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
    const copy = page.getByRole('button', { name: locale === 'en' ? 'Copy time information' : '複製時間資訊' })
    await expect(copy).toBeFocused()
    expect(await copy.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page.locator('.device-time [role="status"]')).toContainText(locale === 'en' ? 'Could not copy' : '無法複製')
    await page.keyboard.press('Enter')
    await expect(page.locator('.device-time [role="status"]')).toHaveText(locale === 'en' ? 'Time information copied.' : '已複製時間資訊。')
    expect(await page.evaluate(() => Reflect.get(window, 'copiedTime'))).toContain('17:10\nAsia/Taipei · UTC+08:00')
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
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
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
  await page.clock.install({ time: new Date(instant) })
  await page.clock.pauseAt(new Date(instant))
  await gotoHydrated(page, '/en/tools/device-time/')
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
    await expect(page.locator('[data-device-clock] time')).toHaveText(/^\d{2}:\d{2}:\d{2}$/)
    await page.locator('[data-seconds-toggle]').click()
    await expect(page.locator('[data-device-clock] time')).toHaveText(/^\d{2}:\d{2}$/)
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
