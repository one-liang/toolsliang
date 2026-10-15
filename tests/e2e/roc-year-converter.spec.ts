import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

const TOOL_ROUTE = '/zh-tw/tools/roc-year-converter/'
/** The visitor's device clock: every "this year" assertion follows it, never the build machine. */
const DEVICE_NOW = new Date('2026-10-15T10:00:00+08:00')
const TOUCH_TARGET_TOLERANCE_PX = 0.001
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
/**
 * What this suite types and reads back. A bare year would also match a hashed
 * asset filename, so each canary is the sentence the result panel writes,
 * which carries both the year typed and the year answered.
 */
const TOOL_CONTENT = [
  { label: '輸出', value: '民國 115 年 ＝ 西元 2026 年' },
  { label: '輸出', value: '西元 2026 年 ＝ 民國 115 年' },
  { label: '輸出', value: '民國 20 年 ＝ 西元 1931 年' },
  { label: '輸出', value: '西元 1911 年 ＝ 民國前 1 年' },
  { label: '輸出', value: '民國 1 年 ＝ 西元 1912 年' },
  { label: '輸出', value: 'ROC year 115 ＝ 2026' },
]

guardToolContentBoundary(TOOL_CONTENT, NETWORK_BOUNDARY_POLICY)

test.use({ timezoneId: 'Asia/Taipei' })

async function gotoTool(page: Page, route = TOOL_ROUTE) {
  await page.clock.setFixedTime(DEVICE_NOW)
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  await expect(page.locator('#roc-year-input')).toBeVisible()
  return response
}

/** Whether a row sits fully inside the table's own scrolling box. */
async function rowIsInView(scroller: Locator, row: Locator) {
  const [outer, inner] = await Promise.all([scroller.boundingBox(), row.boundingBox()])
  if (!outer || !inner) return false
  return inner.y >= outer.y - 1 && inner.y + inner.height <= outer.y + outer.height + 1
}

test('伺服器輸出 FAQ 與來源，但不在建置時決定「今年」', async ({ request }) => {
  const response = await request.get(TOOL_ROUTE)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain('民國年怎麼換成西元年？')
  expect(html).toContain('西元年＝民國年＋1911')
  expect(html, '今年依訪客裝置的時鐘決定，不能寫死在預先產生的頁面').not.toContain('data-current-year')
})

test('開啟時看得到今年、對照表與民國紀年的官方依據', async ({ page }) => {
  const response = await gotoTool(page)
  expect(response?.ok(), `${TOOL_ROUTE} 應成功載入`).toBe(true)

  await expect(page.locator('h1')).toHaveText('民國西元對照')
  await expect(page.getByLabel('民國年份')).toHaveValue('')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('[data-current-year]')).toHaveText('今年是民國 115 年（西元 2026 年）。')

  const table = page.getByRole('table', { name: /民國西元對照表/ })
  await expect(table.locator('tbody tr')).toHaveCount(125)
  const current = table.locator('tr[aria-current="date"]')
  await expect(current).toHaveAttribute('data-gregorian', '2026')
  await expect(current, '今年要有文字標示，不只靠顏色').toContainText('今年')
  await expect.poll(() => rowIsInView(page.locator('.roc-year__scroll'), current), '開啟時對照表捲到今年').toBe(true)

  await expect(page.locator('.roc-year__formula')).toHaveText('換算方式：西元年＝民國年＋1911')
  await expect(page.getByRole('heading', { name: '資料來源與審閱' })).toBeVisible()
  const sources = page.locator('.tool-contract--sources')
  await expect(sources).toContainText('西元年＝民國年＋1911')
  for (const name of ['教育部《重編國語辭典修訂本》：「民國」', '中華民國總統府：國父－中華民國簡介', '內政部戶政司：年歲對照表']) {
    await expect(sources.getByRole('link', { name })).toBeVisible()
  }
})

test('民國年與西元年雙向查詢，結果更新不搬動焦點', async ({ page }) => {
  await gotoTool(page)
  const result = page.locator('.result-panel')
  await expect(result).toHaveAttribute('aria-live', 'polite')

  const roc = page.getByLabel('民國年份')
  await roc.focus()
  await page.keyboard.type('115')
  await expect(page.locator('.roc-year__headline')).toHaveText('西元 2026 年')
  await expect(result).toContainText('民國 115 年 ＝ 西元 2026 年')
  await expect(roc, '結果更新不得搬動焦點').toBeFocused()

  await roc.fill('1')
  await expect(page.locator('.roc-year__headline')).toHaveText('西元 1912 年')
  await expect(result).toContainText('民國元年')

  await page.getByRole('radio', { name: '民國年' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: '西元年' })).toBeChecked()
  const gregorian = page.getByLabel('西元年份')
  await expect(gregorian, '切換方向時保留同一個年份').toHaveValue('1912')

  await gregorian.fill('2026')
  await expect(page.locator('.roc-year__headline')).toHaveText('民國 115 年')
  await expect(result).toContainText('西元 2026 年 ＝ 民國 115 年')

  await gregorian.fill('1911')
  await expect(page.locator('.roc-year__headline')).toHaveText('民國前 1 年')
  await expect(page.locator('[data-outside-table]')).toContainText('不在這張表的範圍內')
  await expect(page.locator('main')).not.toContainText(/民國\s*0\s*年/)
})

test('民國 0 年與非數字以可修正的訊息說明，英文頁以英文呈現', async ({ page }) => {
  await gotoTool(page)
  const roc = page.getByLabel('民國年份')

  await roc.fill('0')
  await expect(page.getByRole('alert')).toContainText('民國沒有 0 年')
  await expect(roc).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.roc-year__headline')).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText(/民國\s*0\s*年/)

  await roc.fill('-3')
  await expect(page.getByRole('alert'), '負數引導改查西元年').toContainText('請改選「西元年」')

  await roc.fill('一一五')
  await expect(page.getByRole('alert')).toContainText('請只填數字')

  await roc.fill('')
  await expect(page.getByRole('alert'), '空白不是錯誤').toHaveCount(0)

  await gotoTool(page, '/en/tools/roc-year-converter/')
  await page.getByLabel('ROC year number').fill('0')
  await expect(page.getByRole('alert')).toContainText('The ROC era has no year 0')
  await page.getByLabel('ROC year number').fill('115')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.result-panel')).toContainText('ROC year 115 ＝ 2026')
})

test('輸入年份後對照表自己捲到並標示該列，頁面不跟著跳', async ({ page }) => {
  await gotoTool(page)
  const scroller = page.locator('.roc-year__scroll')
  const before = await page.evaluate(() => window.scrollY)

  await page.getByLabel('民國年份').fill('20')
  const match = page.locator('tr[data-match]')
  await expect(match).toHaveCount(1)
  await expect(match).toHaveAttribute('data-gregorian', '1931')
  await expect(match, '查詢的列要有文字標示').toContainText('你查的年份')
  await expect.poll(() => rowIsInView(scroller, match), '查詢的列捲進對照表的可見範圍').toBe(true)
  expect(await page.evaluate(() => window.scrollY), '只捲動表格，不捲動整頁').toBe(before)

  await page.getByRole('radio', { name: '西元年' }).check()
  await page.getByLabel('西元年份').fill('2036')
  await expect(match).toHaveAttribute('data-gregorian', '2036')
  await expect.poll(() => rowIsInView(scroller, match)).toBe(true)
})

test('對照表可用鍵盤捲動', async ({ page }) => {
  await gotoTool(page)
  const scroller = page.getByRole('region', { name: '民國西元對照表' })
  await scroller.focus()
  await expect(scroller).toBeFocused()

  await page.keyboard.press('Home')
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(0)
  await page.keyboard.press('PageDown')
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
})

test('light 與 dark 模式皆通過 WCAG 2.2 AA 自動檢查', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('民國年份').fill('115')
  await expect(page.locator('tr[data-match]')).toHaveCount(1)

  for (const mode of ['light', 'dark'] as const) {
    if (mode === 'dark') {
      await page.getByRole('button', { name: '切換色彩模式' }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    expect(results.violations, `${mode} 模式無障礙違規：\n${results.violations.map(item => `${item.id}: ${item.help}`).join('\n')}`).toEqual([])
  }
})

for (const viewport of [
  { width: 375, height: 812, label: '手機', firstScreen: true },
  { width: 768, height: 1024, label: '平板', firstScreen: false },
  { width: 1366, height: 768, label: '桌面', firstScreen: true },
  { width: 1440, height: 1000, label: '寬桌面', firstScreen: false },
]) {
  test(`${viewport.label} ${viewport.width}px 無橫向跑版、操作目標可觸控${viewport.firstScreen ? '，輸入與結果在第一個畫面' : ''}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await gotoTool(page)

    const dimensions = await page.locator('html').evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(dimensions.scrollWidth, `${viewport.label} 不得有橫向跑版`).toBeLessThanOrEqual(dimensions.clientWidth + 1)

    const input = page.getByLabel('民國年份')
    for (const target of [input, page.locator('.roc-year__direction').first(), page.locator('.roc-year__direction').last()]) {
      const box = await target.boundingBox()
      expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
      expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
    }

    if (!viewport.firstScreen) return

    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    // On a phone the bottom navigation floats over the page, so it is the real bottom edge.
    const nav = page.locator('.mobile-nav')
    const visibleBottom = await nav.isVisible() ? (await nav.boundingBox())!.y : viewport.height
    for (const [name, target] of [['輸入欄位', input], ['對照結果', page.locator('.result-panel')]] as const) {
      const box = (await target.boundingBox())!
      expect(box.y, `${name}在第一個畫面內`).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height, `${name}不需捲動就看得到`).toBeLessThanOrEqual(visibleBottom)
    }
    if (viewport.width >= 1024) {
      const current = page.locator('tr[aria-current="date"]')
      const box = (await current.boundingBox())!
      expect(box.y + box.height, '桌面第一個畫面就看得到對照表的今年').toBeLessThanOrEqual(visibleBottom)
    }
  })
}

test('首次載入後可離線重新開啟並查詢', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service Worker 生命週期只在 Chromium 可驗證')
  await gotoTool(page)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  expectOfflineRequests(page)
  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('[data-capability-ready="true"]').waitFor()
    await page.getByLabel('民國年份').fill('115')
    await expect(page.locator('.result-panel')).toContainText('民國 115 年 ＝ 西元 2026 年')
    await expect(page.locator('tr[aria-current="date"]')).toHaveAttribute('data-gregorian', '2026')
  }
  finally { await context.setOffline(false) }
})
