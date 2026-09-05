import { expect, test, type Page } from '@playwright/test'
import { guardToolContentBoundary } from './support/tool-content-boundary'

const TOOL_ROUTE = '/zh-tw/tools/ntd-uppercase/'
const HAZARD_INPUT = '100000001'
const ACCOUNTING_WORDING = '新臺幣壹億零壹元整'
const TREASURY_WORDING = '新臺幣壹億壹元整'
const ROUNDING_INPUT = '12,850.5'
const ROUNDED_WORDING = '新臺幣壹萬貳仟捌佰伍拾壹元整'
const CHEQUE_FRACTION_INPUT = '100.5'
const COPY_INPUT = '1018'
const COPY_WORDING = '新臺幣壹仟零壹拾捌元整'
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
const TOOL_CONTENT = [
  { label: '輸入', value: HAZARD_INPUT },
  { label: '輸入', value: ROUNDING_INPUT },
  { label: '輸入', value: CHEQUE_FRACTION_INPUT },
  { label: '輸入', value: COPY_INPUT },
  { label: '輸出', value: ACCOUNTING_WORDING },
  { label: '輸出', value: TREASURY_WORDING },
  { label: '輸出', value: ROUNDED_WORDING },
  { label: '輸出', value: COPY_WORDING },
]

guardToolContentBoundary(TOOL_CONTENT, NETWORK_BOUNDARY_POLICY)

async function gotoTool(page: Page, route = TOOL_ROUTE) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  return response
}

/**
 * The clipboard itself is a browser capability, and the three engines grant it
 * differently; what this suite has to prove is that the workspace tells the
 * visitor which of the two outcomes happened. The recorder stands in for the
 * real clipboard so both paths are reachable in every browser.
 */
async function recordClipboard(page: Page, outcome: 'granted' | 'denied') {
  await page.addInitScript((mode) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          Object.assign(window, { __copiedText: text })
          return mode === 'granted' ? Promise.resolve() : Promise.reject(new Error('denied'))
        },
      },
    })
  }, outcome)
}

test('工具開啟即說明三種用途、規則與來源', async ({ page }) => {
  const response = await gotoTool(page)
  expect(response?.ok(), `${TOOL_ROUTE} 應成功載入`).toBe(true)

  await expect(page.getByRole('radio', { name: '一般會計' })).toBeChecked()
  await expect(page.getByRole('radio', { name: '支票填寫參考' })).toBeVisible()
  await expect(page.getByRole('radio', { name: '國庫付款憑單' })).toBeVisible()
  await expect(page.locator('.result-panel')).toContainText('選好用途並輸入金額')

  const rules = page.locator('.ntd-rules')
  await expect(rules).toContainText('9,999,999,999,999,999.99')
  await expect(rules).toContainText('保留「角」與「分」')

  const caveats = page.locator('.ntd-caveats')
  await expect(caveats, '免責必須在結果附近，而不是只在頁尾').toContainText('不是法律或會計審查')
  await expect(caveats).toContainText('金額只在你的瀏覽器換算')
  await expect(page.locator('.ntd-source')).toContainText('ntd-uppercase-2026-09-05')
  await expect(page.locator('.ntd-source').getByRole('link', { name: /票據法第 7 條/ })).toBeVisible()

  const examples = page.getByRole('table', { name: '同一筆金額在三種用途的國字大寫' })
  await expect(examples.getByRole('row', { name: /壹佰零壹元整.*壹佰壹元整/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: '關於這個工具的常見問題' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '資料來源與審閱' })).toBeVisible()
})

test('換用途會以同一筆金額改寫，國庫用途顯示四捨五入前後', async ({ page }) => {
  await gotoTool(page)
  const amount = page.getByLabel('輸入金額（新臺幣）')
  await amount.fill(HAZARD_INPUT)
  await expect(page.locator('.ntd-result__wording')).toHaveText(ACCOUNTING_WORDING)

  await page.getByRole('radio', { name: '國庫付款憑單' }).check()
  await expect(page.locator('.ntd-result__wording'), '國庫用途不寫中間的零').toHaveText(TREASURY_WORDING)
  await expect(amount, '換用途不得清空金額').toHaveValue(HAZARD_INPUT)
  await expect(page.locator('.ntd-caveats')).toContainText('不書寫中間的「零」')

  await amount.fill(ROUNDING_INPUT)
  const rounded = page.locator('.ntd-result__rounded')
  await expect(rounded, '捨入會改變金額，必須顯示前後對照').toContainText('12,850.50')
  await expect(rounded).toContainText('12,851')
  await expect(page.locator('.ntd-result__wording')).toHaveText(ROUNDED_WORDING)
})

test('支票用途不替使用者改動金額，中英文都說明怎麼改', async ({ page }) => {
  await gotoTool(page)
  await page.getByRole('radio', { name: '支票填寫參考' }).check()
  await page.getByLabel('輸入金額（新臺幣）').fill(CHEQUE_FRACTION_INPUT)

  await expect(page.getByRole('alert')).toHaveText('支票大寫金額寫到「元」為止，請先與收款人確認金額後再輸入整數。')
  await expect(page.locator('.ntd-result__wording'), '無法換寫時不得顯示結果').toHaveCount(0)
  await expect(page.getByRole('button', { name: '複製結果' })).toBeDisabled()

  await page.getByLabel('輸入金額（新臺幣）').fill('1000000000000')
  await expect(page.getByRole('alert'), '超出上限時必須寫出這個用途的上限').toContainText('999,999,999,999')

  await gotoTool(page, '/en/tools/ntd-uppercase/')
  await page.getByRole('radio', { name: 'Cheque reference' }).check()
  await page.getByLabel('Amount (NTD)').fill(CHEQUE_FRACTION_INPUT)
  await expect(page.getByRole('alert'))
    .toHaveText('A cheque amount is written to 元 only; confirm the amount with the payee, then enter a whole number.')

  await page.getByLabel('Amount (NTD)').fill('101')
  await expect(page.getByRole('alert'), '修正後錯誤訊息必須消失').toHaveCount(0)
  await expect(page.locator('.ntd-result__wording'), '結果本身仍是繁體中文單據用語').toHaveText('新臺幣壹佰零壹元整')
})

for (const outcome of ['granted', 'denied'] as const) {
  test(`複製${outcome === 'granted' ? '成功' : '失敗'}的狀態可由輔助科技辨識`, async ({ page }) => {
    await recordClipboard(page, outcome)
    await gotoTool(page)
    await page.getByLabel('輸入金額（新臺幣）').fill(COPY_INPUT)

    const status = page.locator('.ntd-copy-status')
    await expect(status).toHaveAttribute('role', 'status')
    await expect(status, '尚未複製前不得先宣告結果').toHaveText('')

    await page.getByRole('button', { name: '複製結果' }).click()
    if (outcome === 'granted') {
      await expect(status).toHaveText('已複製國字大寫')
      expect(await page.evaluate(() => (window as unknown as { __copiedText?: string }).__copiedText))
        .toBe(COPY_WORDING)
    }
    else {
      await expect(status).toHaveText('無法自動複製，請手動選取結果文字後複製。')
    }

    await page.getByLabel('輸入金額（新臺幣）').fill('2000')
    await expect(status, '金額改變後，舊的複製狀態不得留在畫面上').toHaveText('')
  })
}
