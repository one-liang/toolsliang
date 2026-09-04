import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { gotoHydrated, waitForHydration } from './support/hydration'
import { inspectNetworkRequest, redactToolContent } from './support/privacy-boundary'

const TOOL_ROUTE = '/zh-tw/tools/ntd-uppercase/'
const OFFLINE_ROUTE = '/zh-tw/offline/'
const TOOL_INPUT = '10001.09'
const TOOL_OUTPUT = '新臺幣壹萬零壹元玖分'
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
const TOOL_CONTENT = [
  { label: '輸入', value: TOOL_INPUT },
  { label: '輸出', value: TOOL_OUTPUT },
]

/**
 * Going offline on purpose makes the browser report the requests it could not
 * make. That is the condition under test, not a defect, so those messages are
 * tolerated only in the tests that disconnect — never application errors.
 */
const OFFLINE_NOISE = /ERR_INTERNET_DISCONNECTED|ERR_FAILED|Failed to load resource|NUXT_E7002|NUXT_E7003/

interface PwaFindings {
  consoleErrors: string[]
  networkFindings: string[]
  offlineExpected: boolean
}

const findingsByPage = new WeakMap<Page, PwaFindings>()

function expectOfflineNoise(page: Page) {
  findingsByPage.get(page)!.offlineExpected = true
}

test.beforeEach(({ page }) => {
  const findings: PwaFindings = { consoleErrors: [], networkFindings: [], offlineExpected: false }
  findingsByPage.set(page, findings)

  page.on('console', (message) => {
    if (message.type() === 'error') findings.consoleErrors.push(redactToolContent(message.text(), TOOL_CONTENT))
  })
  page.context().on('request', (request) => {
    findings.networkFindings.push(...inspectNetworkRequest({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      body: request.postData(),
    }, TOOL_CONTENT, NETWORK_BOUNDARY_POLICY))
  })
})

test.describe('可安裝的應用外殼', () => {
  test('每個語言都提供可安裝的 manifest 與圖示', async ({ page, request }) => {
    await gotoHydrated(page, TOOL_ROUTE)
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/zh-tw/manifest.webmanifest')

    const response = await request.get('/zh-tw/manifest.webmanifest')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/manifest+json')

    const manifest = await response.json()
    expect(manifest).toMatchObject({
      name: 'toolsliang 萬用工具',
      short_name: 'toolsliang',
      lang: 'zh-Hant-TW',
      display: 'standalone',
      start_url: '/zh-tw/',
      scope: '/',
      theme_color: '#f6f3f0',
      background_color: '#f6f3f0',
    })
    // Chromium's installability baseline: a 192px icon plus a maskable icon.
    expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '192x192')).toBe(true)
    expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(true)

    for (const icon of manifest.icons as Array<{ src: string }>) {
      const iconResponse = await request.get(icon.src)
      expect(iconResponse.status(), `${icon.src} 必須可下載`).toBe(200)
      expect(iconResponse.headers()['content-type']).toContain('image/png')
    }

    const shortcutUrls = (manifest.shortcuts as Array<{ url: string }>).map(shortcut => shortcut.url)
    expect(shortcutUrls).toContain(TOOL_ROUTE)
  })

  test('英文版 manifest 指向英文起始網址', async ({ page, request }) => {
    await gotoHydrated(page, '/en/tools/ntd-uppercase/')
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/en/manifest.webmanifest')

    const manifest = await (await request.get('/en/manifest.webmanifest')).json()
    expect(manifest.start_url).toBe('/en/')
    expect(manifest.lang).toBe('en')
  })

  test('離線說明頁在兩種主題下都通過 WCAG 2.2 AA 檢查', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.addInitScript(mode => window.localStorage.setItem('toolsliang-theme', mode), theme)
      await gotoHydrated(page, OFFLINE_ROUTE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('目前無法連線')

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(results.violations, `${theme} 主題無障礙違規：\n${results.violations.map(v => v.id).join('\n')}`).toEqual([])
    }
  })

  test('離線說明頁不可被索引', async ({ request }) => {
    const html = await (await request.get(OFFLINE_ROUTE)).text()
    expect(html).toContain('content="noindex, follow"')

    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).not.toContain('/offline/')
  })
})

/**
 * Service Worker lifecycle, offline navigation and update control are verified
 * in Chromium only: Playwright's Firefox and WebKit builds do not expose a
 * usable Service Worker lifecycle. The shared, browser-independent policy is
 * covered by the unit suite, and every other check here runs everywhere.
 */
test.describe('漸進式離線與更新控制', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Service Worker 生命週期只在 Chromium 可驗證')

  async function activateServiceWorker(page: Page) {
    await gotoHydrated(page, TOOL_ROUTE)
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20_000 })
  }

  test('首次載入後，輕量工具可離線啟動並完成核心流程', async ({ page, context }) => {
    await activateServiceWorker(page)
    expectOfflineNoise(page)
    await context.setOffline(true)

    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForHydration(page)

      await expect(page.getByRole('heading', { level: 1 })).toHaveText('新臺幣國字大寫')
      await page.getByLabel('輸入金額（新臺幣）').fill(TOOL_INPUT)
      await expect(page.locator('.result-panel strong')).toHaveText(TOOL_OUTPUT)
      await expect(page.locator('[data-tool-offline]')).toHaveAttribute('data-tool-offline', 'ready')
    }
    finally {
      await context.setOffline(false)
    }
  })

  test('離線時開啟未快取的頁面會顯示可理解的離線說明', async ({ page, context }) => {
    await activateServiceWorker(page)
    expectOfflineNoise(page)
    await context.setOffline(true)

    try {
      await page.goto('/zh-tw/design-system/', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('目前無法連線')
      await expect(page.locator('.offline-page__tools').getByRole('link', { name: '新臺幣國字大寫' })).toBeVisible()
    }
    finally {
      await context.setOffline(false)
    }
  })

  test('快取只保存版本化的應用資產，不含工具內容', async ({ page }) => {
    await activateServiceWorker(page)
    await page.getByLabel('輸入金額（新臺幣）').fill(TOOL_INPUT)
    await expect(page.locator('.result-panel strong')).toHaveText(TOOL_OUTPUT)

    const cached = await page.evaluate(async () => {
      const names = await caches.keys()
      const entries: string[] = []
      for (const name of names) {
        const cache = await caches.open(name)
        entries.push(...(await cache.keys()).map(request => request.url))
      }
      return { names, entries }
    })

    expect(cached.names.length).toBeGreaterThan(0)
    expect(cached.names.every(name => name.startsWith('toolsliang-')), `未預期的快取：${cached.names.join('、')}`).toBe(true)
    expect(cached.entries.length).toBeGreaterThan(0)

    const findings = cached.entries.flatMap(url => inspectNetworkRequest(
      { url, method: 'GET', headers: {}, body: null },
      TOOL_CONTENT,
      NETWORK_BOUNDARY_POLICY,
    ))
    expect(findings, `快取內容違反本機邊界：\n${findings.join('\n')}`).toEqual([])
    expect(cached.entries.every(url => !new URL(url).search), '快取鍵不得含查詢字串').toBe(true)
  })

  /**
   * A deploy is simulated by registering a second script URL in the same scope:
   * the browser installs it and, because a version is already controlling the
   * page, parks it as the waiting worker — exactly the state a deploy produces.
   */
  async function stageWaitingVersion(page: Page, revision: number) {
    await page.evaluate(async (value) => {
      await navigator.serviceWorker.register(`/sw.js?revision=${value}`, { scope: '/' })
    }, revision)
  }

  test('新版本先通知，不靜默重新載入，並在有未完成工作時要求明確確認', async ({ page }) => {
    await activateServiceWorker(page)

    const amount = page.getByLabel('輸入金額（新臺幣）')
    await amount.fill(TOOL_INPUT)
    await expect(page.locator('.result-panel strong')).toHaveText(TOOL_OUTPUT)

    await stageWaitingVersion(page, 2)

    const banner = page.locator('[data-pwa-update]')
    await expect(banner).toBeVisible()
    await expect(banner).toHaveAttribute('data-pwa-update-blocked', 'true')
    await expect(banner).toContainText('尚未完成')

    // The waiting version must not have taken the workspace away on its own.
    await expect(amount).toHaveValue(TOOL_INPUT)
    await expect(page.locator('.result-panel strong')).toHaveText(TOOL_OUTPUT)

    await amount.fill('')
    await expect(banner).toHaveAttribute('data-pwa-update-blocked', 'false')
    await expect(banner).toContainText('重新載入')

    await page.locator('[data-pwa-update-dismiss]').click()
    await expect(banner).toBeHidden()
  })

  test('使用者確認後才套用等待中的新版本', async ({ page }) => {
    await activateServiceWorker(page)
    await stageWaitingVersion(page, 4)

    await expect(page.locator('[data-pwa-update]')).toBeVisible()
    await page.locator('[data-pwa-update-confirm]').click()

    await page.waitForFunction(
      () => Boolean(navigator.serviceWorker.controller?.scriptURL.includes('revision=4')),
      null,
      { timeout: 20_000 },
    )
    await waitForHydration(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('新臺幣國字大寫')
  })
})

test.afterEach(async ({ page }) => {
  const findings = findingsByPage.get(page)!
  const consoleErrors = findings.offlineExpected
    ? findings.consoleErrors.filter(message => !OFFLINE_NOISE.test(message))
    : findings.consoleErrors

  expect(findings.networkFindings, `PWA 流程不得離開本機邊界：\n${findings.networkFindings.join('\n')}`).toEqual([])
  expect(consoleErrors, `console errors：\n${consoleErrors.join('\n')}`).toEqual([])

  // A registered worker must not leak into the next test's cache assertions.
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? []
    await Promise.all(registrations.map(registration => registration.unregister()))
    const names = await caches.keys()
    await Promise.all(names.map(name => caches.delete(name)))
  }).catch(() => {})
})
