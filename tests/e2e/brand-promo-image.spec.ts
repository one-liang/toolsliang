import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { gotoHydrated } from './support/hydration'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

guardToolContentBoundary([
  { label: '品牌素材檔名', value: 'private-brand-canary.png' },
  { label: 'PNG 像素', value: 'PNG\r\n\u001a\n' },
  { label: 'PNG Base64', value: 'iVBORw0KGgo' },
], { allowedOrigins: ['http://127.0.0.1:4173'] })

async function fixture(page: Page, color: string, width = 100, height = 100) {
  const bytes = await page.evaluate(async ({ color, width, height }) => {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = color; ctx.fillRect(0, 0, width, height)
    return [...new Uint8Array(await (await canvas.convertToBlob()).arrayBuffer())]
  }, { color, width, height })
  return { name: 'private-brand-canary.png', mimeType: 'image/png', buffer: Buffer.from(bytes) }
}
async function add(page: Page, kind: string, color: string) {
  await page.getByLabel('新圖層類型').selectOption(kind)
  await page.getByLabel('匯入圖片', { exact: true }).setInputFiles(await fixture(page, color))
  await expect(page.getByRole('status').filter({ hasText: '已加入圖層' })).toBeVisible()
}
async function outputPixels(page: Page) {
  const url = await page.getByRole('link', { name: '下載 PNG', exact: true }).getAttribute('href')
  return page.evaluate(async (url) => {
    const image = await createImageBitmap(await (await fetch(url!)).blob())
    const canvas = new OffscreenCanvas(image.width, image.height)
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0)
    const output = { width: image.width, height: image.height, corner: [...ctx.getImageData(0, 0, 1, 1).data], centre: [...ctx.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data] }
    image.close(); return output
  }, url)
}

test('組合、鍵盤調整、圖層順序、復原重做與 PNG 像素輸出', async ({ page }, info) => {
  await gotoHydrated(page, '/zh-tw/tools/brand-promo-image/')
  await add(page, 'background', '#ff0000')
  await add(page, 'logo', '#0000ff')
  await page.getByLabel('縮放（%）', { exact: true }).fill('50')
  await page.getByRole('button', { name: '向右微調', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('1')
  await page.keyboard.press('Control+z')
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('0')
  await page.keyboard.press('Control+Shift+z')
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('1')
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toBeVisible()
  expect(await outputPixels(page)).toEqual({ width: 1000, height: 1000, corner: [255, 0, 0, 255], centre: [0, 0, 255, 255] })
  await page.getByRole('button', { name: '下移一層', exact: true }).click()
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toBeVisible()
  expect((await outputPixels(page)).centre).toEqual([255, 0, 0, 255])
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: '下載 PNG', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('brand-promo.png')
  const latency = await page.getByRole('button', { name: '向左微調', exact: true }).evaluate(async (button) => {
    const start = performance.now()
    ;(button as HTMLButtonElement).click()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    return performance.now() - start
  })
  expect(latency).toBeLessThan(100)
  expect((await new AxeBuilder({ page }).include('.brand-promo').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  if (info.project.name === 'chromium') {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: 'artifacts/brand-promo-composed-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 375, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: 'artifacts/brand-promo-composed-mobile.png', fullPage: true })
  }
})

test('主動保存的框版與 Logo 在重新載入後可重用，損毀匯入不破壞素材', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/brand-promo-image/')
  await add(page, 'frame', '#ff0000')
  await page.getByRole('button', { name: '保存素材到這台裝置', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已將素材保存' })).toBeVisible()
  await add(page, 'logo', '#0000ff')
  await page.getByRole('button', { name: '保存素材到這台裝置', exact: true }).click()
  await expect(page.getByRole('button', { name: '加入已保存素材', exact: true })).toHaveCount(2)
  await page.reload()
  await expect(page.getByRole('button', { name: '加入已保存素材', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: '加入已保存素材', exact: true }).first().click()
  await expect(page.getByRole('status').filter({ hasText: '已加入圖層' })).toBeVisible()
  await page.getByLabel('匯入圖片', { exact: true }).setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') })
  await expect(page.locator('#promo-error')).not.toBeEmpty()
  await expect(page.locator('.brand-promo__layers ol li')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '加入已保存素材', exact: true })).toHaveCount(2)
})

test('12 MP 輸出與取消不影響既有圖層', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/brand-promo-image/')
  await add(page, 'product', '#00ff00')
  await page.getByLabel('寬度（像素）').fill('4000')
  await page.getByLabel('高度（像素）').fill('3000')
  const start = Date.now()
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toBeVisible({ timeout: 10_000 })
  expect(Date.now() - start).toBeLessThan(10_000)
  expect(await outputPixels(page)).toMatchObject({ width: 4000, height: 3000 })
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已取消' })).toBeVisible()
  await expect(page.locator('.brand-promo__layers ol li')).toHaveCount(1)
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toHaveCount(0)
})

for (const locale of ['zh-tw', 'en']) {
  test(`${locale} 響應式、亮暗色、SEO 與無障礙`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoHydrated(page, `/${locale}/tools/brand-promo-image/`)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://toolsliang.com/${locale}/tools/brand-promo-image/`)
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', 'https://toolsliang.com/en/tools/brand-promo-image/')
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: locale === 'en' ? 'Toggle color theme' : '切換色彩模式' }).click()
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
      if (info.project.name === 'chromium') await page.screenshot({ path: `artifacts/brand-promo-${locale}-${theme}.png`, fullPage: true })
    }
  })
}

test('容量不足不刪除已保存素材，恢復空間後可重試', async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (sessionStorage.getItem('simulate-quota') === 'yes') throw new DOMException('full', 'QuotaExceededError')
      return put.apply(this, args)
    }
  })
  await gotoHydrated(page, '/zh-tw/tools/brand-promo-image/')
  await add(page, 'logo', '#0000ff')
  await page.getByRole('button', { name: '保存素材到這台裝置', exact: true }).click()
  await expect(page.getByRole('button', { name: '加入已保存素材', exact: true })).toHaveCount(1)
  await page.evaluate(() => sessionStorage.setItem('simulate-quota', 'yes'))
  await page.getByRole('button', { name: '保存素材到這台裝置', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '裝置儲存空間不足' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: '加入已保存素材', exact: true })).toHaveCount(1)
  await page.evaluate(() => sessionStorage.removeItem('simulate-quota'))
  await page.getByRole('button', { name: '加入已保存素材', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已加入圖層' })).toBeVisible()
  await page.getByRole('button', { name: '保存素材到這台裝置', exact: true }).click()
  await expect(page.getByRole('button', { name: '加入已保存素材', exact: true })).toHaveCount(2)
})

test('HEIC、大圖與輸出失敗可復原，圖層與已保存資產仍在', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = Worker
    window.Worker = class extends NativeWorker {
      override postMessage(message: unknown, transfer?: Transferable[]) {
        const command = message as { type?: string, input?: { scene?: unknown } }
        if (command.type === 'run' && command.input?.scene && sessionStorage.getItem('simulate-encode') === 'yes') {
          setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data: { type: 'error', code: 'encode_failed' } })), 10)
        }
        else super.postMessage(message, transfer ?? [])
      }
    }
  })
  await gotoHydrated(page, '/zh-tw/tools/brand-promo-image/')
  await add(page, 'logo', '#0000ff')
  await page.getByRole('button', { name: '保存素材到這台裝置', exact: true }).click()
  await expect(page.getByRole('button', { name: '加入已保存素材', exact: true })).toHaveCount(1)
  await page.getByLabel('匯入圖片', { exact: true }).setInputFiles({ name: 'asset.heic', mimeType: 'image/heic', buffer: Buffer.from('x') })
  await expect(page.locator('#promo-error')).toContainText('HEIC')
  const huge = (await fixture(page, '#ffffff')).buffer
  huge.writeUInt32BE(9000, 16)
  await page.getByLabel('匯入圖片', { exact: true }).setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: huge })
  await expect(page.locator('#promo-error')).not.toBeEmpty()
  await page.evaluate(() => sessionStorage.setItem('simulate-encode', 'yes'))
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.locator('#promo-error')).not.toBeEmpty()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toHaveCount(0)
  await expect(page.locator('.brand-promo__layers ol li')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '加入已保存素材', exact: true })).toHaveCount(1)
  await page.evaluate(() => sessionStorage.removeItem('simulate-encode'))
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toBeVisible()
})

test('離線重新載入可重用素材與輸出，內容不進入快取或偏好', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'chromium', 'Service Worker 生命週期僅在 Chromium 驗證')
  await gotoHydrated(page, '/zh-tw/tools/brand-promo-image/')
  await add(page, 'logo', '#0000ff')
  await page.getByRole('button', { name: '保存素材到這台裝置', exact: true }).click()
  await expect(page.getByRole('button', { name: '加入已保存素材', exact: true })).toHaveCount(1)
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    const paths = (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat()
    return navigator.serviceWorker.controller && paths.some(path => /promo\.worker-.*\.js$/.test(path)) && paths.some(path => /image\.worker-.*\.js$/.test(path))
  }, undefined, { timeout: 20_000 })
  expectOfflineRequests(page)
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: '加入已保存素材', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已加入圖層' })).toBeVisible()
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toBeVisible()
  const stored = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    urls: (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat(),
  }))
  expect(stored.local).toBe(0)
  expect(stored.session).toBe(0)
  expect(stored.urls.some(url => url.includes('private-brand-canary') || url.startsWith('blob:'))).toBe(false)
})

test('無效尺寸或位置不會被另一欄編輯清除，修正前禁止輸出', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/brand-promo-image/')
  await add(page, 'product', '#0000ff')
  await page.getByLabel('寬度（像素）').fill('9000')
  await page.getByLabel('高度（像素）').fill('2000')
  await expect(page.getByLabel('寬度（像素）')).toHaveValue('9000')
  await expect(page.getByRole('button', { name: '產生 PNG', exact: true })).toBeDisabled()
  await expect(page.getByLabel('寬度（像素）')).toHaveAttribute('aria-invalid', 'true')
  await page.getByLabel('寬度（像素）').fill('1000')
  await page.getByLabel('水平位置（%）').fill('101')
  await page.getByRole('button', { name: '向上微調', exact: true }).click()
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('101')
  await expect(page.getByRole('button', { name: '產生 PNG', exact: true })).toBeDisabled()
  await page.getByLabel('水平位置（%）').fill('0')
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toBeVisible()
  expect(await outputPixels(page)).toMatchObject({ width: 1000, height: 2000 })
})
