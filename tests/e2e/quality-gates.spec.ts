import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { inspectNetworkRequest, redactToolContent } from './support/privacy-boundary'

const TOOL_ROUTE = '/zh-tw/tools/ntd-uppercase/'
const TOOL_INPUT = '10001.09'
const TOOL_OUTPUT = '新台幣壹萬零壹元玖分'
const PAGE_LOAD_BUDGET_MS = 5_000
const TOOL_RESPONSE_BUDGET_MS = 1_000

async function gotoTool(page: Page) {
  const response = await page.goto(TOOL_ROUTE, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  return response
}

async function pressFocusForward(page: Page, testInfo: TestInfo) {
  await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
}

test('代表性工具的內容留在裝置，且核心流程可用鍵盤完成', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const networkFindings: string[] = []
  const toolContent = [
    { label: '輸入', value: TOOL_INPUT },
    { label: '輸出', value: TOOL_OUTPUT },
    { label: '檔名', value: 'quality-fixture.pdf' },
  ]

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(redactToolContent(message.text(), toolContent))
  })
  page.on('pageerror', error => pageErrors.push(redactToolContent(error.message, toolContent)))
  page.on('request', (request) => {
    networkFindings.push(...inspectNetworkRequest({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      body: request.postData(),
    }, toolContent))
  })
  page.on('websocket', (socket) => {
    networkFindings.push(...inspectNetworkRequest({
      url: socket.url(),
      method: 'WEBSOCKET',
      headers: {},
      body: null,
    }, toolContent))
  })

  const response = await gotoTool(page)
  expect(response?.ok(), `${TOOL_ROUTE} 應成功載入`).toBe(true)

  await pressFocusForward(page, testInfo)
  await expect(page.getByRole('link', { name: '跳至主要內容' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main-content')).toBeFocused()

  const amount = page.getByLabel('輸入金額（新台幣）')
  await amount.focus()
  await amount.fill(TOOL_INPUT)
  await expect(page.locator('.result-panel')).toContainText(TOOL_OUTPUT)
  await pressFocusForward(page, testInfo)
  await expect(page.getByRole('button', { name: '複製結果' })).toBeFocused()
  const focusStyle = await page.getByRole('button', { name: '複製結果' }).evaluate((element) => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) }
  })
  expect(focusStyle.style, '鍵盤 focus 必須有可見輪廓').not.toBe('none')
  expect(focusStyle.width, '鍵盤 focus 輪廓至少 2px').toBeGreaterThanOrEqual(2)
  await pressFocusForward(page, testInfo)
  await expect(page.getByRole('button', { name: '清除' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.result-panel')).toContainText('—')
  expect(await amount.evaluate(element => (element as HTMLInputElement).value)).toBe('')

  expect(networkFindings, `工具內容網路邊界違規：\n${networkFindings.join('\n')}`).toEqual([])
  expect(consoleErrors, `console errors：\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors：\n${pageErrors.join('\n')}`).toEqual([])
})

test('light 與 dark 模式皆通過 WCAG 2.2 AA 自動檢查', async ({ page }) => {
  await gotoTool(page)

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
  { width: 1024, height: 768, label: '桌面' },
  { width: 1440, height: 1000, label: '寬桌面' },
]) {
  test(`${viewport.label} ${viewport.width}px 無橫向跑版且導覽可觸控`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await gotoTool(page)

    const dimensions = await page.locator('html').evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(dimensions.scrollWidth, `${viewport.label} 不得有橫向跑版`).toBeLessThanOrEqual(dimensions.clientWidth + 1)

    const mobileNavigation = page.locator('.mobile-nav')
    const desktopSidebar = page.locator('.app-sidebar')
    if (viewport.width < 1024) {
      await expect(mobileNavigation).toBeVisible()
      await expect(desktopSidebar).toBeHidden()
      for (const target of await mobileNavigation.getByRole('link').all()) {
        const box = await target.boundingBox()
        expect(box?.width, '手機導覽目標寬度至少 44px').toBeGreaterThanOrEqual(44)
        expect(box?.height, '手機導覽目標高度至少 44px').toBeGreaterThanOrEqual(44)
      }
    }
    else {
      await expect(desktopSidebar).toBeVisible()
      await expect(mobileNavigation).toBeHidden()
    }

    const amount = page.getByLabel('輸入金額（新台幣）')
    await amount.fill(TOOL_INPUT)
    await expect(page.locator('.result-panel')).toContainText(TOOL_OUTPUT)
    await page.getByRole('button', { name: '清除' }).click()
    await expect(amount).toHaveValue('')
  })
}

test('reduced motion 與基本效能預算通過', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/zh-tw/design-system/', { waitUntil: 'domcontentloaded' })
  await page.locator('.motion-dot').waitFor()
  await page.reload({ waitUntil: 'load' })

  const animationDuration = await page.locator('.motion-dot').evaluate((element) => {
    return Number.parseFloat(getComputedStyle(element).animationDuration) * 1_000
  })
  expect(animationDuration, 'reduced motion 動畫時間應接近零').toBeLessThanOrEqual(1)

  const navigationDuration = await page.evaluate(() => {
    return performance.getEntriesByType('navigation')[0]?.duration ?? Number.POSITIVE_INFINITY
  })
  expect(navigationDuration, `頁面載入需低於 ${PAGE_LOAD_BUDGET_MS}ms`).toBeLessThan(PAGE_LOAD_BUDGET_MS)

  await gotoTool(page)
  const toolResponseDuration = await page.evaluate(({ budget, input, output }) => {
    const amount = document.querySelector<HTMLInputElement>('#ntd-amount')!
    const result = document.querySelector<HTMLElement>('.result-panel')!

    return new Promise<number>((resolve, reject) => {
      const startedAt = performance.now()
      const observer = new MutationObserver(() => {
        if (result.textContent?.includes(output)) {
          observer.disconnect()
          resolve(performance.now() - startedAt)
        }
      })
      observer.observe(result, { childList: true, characterData: true, subtree: true })
      amount.value = input
      amount.dispatchEvent(new Event('input', { bubbles: true }))
      window.setTimeout(() => {
        observer.disconnect()
        reject(new Error('工具結果未在效能量測期限內更新'))
      }, budget)
    })
  }, { budget: TOOL_RESPONSE_BUDGET_MS, input: TOOL_INPUT, output: TOOL_OUTPUT })
  expect(toolResponseDuration, `工具回應需低於 ${TOOL_RESPONSE_BUDGET_MS}ms`).toBeLessThan(TOOL_RESPONSE_BUDGET_MS)
})
