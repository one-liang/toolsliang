import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { dgpa2026DaysOff, dgpa2026DaysOffTotal, dgpa2026MakeupWorkdays } from '../support/dgpa-2026-office-calendar'
import { waitForHydration } from './support/hydration'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

const TOOL_ROUTE = '/zh-tw/tools/taiwan-calendar/'
const TOUCH_TARGET_TOLERANCE_PX = 0.001
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
/**
 * This tool takes no personal content, so the canaries are the only things a
 * visit could reveal: the year and the day someone looked at. Neither may
 * appear in a URL, a header or a body — see the `no-personal-events` caveat.
 */
const TOOL_CONTENT = [
  { label: '查詢年份', value: '2020-02-29' },
  { label: '查詢日期', value: '2026-06-19' },
]

guardToolContentBoundary(TOOL_CONTENT, NETWORK_BOUNDARY_POLICY)

async function gotoTool(page: Page, route = TOOL_ROUTE) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  await page.locator('[data-calendar-state="ready"]').waitFor()
  return response
}

const LABELS = {
  'zh-tw': { year: '年份', previous: '上個月', next: '下個月' },
  'en': { year: 'Year', previous: 'Previous month', next: 'Next month' },
}

/**
 * The calendar opens on the device's own month, so a test names the month it
 * wants and walks there rather than assuming where it started.
 */
async function showMonth(page: Page, year: number, month: number, locale: keyof typeof LABELS = 'zh-tw') {
  const labels = LABELS[locale]
  // `year` also appears inside every day's accessible name, so the year control is matched exactly.
  const select = page.getByLabel(labels.year, { exact: true })
  if (await select.inputValue() !== String(year)) {
    await select.selectOption(String(year))
    await page.locator('[data-calendar-state="ready"]').waitFor()
  }

  const grid = page.locator('.calendar-grid')
  for (let step = 0; step < 12; step += 1) {
    const current = Number(await grid.getAttribute('data-month'))
    if (current === month) return
    await page.getByRole('button', { name: current < month ? labels.next : labels.previous }).click()
    await expect(grid).toHaveAttribute('data-month', String(current < month ? current + 1 : current - 1))
  }
  throw new Error(`could not reach ${year}-${month}`)
}

function day(page: Page, date: string) {
  return page.locator(`.calendar-day[data-date="${date}"]`)
}

test('工具開啟即顯示當年月曆與常駐的資料版本，說明收合在月曆旁', async ({ page }) => {
  const response = await gotoTool(page)
  expect(response?.ok(), `${TOOL_ROUTE} 應成功載入`).toBe(true)

  await expect(page.locator('.calendar-grid')).toBeVisible()
  await expect(page.locator('.calendar-day').first()).toBeVisible()

  // 顯名是政府資料開放授權條款成立的條件，不收合。
  const line = page.locator('.calendar-edition__line')
  await expect(line, '授權要求顯名標示提供機關').toContainText('行政院人事行政總處')
  await expect(line).toContainText('115年中華民國政府行政機關辦公日曆表')
  await expect(line).toContainText('交通部中央氣象署')
  await expect(line.getByRole('link', { name: '政府資料開放授權條款－第 1 版' })).toBeVisible()

  const details = page.locator('.calendar-edition__details')
  const caveats = details.locator('.calendar-caveats')
  await expect(caveats, '免責收合在月曆旁的資料版本內').toBeHidden()
  await details.locator('summary').click()
  await expect(caveats, '產品邊界必須在年曆附近，而不是只在頁尾').toContainText('學校、公司與各行業的實際出勤另有規定')
  await expect(caveats).toContainText('不預測還沒決定的假期')
  await expect(caveats).toContainText('不需要也不儲存任何個人行程')
  await expect(details.locator('.calendar-sources')).toContainText('taiwan-calendar-2026-09-06')

  await expect(page.getByRole('heading', { name: '關於這個工具的常見問題' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '資料來源與審閱' })).toBeVisible()
})

test('T13 的代表性日期與跨年案例都顯示正確', async ({ page }) => {
  await gotoTool(page)

  // 春節與農曆除夕：除夕是正月初一的前一天，且落在十二月廿九。
  await showMonth(page, 2026, 2)
  await expect(day(page, '2026-02-16')).toHaveAttribute('data-kind', 'national-holiday')
  await day(page, '2026-02-16').click()
  await expect(page.locator('.calendar-detail')).toContainText('農曆除夕')
  await expect(page.locator('.calendar-detail')).toContainText('十二月廿九')

  await day(page, '2026-02-17').click()
  await expect(page.locator('.calendar-detail')).toContainText('春節')
  await expect(page.locator('.calendar-detail')).toContainText('丙午年（馬）正月初一')

  // 民族掃墓節落在當年的清明節氣，不是固定的 4 月 5 日。
  await showMonth(page, 2026, 4)
  await day(page, '2026-04-05').click()
  await expect(page.locator('.calendar-detail')).toContainText('清明')
  await expect(page.locator('.calendar-detail')).toContainText('民族掃墓節')

  // 跨年：12 月底往後翻會進入下一個已公告年度，星期不重新起算。
  await showMonth(page, 2026, 12)
  await day(page, '2026-12-31').click()
  await expect(page.locator('.calendar-detail')).toContainText('星期四')

  await page.getByRole('button', { name: '下個月' }).click()
  await expect(page.getByLabel('年份', { exact: true })).toHaveValue('2027')
  await expect(page.locator('.calendar-grid')).toHaveAttribute('data-month', '1')
  await day(page, '2027-01-01').click()
  await expect(page.locator('.calendar-detail')).toContainText('星期五')
  await expect(page.locator('.calendar-detail')).toContainText('民國 116 年')
})

test('已修正的年度標示採用的版本，未公告的年度直說尚未公告', async ({ page }) => {
  await gotoTool(page)
  await showMonth(page, 2025, 1)

  await expect(page.locator('.calendar-edition__line'), '修正版要常駐標示').toContainText('1141020')
  await expect(page.locator('.calendar-edition__revised')).toHaveText('（修正版）')
  await page.locator('.calendar-edition__details summary').click()
  await expect(page.locator('.calendar-revised')).toContainText('主管機關已發布修正版')
  await expect(page.locator('.calendar-caveats__emphasised')).toContainText('民國 114 年就在年中新增了三個放假日')

  await page.getByLabel('年份', { exact: true }).selectOption('2028')
  await expect(page.locator('.calendar-grid'), '尚未公告的年度不得畫出空白月曆').toHaveCount(0)
  await expect(page.locator('.calendar-refusal')).toContainText('主管機關尚未公告，這裡不會先猜')
})

test('補班日與補假在畫面上有文字，不只有顏色', async ({ page }) => {
  await gotoTool(page)
  await showMonth(page, 2025, 2)

  await expect(day(page, '2025-02-08'), '補班日必須寫出來').toContainText('補班日')
  await expect(day(page, '2025-02-08')).toHaveAttribute('data-kind', 'makeup-workday')

  const agenda = page.locator('.calendar-agenda')
  await expect(agenda, '手機以清單呈現同一份標示').toContainText('補班日')
  await expect(page.locator('.calendar-agenda__item[data-date="2025-02-08"]')).toBeVisible()
  await expect(page.locator('.calendar-agenda__item[data-date="2025-02-11"]'), '一般上班日不進標示清單').toHaveCount(0)
})

test('月曆可用鍵盤走完，焦點不困在網格裡，操作目標在手機上可觸控', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoTool(page)
  await showMonth(page, 2026, 1)

  const first = day(page, '2026-01-01')
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(day(page, '2026-01-02')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(day(page, '2026-01-09')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.calendar-detail')).toContainText('民國 115 年')

  const tabbable = await page.locator('.calendar-day[tabindex="0"]').count()
  expect(tabbable, '網格只保留一個 Tab 停留點，Tab 才能離開').toBe(1)
  await page.keyboard.press('Tab')
  await expect(page.locator('.calendar-day:focus'), 'Tab 必須離開月曆網格').toHaveCount(0)

  const dimensions = await page.locator('html').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(dimensions.scrollWidth, `${testInfo.project.name} 375px 不得有橫向跑版`).toBeLessThanOrEqual(dimensions.clientWidth + 1)

  for (const target of [
    page.getByLabel('年份', { exact: true }),
    page.locator('.calendar-view__option').first(),
    page.locator('.calendar-view__option').last(),
    page.getByRole('button', { name: '上個月' }),
    page.getByRole('button', { name: '下個月' }),
    page.getByRole('button', { name: '回到今天' }),
    page.locator('.calendar-agenda__button').first(),
  ]) {
    const box = await target.boundingBox()
    expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
    expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
  }
})

test('英文頁以英文回答，並保留來源使用的中文名稱', async ({ page }) => {
  await gotoTool(page, '/en/tools/taiwan-calendar/')
  await showMonth(page, 2026, 6, 'en')
  await day(page, '2026-06-19').click()

  const detail = page.locator('.calendar-detail')
  await expect(detail).toContainText('Dragon Boat Festival')
  await expect(detail, '英文頁保留來源的中文節日名').toContainText('端午節')
  await expect(page.locator('.calendar-edition__line')).toContainText('Open Government Data License, version 1.0')
  await page.locator('.calendar-edition__details summary').click()
  await expect(page.locator('.calendar-caveats')).toContainText('schools, companies, and individual industries set their own schedules')

  await page.getByLabel('Year', { exact: true }).selectOption('2028')
  await expect(page.locator('.calendar-refusal')).toContainText('has not been announced yet')
})

test('選取的日子在滑鼠停留時維持反白，不換成 hover 底色', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoTool(page)
  await showMonth(page, 2026, 1)
  const selected = day(page, '2026-01-01')
  await selected.click()
  await page.mouse.move(0, 0)
  const resting = await selected.evaluate(element => getComputedStyle(element).backgroundColor)
  await selected.hover()
  await expect.poll(() => selected.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(resting)
})

test('月曆在 light 與 dark 模式皆通過 WCAG 2.2 AA 自動檢查', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoTool(page)
  await showMonth(page, 2026, 1)
  await day(page, '2026-01-01').click()
  // The folded notes are audited too: their small print has to meet contrast once opened.
  await page.locator('.calendar-edition__details summary').click()
  // Clicking a day scrolls it into view, which slides the year control under the
  // sticky top bar; the audit runs on the settled, unscrolled page.
  await page.evaluate(() => window.scrollTo(0, 0))

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

const OFF_KINDS = ['weekend', 'national-holiday', 'substitute-holiday', 'bridge-holiday']

async function showYearView(page: Page) {
  await page.locator('input[name="calendar-view"][value="year"]').check()
  await expect(page.locator('.calendar-workspace')).toHaveAttribute('data-calendar-view', 'year')
  await expect(page.locator('.calendar-mini')).toHaveCount(12)
}

async function yearCells(page: Page) {
  return page.locator('.calendar-year-view .calendar-day').evaluateAll(buttons => buttons.map(button => ({
    date: button.getAttribute('data-date')!,
    kind: button.getAttribute('data-kind')!,
    flag: button.querySelector('.calendar-day__flag')?.textContent ?? '',
  })))
}

function monthColumns(page: Page) {
  return page.locator('.calendar-months').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
}

test('2026 年的年檢視與人事行政總處公告的辦公日曆表逐日一致', async ({ page }) => {
  await gotoTool(page)
  await showMonth(page, 2026, 1)
  await showYearView(page)

  const cells = await yearCells(page)
  const announced = dgpa2026DaysOff()
  expect(cells, '一年 365 天都要畫出來').toHaveLength(365)
  expect(announced.size, '公告的全年放假日數').toBe(dgpa2026DaysOffTotal)

  for (const cell of cells) {
    expect(OFF_KINDS.includes(cell.kind), `${cell.date} 的放假或上班與公告不一致`).toBe(announced.has(cell.date))
    // 週末以欄位表明；其餘放假日另有「休」字，放假與上班不只靠顏色區分。
    if (cell.kind !== 'weekend' && OFF_KINDS.includes(cell.kind)) expect(cell.flag, cell.date).toBe('休')
  }
  expect(cells.filter(cell => cell.kind === 'makeup-workday').map(cell => cell.date), '115 年沒有補班日').toEqual(dgpa2026MakeupWorkdays)

  const legend = page.locator('.calendar-legend')
  await expect(legend).toContainText('上班日')
  await expect(legend).toContainText('放假日')
  await expect(legend).toContainText('休')
})

test('年檢視在手機一欄、平板兩欄、桌面三欄，且不出現橫向捲動', async ({ page }, testInfo) => {
  for (const [width, columns] of [[375, 1], [768, 2], [1440, 3]] as const) {
    await page.setViewportSize({ width, height: 900 })
    await gotoTool(page)
    await showMonth(page, 2026, 1)
    await showYearView(page)

    expect(await monthColumns(page), `${width}px 的欄數`).toBe(columns)
    const overflow = await page.locator('html').evaluate(element => element.scrollWidth - element.clientWidth)
    expect(overflow, `${testInfo.project.name} ${width}px 不得有橫向跑版`).toBeLessThanOrEqual(1)
  }
})

test('點年檢視的某一天切回月檢視並選到該日，鍵盤可跨月移動', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoTool(page)
  await showMonth(page, 2026, 1)
  await showYearView(page)

  await day(page, '2026-01-31').focus()
  await page.keyboard.press('ArrowRight')
  await expect(day(page, '2026-02-01'), '方向鍵跨月移動焦點').toBeFocused()
  expect(await page.locator('.calendar-year-view .calendar-day[tabindex="0"]').count(), '整年只保留一個 Tab 停留點').toBe(1)

  await day(page, '2026-09-28').click()
  await expect(page.locator('.calendar-workspace')).toHaveAttribute('data-calendar-view', 'month')
  await expect(page.locator('.calendar-grid')).toHaveAttribute('data-month', '9')
  await expect(day(page, '2026-09-28')).toHaveAttribute('aria-pressed', 'true')
  await expect(day(page, '2026-09-28')).toBeFocused()
  await expect(page.locator('.calendar-detail')).toContainText('教師節')

  await page.locator('input[name="calendar-view"][value="year"]').check()
  await page.getByLabel('年份', { exact: true }).selectOption('2028')
  await expect(page.locator('.calendar-year-view'), '尚未公告的年度不得畫出空白年曆').toHaveCount(0)
  await expect(page.locator('.calendar-refusal')).toContainText('主管機關尚未公告，這裡不會先猜')
})

test('年檢視在 light 與 dark 模式皆通過 WCAG 2.2 AA 自動檢查', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoTool(page)
  await showMonth(page, 2026, 1)
  await showYearView(page)
  await page.locator('.calendar-edition__details summary').click()
  await page.evaluate(() => window.scrollTo(0, 0))

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

/**
 * The year modules are static assets of this build, so the year on screen
 * survives going offline. Restarting offline needs the Service Worker, and only
 * Chromium exposes a verifiable Service Worker lifecycle in Playwright.
 */
test('離線重新啟動後年檢視仍可使用', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service Worker 生命週期只在 Chromium 可驗證')
  await gotoTool(page)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20_000 })
  await showMonth(page, 2026, 1)
  await page.waitForLoadState('networkidle')

  expectOfflineRequests(page)
  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForHydration(page)
    await page.locator('[data-calendar-state="ready"]').waitFor()
    await showMonth(page, 2026, 1)
    await showYearView(page)

    expect(await yearCells(page)).toHaveLength(365)
    await expect(day(page, '2026-02-16').locator('.calendar-day__flag')).toHaveText('休')
  }
  finally {
    await context.setOffline(false)
  }
})
