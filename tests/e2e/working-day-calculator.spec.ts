import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

const TOOL_ROUTE = '/zh-tw/tools/working-day-calculator/'
/** The visitor's device clock: "today" follows it, never the build machine. */
const DEVICE_NOW = new Date('2026-02-13T10:00:00+08:00')
const TOUCH_TARGET_TOLERANCE_PX = 0.001
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
/**
 * What this suite types and reads back. Each canary is a date a visitor picks
 * or the sentence the result panel writes, so none of them can match a hashed
 * asset filename by accident.
 */
const TOOL_CONTENT = [
  { label: '輸入', value: '2026-03-02' },
  { label: '輸入', value: '2026-04-10' },
  { label: '輸入', value: '2027-12-28' },
  { label: '輸出', value: '從 2026-02-13（五）往後數 3 個工作天，不含起算日。' },
  { label: '輸出', value: '從 2026-03-02（一）往前數 3 個工作天，不含起算日。' },
  { label: '輸出', value: '2026-04-01（三）到 2026-04-10（五），頭尾兩天都算，共 10 個日曆天。' },
  { label: '輸出', value: '3 working days after Fri 13 Feb 2026, not counting the start date.' },
]

guardToolContentBoundary(TOOL_CONTENT, NETWORK_BOUNDARY_POLICY)

test.use({ timezoneId: 'Asia/Taipei' })

async function gotoTool(page: Page, route = TOOL_ROUTE) {
  await page.clock.setFixedTime(DEVICE_NOW)
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  await page.locator('[data-working-day-state="ready"]').waitFor()
  return response
}

test('伺服器輸出 FAQ 與來源，但不在建置時決定「今天」', async ({ request }) => {
  const response = await request.get(TOOL_ROUTE)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain('工作天怎麼算？')
  expect(html).toContain('可以拿來算法定期間或訴訟期限嗎？')
  expect(html, '今天依訪客裝置的時鐘決定，不能寫死在預先產生的頁面').not.toContain('data-working-day-state')
})

test('開啟時預設從今天往後數，並常駐標示辦公日曆表的版本與授權', async ({ page }) => {
  const response = await gotoTool(page)
  expect(response?.ok(), `${TOOL_ROUTE} 應成功載入`).toBe(true)

  await expect(page.locator('h1')).toHaveText('工作天計算')
  await expect(page.getByRole('radio', { name: '往後數' })).toBeChecked()
  await expect(page.getByLabel('起算日')).toHaveValue('2026-02-13')
  await expect(page.getByRole('alert')).toHaveCount(0)

  const edition = page.locator('[data-edition]')
  await expect(edition).toContainText('行政院人事行政總處')
  await expect(edition.getByRole('link', { name: '政府資料開放授權條款－第 1 版' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '資料來源與審閱' })).toBeVisible()
  await expect(page.locator('.tool-contract--sources').getByRole('link', { name: '全國法規資料庫：民法第 122 條' })).toBeVisible()
})

test('三種算法都算得出來，結果更新不搬動焦點', async ({ page }) => {
  await gotoTool(page)
  const result = page.locator('.result-panel')
  await expect(result).toHaveAttribute('aria-live', 'polite')

  const count = page.getByLabel('幾個工作天')
  await count.focus()
  await page.keyboard.type('3')
  await expect(page.locator('.working-day__headline')).toHaveText('2026-02-25（三）')
  await expect(result).toContainText('從 2026-02-13（五）往後數 3 個工作天，不含起算日。')
  await expect(count, '結果更新不得搬動焦點').toBeFocused()

  const breakdown = page.locator('.working-day__breakdown')
  await breakdown.locator('summary').click()
  await expect(breakdown.locator('[data-skipped] li').first()).toHaveText('2026-02-15（日）小年夜')

  await page.getByRole('radio', { name: '往前數' }).check()
  await page.getByLabel('起算日').fill('2026-03-02')
  await expect(page.locator('.working-day__headline')).toHaveText('2026-02-24（二）')

  await page.getByRole('radio', { name: '數區間' }).check()
  await page.getByLabel('開始日').fill('2026-04-01')
  await page.getByLabel('結束日').fill('2026-04-10')
  await expect(page.locator('.working-day__headline')).toHaveText('6 個工作天')
  await expect(result).toContainText('2026-04-01（三）到 2026-04-10（五），頭尾兩天都算，共 10 個日曆天。')
})

test('碰到還沒公告的年份就停下來說明，英文頁以英文呈現', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('起算日').fill('2027-12-28')
  await page.getByLabel('幾個工作天').fill('3')
  await expect(page.locator('[data-refusal]')).toContainText('第 3 個要用到 2028 年')
  await expect(page.locator('.working-day__headline'), '拒答時不顯示任何日期').toHaveCount(0)

  await page.getByLabel('幾個工作天').fill('0')
  await expect(page.getByRole('alert')).toHaveText('請填 1 以上的數字。')
  await page.getByLabel('幾個工作天').fill('')
  await expect(page.getByRole('alert'), '空白不是錯誤').toHaveCount(0)

  await gotoTool(page, '/en/tools/working-day-calculator/')
  await page.getByLabel('Number of working days').fill('3')
  await expect(page.locator('.result-panel')).toContainText('3 working days after Fri 13 Feb 2026, not counting the start date.')
})

test('台灣行事曆連到工作天計算，工作天計算也連回台灣行事曆', async ({ page }) => {
  await page.goto('/zh-tw/tools/taiwan-calendar/', { waitUntil: 'domcontentloaded' })
  await page.locator('[data-calendar-state="ready"]').waitFor()
  await page.locator('.calendar-working-day-link').getByRole('link', { name: '工作天計算' }).click()
  await expect(page).toHaveURL(/\/zh-tw\/tools\/working-day-calculator\/$/)
  await page.locator('[data-working-day-state="ready"]').waitFor()

  await page.locator('.working-day__calendar-link').getByRole('link', { name: '台灣行事曆' }).click()
  await expect(page).toHaveURL(/\/zh-tw\/tools\/taiwan-calendar\/$/)
})

test('light 與 dark 模式皆通過 WCAG 2.2 AA 自動檢查', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('幾個工作天').fill('3')
  await expect(page.locator('.working-day__headline')).toHaveText('2026-02-25（三）')
  await page.locator('.working-day__breakdown summary').click()

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
  { width: 375, height: 812, label: '手機' },
  { width: 768, height: 1024, label: '平板' },
  { width: 1366, height: 768, label: '桌面' },
]) {
  test(`${viewport.label} ${viewport.width}px 無橫向跑版、操作目標可觸控`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await gotoTool(page)

    const dimensions = await page.locator('html').evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(dimensions.scrollWidth, `${viewport.label} 不得有橫向跑版`).toBeLessThanOrEqual(dimensions.clientWidth + 1)

    const targets = [
      page.getByLabel('起算日'),
      page.getByLabel('幾個工作天'),
      ...['往後數', '往前數', '數區間'].map(name => page.getByRole('radio', { name }).locator('xpath=ancestor::label[1]')),
    ]
    for (const target of targets) {
      const box = await target.boundingBox()
      expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
      expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
    }
  })
}

test('首次載入後可離線重新開啟並跨年計算', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service Worker 生命週期只在 Chromium 可驗證')
  await gotoTool(page)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20_000 })
  // Once the worker controls the page, one more visit stores every year it loads.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-working-day-state="ready"]').waitFor()
  await page.waitForLoadState('networkidle')

  expectOfflineRequests(page)
  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('[data-capability-ready="true"]').waitFor()
    await page.locator('[data-working-day-state="ready"]').waitFor()
    await page.getByLabel('起算日').fill('2025-12-30')
    await page.getByLabel('幾個工作天').fill('3')
    await expect(page.locator('.working-day__headline'), '跨到下一年也算得出來').toHaveText('2026-01-05（一）')
  }
  finally { await context.setOffline(false) }
})
