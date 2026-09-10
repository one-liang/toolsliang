import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { productImageWorkbenchCanaries } from '../support/product-image-workbench-canaries'
import { gotoHydrated } from './support/hydration'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

guardToolContentBoundary(productImageWorkbenchCanaries, { allowedOrigins: ['http://127.0.0.1:4173'] })

/** Preparing five engines and running a model on the WebAssembly baseline is the slow part. */
test.setTimeout(240_000)

const route = '/zh-tw/tools/product-image-workbench/'

/** A batch action names the number of images it will touch, so match on the verb. */
const batch = (page: Page, verb: string) => page.getByRole('button', { name: new RegExp(verb) })

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

async function importProducts(page: Page, files: Awaited<ReturnType<typeof imageFile>>[]) {
  await page.getByLabel('選擇商品圖').setInputFiles(files)
  await expect(page.locator('[data-queue-item]')).toHaveCount(files.length)
  await expect(page.locator('[data-workbench-step="import"]')).toHaveAttribute('data-workbench-state', 'done')
}

async function outputPixels(page: Page, name = '下載第 1 項') {
  const href = await page.getByRole('link', { name }).getAttribute('href')

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

/** Reads the archive the page built, the way an unzip program would. */
async function archiveNames(page: Page) {
  const href = await page.getByRole('link', { name: '下載封存檔' }).getAttribute('href')

  return page.evaluate(async (url) => {
    const bytes = new Uint8Array(await (await fetch(url!)).arrayBuffer())
    const view = new DataView(bytes.buffer)
    let end = bytes.length - 22
    while (end >= 0 && view.getUint32(end, true) !== 0x06054B50) end -= 1
    const count = view.getUint16(end + 10, true)
    let offset = view.getUint32(end + 16, true)
    const names: string[] = []
    for (let index = 0; index < count; index += 1) {
      const nameLength = view.getUint16(offset + 28, true)
      names.push(new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength)))
      offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
    }
    return names
  }, href)
}

test('合規主圖批次：兩張圖走完流程、逐項下載並在本機打包封存', async ({ page }) => {
  await gotoHydrated(page, route)

  await expect(page.locator('[data-workbench-step="brand"]')).toHaveAttribute('data-workbench-state', 'unavailable')
  await expect(page.locator('[data-workbench-step="compress"]')).toHaveAttribute('data-workbench-state', 'unavailable')

  const product = await productFile(page)
  await importProducts(page, [product, product])
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'cutout')

  await batch(page, '整批略過這一步').click()
  await expect(page.locator('[data-workbench-step="cutout"]')).toHaveAttribute('data-workbench-state', 'skipped')
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'layout')

  // Compression belongs to whoever has not already stated a capacity: the momo
  // preset publishes a byte range, the reviewed Amazon one does not.
  await page.getByLabel('通路規格').selectOption('amazon-main')
  await expect(page.locator('[data-workbench-step="compress"]')).not.toHaveAttribute('data-workbench-state', 'unavailable')
  await page.getByLabel('通路規格').selectOption('momo-store-main')
  await expect(page.locator('[data-workbench-step="compress"]')).toHaveAttribute('data-workbench-state', 'unavailable')

  await expect(page.getByLabel('寬度（像素）')).toHaveValue('1000')
  await batch(page, '整批產生版型').click()

  await expect(page.locator('[data-workbench-step="layout"]')).toHaveAttribute('data-workbench-state', 'done', { timeout: 90_000 })
  await expect(page.locator('[data-queue-state="done"]')).toHaveCount(2)
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'output')

  const output = await outputPixels(page)
  expect(output).toMatchObject({ width: 1000, height: 1000, type: 'image/jpeg' })
  expect(output.bytes).toBeGreaterThanOrEqual(50_000)
  expect(output.bytes).toBeLessThanOrEqual(1_000_000)
  await expect(page.locator('[data-workbench-check]')).toHaveAttribute('data-workbench-check', 'pass')
  await expect(page.locator('[data-workbench-panel="output"]')).toContainText('不保證通路審核通過')

  const item = page.waitForEvent('download')
  await page.getByRole('link', { name: '下載第 2 項' }).click()
  expect((await item).suggestedFilename()).toBe('compliant-product-image-02.jpg')

  await batch(page, '打包 2 個輸出成封存檔').click()
  await expect(page.getByRole('link', { name: '下載封存檔' })).toBeVisible({ timeout: 60_000 })
  expect(await archiveNames(page)).toEqual(['compliant-product-image-01.jpg', 'compliant-product-image-02.jpg'])

  const archive = page.waitForEvent('download')
  await page.getByRole('link', { name: '下載封存檔' }).click()
  expect((await archive).suggestedFilename()).toBe('compliant-product-images.zip')

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
    await expect(page.locator('[data-workbench-panel]')).toContainText(locale === 'en' ? 'Choose product images' : '選擇商品圖')
    // The ceilings are stated before a file is chosen, not after one is refused.
    await expect(page.locator('#workbench-import-help')).toContainText(locale === 'en' ? '20 images' : '最多 20 張')

    // A refused file must be explained in the language of the page it was refused on.
    await page.getByLabel(locale === 'en' ? 'Choose product images' : '選擇商品圖')
      .setInputFiles({ name: 'renamed.png', mimeType: 'image/png', buffer: Buffer.from('not an image at all') })
    await expect(page.locator('#workbench-import-issues')).toContainText(locale === 'en' ? 'Choose a JPEG, PNG, or WebP image' : '請選擇真正的 JPEG、PNG 或 WebP 圖片')

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
  await importProducts(page, [await productFile(page)])
  await batch(page, '整批略過這一步').click()
  await batch(page, '整批產生版型').click()
  await expect(page.getByRole('link', { name: '下載第 1 項' })).toBeVisible({ timeout: 60_000 })

  const href = await page.getByRole('link', { name: '下載第 1 項' }).getAttribute('href')
  await page.getByRole('button', { name: '清空工作台' }).click()
  await expect(page.getByRole('link', { name: '下載第 1 項' })).toHaveCount(0)
  expect(await page.evaluate(url => fetch(url!).then(() => 'readable', () => 'released'), href)).toBe('released')
})

test('品牌宣傳圖分支：版型結果疊上 Logo，再由壓縮步驟決定容量', async ({ page }) => {
  await gotoHydrated(page, route)
  await importProducts(page, [await imageFile(page, 'private-workbench-canary.png', '#1d4ed8')])
  await batch(page, '整批略過這一步').click()

  await page.locator('#workbench-purpose-promotional').check()
  await expect(page.locator('[data-workbench-step="brand"]')).not.toHaveAttribute('data-workbench-state', 'unavailable')
  await expect(page.locator('[data-workbench-step="compress"]')).not.toHaveAttribute('data-workbench-state', 'unavailable')
  await expect(page.getByLabel('通路規格')).toHaveCount(0)

  // A non-square canvas: the Logo's share of the width is not its scale, so a
  // preview that reads the scale as a width would disagree with the file.
  await page.getByLabel('寬度（像素）').fill('900')
  await page.getByLabel('高度（像素）').fill('600')
  await page.getByLabel('輸出格式').selectOption('image/png')
  await batch(page, '整批產生版型').click()
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

  await batch(page, '整批組合品牌素材').click()
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'compress', { timeout: 60_000 })

  // The promotional branch has no channel capacity rule, so this step is where one comes from.
  await page.getByLabel('輸出格式').selectOption('image/jpeg')
  await page.getByLabel('品質（%）').fill('40')
  await batch(page, '整批壓縮').click()
  await expect(page.getByRole('link', { name: '下載第 1 項' })).toBeVisible({ timeout: 60_000 })

  const output = await outputPixels(page)
  expect(output).toMatchObject({ width: 900, height: 600, type: 'image/jpeg' })
  // The Logo covers the centre; the layout result still shows at the edge.
  expectColour(output.centre, [22, 163, 74])
  expectColour(output.corner, [29, 78, 216])

  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: '下載第 1 項' }).click()
  expect((await download).suggestedFilename()).toBe('brand-promo-image-01.jpg')
})

test('混合批次：不能處理的那一張只留在自己那一列，其餘照常完成', async ({ page }) => {
  await gotoHydrated(page, route)
  // 9,000 pixels on one side is over the shared ceiling, and it is said before
  // the batch runs rather than discovered halfway through it.
  const oversized = await imageFile(page, 'private-workbench-canary.png', '#b91c1c', 9000, 100)
  const product = await productFile(page)
  await page.getByLabel('選擇商品圖').setInputFiles([product, oversized, product])
  await expect(page.locator('[data-queue-item]')).toHaveCount(3)

  await expect(page.locator('[data-queue-item="item-2"]')).toHaveAttribute('data-queue-state', 'failed')
  await expect(page.locator('[data-queue-item="item-2"]')).toContainText('圖片超過本機處理上限')
  // Nothing about that file can be run again, so no row offers to.
  await expect(page.locator('[data-queue-item="item-2"]').getByRole('button', { name: '重試第 2 項' })).toHaveCount(0)

  await batch(page, '整批略過這一步').click()
  await batch(page, '整批產生版型').click()
  await expect(page.locator('[data-queue-state="done"]')).toHaveCount(2, { timeout: 90_000 })
  await expect(page.locator('[data-queue-item="item-2"]')).toHaveAttribute('data-queue-state', 'failed')

  await expect(page.getByRole('status').filter({ hasText: '共 3 張' }).first()).toContainText('1 張未完成')

  // Removing the row it stopped on puts the reading position on the row that took its place.
  await page.getByRole('button', { name: '移除第 2 項' }).click()
  await expect(page.locator('[data-queue-item]')).toHaveCount(2)
  expect(await page.evaluate(() => document.activeElement?.closest('[data-queue-item]')?.getAttribute('data-queue-item'))).toBe('item-3')

  await batch(page, '打包 2 個輸出成封存檔').click()
  await expect(page.getByRole('link', { name: '下載封存檔' })).toBeVisible({ timeout: 60_000 })
  expect(await archiveNames(page)).toEqual(['compliant-product-image-01.jpg', 'compliant-product-image-03.jpg'])
})

test('取消只交還未完成的工作：逐項與全部取消都保留先前成果', async ({ page }) => {
  await gotoHydrated(page, route)
  // Cancelling needs a step that is still running. Delaying the engine's own
  // script does not produce one — the Service Worker and the browser cache both
  // answer that request without touching the network — so the work itself is
  // made heavy instead: a 5.8 MP source written to the largest canvas the tool
  // allows.
  await importProducts(page, [await productFile(page, 2400)])

  await batch(page, '整批略過這一步').click()
  await page.locator('#workbench-purpose-promotional').check()
  await page.getByLabel('寬度（像素）').fill('4800')
  await page.getByLabel('高度（像素）').fill('4800')
  await page.getByLabel('輸出格式').selectOption('image/png')
  await batch(page, '整批產生版型').click()

  // The panel reflows while the step runs. Waiting for the button to hold still
  // spends the very window this test needs, and a forced click can land where
  // the button no longer is, so the event is dispatched on the element itself.
  const cancelItem = page.getByRole('button', { name: '取消第 1 項' })
  await expect(cancelItem).toBeVisible()
  await cancelItem.dispatchEvent('click')

  await expect(page.locator('[data-workbench-step="import"]')).toHaveAttribute('data-workbench-state', 'done')
  await expect(page.locator('[data-workbench-step="cutout"]')).toHaveAttribute('data-workbench-state', 'skipped')
  await expect(page.locator('[data-workbench-step="layout"]')).toHaveAttribute('data-workbench-state', 'ready')
  await expect(page.getByRole('link', { name: '下載第 1 項' })).toHaveCount(0)

  // Cancel-all stops the batch the same way, and says so.
  await batch(page, '整批產生版型').click()
  const cancelAll = page.getByRole('button', { name: '全部取消' })
  await expect(cancelAll).toBeVisible()
  await cancelAll.dispatchEvent('click')
  await expect(page.getByRole('status').filter({ hasText: '已完成的項目保留成果' })).toBeVisible()
  await expect(page.locator('[data-workbench-step="cutout"]')).toHaveAttribute('data-workbench-state', 'skipped')
  await expect(page.locator('[data-workbench-step="layout"]')).toHaveAttribute('data-workbench-state', 'ready')

  // The same step retries from the results the earlier steps still hold.
  await page.getByLabel('寬度（像素）').fill('800')
  await page.getByLabel('高度（像素）').fill('800')
  await batch(page, '整批產生版型').click()
  await expect(page.locator('[data-workbench-step="layout"]')).toHaveAttribute('data-workbench-state', 'done', { timeout: 60_000 })

  await batch(page, '整批略過這一步').click()
  await batch(page, '整批略過這一步').click()
  await expect(page.getByRole('link', { name: '下載第 1 項' })).toBeVisible()

  // Going back and changing the layout retires the output instead of leaving a stale file downloadable.
  await page.locator('[data-workbench-step="layout"] button').click()
  await page.getByLabel('縮放（%）').fill('120')
  await expect(page.locator('[data-workbench-step="layout"]')).toHaveAttribute('data-workbench-state', 'ready')
  await expect(page.locator('[data-workbench-step="output"]')).toHaveAttribute('data-workbench-state', 'locked')
})

test('去背引擎不可用時只停用去背，其餘步驟仍可完成輸出', async ({ page }) => {
  // The aborted worker request is the condition under test; the browser reports it.
  expectOfflineRequests(page)
  await page.route('**/*background-removal.worker*', handler => handler.abort())
  await gotoHydrated(page, route)

  await expect(page.locator('[data-workbench-step="cutout"]')).toHaveAttribute('data-workbench-state', 'unavailable', { timeout: 30_000 })
  await importProducts(page, [await productFile(page)])
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'layout')
  await expect(page.locator('[data-workbench-step="cutout"] button')).toBeDisabled()

  await batch(page, '整批產生版型').click()
  await expect(page.getByRole('link', { name: '下載第 1 項' })).toBeVisible({ timeout: 60_000 })
})

test('純鍵盤可完成步驟切換與佇列操作，未完成工作會攔截離開', async ({ page }) => {
  await gotoHydrated(page, route)
  await importProducts(page, [await productFile(page)])

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

  await page.getByRole('status').filter({ hasText: '共 1 張' }).first().waitFor()
  await expect(page.getByRole('status').filter({ hasText: '第 1 步' }).first()).toBeVisible()

  await page.locator('[data-workbench-step="cutout"] button').focus()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('workbench-cutout')
  await expect(page.getByRole('status').filter({ hasText: '第 2 步' }).first()).toBeVisible()

  // Every row action is a real button, reachable and large enough to hit.
  const remove = page.getByRole('button', { name: '移除第 1 項' })
  await remove.focus()
  const target = await remove.boundingBox()
  expect(target!.width).toBeGreaterThanOrEqual(44)
  expect(target!.height).toBeGreaterThanOrEqual(44)
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-queue-item]')).toHaveCount(0)
  // The queue went away with its last row, so the reading position lands on the panel.
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('workbench-import')
})

test('蓋住上限的批次仍可完成：併發受限，且封存不佔住主執行緒', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', '長工作量測只在支援 longtask 的瀏覽器進行一次')

  await gotoHydrated(page, route)
  const product = await productFile(page)
  // Two more than the batch holds: the extra ones are refused as they are added,
  // and what was taken in is still a batch that runs to the end.
  await page.getByLabel('選擇商品圖').setInputFiles(Array.from({ length: 22 }, () => product))
  await expect(page.locator('[data-queue-item]')).toHaveCount(20)
  await expect(page.locator('#workbench-import-issues')).toContainText('超過張數上限')
  await expect(page.locator('[data-workbench-step="import"]')).toHaveAttribute('data-workbench-state', 'done')

  await batch(page, '整批略過這一步').click()
  await page.getByLabel('通路規格').selectOption('momo-store-main')

  await page.evaluate(() => {
    const window_ = window as unknown as { __peak: number, __long: number }
    window_.__peak = 0
    window_.__long = 0
    new PerformanceObserver(list => { for (const entry of list.getEntries()) window_.__long = Math.max(window_.__long, entry.duration) })
      .observe({ entryTypes: ['longtask'] })
    setInterval(() => { window_.__peak = Math.max(window_.__peak, document.querySelectorAll('[data-queue-state="running"]').length) }, 20)
  })

  await batch(page, '整批產生版型').click()
  await expect(page.locator('[data-queue-state="done"]')).toHaveCount(20, { timeout: 180_000 })
  // §12.11 caps encoding at two jobs; a batch of twenty therefore never opens twenty.
  const peak = await page.evaluate(() => (window as unknown as { __peak: number }).__peak)
  expect(peak).toBeGreaterThan(0)
  expect(peak).toBeLessThanOrEqual(2)

  await batch(page, '打包 20 個輸出成封存檔').click()
  await expect(page.getByRole('link', { name: '下載封存檔' })).toBeVisible({ timeout: 60_000 })
  expect(await archiveNames(page)).toHaveLength(20)
  // The budget is 50 ms. The ceiling asserted here is far looser on purpose:
  // reading and checksumming a whole batch on the page would produce a task of
  // seconds, and a loose bound stays honest on a shared CI machine.
  expect(await page.evaluate(() => (window as unknown as { __long: number }).__long)).toBeLessThan(500)
})

test('完整代表性流程：本機去背後接續版型與下載', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', '模型下載與推論的完整流程只在 Chromium 驗證一次')

  await gotoHydrated(page, route)
  await importProducts(page, [await portraitFile(page)])

  await expect(page.locator('[data-workbench-model]')).toHaveAttribute('data-model-ready', 'false')
  await expect(batch(page, '整批去背')).toBeDisabled()
  await page.getByRole('button', { name: '下載模型' }).click()
  await page.locator('[data-workbench-model][data-model-ready="true"]').waitFor({ timeout: 180_000 })

  await batch(page, '整批去背').click()
  await expect(page.locator('[data-workbench-step="cutout"]')).toHaveAttribute('data-workbench-state', 'done', { timeout: 180_000 })
  await expect(page.locator('[data-workbench-panel]')).toHaveAttribute('data-workbench-panel', 'layout')

  await page.getByLabel('通路規格').selectOption('momo-store-main')
  await batch(page, '整批產生版型').click()
  await expect(page.getByRole('link', { name: '下載第 1 項' })).toBeVisible({ timeout: 60_000 })
  expect(await outputPixels(page)).toMatchObject({ width: 1000, height: 1000, type: 'image/jpeg' })

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'artifacts/product-image-workbench-desktop.png', fullPage: true })
})
