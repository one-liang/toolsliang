import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { gotoHydrated } from './support/hydration'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

guardToolContentBoundary([
  { label: '品牌素材檔名', value: 'private-brand-canary.png' },
  { label: 'PNG 像素', value: 'PNG\r\n\u001a\n' },
  { label: 'PNG Base64', value: 'iVBORw0KGgo' },
], { allowedOrigins: ['http://127.0.0.1:4173'] })

const kindNames: Record<string, string> = { product: '加入商品圖', background: '加入背景', frame: '加入框版', logo: '加入 Logo' }

async function fixture(page: Page, color: string, width = 100, height = 100) {
  const bytes = await page.evaluate(async ({ color, width, height }) => {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = color; ctx.fillRect(0, 0, width, height)
    return [...new Uint8Array(await (await canvas.convertToBlob()).arrayBuffer())]
  }, { color, width, height })
  return { name: 'private-brand-canary.png', mimeType: 'image/png', buffer: Buffer.from(bytes) }
}
/** Each layer type has its own button; they all open the same file picker. */
async function choose(page: Page, kind: string, file: { name: string, mimeType: string, buffer: Buffer }) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: kindNames[kind], exact: true }).click()
  await (await chooser).setFiles(file)
}
async function add(page: Page, kind: string, color: string) {
  await choose(page, kind, await fixture(page, color))
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

/** Drags the mouse by a share of the stage, so the numbers stay the same at any preview size. */
async function dragBy(page: Page, from: { x: number, y: number }, share: { x: number, y: number }) {
  const stage = (await page.locator('[data-promo-stage]').boundingBox())!
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + stage.width * share.x, from.y + stage.height * share.y, { steps: 8 })
  await page.mouse.up()
}

async function percent(page: Page, label: string) {
  return Number(await page.getByLabel(label, { exact: true }).inputValue())
}

test('在預覽上直接拖曳、拉角等比縮放、拉邊拉伸，並以快捷鍵調整圖層上下', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/brand-promo-image/')
  await add(page, 'background', '#ff0000')
  await add(page, 'logo', '#0000ff')
  await page.getByLabel('縮放（%）', { exact: true }).fill('50')
  const stage = page.locator('[data-promo-stage]')
  await stage.scrollIntoViewIfNeeded()
  const box = (await stage.boundingBox())!

  // Clicking the logo picks it, and dragging moves it by the same share of the canvas.
  await dragBy(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: 0.1, y: 0 })
  expect(Math.abs(await percent(page, '水平位置（%）') - 10)).toBeLessThanOrEqual(1)
  await page.keyboard.press('Control+z')
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('0')
  await page.keyboard.press('Control+Shift+z')
  expect(Math.abs(await percent(page, '水平位置（%）') - 10)).toBeLessThanOrEqual(1)

  // A corner scales proportionally: 500 px wide plus 100 px each way is 120%, so 50% becomes 60%.
  const corner = (await page.locator('.brand-promo__handle--se').boundingBox())!
  await dragBy(page, { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 }, { x: 0.1, y: 0.1 })
  expect(Math.abs(await percent(page, '縮放（%）') - 60)).toBeLessThanOrEqual(1)
  await expect(page.getByRole('button', { name: '還原原始比例', exact: true })).toHaveCount(0)

  // An edge stretches one side, which the panel offers to undo.
  const edge = (await page.locator('.brand-promo__handle--e').boundingBox())!
  await dragBy(page, { x: edge.x + edge.width / 2, y: edge.y + edge.height / 2 }, { x: 0.05, y: 0 })
  await expect(page.getByRole('button', { name: '還原原始比例', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '還原原始比例', exact: true }).click()
  await expect(page.getByRole('button', { name: '還原原始比例', exact: true })).toHaveCount(0)

  // Ctrl+[ sends the logo behind the background, and the front-first panel shows it.
  await stage.focus()
  await expect(page.locator('.brand-promo__layers ol li').first()).toContainText('Logo')
  await page.keyboard.press('Control+BracketLeft')
  await expect(page.locator('.brand-promo__layers ol li').first()).toContainText('背景')
  await page.keyboard.press('Control+Shift+BracketRight')
  await expect(page.locator('.brand-promo__layers ol li').first()).toContainText('Logo')

  // Arrow keys on the focused preview nudge by one canvas pixel.
  const before = await percent(page, '垂直位置（%）')
  for (let step = 0; step < 10; step++) await page.keyboard.press('ArrowDown')
  await expect(page.getByLabel('垂直位置（%）')).toHaveValue(String(before + 1))

  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toBeVisible()
  expect((await outputPixels(page)).corner).toEqual([255, 0, 0, 255])
})

test('組合、鍵盤調整、圖層順序、復原重做與 PNG 像素輸出', async ({ page }, info) => {
  await gotoHydrated(page, '/zh-tw/tools/brand-promo-image/')
  await add(page, 'background', '#ff0000')
  await add(page, 'logo', '#0000ff')
  await page.getByLabel('縮放（%）', { exact: true }).fill('50')
  await page.getByLabel('水平位置（%）', { exact: true }).fill('1')
  await page.locator('[data-promo-stage]').focus()
  await page.keyboard.press('Control+z')
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('0')
  await page.keyboard.press('Control+Shift+z')
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('1')
  await page.getByRole('button', { name: '復原', exact: true }).click()
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('0')
  await page.getByRole('button', { name: '重做', exact: true }).click()
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('1')

  // Making the PNG turns the button into the download link, and focus moves with it.
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  const download = page.getByRole('link', { name: '下載 PNG', exact: true })
  await expect(download).toBeVisible()
  await expect(download).toBeFocused()
  await expect(page.getByRole('button', { name: '產生 PNG', exact: true })).toHaveCount(0)
  expect(await outputPixels(page)).toEqual({ width: 1000, height: 1000, corner: [255, 0, 0, 255], centre: [0, 0, 255, 255] })

  // Any change makes the output stale: the link gives way to the button again.
  await page.getByRole('button', { name: '下移一層', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toBeVisible()
  expect((await outputPixels(page)).centre).toEqual([255, 0, 0, 255])
  const saved = page.waitForEvent('download')
  await page.getByRole('link', { name: '下載 PNG', exact: true }).click()
  expect((await saved).suggestedFilename()).toBe('brand-promo.png')
  const latency = await page.getByRole('button', { name: '上移一層', exact: true }).evaluate(async (button) => {
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

test('工作區沒有保存到裝置的入口，損毀圖片不破壞既有圖層', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/brand-promo-image/')
  await add(page, 'frame', '#ff0000')
  await add(page, 'logo', '#0000ff')
  await expect(page.locator('.brand-promo')).not.toContainText('保存')
  await expect(page.locator('.brand-promo a[href*="/storage/"]')).toHaveCount(0)
  await choose(page, 'product', { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') })
  await expect(page.locator('#promo-error')).not.toBeEmpty()
  await expect(page.locator('.brand-promo__layers ol li')).toHaveCount(2)
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
  // A new size makes the finished file stale, so the button comes back.
  await page.getByLabel('寬度（像素）').fill('4001')
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  // The workspace reflows while the render runs. Waiting for the button to hold
  // still spends the very window this assertion needs, and a forced click can
  // land where the button no longer is, so the event is dispatched on it.
  const cancel = page.getByRole('button', { name: '取消', exact: true })
  await expect(cancel).toBeVisible()
  await cancel.dispatchEvent('click')
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

  /*
   * #91's first screen: without scrolling, the visitor sees where to add a
   * layer, where the result appears and the action that makes it. On a phone
   * the floating bottom navigation covers the end of the viewport.
   */
  test(`${locale} 1366×768 與 375×812 不捲動就看得到加入圖層、預覽與產生 PNG`, async ({ page }) => {
    const make = locale === 'en' ? 'Make PNG' : '產生 PNG'
    for (const viewport of [{ width: 1366, height: 768 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport)
      await gotoHydrated(page, `/${locale}/tools/brand-promo-image/`)
      await expect(page.locator('[data-promo-add]').first()).toBeEnabled()
      const fold = await page.evaluate(() => {
        const nav = document.querySelector('.mobile-nav')
        const navTop = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight
        return Math.min(innerHeight, navTop)
      })
      for (const target of [page.locator('[data-promo-add]').last(), page.locator('[data-promo-stage]'), page.getByRole('button', { name: make, exact: true })]) {
        const box = (await target.boundingBox())!
        expect(box.y, `${viewport.width}px`).toBeGreaterThanOrEqual(0)
        expect(box.y + box.height, `${viewport.width}px`).toBeLessThanOrEqual(fold)
      }
    }
  })
}

test('HEIC、大圖與輸出失敗可復原，圖層仍在', async ({ page }) => {
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
  await choose(page, 'background', { name: 'asset.heic', mimeType: 'image/heic', buffer: Buffer.from('x') })
  await expect(page.locator('#promo-error')).toContainText('HEIC')
  const huge = (await fixture(page, '#ffffff')).buffer
  huge.writeUInt32BE(9000, 16)
  await choose(page, 'background', { name: 'huge.png', mimeType: 'image/png', buffer: huge })
  await expect(page.locator('#promo-error')).not.toBeEmpty()
  await page.evaluate(() => sessionStorage.setItem('simulate-encode', 'yes'))
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.locator('#promo-error')).not.toBeEmpty()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toHaveCount(0)
  await expect(page.locator('.brand-promo__layers ol li')).toHaveCount(1)
  await page.evaluate(() => sessionStorage.removeItem('simulate-encode'))
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toBeVisible()
})

test('離線重新載入後可重新組合與輸出，裝置上不留下素材', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'chromium', 'Service Worker 生命週期僅在 Chromium 驗證')
  await gotoHydrated(page, '/zh-tw/tools/brand-promo-image/')
  await add(page, 'logo', '#0000ff')
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    const paths = (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat()
    return navigator.serviceWorker.controller && paths.some(path => /promo\.worker-.*\.js$/.test(path)) && paths.some(path => /image\.worker-.*\.js$/.test(path))
  }, undefined, { timeout: 20_000 })
  expectOfflineRequests(page)
  await context.setOffline(true)
  // Nothing is kept: the composition goes away with the page.
  await page.reload()
  await expect(page.locator('[data-promo-add]').first()).toBeEnabled()
  await expect(page.locator('.brand-promo__layers ol li')).toHaveCount(0)
  await add(page, 'logo', '#0000ff')
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toBeVisible()
  const stored = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: (await indexedDB.databases()).map(database => database.name),
    urls: (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat(),
  }))
  expect(stored.local).toBe(0)
  expect(stored.session).toBe(0)
  expect(stored.databases).not.toContain('toolsliang-local-assets')
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
  await page.getByLabel('垂直位置（%）').fill('5')
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('101')
  await expect(page.getByRole('button', { name: '產生 PNG', exact: true })).toBeDisabled()
  await page.getByLabel('水平位置（%）').fill('0')
  await page.getByRole('button', { name: '產生 PNG', exact: true }).click()
  await expect(page.getByRole('link', { name: '下載 PNG', exact: true })).toBeVisible()
  expect(await outputPixels(page)).toMatchObject({ width: 1000, height: 2000 })
})
