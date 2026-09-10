import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { productImageWorkbenchCanaries } from '../support/product-image-workbench-canaries'
import { gotoHydrated } from './support/hydration'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

guardToolContentBoundary(productImageWorkbenchCanaries, { allowedOrigins: ['http://127.0.0.1:4173'] })

/** Preparing three engines and running a model on the WebAssembly baseline is the slow part. */
test.setTimeout(240_000)

const route = '/zh-tw/tools/product-image-workbench/'

/** Drawn in the page, never a real photograph; the file name is the canary the guard watches. */
async function imageFile(page: Page, name: string, colour: string, width = 240, height = 240) {
  const bytes = await page.evaluate(async ({ colour, width, height }) => {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')!
    context.fillStyle = colour
    context.fillRect(0, 0, width, height)
    return [...new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer())]
  }, { colour, width, height })

  return { name, mimeType: 'image/png', buffer: Buffer.from(bytes) }
}

/**
 * A drawn product with enough per-pixel detail that a JPEG of it cannot collapse
 * under a channel's capacity floor. Encoding it once keeps the three-browser run
 * inside the CI budget; nothing here is a photograph.
 */
const fixtures = new Map<string, Buffer>()

async function productFile(page: Page, size = 1200) {
  const cached = fixtures.get(String(size))
  if (cached) return { name: 'private-workbench-canary.png', mimeType: 'image/jpeg', buffer: cached }

  const bytes = await page.evaluate(async (side) => {
    const canvas = new OffscreenCanvas(side, side)
    const context = canvas.getContext('2d')!
    const pixels = context.createImageData(side, side)
    let seed = 20260909
    for (let index = 0; index < pixels.data.length; index += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0
      pixels.data[index] = 200 + (seed >>> 25)
      pixels.data[index + 1] = 60 + ((seed >>> 18) & 0x3f)
      pixels.data[index + 2] = 60 + ((seed >>> 11) & 0x3f)
      pixels.data[index + 3] = 255
    }
    context.putImageData(pixels, 0, 0)
    return [...new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 })).arrayBuffer())]
  }, size)

  const buffer = Buffer.from(bytes)
  fixtures.set(String(size), buffer)

  return { name: 'private-workbench-canary.png', mimeType: 'image/jpeg', buffer }
}

/** A head and shoulders the portrait model can find, drawn the same way. */
async function portraitFile(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(512, 512)
    const context = canvas.getContext('2d')!
    context.fillStyle = '#3b6ea5'
    context.fillRect(0, 0, 512, 512)
    context.fillStyle = '#e8c39e'
    context.beginPath(); context.arc(256, 190, 90, 0, Math.PI * 2); context.fill()
    context.fillStyle = '#2f2a26'
    context.beginPath(); context.ellipse(256, 430, 150, 130, 0, 0, Math.PI * 2); context.fill()
    return [...new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer())]
  })

  return { name: 'private-workbench-canary.png', mimeType: 'image/png', buffer: Buffer.from(bytes) }
}

/** Re-encoding shifts a channel by a step or two; the assertion is about which layer won. */
function expectColour(actual: number[], expected: [number, number, number]) {
  expected.forEach((channel, index) => expect(Math.abs(actual[index]! - channel)).toBeLessThanOrEqual(6))
}

async function importProduct(page: Page, file: Awaited<ReturnType<typeof imageFile>>) {
  await page.getByLabel('選擇商品圖').setInputFiles(file)
  await expect(page.locator('[data-workbench-step="import"]')).toHaveAttribute('data-workbench-state', 'done')
}

async function outputPixels(page: Page) {
  const href = await page.getByRole('link', { name: '下載輸出檔案' }).getAttribute('href')

  return page.evaluate(async (url) => {
    const blob = await (await fetch(url!)).blob()
    const image = await createImageBitmap(blob)
    // Closing an ImageBitmap zeroes its dimensions, so read them first.
    const { width, height } = image
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const centre = [...context.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data]
    const corner = [...context.getImageData(2, 2, 1, 1).data]
    image.close()
    return { width, height, bytes: blob.size, type: blob.type, centre, corner }
  }, href)
}

test('略過去背的合規主圖流程：從原圖完成版型、下載，並釋放記憶體', async ({ page }) => {
  await gotoHydrated(page, route)

  await expect(page.locator('[data-workbench-step="brand"]')).toHaveAttribute('data-workbench-state', 'unavailable')
  await importProduct(page, await productFile(page))
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'cutout')

  await page.getByRole('button', { name: '略過去背' }).click()
  await expect(page.locator('[data-workbench-step="cutout"]')).toHaveAttribute('data-workbench-state', 'skipped')
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'layout')

  await page.getByLabel('通路規格').selectOption('momo-store-main')
  await expect(page.getByLabel('寬度（像素）')).toHaveValue('1000')
  await page.getByRole('button', { name: '產生版型' }).click()

  await expect(page.getByRole('link', { name: '下載輸出檔案' })).toBeVisible({ timeout: 60_000 })
  const output = await outputPixels(page)
  expect(output).toMatchObject({ width: 1000, height: 1000, type: 'image/jpeg' })
  expect(output.bytes).toBeGreaterThanOrEqual(50_000)
  expect(output.bytes).toBeLessThanOrEqual(1_000_000)
  await expect(page.locator('[data-workbench-check]')).toHaveAttribute('data-workbench-check', 'pass')
  await expect(page.locator('[data-workbench-panel="output"]')).toContainText('不保證通路審核通過')

  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: '下載輸出檔案' }).click()
  expect((await download).suggestedFilename()).toBe('compliant-product-image.jpg')

  expect((await new AxeBuilder({ page }).include('.product-image-workbench').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
})

/** The English page is its own contract: its own URL, its own copy, its own audit. */
for (const locale of ['zh-tw', 'en']) {
  test(`${locale} 響應式、亮暗色、SEO 與無障礙`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoHydrated(page, `/${locale}/tools/product-image-workbench/`)

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://toolsliang.com/${locale}/tools/product-image-workbench/`)
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', 'https://toolsliang.com/en/tools/product-image-workbench/')
    await expect(page.locator('link[hreflang="zh-Hant-TW"]')).toHaveAttribute('href', 'https://toolsliang.com/zh-tw/tools/product-image-workbench/')
    await expect(page.locator('[data-workbench-panel]')).toContainText(locale === 'en' ? 'Choose product image' : '選擇商品圖')

    // A refused file must be explained in the language of the page it was refused on.
    await page.getByLabel(locale === 'en' ? 'Choose product image' : '選擇商品圖')
      .setInputFiles({ name: 'renamed.png', mimeType: 'image/png', buffer: Buffer.from('not an image at all') })
    await expect(page.getByRole('alert')).toContainText(locale === 'en' ? 'Choose a JPEG, PNG, or WebP image' : '請選擇真正的 JPEG、PNG 或 WebP 圖片')

    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: locale === 'en' ? 'Toggle color theme' : '切換色彩模式' }).click()
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
      if (info.project.name === 'chromium') await page.screenshot({ path: `artifacts/product-image-workbench-${locale}-${theme}.png`, fullPage: true })
    }
  })
}

/**
 * Reading a revoked URL is the condition under test, and the browser reports the
 * refused request; it lives in its own test so the flow above stays strict.
 */
test('清空工作台會交還輸出佔用的記憶體，而不只是隱藏結果', async ({ page }) => {
  expectOfflineRequests(page)
  await gotoHydrated(page, route)
  await importProduct(page, await productFile(page))
  await page.getByRole('button', { name: '略過去背' }).click()
  await page.getByRole('button', { name: '產生版型' }).click()
  await expect(page.getByRole('link', { name: '下載輸出檔案' })).toBeVisible({ timeout: 60_000 })

  const href = await page.getByRole('link', { name: '下載輸出檔案' }).getAttribute('href')
  await page.getByRole('button', { name: '清空工作台' }).click()
  await expect(page.getByRole('link', { name: '下載輸出檔案' })).toHaveCount(0)
  expect(await page.evaluate(url => fetch(url!).then(() => 'readable', () => 'released'), href)).toBe('released')
})

test('品牌宣傳圖分支：版型結果再疊上框版與 Logo 並輸出 PNG', async ({ page }) => {
  await gotoHydrated(page, route)
  await importProduct(page, await imageFile(page, 'private-workbench-canary.png', '#1d4ed8'))
  await page.getByRole('button', { name: '略過去背' }).click()

  await page.locator('#workbench-purpose-promotional').check()
  await expect(page.locator('[data-workbench-step="brand"]')).not.toHaveAttribute('data-workbench-state', 'unavailable')
  await expect(page.getByLabel('通路規格')).toHaveCount(0)

  // A non-square canvas: the Logo's share of the width is not its scale, so a
  // preview that reads the scale as a width would disagree with the file.
  await page.getByLabel('寬度（像素）').fill('900')
  await page.getByLabel('高度（像素）').fill('600')
  await page.getByRole('button', { name: '產生版型' }).click()
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'brand', { timeout: 60_000 })

  await page.getByLabel('Logo 圖片').setInputFiles(await imageFile(page, 'private-workbench-logo.png', '#16a34a', 120, 120))
  await page.getByLabel('Logo 縮放（%）').fill('40')
  await page.getByLabel('Logo 水平位置（%）').fill('0')
  await page.getByLabel('Logo 垂直位置（%）').fill('0')

  // 40% of the contain fit of a 120 px square on 900 × 600 is 240 px, not 360.
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector('[data-workbench-panel="brand"] .workbench__canvas')!
    const layers = canvas.querySelectorAll('img')
    const logo = layers[layers.length - 1]!
    return Math.round(logo.getBoundingClientRect().width / canvas.getBoundingClientRect().width * 1000) / 1000
  })).toBeCloseTo(240 / 900, 2)

  await page.getByRole('button', { name: '組合品牌素材' }).click()

  await expect(page.getByRole('link', { name: '下載輸出檔案' })).toBeVisible({ timeout: 60_000 })
  const output = await outputPixels(page)
  expect(output).toMatchObject({ width: 900, height: 600, type: 'image/png' })
  // The Logo covers the centre; the layout result still shows at the edge.
  expectColour(output.centre, [22, 163, 74])
  expectColour(output.corner, [29, 78, 216])

  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: '下載輸出檔案' }).click()
  expect((await download).suggestedFilename()).toBe('brand-promo-image.png')
})

test('取消與失敗只影響該步驟，先前成果保留且可回到前一步', async ({ page }) => {
  await gotoHydrated(page, route)
  // Cancelling needs a step that is still running. Delaying the engine's own
  // script does not produce one — the Service Worker and the browser cache both
  // answer that request without touching the network — so the work itself is
  // made heavy instead: a 5.8 MP source written to the largest canvas the tool
  // allows.
  await importProduct(page, await productFile(page, 2400))

  // A refused file must not cost the merchant the image they already imported.
  await page.getByRole('button', { name: '回到前一步' }).click()
  await page.getByLabel('選擇商品圖').setInputFiles({ name: 'renamed.png', mimeType: 'image/png', buffer: Buffer.from('not an image at all') })
  await expect(page.getByRole('alert')).toContainText('請選擇真正的 JPEG、PNG 或 WebP 圖片')
  await expect(page.locator('[data-workbench-step="import"]')).toHaveAttribute('data-workbench-state', 'done')

  await page.locator('[data-workbench-step="cutout"] button').click()
  await page.getByRole('button', { name: '略過去背' }).click()

  await page.locator('#workbench-purpose-promotional').check()
  await page.getByLabel('寬度（像素）').fill('4800')
  await page.getByLabel('高度（像素）').fill('4800')
  await page.getByLabel('輸出格式').selectOption('image/png')
  await page.getByRole('button', { name: '產生版型' }).click()
  // The panel reflows while the step runs. Waiting for the button to hold still
  // spends the very window this test needs, and a forced click can land where
  // the button no longer is, so the event is dispatched on the element itself.
  const cancelStep = page.getByRole('button', { name: '取消這一步' })
  await expect(cancelStep).toBeVisible()
  await cancelStep.dispatchEvent('click')

  await expect(page.getByRole('status').filter({ hasText: '已取消' })).toBeVisible()
  await expect(page.locator('[data-workbench-step="import"]')).toHaveAttribute('data-workbench-state', 'done')
  await expect(page.locator('[data-workbench-step="cutout"]')).toHaveAttribute('data-workbench-state', 'skipped')
  await expect(page.locator('[data-workbench-step="layout"]')).toHaveAttribute('data-workbench-state', 'ready')
  await expect(page.getByRole('link', { name: '下載輸出檔案' })).toHaveCount(0)

  // The same step retries from the results the earlier steps still hold.
  await page.getByLabel('寬度（像素）').fill('800')
  await page.getByLabel('高度（像素）').fill('800')
  await page.getByRole('button', { name: '產生版型' }).click()
  await expect(page.locator('[data-workbench-step="layout"]')).toHaveAttribute('data-workbench-state', 'done', { timeout: 60_000 })

  await page.getByRole('button', { name: '略過品牌素材' }).click()
  await expect(page.getByRole('link', { name: '下載輸出檔案' })).toBeVisible()

  // Going back and changing the layout retires the output instead of leaving a stale file downloadable.
  await page.locator('[data-workbench-step="layout"] button').click()
  await page.getByLabel('縮放（%）').fill('120')
  await expect(page.locator('[data-workbench-step="layout"]')).toHaveAttribute('data-workbench-state', 'ready')
  await expect(page.locator('[data-workbench-step="output"]')).toHaveAttribute('data-workbench-state', 'locked')
  await page.getByRole('button', { name: '產生版型' }).click()
  await expect(page.locator('[data-workbench-step="layout"]')).toHaveAttribute('data-workbench-state', 'done', { timeout: 60_000 })
})

test('去背引擎不可用時只停用去背，其餘步驟仍可完成輸出', async ({ page }) => {
  // The aborted worker request is the condition under test; the browser reports it.
  expectOfflineRequests(page)
  await page.route('**/*background-removal.worker*', handler => handler.abort())
  await gotoHydrated(page, route)

  await expect(page.locator('[data-workbench-step="cutout"]')).toHaveAttribute('data-workbench-state', 'unavailable', { timeout: 30_000 })
  await importProduct(page, await productFile(page))
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'layout')
  await expect(page.locator('[data-workbench-step="cutout"] button')).toBeDisabled()

  await page.getByRole('button', { name: '產生版型' }).click()
  await expect(page.getByRole('link', { name: '下載輸出檔案' })).toBeVisible({ timeout: 60_000 })
})

test('純鍵盤可完成步驟切換，焦點與進度隨步驟移動，未完成工作會攔截離開', async ({ page }) => {
  await gotoHydrated(page, route)
  await importProduct(page, await productFile(page))

  // Unfinished local work is the one thing a closed tab cannot get back.
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })).toBe(true)

  await page.locator('[data-workbench-step="import"] button').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'import')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('workbench-import')

  await page.getByRole('status').filter({ hasText: '共' }).first().waitFor()
  await expect(page.getByRole('status').filter({ hasText: '第 1 步' }).first()).toBeVisible()

  await page.locator('[data-workbench-step="cutout"] button').focus()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('workbench-cutout')
  await expect(page.getByRole('status').filter({ hasText: '第 2 步' }).first()).toBeVisible()

  const target = await page.getByRole('button', { name: '略過去背' }).boundingBox()
  expect(target!.width).toBeGreaterThanOrEqual(44)
  expect(target!.height).toBeGreaterThanOrEqual(44)
})

test('完整代表性流程：本機去背後接續版型與下載', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', '模型下載與推論的完整流程只在 Chromium 驗證一次')

  await gotoHydrated(page, route)
  await importProduct(page, await portraitFile(page))

  await expect(page.locator('[data-workbench-model]')).toHaveAttribute('data-model-ready', 'false')
  await expect(page.getByRole('button', { name: '開始去背' })).toBeDisabled()
  await page.getByRole('button', { name: '下載模型' }).click()
  await page.locator('[data-workbench-model][data-model-ready="true"]').waitFor({ timeout: 180_000 })

  await page.getByRole('button', { name: '開始去背' }).click()
  await expect(page.locator('[data-workbench-step="cutout"]')).toHaveAttribute('data-workbench-state', 'done', { timeout: 180_000 })
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'layout')

  await page.getByLabel('通路規格').selectOption('momo-store-main')
  await page.getByRole('button', { name: '產生版型' }).click()
  await expect(page.getByRole('link', { name: '下載輸出檔案' })).toBeVisible({ timeout: 60_000 })
  expect(await outputPixels(page)).toMatchObject({ width: 1000, height: 1000, type: 'image/jpeg' })

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'artifacts/product-image-workbench-desktop.png', fullPage: true })
})
