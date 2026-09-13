import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Locator } from '@playwright/test'
import { gotoHydrated, waitForHydration } from './support/hydration'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

const TOOL_ROUTE = '/zh-tw/tools/custom-calendar/'
const EN_TOOL_ROUTE = '/en/tools/custom-calendar/'
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
// Sub-pixel layout can report a 44px target as 43.999996; the same tolerance as the App Shell gate.
const TOUCH_TARGET_TOLERANCE_PX = 0.001
// A physical press interval exposes movement between pointerdown and pointerup;
// this is input duration, not a sleep to wait for scrolling or storage.
const POINTER_PRESS_MS = 100

/**
 * Everything a visitor types into this tool. All of it is saved on the device,
 * so none of it may appear in a request, a Service Worker cache, the preference
 * namespace or a file name.
 */
const ENTRY_TITLE = 'canary-公司特休-liang'
const ENTRY_NOTE = 'canary-note-0918-liang'
const IMPORTED_TITLE = 'canary-匯入排班-liang'

const toolContent = [
  { label: '自訂項目名稱', value: ENTRY_TITLE },
  { label: '自訂項目備註', value: ENTRY_NOTE },
  { label: '匯入項目名稱', value: IMPORTED_TITLE },
]

guardToolContentBoundary(toolContent, NETWORK_BOUNDARY_POLICY)

const LABELS = {
  'zh-tw': { year: '年份', previous: '上個月', next: '下個月' },
  'en': { year: 'Year', previous: 'Previous month', next: 'Next month' },
}

function backupFile(entries: Array<{ id: string, title: string, startDate: string, endDate: string, mark: string }>) {
  return JSON.stringify({
    format: 'toolsliang.custom-calendar',
    version: 1,
    updatedAt: '2026-09-07T02:00:00.000Z',
    entries: entries.map(entry => ({
      ...entry,
      note: '',
      updatedAt: '2026-09-07T02:00:00.000Z',
    })),
  })
}

async function gotoTool(page: Page, route = TOOL_ROUTE) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
  await page.locator('[data-capability-ready="true"]').waitFor()
  await page.locator('[data-calendar-state="ready"]').waitFor()
  return response
}

/** The calendar opens on the device's own month, so a test walks to the month it wants. */
async function showMonth(page: Page, year: number, month: number, locale: keyof typeof LABELS = 'zh-tw') {
  const labels = LABELS[locale]
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

async function openDay(page: Page, date: string, locale: keyof typeof LABELS = 'zh-tw') {
  await showMonth(page, Number(date.slice(0, 4)), Number(date.slice(5, 7)), locale)
  await day(page, date).click()
}

/** Finish focus-triggered scrolling before a real pointer press and release. */
async function clickEntryAction(target: Locator, delay = 0) {
  await target.evaluate(element => element.scrollIntoView({ behavior: 'instant', block: 'center' }))
  await target.click({ delay })
}

async function addEntry(
  page: Page,
  values: { title: string, note?: string, mark?: string, start?: string, end?: string },
) {
  await clickEntryAction(page.locator('[data-entry-action="add"]'))
  await page.locator('#custom-entry-title').fill(values.title)
  if (values.note) await page.locator('#custom-entry-note').fill(values.note)
  if (values.mark) await page.locator(`input[name="custom-entry-mark"][value="${values.mark}"]`).check()
  if (values.start) await page.locator('#custom-entry-start').fill(values.start)
  if (values.end) await page.locator('#custom-entry-end').fill(values.end)
  await clickEntryAction(page.locator('[data-entry-action="save"]'), POINTER_PRESS_MS)
  // The form closes only once the device has accepted the write, so every
  // caller of a successful save waits for the transaction rather than the click.
  await expect(page.locator('.custom-calendar-form')).toHaveCount(0)
}

test('新增、編輯、刪除自訂項目，並在重新載入後保留', async ({ page }) => {
  const response = await gotoTool(page)
  expect(response?.ok(), `${TOOL_ROUTE} 應成功載入`).toBe(true)

  await expect(page.locator('.custom-calendar-boundary')).toContainText('只保存在這台裝置')
  await expect(page.locator('.custom-calendar-storage')).toContainText('這台裝置還沒有自訂行事曆內容')

  await openDay(page, '2026-09-18')
  await addEntry(page, { title: ENTRY_TITLE, note: ENTRY_NOTE, mark: 'day-off' })

  await expect(page.locator('.custom-calendar-status')).toContainText('已在這台裝置保存')
  await expect(page.locator('.custom-calendar-entry')).toContainText(ENTRY_TITLE)
  await expect(page.locator('.custom-calendar-entry')).toContainText(ENTRY_NOTE)
  await expect(day(page, '2026-09-18')).toHaveAttribute('data-custom', 'day-off')
  await expect(page.locator('.custom-calendar-agenda')).toContainText(ENTRY_TITLE)

  // Reading the device again shows the same entry: it is persisted, not in memory.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
  await page.locator('[data-calendar-state="ready"]').waitFor()
  await openDay(page, '2026-09-18')
  await expect(page.locator('.custom-calendar-entry')).toContainText(ENTRY_TITLE)

  await clickEntryAction(page.locator('[data-entry-action="edit"]'))
  await page.locator('#custom-entry-end').fill('2026-09-20')
  await clickEntryAction(page.locator('[data-entry-action="save"]'), POINTER_PRESS_MS)
  await expect(page.locator('.custom-calendar-status')).toContainText('已更新')
  await expect(day(page, '2026-09-20'), '期間內每一天都要標示').toHaveAttribute('data-custom', 'day-off')

  // Deleting asks first, and the question is where the keyboard lands.
  await clickEntryAction(page.locator('[data-entry-action="delete"]'))
  await expect(page.locator('[data-entry-action="confirm-delete"]')).toBeFocused()
  await clickEntryAction(page.locator('[data-entry-action="cancel-delete"]'))
  await expect(page.locator('.custom-calendar-entry')).toHaveCount(1)

  await clickEntryAction(page.locator('[data-entry-action="delete"]'))
  await clickEntryAction(page.locator('[data-entry-action="confirm-delete"]'))
  await expect(page.locator('.custom-calendar-status')).toContainText('已刪除')
  await expect(day(page, '2026-09-18')).not.toHaveAttribute('data-custom', /.*/)
})

test('官方日別與自訂項目分成兩層，差異寫成文字', async ({ page }) => {
  await gotoTool(page)
  await openDay(page, '2026-09-18')
  await addEntry(page, { title: ENTRY_TITLE, mark: 'day-off' })

  const official = page.locator('.custom-calendar-layers__official')
  await expect(official, '官方日別不得被自訂項目改寫').toContainText('上班日')
  await expect(official).toContainText('民國 115 年')
  await expect(page.locator('.custom-calendar-layers__custom')).toContainText('自訂放假')
  await expect(page.locator('.custom-calendar-changed')).toContainText('與辦公日曆表不同')

  const cell = day(page, '2026-09-18')
  await expect(cell.locator('.calendar-day__custom'), '格子內要有文字，而不是只有顏色').toHaveText('自訂放假')
  await expect(cell).toHaveAttribute('data-changed', 'true')

  // 只留備註的日子同樣要有文字，否則格子的底色就成了唯一線索。
  await openDay(page, '2026-09-21')
  await addEntry(page, { title: `${ENTRY_TITLE}-3`, mark: 'note' })
  await expect(day(page, '2026-09-21').locator('.calendar-day__custom')).toHaveText('自訂備註')

  // 中秋節仍照辦公日曆表顯示，自訂上班不會改寫它。
  await openDay(page, '2026-09-25')
  await addEntry(page, { title: `${ENTRY_TITLE}-2`, mark: 'workday' })
  await expect(page.locator('.custom-calendar-layers__official')).toContainText('中秋節')
  await expect(page.locator('.custom-calendar-layers__custom')).toContainText('自訂上班')
  await expect(day(page, '2026-09-25')).toHaveAttribute('data-kind', 'national-holiday')
})

test('無法儲存的輸入會逐項說明，且不寫入裝置', async ({ page }) => {
  await gotoTool(page)
  await openDay(page, '2026-09-18')

  await clickEntryAction(page.locator('[data-entry-action="add"]'))
  await page.locator('#custom-entry-end').fill('2026-09-01')
  await clickEntryAction(page.locator('[data-entry-action="save"]'))

  const error = page.locator('.custom-calendar-form__error')
  await expect(error).toContainText('請先填寫項目名稱')
  await expect(error).toContainText('結束日期不能早於開始日期')
  await expect(page.locator('#custom-entry-title')).toHaveAttribute('aria-invalid', 'true')

  await page.locator('#custom-entry-title').fill(ENTRY_TITLE)
  await page.locator('#custom-entry-start').fill('2019-01-01')
  await page.locator('#custom-entry-end').fill('2019-01-02')
  await clickEntryAction(page.locator('[data-entry-action="save"]'))
  await expect(error).toContainText('目前只能加在')

  await clickEntryAction(page.locator('[data-entry-action="cancel"]'))
  await expect(page.locator('.custom-calendar-entry')).toHaveCount(0)
  await expect(page.locator('.custom-calendar-storage')).toContainText('這台裝置還沒有自訂行事曆內容')
})

test('匯出由使用者觸發、檔名只帶日期，匯入後恢復同一份項目', async ({ page }) => {
  await gotoTool(page)
  await openDay(page, '2026-09-18')
  await addEntry(page, { title: ENTRY_TITLE, note: ENTRY_NOTE, mark: 'day-off' })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-calendar-action="export"]').click(),
  ])

  const fileName = download.suggestedFilename()
  expect(fileName).toMatch(/^toolsliang-custom-calendar-\d{4}-\d{2}-\d{2}\.json$/)
  for (const canary of toolContent) {
    expect(fileName.includes(canary.value), `檔名不得含有工具內容（${canary.label}）`).toBe(false)
  }
  await expect(page.locator('.custom-calendar-status')).toContainText('已在這台裝置產生備份檔')

  await page.locator('[data-calendar-action="clear"]').click()
  await expect(page.locator('.custom-calendar-confirm')).toContainText('建議先匯出備份')
  await page.locator('[data-calendar-action="confirm-clear"]').click()
  await expect(page.locator('.custom-calendar-storage')).toContainText('這台裝置還沒有自訂行事曆內容')

  await page.setInputFiles('#custom-calendar-import', {
    name: 'custom-calendar-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupFile([
      { id: 'canary-1', title: IMPORTED_TITLE, startDate: '2026-09-18', endDate: '2026-09-18', mark: 'workday' },
    ]), 'utf8'),
  })
  await expect(page.locator('.custom-calendar-status')).toContainText('已匯入 1 筆新項目')
  await openDay(page, '2026-09-18')
  await expect(page.locator('.custom-calendar-entry')).toContainText(IMPORTED_TITLE)
})

test('備份檔裡不符合規則的項目整份拒絕，不寫入畫不出來的年度', async ({ page }) => {
  await gotoTool(page)

  await page.setInputFiles('#custom-calendar-import', {
    name: 'out-of-range.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupFile([
      { id: 'canary-2099', title: IMPORTED_TITLE, startDate: '2099-01-01', endDate: '2099-01-01', mark: 'day-off' },
    ]), 'utf8'),
  })

  const alert = page.locator('.custom-calendar-error')
  await expect(alert).toContainText('不符合目前規則')
  await expect(alert).toContainText('整份都沒有匯入')
  await expect(page.locator('.custom-calendar-storage')).toContainText('這台裝置還沒有自訂行事曆內容')
})

test('讀不到的匯入檔不改變裝置上的項目', async ({ page }) => {
  await gotoTool(page)
  await openDay(page, '2026-09-18')
  await addEntry(page, { title: ENTRY_TITLE, mark: 'day-off' })

  await page.setInputFiles('#custom-calendar-import', {
    name: 'not-a-calendar.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"other.tool","version":1,"entries":[]}', 'utf8'),
  })

  const alert = page.locator('.custom-calendar-error')
  await expect(alert).toContainText('不是可讀的自訂行事曆備份檔')
  await expect(alert).toContainText('這次沒有匯入任何項目')
  await expect(page.locator('.custom-calendar-entry'), '失敗的匯入不得改變裝置上的項目').toContainText(ENTRY_TITLE)
})

test('鍵盤可完成整段流程，網格只保留一個 Tab 停留點', async ({ page }) => {
  await gotoTool(page)
  await showMonth(page, 2026, 9)

  await day(page, '2026-09-10').focus()
  await page.keyboard.press('ArrowRight')
  await expect(day(page, '2026-09-11')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(day(page, '2026-09-18')).toBeFocused()

  const tabbable = await page.locator('.calendar-day[tabindex="0"]').count()
  expect(tabbable, '網格只保留一個 Tab 停留點，Tab 才能離開').toBe(1)

  await page.keyboard.press('Enter')
  await expect(page.locator('.custom-calendar-layers__official')).toContainText('民國 115 年')

  await clickEntryAction(page.locator('[data-entry-action="add"]'))
  await expect(page.locator('#custom-entry-title'), '打開表單後焦點落在第一個欄位').toBeFocused()
  await page.keyboard.type(ENTRY_TITLE)
  await page.locator('input[name="custom-entry-mark"][value="day-off"]').focus()
  await page.keyboard.press('Space')
  await clickEntryAction(page.locator('[data-entry-action="save"]'))

  await expect(page.locator('.custom-calendar-entry')).toContainText(ENTRY_TITLE)
  await expect(page.locator('.custom-calendar-status'), '狀態列可被聚焦，宣告剛剛發生的事').toBeFocused()
})

test('手機寬度可操作，並在 light 與 dark 模式通過 WCAG 2.2 AA', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoTool(page)
  await openDay(page, '2026-09-18')
  await addEntry(page, { title: ENTRY_TITLE, note: ENTRY_NOTE, mark: 'day-off' })

  const layout = await page.locator('html').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(layout.scrollWidth, `${testInfo.project.name} 375px 不得有橫向跑版`).toBeLessThanOrEqual(layout.clientWidth + 1)

  for (const target of [
    page.getByLabel('年份', { exact: true }),
    page.locator('.custom-calendar-entry [data-entry-action="edit"]'),
    page.locator('.custom-calendar-entry [data-entry-action="delete"]'),
    page.locator('[data-calendar-action="export"]'),
    page.locator('.custom-calendar-agenda__button').first(),
  ]) {
    const box = await target.boundingBox()
    expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
    expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
  }

  const importLabel = page.locator('.custom-calendar-storage__import label')
  await page.locator('#custom-calendar-import').focus()
  const importFocus = await importLabel.evaluate((element) => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) }
  })
  expect(importFocus.style, '匯入控制項聚焦時必須有可見輪廓').not.toBe('none')
  expect(importFocus.width, '匯入 focus 輪廓至少 3px').toBeGreaterThanOrEqual(3)

  for (const mode of ['light', 'dark'] as const) {
    if (mode === 'dark') {
      await page.getByRole('button', { name: '切換色彩模式' }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    }

    // Focusing the import control and switching themes can scroll the page.
    // Audit a fixed position after those actions: smooth scrolling lets the
    // sticky top bar partially cover month buttons while axe measures them.
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
    await expect.poll(() => page.evaluate(() => window.scrollY), '無障礙量測前頁面應停在頂端').toBe(0)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations, `${mode} 模式自訂行事曆無障礙違規：\n${results.violations.map(item => `${item.id}: ${item.help}`).join('\n')}`).toEqual([])
  }
})

test('自訂項目不進入網路請求、快取與偏好命名空間', async ({ page }) => {
  await gotoTool(page)
  await openDay(page, '2026-09-18')
  await addEntry(page, { title: ENTRY_TITLE, note: ENTRY_NOTE, mark: 'day-off' })
  await page.waitForLoadState('networkidle')

  const cacheEntries = await page.evaluate(async () => {
    const entries: Array<{ cache: string, url: string, body: string }> = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) {
        const response = await cache.match(request)
        entries.push({ cache: name, url: request.url, body: response ? await response.text() : '' })
      }
    }
    return entries
  })

  for (const entry of cacheEntries) {
    expect(entry.cache, '只允許版本化的應用資產快取').toMatch(/^toolsliang-/)
    for (const canary of toolContent) {
      expect(entry.url.includes(canary.value), `快取項目 URL 含有工具內容（${canary.label}）`).toBe(false)
      expect(entry.body.includes(canary.value), `快取內容含有工具內容（${canary.label}）`).toBe(false)
    }
  }

  const deviceStorage = await page.evaluate(() => ({
    local: Object.entries(window.localStorage).map(([key, value]) => `${key}=${value}`).join('\n'),
    session: Object.entries(window.sessionStorage).map(([key, value]) => `${key}=${value}`).join('\n'),
  }))

  for (const canary of toolContent) {
    expect(deviceStorage.local.includes(canary.value), `偏好命名空間含有工具內容（${canary.label}）`).toBe(false)
    expect(deviceStorage.session.includes(canary.value), `session 儲存含有工具內容（${canary.label}）`).toBe(false)
  }

  expect(page.url(), '自訂項目不得寫進網址').not.toContain(encodeURIComponent(ENTRY_TITLE))
})

test('英文頁以英文說明與拒絕', async ({ page }) => {
  await gotoTool(page, EN_TOOL_ROUTE)
  await openDay(page, '2026-09-18', 'en')

  await expect(page.locator('.custom-calendar-boundary')).toContainText('this device')
  await clickEntryAction(page.locator('[data-entry-action="add"]'))
  await clickEntryAction(page.locator('[data-entry-action="save"]'))
  await expect(page.locator('.custom-calendar-form__error')).toContainText('Enter a name for this entry')

  await page.locator('#custom-entry-title').fill(ENTRY_TITLE)
  await page.locator('input[name="custom-entry-mark"][value="day-off"]').check()
  await clickEntryAction(page.locator('[data-entry-action="save"]'))

  await expect(page.locator('.custom-calendar-layers__custom')).toContainText('Custom day off')
  await expect(page.locator('.custom-calendar-caveats')).toContainText('never sync as cloud preferences')
})

/**
 * Restarting offline needs the Service Worker to serve the App Shell, and only
 * Chromium exposes a verifiable Service Worker lifecycle in Playwright. The
 * device database itself is covered browser-independently by the unit suite.
 */
test.describe('離線後的自訂行事曆', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Service Worker 生命週期只在 Chromium 可驗證')

  test('離線重新啟動仍可檢視、新增與刪除自訂項目', async ({ page, context }) => {
    await gotoHydrated(page, TOOL_ROUTE)
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20_000 })
    await page.locator('[data-calendar-state="ready"]').waitFor()
    await openDay(page, '2026-09-18')
    await addEntry(page, { title: ENTRY_TITLE, mark: 'day-off' })
    await page.waitForLoadState('networkidle')

    expectOfflineRequests(page)
    await context.setOffline(true)
    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForHydration(page)
      await page.locator('[data-calendar-state="ready"]').waitFor()

      await openDay(page, '2026-09-18')
      await expect(page.locator('.custom-calendar-entry')).toContainText(ENTRY_TITLE)

      await addEntry(page, { title: `${ENTRY_TITLE}-offline`, mark: 'note' })
      await expect(page.locator('.custom-calendar-entry')).toHaveCount(2)

      await clickEntryAction(page.locator('.custom-calendar-entry').first().locator('[data-entry-action="delete"]'))
      await clickEntryAction(page.locator('[data-entry-action="confirm-delete"]'))
      await expect(page.locator('.custom-calendar-entry')).toHaveCount(1)
    }
    finally {
      await context.setOffline(false)
    }
  })
})
