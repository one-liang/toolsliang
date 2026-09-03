import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { inspectNetworkRequest, inspectWebSocketFrame, redactToolContent } from './support/privacy-boundary'

const TOOL_ROUTE = '/zh-tw/tools/ntd-uppercase/'
const TOOL_INPUT = '10001.09'
const TOOL_OUTPUT = '新臺幣壹萬零壹元玖分'
const SECONDARY_TOOL_INPUT = '765432.10'
const SECONDARY_TOOL_OUTPUT = '新臺幣柒拾陸萬伍仟肆佰參拾貳元壹角'
const INVALID_TOOL_INPUT = 'quality-invalid-input-8af3'
const PAGE_LOAD_BUDGET_MS = 5_000
const TOOL_RESPONSE_BUDGET_MS = 50
const TOUCH_TARGET_TOLERANCE_PX = 0.001
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
const TOOL_CONTENT = [
  { label: '輸入', value: TOOL_INPUT },
  { label: '輸出', value: TOOL_OUTPUT },
  { label: '輸入', value: SECONDARY_TOOL_INPUT },
  { label: '輸出', value: SECONDARY_TOOL_OUTPUT },
  { label: '輸入', value: INVALID_TOOL_INPUT },
  { label: '檔名', value: 'quality-fixture.pdf' },
]

interface QualityFindings {
  consoleErrors: string[]
  pageErrors: string[]
  networkFindings: string[]
}

const findingsByPage = new WeakMap<Page, QualityFindings>()

test.beforeEach(({ page }) => {
  const findings: QualityFindings = {
    consoleErrors: [],
    pageErrors: [],
    networkFindings: [],
  }
  findingsByPage.set(page, findings)

  page.on('console', (message) => {
    if (message.type() === 'error') findings.consoleErrors.push(redactToolContent(message.text(), TOOL_CONTENT))
  })
  page.on('pageerror', error => findings.pageErrors.push(redactToolContent(error.message, TOOL_CONTENT)))
  page.context().on('request', (request) => {
    findings.networkFindings.push(...inspectNetworkRequest({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      body: request.postData(),
    }, TOOL_CONTENT, NETWORK_BOUNDARY_POLICY))
  })
  page.on('websocket', (socket) => {
    findings.networkFindings.push(...inspectNetworkRequest({
      url: socket.url(),
      method: 'WEBSOCKET',
      headers: {},
      body: null,
    }, TOOL_CONTENT, NETWORK_BOUNDARY_POLICY))
    socket.on('framesent', (event) => {
      findings.networkFindings.push(...inspectWebSocketFrame(
        socket.url(),
        event.payload,
        TOOL_CONTENT,
        NETWORK_BOUNDARY_POLICY,
      ))
    })
  })
})

test.afterEach(({ page }) => {
  const findings = findingsByPage.get(page)!
  expect(findings.networkFindings, `工具內容網路邊界違規：\n${findings.networkFindings.join('\n')}`).toEqual([])
  expect(findings.consoleErrors, `console errors：\n${findings.consoleErrors.join('\n')}`).toEqual([])
  expect(findings.pageErrors, `page errors：\n${findings.pageErrors.join('\n')}`).toEqual([])
})

async function gotoTool(page: Page) {
  const response = await page.goto(TOOL_ROUTE, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  return response
}

async function pressFocusForward(page: Page, testInfo: TestInfo) {
  await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
}

test('工具進頁即可操作，並在功能後提供清楚的使用說明', async ({ page }) => {
  await gotoTool(page)

  const amount = page.getByLabel('輸入金額（新臺幣）')
  await expect(amount).toHaveValue('')
  await expect(amount).toHaveAttribute('placeholder', '例如：12,850.50')
  await expect(amount).toHaveAttribute('aria-invalid', 'false')
  await expect(page.getByRole('alert')).toHaveCount(0)

  const workspace = page.locator('.tool-workspace')
  const beforeYouStart = page.getByRole('heading', { name: '開始前先知道' })
  expect(await workspace.evaluate(element => element.compareDocumentPosition(
    document.getElementById('tool-answer-ntd-uppercase')!,
  ) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy()
  await expect(beforeYouStart).toBeVisible()

  await expect(page.locator('.tool-heading__icon')).toHaveCount(0)
  await expect(page.getByText('輸入與結果只在此裝置處理。')).toHaveCount(0)
  await expect(page.getByText('轉換只在此瀏覽器執行。', { exact: false })).toHaveCount(0)

  const referenceTable = page.getByRole('table', { name: '數字與國字大寫對照' })
  await expect(referenceTable).toBeVisible()
  await expect(referenceTable.getByRole('row', { name: '1 壹' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '資料來源與審閱' })).toBeVisible()
})

test('英文頁以英文說明輸入錯誤', async ({ page }) => {
  await page.goto('/en/tools/ntd-uppercase/', { waitUntil: 'domcontentloaded' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  await page.getByLabel('Amount (NTD)').fill(INVALID_TOOL_INPUT)

  await expect(page.getByRole('alert')).toHaveText('Enter an amount of zero or more with up to two decimal places.')
})

test('複製按鈕以淺色圖文呈現，且符合一般文字對比', async ({ page }) => {
  await gotoTool(page)

  for (const mode of ['light', 'dark'] as const) {
    if (mode === 'dark') {
      await page.getByRole('button', { name: '切換色彩模式' }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    }
    await page.getByLabel('輸入金額（新臺幣）').fill(SECONDARY_TOOL_INPUT)

    const contrast = await page.getByRole('button', { name: '複製結果' }).evaluate((element) => {
      function luminance(color: string) {
        const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((channel) => {
          const value = channel / 255
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        })
        return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
      }

      const style = getComputedStyle(element)
      const foreground = luminance(style.color)
      const background = luminance(style.backgroundColor)
      return {
        foreground,
        background,
        ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
      }
    })

    expect(contrast.foreground, `${mode} 模式圖示與文字應比按鈕背景亮`).toBeGreaterThan(contrast.background)
    expect(contrast.ratio, `${mode} 模式圖示與文字對比至少 4.5:1`).toBeGreaterThanOrEqual(4.5)
  }
})

test('代表性工具的內容留在裝置，且核心流程可用鍵盤完成', async ({ page }, testInfo) => {
  const response = await gotoTool(page)
  expect(response?.ok(), `${TOOL_ROUTE} 應成功載入`).toBe(true)

  await pressFocusForward(page, testInfo)
  await expect(page.getByRole('link', { name: '跳至主要內容' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main-content')).toBeFocused()

  const amount = page.getByLabel('輸入金額（新臺幣）')
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

})

test('light 與 dark 模式皆通過 WCAG 2.2 AA 自動檢查', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('輸入金額（新臺幣）').fill(SECONDARY_TOOL_INPUT)

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

    const amount = page.getByLabel('輸入金額（新臺幣）')
    await amount.fill(TOOL_INPUT)
    await expect(page.locator('.result-panel')).toContainText(TOOL_OUTPUT)

    const coreTargets = [
      amount,
      page.getByRole('button', { name: '加入常用' }),
      page.getByRole('button', { name: '複製結果' }),
      page.getByRole('button', { name: '清除' }),
    ]
    for (const target of coreTargets) {
      const box = await target.boundingBox()
      expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
      expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
    }

    await page.getByRole('button', { name: '清除' }).click()
    await expect(amount).toHaveValue('')
  })
}

test('reduced motion 取消非必要動畫', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/zh-tw/design-system/', { waitUntil: 'networkidle' })
  await page.locator('.motion-dot').waitFor()

  const animationDuration = await page.locator('.motion-dot').evaluate((element) => {
    return Number.parseFloat(getComputedStyle(element).animationDuration) * 1_000
  })
  expect(animationDuration, 'reduced motion 動畫時間應接近零').toBeLessThanOrEqual(1)
})

test('工具頁載入與轉換符合基本效能預算', async ({ page }) => {
  await page.goto(TOOL_ROUTE, { waitUntil: 'load' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  const navigationDuration = await page.evaluate(() => {
    return performance.getEntriesByType('navigation')[0]?.duration ?? Number.POSITIVE_INFINITY
  })
  expect(navigationDuration, `頁面載入需低於 ${PAGE_LOAD_BUDGET_MS}ms`).toBeLessThan(PAGE_LOAD_BUDGET_MS)

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
