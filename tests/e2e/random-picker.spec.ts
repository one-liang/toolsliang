import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { guardToolContentBoundary } from './support/tool-content-boundary'

const TOOL_ROUTE = '/zh-tw/tools/random-picker/'
const FIRST = '抽選測試甲-9c41'
const SECOND = '抽選測試乙-9c41'
const THIRD = '抽選測試丙-9c41'
const CANDIDATES = [FIRST, SECOND, THIRD].join('\n')
const ADDED = '抽選測試丁-9c41'
const TOUCH_TARGET_TOLERANCE_PX = 0.001
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
/**
 * Every candidate this suite types and every name it reads back. The suffix
 * keeps a candidate from also matching a hashed asset filename and failing the
 * boundary check for the wrong reason.
 */
const TOOL_CONTENT = [
  { label: '輸入', value: FIRST },
  { label: '輸入', value: SECOND },
  { label: '輸入', value: THIRD },
  { label: '輸入', value: ADDED },
]

guardToolContentBoundary(TOOL_CONTENT, NETWORK_BOUNDARY_POLICY)

async function gotoTool(page: Page, route = TOOL_ROUTE) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  return response
}

/**
 * Pins the draw so a test can name the winner. Only the 32-bit words the picker
 * asks for are replaced; anything else in the page keeps the real source.
 */
async function alwaysDrawTheFirstEntry(page: Page) {
  await page.addInitScript(() => {
    const source = crypto as Crypto & { getRandomValues: (array: ArrayBufferView) => ArrayBufferView }
    const original = source.getRandomValues.bind(source)
    Object.defineProperty(source, 'getRandomValues', {
      configurable: true,
      value: (array: ArrayBufferView) => (array instanceof Uint32Array ? array.fill(0) : original(array)),
    })
  })
}

async function fillCandidates(page: Page, candidates = CANDIDATES) {
  await page.getByLabel('候選名單').fill(candidates)
}

test('工具開啟即說明等機率作法、界線與來源', async ({ page }) => {
  const response = await gotoTool(page)
  expect(response?.ok(), `${TOOL_ROUTE} 應成功載入`).toBe(true)

  await expect(page.getByRole('radio', { name: '保留重複（各佔一個機會）' })).toBeChecked()
  await expect(page.getByRole('radio', { name: '名單' })).toBeChecked()
  await expect(page.locator('.picker-result')).toContainText('準備好名單後按')

  const caveats = page.locator('.picker-caveats')
  await expect(caveats, '無法稽核必須在結果附近，而不是只在頁尾').toContainText('無法向別人證明結果沒有被重抽')
  await expect(caveats).toContainText('不會送出、不會保存')
  await expect(page.locator('.picker-source')).toContainText('random-picker-2026-09-05')
  await expect(page.locator('.picker-source').getByRole('link', { name: /Web Cryptography API/ })).toBeVisible()

  await expect(page.locator('.picker-method')).toContainText('Fisher–Yates')
  await expect(page.locator('.picker-method')).toContainText('拒絕取樣')
  await expect(page.getByRole('heading', { name: '關於這個工具的常見問題' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '資料來源與審閱' })).toBeVisible()
})

test('抽選結果由 live region 宣告，多名抽選不重複中選', async ({ page }) => {
  await gotoTool(page)
  await fillCandidates(page)
  await expect(page.locator('.picker-summary')).toContainText('可抽選項目 3 筆')

  await page.getByLabel('抽出幾名').fill('2')
  await page.getByRole('button', { name: '開始抽選' }).click()

  const result = page.locator('.picker-result')
  await expect(result).toHaveAttribute('role', 'status')
  await expect(result).toHaveAttribute('aria-live', 'polite')
  await expect(page.locator('.picker-result__item')).toHaveCount(2)

  const drawn = await page.locator('.picker-result__item').allInnerTexts()
  expect(new Set(drawn).size, '多人抽選不得重複中選').toBe(2)
  for (const entry of drawn) expect([FIRST, SECOND, THIRD]).toContain(entry)
})

test('逐項新增與空白行處理都看得見', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('候選名單').fill(`${FIRST}\n\n  \n${SECOND}`)
  await expect(page.locator('.picker-summary')).toContainText('略過空白行 2 行')

  await page.getByLabel('逐項新增').fill(ADDED)
  await page.getByRole('button', { name: '加入名單' }).click()
  await expect(page.getByLabel('候選名單')).toHaveValue(`${FIRST}\n\n  \n${SECOND}\n${ADDED}`)
  await expect(page.locator('.picker-summary')).toContainText('可抽選項目 3 筆')
})

test('重複項目策略由使用者決定，並說明目前的機會分配', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('候選名單').fill(`${FIRST}\n${FIRST}\n${SECOND}`)
  await expect(page.locator('.picker-caveats')).toContainText('目前設定讓它們各佔一個機會')

  await page.getByRole('radio', { name: '合併重複（同名只算一次）' }).check()
  await expect(page.locator('.picker-summary')).toContainText('合併重複 1 筆')
  await expect(page.locator('.picker-caveats')).not.toContainText('目前設定讓它們各佔一個機會')
})

test('輪盤可以跳過，跳過後仍是同一個已決定的結果', async ({ page }) => {
  await alwaysDrawTheFirstEntry(page)
  await gotoTool(page)
  await fillCandidates(page)
  await page.getByRole('radio', { name: '輪盤' }).check()
  await expect(page.locator('.picker-wheel')).toBeVisible()
  await expect(page.locator('.picker-candidates'), '輪盤旁必須有可讀的候選名單').toContainText(THIRD)

  await page.getByRole('button', { name: '開始抽選' }).click()
  await expect(page.locator('.picker-result')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('progressbar', { name: '輪盤進度' })).toBeVisible()
  await expect(page.locator('.picker-result__item'), '動畫還沒停就不得宣告結果').toHaveCount(0)

  await page.getByRole('button', { name: '跳過動畫' }).click()
  await expect(page.locator('.picker-result')).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.picker-result__item')).toHaveText([FIRST])
  await expect(page.getByRole('button', { name: '跳過動畫' })).toHaveCount(0)
})

test('reduced motion 下不播動畫，結果立刻可讀', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await alwaysDrawTheFirstEntry(page)
  await gotoTool(page)
  await fillCandidates(page)
  await page.getByRole('radio', { name: '輪盤' }).check()
  await page.getByRole('button', { name: '開始抽選' }).click()

  await expect(page.locator('.picker-result__item')).toHaveText([FIRST])
  await expect(page.getByRole('button', { name: '跳過動畫' }), '沒有動畫就不需要跳過鍵').toHaveCount(0)
  await expect(page.locator('.picker-wheel'), '輪盤仍然看得到中選的扇形').toBeVisible()
})

test('抽出人數與呈現方式的限制都說明可以怎麼改，中英文各一次', async ({ page }) => {
  await gotoTool(page)
  await fillCandidates(page)
  await page.getByLabel('抽出幾名').fill('5')

  await expect(page.getByRole('alert')).toHaveText('要抽 5 名，但名單只有 3 筆可抽。')
  await expect(page.getByRole('button', { name: '開始抽選' })).toBeDisabled()

  await page.getByRole('radio', { name: '輪盤' }).check()
  await expect(page.locator('.picker-wheel-note')).toContainText('抽 1 名')

  await page.getByLabel('抽出幾名').fill('2')
  await expect(page.getByRole('alert'), '修正後錯誤訊息必須消失').toHaveCount(0)

  await gotoTool(page, '/en/tools/random-picker/')
  await page.getByLabel('Candidates').fill(CANDIDATES)
  await page.getByLabel('How many to draw').fill('5')
  await expect(page.getByRole('alert')).toHaveText('You asked for 5 but the list only has 3 to draw from.')
})

test('核心流程可用鍵盤完成，操作目標在手機上可觸控', async ({ page }, testInfo) => {
  await alwaysDrawTheFirstEntry(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoTool(page)

  const candidates = page.getByLabel('候選名單')
  await candidates.focus()
  await candidates.fill(CANDIDATES)
  const drawButton = page.getByRole('button', { name: '開始抽選' })
  await drawButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.picker-result__item')).toHaveText([FIRST])

  await page.getByRole('button', { name: '重設' }).focus()
  await page.keyboard.press('Enter')
  await expect(candidates).toHaveValue('')
  await expect(page.locator('.picker-result')).toContainText('準備好名單後按')

  const dimensions = await page.locator('html').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(dimensions.scrollWidth, `${testInfo.project.name} 375px 不得有橫向跑版`).toBeLessThanOrEqual(dimensions.clientWidth + 1)

  await candidates.fill(CANDIDATES)
  for (const target of [
    candidates,
    page.getByLabel('抽出幾名'),
    page.locator('.picker-option').first(),
    page.getByRole('button', { name: '加入名單' }),
    drawButton,
    page.getByRole('button', { name: '重設' }),
  ]) {
    const box = await target.boundingBox()
    expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
    expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
  }
})

test('輪盤與結果在 light 與 dark 模式皆通過 WCAG 2.2 AA 自動檢查', async ({ page }) => {
  await alwaysDrawTheFirstEntry(page)
  await gotoTool(page)
  await fillCandidates(page)
  await page.getByRole('radio', { name: '輪盤' }).check()
  await page.getByRole('button', { name: '開始抽選' }).click()
  await expect(page.locator('.picker-result__item')).toHaveText([FIRST])

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
