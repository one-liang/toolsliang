import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { gotoHydrated, waitForHydration } from './support/hydration'
import { inspectNetworkRequest } from './support/privacy-boundary'
import { publishedTools } from '../../app/features/tools/catalog'

const TOOL_ROUTE = '/zh-tw/tools/ntd-uppercase/'
const DIRECTORY_ROUTE = '/zh-tw/tools/'
const DESIGN_SYSTEM_ROUTE = '/zh-tw/design-system/'
const THEME_STORAGE_KEY = 'toolsliang-theme'
// Sub-pixel layout can report a 44px target as 43.999996; the same tolerance as the tool quality gate.
const TOUCH_TARGET_TOLERANCE_PX = 0.001
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
/** The NEW window is read from the registry so the check never pins a date that ages out. */
const NEW_STATUS_TOOL = publishedTools.find(tool => tool.status?.kind === 'new' && tool.status.startsAt && tool.status.endsAt)!
const NEW_STATUS_WINDOW = NEW_STATUS_TOOL.status as { startsAt: string; endsAt: string }
const NEW_STATUS_TOOL_ROUTE = `/zh-tw/tools/${NEW_STATUS_TOOL.slug}/`

function dayAfter(date: string) {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

interface ShellFindings {
  consoleErrors: string[]
  pageErrors: string[]
  networkFindings: string[]
}

const findingsByPage = new WeakMap<Page, ShellFindings>()

test.beforeEach(({ page }) => {
  const findings: ShellFindings = { consoleErrors: [], pageErrors: [], networkFindings: [] }
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
  expect(findings.networkFindings, `App Shell 不得對第三方發出請求：\n${findings.networkFindings.join('\n')}`).toEqual([])
  expect(findings.consoleErrors, `console errors：\n${findings.consoleErrors.join('\n')}`).toEqual([])
  expect(findings.pageErrors, `page errors：\n${findings.pageErrors.join('\n')}`).toEqual([])
})

async function pressFocusForward(page: Page, testInfo: TestInfo) {
  await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
}


async function reloadHydrated(page: Page) {
  // This tests a persisted preference, not an interrupted navigation: the
  // sidebar prefetches the payload of every tool route it can see, and a reload
  // in the middle of those requests cancels them, which the browser reports as
  // an error even though the next load fetches them again.
  await page.waitForLoadState('networkidle')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
}

function readStoredTheme(page: Page) {
  return page.evaluate(key => window.localStorage.getItem(key), THEME_STORAGE_KEY)
}

function contrastAgainstBackground(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    function channels(color: string) {
      return color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
    }
    function luminance(color: string) {
      const [red, green, blue] = channels(color)
      return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722
    }

    const foreground = luminance(getComputedStyle(element).color)
    const background = luminance(getComputedStyle(document.body).backgroundColor)
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
  })
}

for (const viewport of [
  { width: 375, height: 812, label: '手機' },
  { width: 768, height: 1024, label: '平板' },
]) {
  test(`${viewport.label} ${viewport.width}px 以底部導覽與分類 drawer 瀏覽全部分類`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await gotoHydrated(page, DIRECTORY_ROUTE)

    const bottomNav = page.locator('.mobile-nav')
    await expect(bottomNav).toBeVisible()
    await expect(bottomNav.locator('.mobile-nav__item')).toHaveCount(4)

    for (const item of await bottomNav.locator('.mobile-nav__item').all()) {
      const box = await item.boundingBox()
      expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '底部導覽目標寬度至少 44px').toBeGreaterThanOrEqual(44)
      expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '底部導覽目標高度至少 44px').toBeGreaterThanOrEqual(44)
    }

    const trigger = page.getByRole('button', { name: '分類' })
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')

    // The drawer entry is part of the bottom navigation tab order.
    await bottomNav.getByRole('link', { name: '工具' }).focus()
    await pressFocusForward(page, testInfo)
    await expect(trigger).toBeFocused()

    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('heading', { name: '工具分類' })).toBeVisible()

    const categoryTitles = drawer.locator('.drawer-category__title')
    const sidebarCategoryCount = await page.locator('.app-sidebar .sidebar-group').count()
    expect(await categoryTitles.count(), '分類導覽需列出所有已上線分類').toBeGreaterThan(0)
    expect(await categoryTitles.count()).toBe(sidebarCategoryCount)
    for (const title of await categoryTitles.all()) {
      await expect(title.locator('svg'), '分類大標題不使用圖示').toHaveCount(0)
    }

    const drawerDimensions = await page.locator('html').evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(drawerDimensions.scrollWidth, '分類導覽開啟時不得有橫向跑版')
      .toBeLessThanOrEqual(drawerDimensions.clientWidth + 1)

    for (const target of [...await drawer.locator('.drawer-tool-link').all(), drawer.getByRole('button', { name: '關閉分類導覽' })]) {
      const box = await target.boundingBox()
      expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '分類導覽操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
    }

    // Focus is trapped inside the drawer and returns to the trigger on Escape.
    await expect(drawer.locator(':focus')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(trigger).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').locator('.drawer-tool-link').first().click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page).toHaveURL(/\/zh-tw\/tools\/[a-z0-9-]+\/$/)
  })
}

test('桌面側邊欄可用鍵盤收合，收合後仍能開啟每個工具', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, DIRECTORY_ROUTE)

  const sidebar = page.locator('.app-sidebar')
  await expect(sidebar).toBeVisible()
  const expandedTools = await sidebar.locator('.sidebar-tool-link').count()
  expect(expandedTools, '側邊欄需列出工具').toBeGreaterThan(0)

  const collapseButton = page.getByRole('button', { name: '收合側邊欄' })
  await collapseButton.focus()
  await expect(collapseButton).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Enter')

  const expandButton = page.getByRole('button', { name: '展開側邊欄' })
  await expect(expandButton).toHaveAttribute('aria-expanded', 'false')
  await expect(sidebar).toHaveClass(/app-sidebar--collapsed/)

  const collapsedTools = sidebar.locator('.sidebar-tool-link')
  await expect(collapsedTools).toHaveCount(expandedTools)
  for (const link of await collapsedTools.all()) {
    await expect(link).toBeVisible()
    expect((await link.textContent())?.trim().length, '收合後工具仍需有可讀名稱').toBeGreaterThan(0)
  }

  await collapsedTools.first().click()
  await expect(page).toHaveURL(/\/zh-tw\/tools\/[a-z0-9-]+\/$/)

  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: '展開側邊欄' })).toBeVisible()
})

test('主題預設亮色，只有使用者主動切換後才保存偏好', async ({ page }) => {
  await gotoHydrated(page, TOOL_ROUTE)

  await expect(page.locator('html')).not.toHaveClass(/dark/)
  expect(await readStoredTheme(page), '未切換前不得寫入偏好').toBeNull()

  await reloadHydrated(page)
  expect(await readStoredTheme(page), '重新載入仍不得寫入偏好').toBeNull()

  const themeToggle = page.getByRole('button', { name: '切換色彩模式' })
  await themeToggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await readStoredTheme(page)).toBe('dark')

  await reloadHydrated(page)
  await expect(page.locator('html'), '重新載入需沿用已保存的偏好').toHaveClass(/dark/)

  await page.getByRole('button', { name: '切換色彩模式' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  expect(await readStoredTheme(page)).toBe('light')
})

test('中英文切換保留目前工具，並套用對應字體', async ({ page }) => {
  await gotoHydrated(page, TOOL_ROUTE)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-TW')

  await page.getByRole('link', { name: 'EN' }).click()
  await expect(page).toHaveURL(/\/en\/tools\/ntd-uppercase\/$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  const englishFont = await page.locator('body').evaluate(element => getComputedStyle(element).fontFamily)
  expect(englishFont, '英文介面使用 Roboto').toContain('Roboto')

  await page.getByRole('link', { name: '繁中' }).click()
  await expect(page).toHaveURL(/\/zh-tw\/tools\/ntd-uppercase\/$/)
})

test('分類大標題以字級與間距建立層級，不使用圖示', async ({ page }) => {
  await gotoHydrated(page, DIRECTORY_ROUTE)

  const headers = page.locator('.category-panel__header')
  expect(await headers.count()).toBeGreaterThan(0)
  await expect(page.locator('.category-panel__icon')).toHaveCount(0)
  await expect(headers.locator('svg')).toHaveCount(0)

  const heading = headers.first().locator('h2')
  const typography = await heading.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      size: Number.parseFloat(style.fontSize),
      weight: Number.parseFloat(style.fontWeight),
      gap: Number.parseFloat(style.marginBottom),
      bodySize: Number.parseFloat(getComputedStyle(document.body).fontSize),
    }
  })
  expect(typography.size, '分類標題需大於內文').toBeGreaterThan(typography.bodySize)
  expect(typography.weight, '分類標題需加重字重').toBeGreaterThanOrEqual(700)
  expect(typography.gap, '分類標題需與說明保留間距').toBeGreaterThan(0)
})

test('Design System Page 可驗證 loading、disabled、error、success 與互動狀態', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, DESIGN_SYSTEM_ROUTE)

  const loading = page.locator('[data-state-demo="loading"]')
  await expect(loading).toHaveAttribute('aria-busy', 'true')
  await expect(loading).toContainText('處理中')

  await expect(page.locator('[data-state-demo="disabled"]')).toBeDisabled()

  const errorField = page.locator('[data-state-demo="error"]')
  await expect(errorField).toHaveAttribute('aria-invalid', 'true')
  const describedBy = await errorField.getAttribute('aria-describedby')
  await expect(page.locator(`#${describedBy}`)).toHaveText('請輸入零以上、小數點後最多兩位的金額。')

  await expect(page.locator('[data-state-demo="success"]')).toContainText('已複製結果')

  const focusDemo = page.locator('[data-state-demo="focus"]')
  await focusDemo.focus()
  const focusStyle = await focusDemo.evaluate((element) => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) }
  })
  expect(focusStyle.style, 'focus 必須有可見輪廓').not.toBe('none')
  expect(focusStyle.width, 'focus 輪廓至少 3px').toBeGreaterThanOrEqual(3)

  const hoverDemo = page.locator('[data-state-demo="hover"]')
  const restingBorder = await hoverDemo.evaluate(element => getComputedStyle(element).borderColor)
  await hoverDemo.hover()
  await expect.poll(() => hoverDemo.evaluate(element => getComputedStyle(element).borderColor))
    .not.toBe(restingBorder)

  const activeDemo = page.locator('[data-state-demo="active"]')
  const restingBackground = await activeDemo.evaluate(element => getComputedStyle(element).backgroundColor)
  await activeDemo.hover()
  await page.mouse.down()
  try {
    await expect
      .poll(() => activeDemo.evaluate(element => getComputedStyle(element).backgroundColor))
      .not.toBe(restingBackground)
  }
  finally {
    await page.mouse.up()
  }

  await expect(page.locator('.shell-showcase .tool-card').first()).toBeVisible()
})

test('Design System Page 在 light 與 dark 皆符合 WCAG 2.2 AA 與主色對比', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, DESIGN_SYSTEM_ROUTE)

  for (const mode of ['light', 'dark'] as const) {
    if (mode === 'dark') {
      await page.getByRole('button', { name: '切換色彩模式' }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    }

    const primaryContrast = await contrastAgainstBackground(page, '.eyebrow')
    expect(primaryContrast, `${mode} 模式暖橘主色文字對比至少 4.5:1`).toBeGreaterThanOrEqual(4.5)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations, `${mode} 模式無障礙違規：\n${results.violations.map(item => `${item.id}: ${item.help}`).join('\n')}`).toEqual([])
  }
})

test('手機分類 drawer 在 light 與 dark 皆通過無障礙自動檢查', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoHydrated(page, DIRECTORY_ROUTE)

  for (const mode of ['light', 'dark'] as const) {
    if (mode === 'dark') {
      await page.getByRole('button', { name: '切換色彩模式' }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    }

    await page.getByRole('button', { name: '分類' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations, `${mode} 模式分類導覽無障礙違規：\n${results.violations.map(item => `${item.id}: ${item.help}`).join('\n')}`).toEqual([])

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  }
})

test('NEW 標籤由訪客裝置日期決定，預先產生的頁面跨過效期也不產生 hydration mismatch', async ({ page }) => {
  // Every tool page is prerendered, so a NEW label baked into the HTML would
  // carry the build machine's date; the console-error check in afterEach is
  // what fails when the visitor's device disagrees with it.
  const prerendered = await (await page.request.get(NEW_STATUS_TOOL_ROUTE)).text()
  expect(prerendered, '預先產生的 HTML 不得帶入建置日期推導的 NEW 標籤').not.toContain('ui-badge--new')

  await page.clock.setFixedTime(new Date(`${dayAfter(NEW_STATUS_WINDOW.endsAt)}T09:00:00Z`))
  await gotoHydrated(page, NEW_STATUS_TOOL_ROUTE)
  await expect(page.locator('.tool-heading__title-row .ui-badge--new')).toHaveCount(0)

  await page.clock.setFixedTime(new Date(`${NEW_STATUS_WINDOW.startsAt}T09:00:00Z`))
  await gotoHydrated(page, NEW_STATUS_TOOL_ROUTE)
  await expect(page.locator('.tool-heading__title-row .ui-badge--new')).toHaveText('NEW')

  await gotoHydrated(page, DIRECTORY_ROUTE)
  const card = page.locator('.tool-card', { has: page.locator(`a[href="${NEW_STATUS_TOOL_ROUTE}"]`) })
  await expect(card.locator('.ui-badge--new')).toHaveText('NEW')

  await page.clock.setFixedTime(new Date(`${dayAfter(NEW_STATUS_WINDOW.endsAt)}T09:00:00Z`))
  await gotoHydrated(page, DIRECTORY_ROUTE)
  await expect(card.locator('.ui-badge--new')).toHaveCount(0)
})
