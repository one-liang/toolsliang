import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { productImageWorkbenchCanaries } from '../support/product-image-workbench-canaries'
import { gotoHydrated } from './support/hydration'
import { settleTransitions } from './support/motion'
import { guardToolContentBoundary } from './support/tool-content-boundary'

guardToolContentBoundary(productImageWorkbenchCanaries, { allowedOrigins: ['http://127.0.0.1:4173'] })

/** Running the portrait model on the WebAssembly baseline is the slow part. */
test.setTimeout(240_000)

const route = '/zh-tw/tools/product-image-workbench/'
const photos = (page: Page) => page.locator('.workbench [data-batch-input]')

/** Drawn in the page, never a real photograph; the file name is the canary the guard watches. */
async function imageFile(page: Page, name: string, colour: string, width = 240, height = 240, type = 'image/png') {
  const bytes = await page.evaluate(async ({ colour, width, height, type }) => {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')!
    context.fillStyle = colour
    context.fillRect(0, 0, width, height)
    return [...new Uint8Array(await (await canvas.convertToBlob({ type, quality: 0.95 })).arrayBuffer())]
  }, { colour, width, height, type })

  return { name, mimeType: type, buffer: Buffer.from(bytes) }
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

/** Every finished output, read back: its size, type, and the colour at a corner and at the centre. */
async function outputs(page: Page) {
  const links = page.locator('.workbench [data-batch-download]')
  const found = []
  for (const link of await links.all()) {
    found.push(await page.evaluate(async (url) => {
      const blob = await (await fetch(url!)).blob()
      const image = await createImageBitmap(blob)
      const canvas = new OffscreenCanvas(image.width, image.height)
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      const output = { type: blob.type, width: image.width, height: image.height, corner: [...context.getImageData(4, 4, 1, 1).data], centre: [...context.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data] }
      image.close()
      return output
    }, await link.getAttribute('href')))
  }
  return found
}

/** JPEG moves colours a little; this is "the same colour" for a flat fill. */
function near(actual: number[], expected: number[]) {
  return actual.slice(0, 3).every((value, index) => Math.abs(value - expected[index]!) <= 12)
}

test('套版與壓縮：三張商品圖套上同一個 Logo，一次處理並在本機打包 ZIP', async ({ page }) => {
  await gotoHydrated(page, route)
  await photos(page).setInputFiles([
    await imageFile(page, 'private-workbench-canary.png', '#ff0000'),
    await imageFile(page, 'private-workbench-canary.png', '#00ff00'),
    await imageFile(page, 'private-workbench-canary.png', '#ffff00'),
  ])
  await expect(page.getByRole('listbox', { name: '這批圖片' }).getByRole('option')).toHaveCount(3)
  // The jobs start as the tools' own defaults: the portrait cutout is off, the layout and the compression on.
  await expect(page.locator('[data-workbench-job="cutout"] input[type=checkbox]')).not.toBeChecked()
  await expect(page.locator('[data-workbench-job="compose"] input[type=checkbox]')).toBeChecked()
  await expect(page.locator('[data-workbench-job="compress"] input[type=checkbox]')).toBeChecked()
  await expect(page.locator('[data-promo-stage]')).toBeVisible()

  const chooser = page.waitForEvent('filechooser')
  await page.locator('[data-workbench-add="logo"]').click()
  await (await chooser).setFiles(await imageFile(page, 'private-workbench-logo.png', '#0000ff', 100, 100))
  // Position and size by number sit folded away beside the canvas, since dragging does the same.
  await page.locator('[data-promo-exact] summary').click()
  await page.getByLabel('縮放（%）', { exact: true }).fill('20')

  await page.locator('[data-workbench-run]').click()
  await expect(page.locator('.workbench__status')).toContainText('完成 3／3 張', { timeout: 120_000 })
  const made = await outputs(page)
  expect(made).toHaveLength(3)
  for (const [index, colour] of [[255, 0, 0], [0, 255, 0], [255, 255, 0]].entries()) {
    expect(made[index]).toMatchObject({ type: 'image/jpeg', width: 1000, height: 1000 })
    // Each photo fills the product layer, and the Logo sits in the same place on every one.
    expect(near(made[index]!.corner, colour), `第 ${index + 1} 張的商品圖`).toBe(true)
    expect(near(made[index]!.centre, [0, 0, 255]), `第 ${index + 1} 張的 Logo`).toBe(true)
  }

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '全部下載（ZIP）', exact: true }).click()
  const zip = await download
  expect(zip.suggestedFilename()).toBe('product-images.zip')
  const { readFile } = await import('node:fs/promises')
  const bytes = (await readFile((await zip.path())!)).toString('latin1')
  for (const name of ['product-image-01.jpg', 'product-image-02.jpg', 'product-image-03.jpg']) expect(bytes).toContain(name)
  expect(bytes, 'ZIP 內不得沿用原始檔名').not.toContain('private-workbench')

  // Changing the layout makes every output stale at once.
  await page.getByLabel('縮放（%）', { exact: true }).fill('30')
  await expect(page.locator('.workbench [data-batch-download]')).toHaveCount(0)
  await expect(page.locator('[data-workbench-run]')).toContainText('全部處理（3 張）')
  await settleTransitions(page)
  expect((await new AxeBuilder({ page }).include('.workbench').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
})

test('只壓縮：關閉套版後維持原尺寸，和圖片壓縮相同', async ({ page }) => {
  await gotoHydrated(page, route)
  const source = await imageFile(page, 'private-workbench-canary.png', '#c0392b', 800, 600, 'image/jpeg')
  await photos(page).setInputFiles(source)
  await page.locator('[data-workbench-job="compose"] input[type=checkbox]').uncheck()
  await expect(page.locator('[data-promo-stage]')).toHaveCount(0)
  await expect(page.locator('[data-workbench-preview]')).toBeVisible()
  await page.locator('[data-workbench-run]').click()
  await expect(page.locator('.workbench__status')).toContainText('完成 1／1 張', { timeout: 60_000 })
  const [made] = await outputs(page)
  expect(made).toMatchObject({ type: 'image/jpeg', width: 800, height: 600 })
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: '下載圖片' }).click()
  expect((await download).suggestedFilename()).toBe('product-image-01.jpg')
})

test('有一張不能處理時只停在那一張，其餘照常完成', async ({ page }) => {
  await gotoHydrated(page, route)
  const oversized = Buffer.alloc(33)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversized)
  oversized.writeUInt32BE(13, 8); oversized.write('IHDR', 12); oversized.writeUInt32BE(9000, 16); oversized.writeUInt32BE(9000, 20)
  await photos(page).setInputFiles([
    await imageFile(page, 'private-workbench-canary.png', '#ff0000'),
    { name: 'private-workbench-canary.png', mimeType: 'image/png', buffer: oversized },
    await imageFile(page, 'private-workbench-canary.png', '#00ff00'),
  ])
  const strip = page.getByRole('listbox', { name: '這批圖片' })
  await page.locator('[data-workbench-run]').click()
  await expect(page.locator('.workbench__status')).toContainText('完成 2／3 張', { timeout: 120_000 })
  await expect(strip.locator('[data-batch-status="failed"]')).toHaveCount(1)
  await strip.getByRole('option').nth(1).click()
  await expect(page.locator('[data-batch-current]')).toContainText('失敗')
  // A picture over the limits stays refused, so trying again is not offered.
  await expect(page.locator('[data-batch-retry]')).toHaveCount(0)
  await expect(page.locator('.workbench [data-batch-download]')).toHaveCount(2)
})

test('第一個畫面就看得到縮圖列、畫布、三個選項、處理與下載按鈕（#112）', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await gotoHydrated(page, route)
  await photos(page).setInputFiles([
    await imageFile(page, 'private-workbench-canary.png', '#ff0000', 240, 320),
    await imageFile(page, 'private-workbench-canary.png', '#00ff00', 320, 240),
  ])
  await expect(page.locator('[data-promo-stage]')).toBeVisible()
  expect(await page.evaluate(() => scrollY)).toBe(0)
  const fold = await page.evaluate(() => innerHeight)
  const visible = async (label: string, target: ReturnType<Page['locator']>) => {
    const box = (await target.boundingBox())!
    expect(box.y + box.height, `${label}不捲動就要完整看得到`).toBeLessThanOrEqual(fold)
  }
  await visible('縮圖列', page.getByRole('listbox', { name: '這批圖片' }))
  await visible('畫布', page.locator('[data-promo-stage]'))
  for (const job of ['cutout', 'compose', 'compress']) await visible(`「${job}」選項`, page.locator(`[data-workbench-job="${job}"] input[type=checkbox]`))
  await visible('處理按鈕', page.locator('[data-workbench-run]'))
  await page.locator('[data-workbench-run]').click()
  await expect(page.getByRole('button', { name: '全部下載（ZIP）', exact: true })).toBeVisible({ timeout: 60_000 })
  await visible('下載按鈕', page.getByRole('button', { name: '全部下載（ZIP）', exact: true }))
  if (info.project.name === 'chromium') await page.screenshot({ path: 'artifacts/product-image-workbench-1366.png' })

  await page.setViewportSize({ width: 375, height: 812 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await settleTransitions(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  if (info.project.name === 'chromium') await page.screenshot({ path: 'artifacts/product-image-workbench-375.png', fullPage: true })
})

for (const locale of ['zh-tw', 'en']) {
  test(`${locale} 響應式、亮暗色、SEO 與無障礙`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoHydrated(page, `/${locale}/tools/product-image-workbench/`)

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://toolsliang.com/${locale}/tools/product-image-workbench/`)
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', 'https://toolsliang.com/en/tools/product-image-workbench/')
    await expect(page.locator('link[hreflang="zh-Hant-TW"]')).toHaveAttribute('href', 'https://toolsliang.com/zh-tw/tools/product-image-workbench/')
    // The ceilings are stated before a file is chosen, not after one is refused.
    await expect(page.locator('.workbench')).toContainText(locale === 'en' ? '20 images' : '20 張')
    // ADR-0022, and #112: no channel specifications, and no step rail.
    await expect(page.locator('body')).not.toContainText(locale === 'en' ? /channel|preset|compliant/i : /通路|合規/)
    await expect(page.locator('[data-workbench-step]')).toHaveCount(0)

    // A refused file is explained in the language of the page it was refused on.
    await photos(page).setInputFiles({ name: 'renamed.png', mimeType: 'image/png', buffer: Buffer.from('not an image at all') })
    await expect(page.locator('[data-batch-issue="unsupported_format"]')).toContainText(locale === 'en' ? 'Choose a JPEG, PNG, or WebP image' : '請選擇真正的 JPEG、PNG 或 WebP 圖片')

    await photos(page).setInputFiles(await imageFile(page, 'private-workbench-canary.png', '#ff0000'))
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: locale === 'en' ? 'Toggle color theme' : '切換色彩模式' }).click()
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    }
  })
}

test('去背：勾選後在本機去背，輸出透明 PNG', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', '模型下載與推論的完整流程只在 Chromium 驗證一次')

  await gotoHydrated(page, route)
  await photos(page).setInputFiles(await portraitFile(page))
  await page.locator('[data-workbench-job="cutout"] input[type=checkbox]').check()
  await page.locator('[data-workbench-job="compose"] input[type=checkbox]').uncheck()
  await page.locator('[data-workbench-job="compress"] input[type=checkbox]').uncheck()
  await page.locator('[data-workbench-run]').click()
  await expect(page.locator('.workbench__status')).toContainText('完成 1／1 張', { timeout: 180_000 })
  const [made] = await outputs(page)
  expect(made).toMatchObject({ type: 'image/png', width: 512, height: 512 })
  // The drawn background is gone and the drawn person is kept.
  expect(made!.corner[3]).toBeLessThan(16)
  expect(made!.centre[3]).toBeGreaterThan(200)
})
