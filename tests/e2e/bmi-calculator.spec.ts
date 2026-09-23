import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { guardToolContentBoundary } from './support/tool-content-boundary'

const TOOL_ROUTE = '/zh-tw/tools/bmi-calculator/'
const HEIGHT_CM = '173.53'
const WEIGHT_KG = '68.47'
const RESULT_BMI = '22.7'
const IMPERIAL_FEET = '6'
const IMPERIAL_INCHES = '2'
const IMPERIAL_POUNDS = '220.5'
const IMPERIAL_RESULT_BMI = '28.3'
const INVALID_INPUT = 'bmi-invalid-input-4d71'
const CONVERTED_FEET = '5'
const CONVERTED_INCHES = '8.32'
const CONVERTED_POUNDS = '150.95'
const TOOL_RESPONSE_BUDGET_MS = 50
const TOUCH_TARGET_TOLERANCE_PX = 0.001
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
const TOOL_CONTENT = [
  { label: '輸入', value: HEIGHT_CM },
  { label: '輸入', value: WEIGHT_KG },
  { label: '輸入', value: IMPERIAL_POUNDS },
  { label: '輸入', value: CONVERTED_POUNDS },
  { label: '輸入', value: INVALID_INPUT },
  { label: '輸出', value: RESULT_BMI },
  { label: '輸出', value: IMPERIAL_RESULT_BMI },
]

guardToolContentBoundary(TOOL_CONTENT, NETWORK_BOUNDARY_POLICY)

async function gotoTool(page: Page, route = TOOL_ROUTE) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  return response
}

async function pressFocusForward(page: Page, testInfo: TestInfo) {
  await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
}

test('工具開啟時即顯示公式、分級與使用限制', async ({ page }) => {
  const response = await gotoTool(page)
  expect(response?.ok(), `${TOOL_ROUTE} 應成功載入`).toBe(true)

  await expect(page.locator('.local-processing-note')).toHaveCount(0)
  await expect(page.getByLabel('身高（公分）')).toHaveValue('')
  await expect(page.getByLabel('體重（公斤）')).toHaveValue('')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.result-panel')).toContainText('填入身高與體重')

  await expect(page.locator('.bmi-formula')).toHaveText('BMI ＝ 體重（公斤）÷ 身高（公尺）÷ 身高（公尺）')
  const categoryTable = page.getByRole('table', { name: '成人 BMI 分級與對應範圍' })
  await expect(categoryTable).toBeVisible()
  await expect(categoryTable.getByRole('row', { name: '健康體重 18.5 ≦ BMI < 24' })).toBeVisible()

  const caveats = page.locator('.bmi-caveats')
  await expect(caveats).toContainText('不是醫療診斷')
  await expect(caveats).toContainText('只適用 18 歲（含）以上成人')
  await expect(caveats).toContainText('懷孕期間不適用')
  const source = page.locator('.bmi-source')
  await expect(source, '來源必須在結果附近，而不是只在頁尾').toContainText('成人健康體位標準')
  await expect(source).toContainText('2025年9月11日')
  await expect(page.getByRole('heading', { name: '關於這個工具的常見問題' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '資料來源與審閱' })).toBeVisible()
  await expect(page.locator('.tool-contract__source-links')
    .getByRole('link', { name: '國民健康署：成人健康體位標準' })).toBeVisible()
})

test('身高體重留在裝置，公英制皆可用鍵盤完成計算', async ({ page }, testInfo) => {
  await gotoTool(page)

  await pressFocusForward(page, testInfo)
  await expect(page.getByRole('link', { name: '跳至主要內容' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main-content')).toBeFocused()

  const height = page.getByLabel('身高（公分）')
  await height.focus()
  await height.fill(HEIGHT_CM)
  await expect(page.locator('#bmi-weight-pending'), '只填身高時，欄位旁平靜地說明還缺什麼').toContainText('還需要填寫體重')
  await expect(page.getByRole('alert')).toHaveCount(0)

  await pressFocusForward(page, testInfo)
  const weight = page.getByLabel('體重（公斤）')
  await expect(weight).toBeFocused()
  await weight.fill(WEIGHT_KG)
  await expect(page.locator('.bmi-result__value')).toHaveText(RESULT_BMI)
  await expect(page.locator('.bmi-result__category')).toContainText('健康體重')
  await expect(weight, '結果更新不得搬動焦點').toBeFocused()

  await page.getByRole('radio', { name: '英制（英尺、英吋、磅）' }).check()
  await expect(page.getByLabel('身高（英尺）'), '切換單位不得清空已輸入的量測值').toHaveValue(CONVERTED_FEET)
  await expect(page.getByLabel('身高（英吋）')).toHaveValue(CONVERTED_INCHES)
  await expect(page.getByLabel('體重（磅）')).toHaveValue(CONVERTED_POUNDS)
  await expect(page.locator('.bmi-result__value'), '換算後仍是同一個人').toHaveText(RESULT_BMI)

  await page.getByLabel('身高（英尺）').fill(IMPERIAL_FEET)
  await page.getByLabel('身高（英吋）').fill(IMPERIAL_INCHES)
  await page.getByLabel('體重（磅）').fill(IMPERIAL_POUNDS)
  await expect(page.locator('.bmi-result__value')).toHaveText(IMPERIAL_RESULT_BMI)
  await expect(page.locator('.bmi-result__category')).toContainText('肥胖')

  await page.getByRole('button', { name: '重設' }).click()
  await expect(page.getByLabel('體重（磅）')).toHaveValue('')
  await expect(page.locator('.result-panel')).toContainText('填入身高與體重')
})

test('結果以 aria-live 宣告，且分級不只用顏色表達', async ({ page }) => {
  await gotoTool(page)
  const result = page.locator('.result-panel')
  await expect(result).toHaveAttribute('aria-live', 'polite')

  await page.getByLabel('身高（公分）').fill(HEIGHT_CM)
  await page.getByLabel('體重（公斤）').fill(WEIGHT_KG)

  await expect(result).toContainText(`分級：健康體重（18.5 ≦ BMI < 24）`)
})

test('無法計算的輸入以可修正的訊息說明，英文頁以英文呈現', async ({ page }) => {
  await gotoTool(page)
  const height = page.getByLabel('身高（公分）')
  await height.fill(INVALID_INPUT)
  await expect(page.getByRole('alert')).toContainText('兩位小數')
  await expect(height).toHaveAttribute('aria-invalid', 'true')

  await height.fill('260')
  await expect(page.getByRole('alert')).toContainText('身高支援 100 到 250 公分。')

  await gotoTool(page, '/en/tools/bmi-calculator/')
  await page.getByLabel('Height (cm)').fill('260')
  await expect(page.getByRole('alert')).toHaveText('Height is supported from 100 to 250 cm.')

  await page.getByLabel('Height (cm)').fill(HEIGHT_CM)
  await page.getByLabel('Weight (kg)').fill(WEIGHT_KG)
  await expect(page.getByRole('alert'), '修正後錯誤訊息必須消失').toHaveCount(0)
  await expect(page.locator('.bmi-result__category')).toContainText('Healthy weight')
})

test('light 與 dark 模式皆通過 WCAG 2.2 AA 自動檢查', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('身高（公分）').fill(HEIGHT_CM)
  await page.getByLabel('體重（公斤）').fill(WEIGHT_KG)

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
  test(`${viewport.label} ${viewport.width}px 無橫向跑版且操作目標可觸控`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await gotoTool(page)

    const dimensions = await page.locator('html').evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(dimensions.scrollWidth, `${viewport.label} 不得有橫向跑版`).toBeLessThanOrEqual(dimensions.clientWidth + 1)

    const height = page.getByLabel('身高（公分）')
    await height.fill(HEIGHT_CM)
    await page.getByLabel('體重（公斤）').fill(WEIGHT_KG)
    await expect(page.locator('.bmi-result__value')).toHaveText(RESULT_BMI)

    const coreTargets = [
      height,
      page.getByLabel('體重（公斤）'),
      // The unit choice is tapped on its label, which is what carries the target size.
      page.locator('.bmi-units__option').first(),
      page.getByRole('button', { name: '重設' }),
    ]
    for (const target of coreTargets) {
      const box = await target.boundingBox()
      expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
      expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
    }
  })
}

test('計算在效能預算內完成', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('身高（公分）').fill(HEIGHT_CM)

  const responseDuration = await page.evaluate(({ budget, input, output }) => {
    const weight = document.querySelector<HTMLInputElement>('#bmi-weight-kilograms')!
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
      weight.value = input
      weight.dispatchEvent(new Event('input', { bubbles: true }))
      window.setTimeout(() => {
        observer.disconnect()
        reject(new Error('工具結果未在效能量測期限內更新'))
      }, budget)
    })
  }, { budget: TOOL_RESPONSE_BUDGET_MS, input: WEIGHT_KG, output: RESULT_BMI })

  expect(responseDuration, `BMI 計算需低於 ${TOOL_RESPONSE_BUDGET_MS}ms`).toBeLessThan(TOOL_RESPONSE_BUDGET_MS)
})
