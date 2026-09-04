import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { gotoHydrated, waitForHydration } from './support/hydration'
import { inspectNetworkRequest } from './support/privacy-boundary'

const TOOL_ROUTE = '/zh-tw/tools/ntd-uppercase/'
const DIRECTORY_ROUTE = '/zh-tw/tools/'
const SAVED_ROUTE = '/zh-tw/tools/?saved=true'
const SAVED_STORAGE_KEY = 'toolsliang-saved-tools'
const LEGACY_STORAGE_KEY = 'toolsliang-common-tools'
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
// Sub-pixel layout can report a 44px target as 43.999996; the same tolerance as the App Shell gate.
const TOUCH_TARGET_TOLERANCE_PX = 0.001
/**
 * Going offline on purpose makes the browser report the requests it could not
 * make. That is the condition under test, not a defect.
 */
const OFFLINE_NOISE = /ERR_INTERNET_DISCONNECTED|ERR_FAILED|Failed to load resource|NUXT_E7002|NUXT_E7003/

interface SavedFindings {
  consoleErrors: string[]
  pageErrors: string[]
  networkFindings: string[]
  offlineExpected: boolean
}

const findingsByPage = new WeakMap<Page, SavedFindings>()

test.beforeEach(({ page }) => {
  const findings: SavedFindings = { consoleErrors: [], pageErrors: [], networkFindings: [], offlineExpected: false }
  findingsByPage.set(page, findings)

  page.on('console', (message) => {
    if (message.type() === 'error') findings.consoleErrors.push(message.text())
  })
  page.on('pageerror', error => findings.pageErrors.push(error.message))
  page.context().on('request', (request) => {
    findings.networkFindings.push(...inspectNetworkRequest({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      body: request.postData(),
    }, [], NETWORK_BOUNDARY_POLICY))
  })
})

test.afterEach(({ page }) => {
  const findings = findingsByPage.get(page)!
  const consoleErrors = findings.offlineExpected
    ? findings.consoleErrors.filter(message => !OFFLINE_NOISE.test(message))
    : findings.consoleErrors

  expect(findings.networkFindings, `常用工具不得離開本機邊界：\n${findings.networkFindings.join('\n')}`).toEqual([])
  expect(consoleErrors, `console errors：\n${consoleErrors.join('\n')}`).toEqual([])
  expect(findings.pageErrors, `page errors：\n${findings.pageErrors.join('\n')}`).toEqual([])
})

function readSavedRecord(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }, SAVED_STORAGE_KEY)
}

/**
 * Saving a tool adds links the App Shell then prefetches. Leaving the page
 * while a prefetch is still in flight aborts it, and the framework reports the
 * abort as a console error that has nothing to do with what is under test.
 */
async function settleBeforeLeaving(page: Page) {
  await page.waitForLoadState('networkidle')
}

function savedToggle(page: Page) {
  return page.getByRole('button', { name: /加入常用|已加入常用/ })
}

test('匿名收藏後，側邊欄與常用工具檢視同步，重新載入仍保留', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, TOOL_ROUTE)

  expect(await readSavedRecord(page), '未收藏前不得寫入本機儲存').toBeNull()
  await expect(page.locator('.sidebar-saved__empty')).toBeVisible()

  const toggle = savedToggle(page)
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  const sidebarSaved = page.locator('.sidebar-saved__link')
  await expect(sidebarSaved).toHaveCount(1)
  await expect(page.locator('.sidebar-saved__empty')).toBeHidden()
  expect(await readSavedRecord(page)).toEqual({ version: 1, slugs: ['ntd-uppercase'] })

  await settleBeforeLeaving(page)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
  await expect(savedToggle(page), '重新載入後仍需是已收藏狀態').toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.sidebar-saved__link')).toHaveCount(1)

  await settleBeforeLeaving(page)
  await page.locator('.sidebar-primary-link--saved').click()
  await expect(page).toHaveURL(/\/zh-tw\/tools\/\?saved=true$/)
  await expect(page.locator('.saved-tool')).toHaveCount(1)
  await expect(page.locator('.saved-tool__link')).toHaveAttribute('href', TOOL_ROUTE)

  // The catalog marks what this device already saved.
  await settleBeforeLeaving(page)
  await gotoHydrated(page, DIRECTORY_ROUTE)
  const savedCard = page.locator('.tool-card', { hasText: '新臺幣國字大寫' }).first()
  await expect(savedCard.locator('.tool-card__badges')).toContainText('常用')
})

test('鍵盤可完成加入、排序控制與移除，並保有可見 focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, TOOL_ROUTE)

  const toggle = savedToggle(page)
  await toggle.focus()
  const focusStyle = await toggle.evaluate((element) => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) }
  })
  expect(focusStyle.style, 'focus 必須有可見輪廓').not.toBe('none')
  expect(focusStyle.width, 'focus 輪廓至少 3px').toBeGreaterThanOrEqual(3)

  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  await settleBeforeLeaving(page)
  await gotoHydrated(page, SAVED_ROUTE)
  const moveUp = page.locator('[data-saved-action="move-up"]')
  const moveDown = page.locator('[data-saved-action="move-down"]')
  const remove = page.locator('[data-saved-action="remove"]')

  // Only one tool is published, so both ends of the list are the same item.
  await expect(moveUp).toBeDisabled()
  await expect(moveDown).toBeDisabled()
  await expect(moveUp).toHaveAttribute('aria-label', /往上移/)
  await expect(moveDown).toHaveAttribute('aria-label', /往下移/)
  await expect(remove).toHaveAttribute('aria-label', /從常用移除/)

  await remove.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.saved-tool')).toHaveCount(0)
  await expect(page.locator('.saved-tools__empty')).toBeVisible()
  expect(await readSavedRecord(page)).toEqual({ version: 1, slugs: [] })
})

test('手機導覽的常用入口可觸控操作，且常用工具檢視通過 WCAG 2.2 AA', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.addInitScript(([key, value]) => {
    window.localStorage.setItem(key!, value!)
  }, [SAVED_STORAGE_KEY, JSON.stringify({ version: 1, slugs: ['ntd-uppercase'] })])
  await gotoHydrated(page, TOOL_ROUTE)

  const savedTab = page.locator('.mobile-nav').getByRole('link', { name: '常用' })
  const tabBox = await savedTab.boundingBox()
  expect((tabBox?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '常用入口寬度至少 44px').toBeGreaterThanOrEqual(44)
  expect((tabBox?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '常用入口高度至少 44px').toBeGreaterThanOrEqual(44)

  await savedTab.click()
  await expect(page).toHaveURL(/\/zh-tw\/tools\/\?saved=true$/)
  await expect(page.locator('.saved-tool')).toHaveCount(1)

  // A direct load of the saved view is served by the prerendered directory, so
  // the entries must still agree on where the visitor is once it hydrates.
  await gotoHydrated(page, SAVED_ROUTE)
  await expect(page.locator('.mobile-nav__item--saved')).toHaveClass(/mobile-nav--active/)
  await expect(page.locator('.mobile-nav .mobile-nav--active')).toHaveCount(1)

  const controlBoxes: Array<{ x: number, width: number }> = []
  for (const control of await page.locator('.saved-tool__actions button').all()) {
    const box = await control.boundingBox()
    expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '常用工具操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
    expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '常用工具操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
    controlBoxes.push({ x: box?.x ?? 0, width: box?.width ?? 0 })
  }

  controlBoxes.sort((left, right) => left.x - right.x)
  for (const [index, box] of controlBoxes.slice(1).entries()) {
    const previous = controlBoxes[index]!
    expect(box.x - (previous.x + previous.width), '相鄰操作目標之間保留間距').toBeGreaterThan(0)
  }

  const layout = await page.locator('html').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(layout.scrollWidth, '常用工具檢視不得有橫向跑版').toBeLessThanOrEqual(layout.clientWidth + 1)

  for (const mode of ['light', 'dark'] as const) {
    if (mode === 'dark') {
      await page.getByRole('button', { name: '切換色彩模式' }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations, `${mode} 模式常用工具無障礙違規：\n${results.violations.map(item => `${item.id}: ${item.help}`).join('\n')}`).toEqual([])
  }
})

test('下架或未知工具不造成導覽錯誤，並在下次寫入時清除', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(([key, value]) => {
    window.localStorage.setItem(key!, value!)
  }, [SAVED_STORAGE_KEY, JSON.stringify({ version: 1, slugs: ['image-resizer', 'ntd-uppercase', 'tool-that-never-existed'] })])
  await gotoHydrated(page, SAVED_ROUTE)

  await expect(page.locator('.saved-tool')).toHaveCount(1)
  await expect(page.locator('.saved-tool__link')).toHaveAttribute('href', TOOL_ROUTE)

  await page.locator('[data-saved-action="remove"]').click()
  expect(await readSavedRecord(page), '下次寫入時一併清除未知工具').toEqual({ version: 1, slugs: [] })
})

test('升級舊版本機紀錄，保留使用者已收藏的工具', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(([key, value]) => {
    window.localStorage.setItem(key!, value!)
  }, [LEGACY_STORAGE_KEY, JSON.stringify(['ntd-uppercase'])])
  await gotoHydrated(page, SAVED_ROUTE)

  await expect(page.locator('.saved-tool')).toHaveCount(1)

  await settleBeforeLeaving(page)
  await gotoHydrated(page, TOOL_ROUTE)
  await savedToggle(page).click()
  await expect(savedToggle(page)).toHaveAttribute('aria-pressed', 'false')

  expect(await readSavedRecord(page)).toEqual({ version: 1, slugs: [] })
  expect(await page.evaluate(key => window.localStorage.getItem(key), LEGACY_STORAGE_KEY), '升級後不再保留舊鍵').toBeNull()
})

test('中英文切換後，常用工具指向同一個工具', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(([key, value]) => {
    window.localStorage.setItem(key!, value!)
  }, [SAVED_STORAGE_KEY, JSON.stringify({ version: 1, slugs: ['ntd-uppercase'] })])
  await gotoHydrated(page, SAVED_ROUTE)

  await expect(page.locator('.saved-tool__link')).toHaveAttribute('href', TOOL_ROUTE)

  await settleBeforeLeaving(page)
  await page.getByRole('link', { name: 'EN' }).click()
  await expect(page).toHaveURL(/\/en\/tools\/\?saved=true$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Saved tools')
  await expect(page.locator('.saved-tool__link')).toHaveAttribute('href', '/en/tools/ntd-uppercase/')
  expect(await readSavedRecord(page), '切換語言不改變保存的工具識別碼').toEqual({ version: 1, slugs: ['ntd-uppercase'] })
})

/**
 * Offline restore needs the Service Worker to serve the App Shell, and only
 * Chromium exposes a verifiable Service Worker lifecycle in Playwright. The
 * device record itself is covered browser-independently by the unit suite.
 */
test.describe('離線後的常用工具', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Service Worker 生命週期只在 Chromium 可驗證')

  test('離線重新啟動仍保留匿名常用工具', async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoHydrated(page, TOOL_ROUTE)
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20_000 })

    await savedToggle(page).click()
    await expect(page.locator('.sidebar-saved__link')).toHaveCount(1)

    await settleBeforeLeaving(page)
    findingsByPage.get(page)!.offlineExpected = true
    await context.setOffline(true)

    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForHydration(page)

      await expect(savedToggle(page)).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.sidebar-saved__link')).toHaveCount(1)

      await page.locator('.sidebar-primary-link--saved').click()
      await expect(page.locator('.saved-tool')).toHaveCount(1)
      await expect(page.locator('.saved-tool__link')).toHaveAttribute('href', TOOL_ROUTE)
    }
    finally {
      await context.setOffline(false)
    }
  })
})
