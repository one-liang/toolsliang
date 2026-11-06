import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

const TOOL_ROUTE = '/zh-tw/tools/qr-code-generator/'
const TOUCH_TARGET_TOLERANCE_PX = 0.001
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
/**
 * What this suite types. Each canary is long and odd enough that it can only
 * appear in a request if the content itself was sent; the Wi-Fi password is
 * the most sensitive thing a visitor gives this tool.
 */
const LINK = 'line.me/R/ti/p/@qr-canary-shop'
const TEXT = 'QR 測試內容：週一公休，其餘 11:00 開門'
const SSID = 'Canary Cafe 5G'
const PASSWORD = 'canary-wifi-pass-2026'
const TOOL_CONTENT = [
  { label: '輸入', value: LINK },
  { label: '輸入', value: TEXT },
  { label: '輸入', value: SSID },
  { label: '輸入', value: PASSWORD },
]

guardToolContentBoundary(TOOL_CONTENT, NETWORK_BOUNDARY_POLICY)

async function gotoTool(page: Page, route = TOOL_ROUTE) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  await page.locator('[data-qr-state]').waitFor()
  return response
}

const downloadPng = (page: Page) => page.getByRole('button', { name: '下載 PNG' })
const downloadSvg = (page: Page) => page.getByRole('button', { name: '下載 SVG' })
const preview = (page: Page) => page.locator('svg.qr-code__image')

test('伺服器輸出 FAQ，工作區只在訪客裝置上出現', async ({ request }) => {
  const response = await request.get(TOOL_ROUTE)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain('產生的 QR Code 會過期嗎？')
  expect(html).toContain('印出去之後可以改內容嗎？')
  expect(html, '輸入的內容只在裝置上，預先產生的頁面不含工作區狀態').not.toContain('data-qr-state')
})

test('開啟時是網址模式，沒有可下載的碼，也看得到商標聲明與本機處理說明', async ({ page }) => {
  const response = await gotoTool(page)
  expect(response?.ok(), `${TOOL_ROUTE} 應成功載入`).toBe(true)

  await expect(page.locator('h1')).toHaveText('QR Code 產生器')
  await expect(page.getByRole('radio', { name: '網址' })).toBeChecked()
  await expect(page.getByLabel('貼上網址')).toHaveValue('')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(preview(page)).toHaveCount(0)
  await expect(downloadPng(page)).toBeDisabled()
  await expect(downloadSvg(page)).toBeDisabled()
  await expect(page.locator('.qr-code__trademark')).toHaveText('QR Code 是 DENSO WAVE INCORPORATED 的註冊商標。')
  await expect(page.locator('[data-scan-reminder]')).toContainText('印刷前請先用手機實際掃一次')
  await expect(page.getByText('QR Code 在這台裝置上產生，你輸入的網址、文字和 Wi-Fi 密碼不會保存或送出。')).toBeVisible()
})

test('貼上網址就出現 QR Code，補上 https:// 並可下載 1024 px 的 PNG 與 SVG', async ({ page }) => {
  await gotoTool(page)
  const field = page.getByLabel('貼上網址')
  await field.focus()
  await page.keyboard.type(LINK)

  await expect(preview(page)).toBeVisible()
  await expect(preview(page)).toHaveAttribute('aria-label', '你輸入的網址的 QR Code')
  await expect(page.locator('[data-encoded-url]')).toHaveText(`https://${LINK}`)
  await expect(page.locator('.qr-code__status')).toHaveText('網址的 QR Code 已產生。')
  await expect(field, '預覽更新不得搬動焦點').toBeFocused()

  const png = page.waitForEvent('download')
  await downloadPng(page).click()
  const pngFile = await png
  expect(pngFile.suggestedFilename()).toBe('qr-code.png')
  const pngBytes = await readFile((await pngFile.path())!)
  expect(pngBytes.subarray(1, 4).toString('ascii'), '下載的是 PNG').toBe('PNG')
  expect([pngBytes.readUInt32BE(16), pngBytes.readUInt32BE(20)], 'PNG 是 1024×1024 px').toEqual([1024, 1024])

  const svg = page.waitForEvent('download')
  await downloadSvg(page).click()
  const svgFile = await svg
  expect(svgFile.suggestedFilename()).toBe('qr-code.svg')
  const svgText = await readFile((await svgFile.path())!, 'utf8')
  expect(svgText).toContain('<svg')
  expect(svgText, '輸入的內容不會以文字寫進 SVG').not.toContain(LINK)
})

test('文字與 Wi-Fi：切換時保留內容、等待缺少的欄位、密碼可隱藏', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('貼上網址').fill(LINK)

  await page.getByRole('radio', { name: '文字' }).check()
  await page.getByLabel('輸入文字').fill(TEXT)
  await expect(page.locator('.qr-code__status')).toHaveText('文字的 QR Code 已產生。')

  await page.getByRole('radio', { name: 'Wi-Fi' }).check()
  await expect(page.getByRole('radio', { name: '有密碼（WPA/WPA2/WPA3）' })).toBeChecked()
  await page.getByLabel('網路名稱').fill(SSID)
  await expect(page.locator('.qr-code__status')).toContainText('填上密碼後就會產生')
  await expect(page.getByRole('alert'), '還沒填的欄位不是錯誤').toHaveCount(0)
  await expect(downloadPng(page)).toBeDisabled()

  const password = page.getByLabel('密碼', { exact: true })
  await expect(password).toHaveAttribute('type', 'text')
  await password.fill(PASSWORD)
  await expect(preview(page)).toBeVisible()
  await expect(downloadPng(page)).toBeEnabled()
  await page.getByRole('button', { name: '隱藏密碼' }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await expect(page.getByRole('button', { name: '顯示密碼' })).toBeVisible()

  await page.getByRole('radio', { name: '無密碼' }).check()
  await expect(page.getByLabel('密碼', { exact: true })).toHaveCount(0)
  await expect(preview(page)).toBeVisible()

  await page.getByRole('radio', { name: '網址' }).check()
  await expect(page.getByLabel('貼上網址'), '切回來時內容還在').toHaveValue(LINK)
})

test('內容太長與看不清的顏色都以文字說明並停用下載', async ({ page }) => {
  await gotoTool(page)
  await page.getByRole('radio', { name: '文字' }).check()
  const text = page.getByLabel('輸入文字')
  await text.fill('測'.repeat(778))

  await expect(page.getByRole('alert')).toContainText('內容太長')
  await expect(text).toHaveAttribute('aria-invalid', 'true')
  await expect(preview(page), '不得留下和輸入不符的舊碼').toHaveCount(0)
  await expect(downloadPng(page)).toBeDisabled()

  await text.fill(TEXT)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByLabel('碼的顏色').fill('#ffffff')
  await page.getByLabel('底色').fill('#000000')
  await expect(page.getByRole('alert')).toContainText('碼的顏色要比底色深')
  await expect(downloadPng(page)).toBeDisabled()
  await expect(downloadSvg(page)).toBeDisabled()

  await page.getByRole('button', { name: '改回黑碼白底' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(downloadPng(page)).toBeEnabled()
})

test('輸入的內容不寫進網址與任何儲存空間', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('貼上網址').fill(LINK)
  await page.getByRole('radio', { name: 'Wi-Fi' }).check()
  await page.getByLabel('網路名稱').fill(SSID)
  await page.getByLabel('密碼', { exact: true }).fill(PASSWORD)
  await expect(preview(page)).toBeVisible()

  expect(page.url()).toBe(new URL(TOOL_ROUTE, 'http://127.0.0.1:4173').href)
  const stored = await page.evaluate(async () => {
    const values = [localStorage, sessionStorage].flatMap(storage => Object.keys(storage).map(key => `${key}=${storage.getItem(key)}`))
    const databases = 'databases' in indexedDB ? (await indexedDB.databases()).map(database => database.name ?? '') : []
    return [...values, ...databases].join('\n')
  })
  for (const canary of TOOL_CONTENT) expect(stored, `${canary.label}不得寫入儲存空間`).not.toContain(canary.value)
})

test('light 與 dark 模式皆通過 WCAG 2.2 AA 自動檢查', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('貼上網址').fill(LINK)
  await expect(preview(page)).toBeVisible()

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
]) {
  test(`${viewport.label} ${viewport.width}px 無橫向跑版、操作目標可觸控${viewport.firstScreen ? '，網址欄位、預覽與下載鈕在第一個畫面' : ''}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await gotoTool(page)

    const dimensions = await page.locator('html').evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
    expect(dimensions.scrollWidth, `${viewport.label} 不得有橫向跑版`).toBeLessThanOrEqual(dimensions.clientWidth + 1)

    const targets = [
      page.getByLabel('貼上網址'),
      downloadPng(page),
      downloadSvg(page),
      page.locator('.qr-code__kind').first(),
      page.getByLabel('碼的顏色'),
      page.getByLabel('底色'),
    ]
    for (const target of targets) {
      const box = await target.boundingBox()
      expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
      expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
    }

    if (!viewport.firstScreen) return

    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    // On a phone the bottom navigation floats over the page, so it is the real bottom edge.
    const nav = page.locator('.mobile-nav')
    const visibleBottom = await nav.isVisible() ? (await nav.boundingBox())!.y : viewport.height
    for (const [name, target] of [['網址欄位', page.getByLabel('貼上網址')], ['預覽', page.locator('.qr-code__stage')], ['下載 PNG', downloadPng(page)], ['下載 SVG', downloadSvg(page)]] as const) {
      const box = (await target.boundingBox())!
      expect(box.y, `${name}在第一個畫面內`).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height, `${name}不需捲動就看得到`).toBeLessThanOrEqual(visibleBottom)
    }
  })
}

test('英文頁以英文呈現', async ({ page }) => {
  await gotoTool(page, '/en/tools/qr-code-generator/')
  await expect(page.locator('h1')).toHaveText('QR Code Generator')
  await page.getByLabel('Paste the link').fill(LINK)
  await expect(page.locator('.qr-code__status')).toHaveText('QR Code for the link is ready.')
  await expect(page.locator('.qr-code__trademark')).toHaveText('QR Code is registered trademark of DENSO WAVE INCORPORATED.')
})

test('首次載入後可離線重新開啟並產生', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service Worker 生命週期只在 Chromium 可驗證')
  await gotoTool(page)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  expectOfflineRequests(page)
  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('[data-capability-ready="true"]').waitFor()
    await page.getByLabel('貼上網址').fill(LINK)
    await expect(preview(page)).toBeVisible()
    await expect(downloadPng(page)).toBeEnabled()
  }
  finally { await context.setOffline(false) }
})
