import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { compliantProductImageCanaries } from '../support/compliant-product-image-canaries'
import { gotoHydrated } from './support/hydration'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

guardToolContentBoundary(compliantProductImageCanaries, { allowedOrigins: ['http://127.0.0.1:4173'] })

test.beforeEach(({ page }) => {
  page.on('console', message => { expect(compliantProductImageCanaries.some(canary => message.text().includes(canary.value)), '主控台不得包含商品圖內容').toBe(false) })
})

/**
 * The externally observable half of every preset: the canvas the editor starts
 * from, and the capacity the channel published. It is written out here rather
 * than imported, so a change to the domain modules has to be restated as a
 * change to what a merchant actually gets.
 */
const presets = [
  { id: 'google-merchant-center-main', width: 1500, height: 1500, maxBytes: 16_000_000 },
  { id: 'amazon-main', width: 1000, height: 1000 },
  { id: 'momo-store-main', width: 1000, height: 1000, minBytes: 50_000, maxBytes: 1_000_000 },
  { id: 'momo-store-ad', width: 1000, height: 1000, minBytes: 50_000, maxBytes: 1_000_000 },
  { id: 'momo-store-variant', width: 1000, height: 1000, minBytes: 50_000, maxBytes: 1_000_000 },
  { id: 'ruten-main', width: 1000, height: 1000, maxBytes: 5_000_000 },
] as const

/**
 * Generating per-pixel noise is the most expensive thing this suite does, and
 * the bytes are deterministic and browser-independent — they are only ever an
 * input file. Encoding each size once and reusing it keeps the three-browser
 * run inside the CI budget.
 */
const fixtures = new Map<string, Buffer>()

/**
 * A drawn product on a plain ground, with enough detail that a JPEG of it
 * cannot collapse under a channel's capacity floor. Nothing here is a
 * photograph, and the file name is the canary the boundary guard watches for.
 */
async function productFile(page: Page, width = 2400, height = 1800) {
  const key = `${width}x${height}`
  const cached = fixtures.get(key)
  if (cached) return { name: 'private-product-canary.png', mimeType: 'image/jpeg', buffer: cached }

  const bytes = await page.evaluate(async ([width, height]) => {
    const canvas = new OffscreenCanvas(width!, height!)
    const context = canvas.getContext('2d')!
    const pixels = context.createImageData(width!, height!)
    let seed = 20260908
    for (let index = 0; index < pixels.data.length; index += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0
      pixels.data[index] = 200 + (seed >>> 25)
      pixels.data[index + 1] = 190 + ((seed >>> 18) & 0x3f)
      pixels.data[index + 2] = 180 + ((seed >>> 11) & 0x3f)
      pixels.data[index + 3] = 255
    }
    context.putImageData(pixels, 0, 0)
    context.fillStyle = '#7a4b2a'
    context.fillRect(width! * 0.2, height! * 0.2, width! * 0.6, height! * 0.6)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 })
    return [...new Uint8Array(await blob.arrayBuffer())]
  }, [width, height] as const)

  const buffer = Buffer.from(bytes)
  fixtures.set(key, buffer)

  return { name: 'private-product-canary.png', mimeType: 'image/jpeg', buffer }
}

/** Reads the produced file back, so the assertion is about bytes and not about the interface. */
async function readOutput(page: Page) {
  const url = await page.getByRole('link', { name: '下載輸出' }).getAttribute('href')

  return page.evaluate(async (url) => {
    const blob = await fetch(url!).then(response => response.blob())
    const bitmap = await createImageBitmap(blob)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()

    return { ...size, type: blob.type, bytes: blob.size }
  }, url)
}

/** The tightest preset there is: an exact canvas, a byte floor and a byte ceiling. */
const representativePreset = 'momo-store-main'

for (const preset of presets) {
  test(`${preset.id}：依通路規格產生輸出並逐條列出檢查結果`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium' && preset.id !== representativePreset,
      '每個 preset 的數值由單元測試釘住；跨瀏覽器只需驗證編碼與算繪，以最嚴格的 preset 代表',
    )
    await gotoHydrated(page, '/zh-tw/tools/compliant-product-image/')
    await page.getByLabel('通路規格', { exact: true }).selectOption(preset.id)
    await expect(page.locator('#compliant-width')).toHaveValue(String(preset.width))
    await expect(page.locator('#compliant-height')).toHaveValue(String(preset.height))
    await page.getByLabel('選擇商品圖片', { exact: true }).setInputFiles(await productFile(page))
    await page.getByRole('button', { name: '產生輸出', exact: true }).click()

    await expect(page.locator('[data-image-result]')).toContainText(`${preset.width} × ${preset.height}`)
    const output = await readOutput(page)
    expect(output.width).toBe(preset.width)
    expect(output.height).toBe(preset.height)
    expect(output.type).toBe('image/jpeg')
    if (preset.maxBytes) expect(output.bytes).toBeLessThanOrEqual(preset.maxBytes)
    if (preset.minBytes) expect(output.bytes).toBeGreaterThanOrEqual(preset.minBytes)

    // Nothing the tool cannot read off the file may be reported as checked.
    const check = page.locator('[data-preset-check]')
    await expect(check).toHaveAttribute('data-result', 'pass')
    await expect(check.locator('[data-rule-group="failed"]')).toHaveCount(0)
    await expect(page.locator('[data-preset-caveats]')).toContainText('規格輔助，不保證通路審核通過。')
  })
}

test('規格來源、查核日期與未公開的欄位都看得見，且來源只外連不代取', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/compliant-product-image/')
  await page.getByLabel('通路規格', { exact: true }).selectOption('ruten-main')

  const source = page.locator('[data-preset-source]')
  await expect(source).toContainText('露天市集')
  await expect(source).toContainText('2026')
  await expect(source.locator('[data-preset-status]')).toHaveAttribute('data-status', 'active')
  await expect(page.locator('[data-coverage-gaps]')).toContainText('尺寸範圍')

  const link = source.getByRole('link').first()
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('href', /^https:\/\/www\.ruten\.com\.tw\//)
  await expect(page.locator('[data-excluded-channels]')).toContainText('蝦皮購物（台灣）')
})

/**
 * The freshness verdict itself is judged against the visitor's own clock, so it
 * is exercised in `tests/compliant-product-image-workspace.test.ts`, where the
 * clock can be moved past the grace period. What a browser has to prove is that
 * the dates the verdict is derived from, and the promise that a lapsed preset
 * is disabled, are both on the page before anyone uploads anything.
 */
test('查核效期與停用政策在上傳前就看得見', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/compliant-product-image/')

  await expect(page.locator('[data-preset-source]')).toContainText('有效至')
  await expect(page.locator('[data-preset-status]')).toHaveAttribute('data-status', 'active')
  await expect(page.locator('[data-preset-status]')).toContainText('依這台裝置的日期判斷')
  await expect(page.locator('[data-preset-caveats]')).toContainText('超過查核效期的 preset 會停用')
  await expect(page.locator('[data-preset-notices]')).toContainText('有些規則要靠你自己確認')
})

test('輔助框與未通過項目都有文字，不只用顏色表達', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/compliant-product-image/')
  await page.getByLabel('通路規格', { exact: true }).selectOption('momo-store-main')
  await page.getByLabel('選擇商品圖片', { exact: true }).setInputFiles(await productFile(page))
  await page.getByRole('button', { name: '產生輸出', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toBeVisible()

  const guide = page.locator('[data-occupancy-guide]')
  await expect(guide).toContainText('商品佔比輔助框')
  await expect(guide).toContainText('80%')
  await expect(page.locator('[data-rule-group="assisted"]')).toContainText('色度模型')
  await expect(page.locator('[data-rule-group="manual"]')).toContainText('每則商品')
  await expect(page.locator('[data-rule-group="out-of-scope"]')).toContainText('允許放置於')
})

test('裁切預覽在產生前就在，輔助框確實蓋在輸出畫布上', async ({ page }, testInfo) => {
  await gotoHydrated(page, '/zh-tw/tools/compliant-product-image/')
  await page.getByLabel('通路規格', { exact: true }).selectOption('momo-store-main')
  await page.getByLabel('選擇商品圖片', { exact: true }).setInputFiles(await productFile(page))

  // §4.4 calls occupancy `assisted`: the frame has to be there while the crop is set.
  const preview = page.locator('[data-image-preview]')
  await expect(preview).toContainText('裁切預覽')
  await expect(page.locator('[data-image-result]')).toHaveCount(0)

  const geometry = async () => {
    const frame = (await page.locator('.compliant-product-image__frame').boundingBox())!
    const guide = (await page.locator('[data-occupancy-guide]').boundingBox())!
    return {
      frameRatio: frame.width / frame.height,
      widthShare: guide.width / frame.width,
      heightShare: guide.height / frame.height,
      insetLeft: (guide.x - frame.x) / frame.width,
      insetTop: (guide.y - frame.y) / frame.height,
    }
  }
  // An 80% area guide is a centred box of √0.8 ≈ 0.894 on each side.
  const side = Math.sqrt(0.8)
  const before = await geometry()
  expect(before.frameRatio).toBeCloseTo(1, 2)
  expect(before.widthShare).toBeCloseTo(side, 2)
  expect(before.heightShare).toBeCloseTo(side, 2)
  expect(before.insetLeft).toBeCloseTo((1 - side) / 2, 2)
  expect(before.insetTop).toBeCloseTo((1 - side) / 2, 2)

  await page.getByRole('button', { name: '產生輸出', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toBeVisible()
  const after = await geometry()
  expect(after.frameRatio).toBeCloseTo(1, 2)
  expect(after.widthShare).toBeCloseTo(side, 2)
  expect(after.heightShare).toBeCloseTo(side, 2)
  if (testInfo.project.name === 'chromium') {
    await page.locator('[data-image-preview]').screenshot({ path: 'artifacts/compliant-product-image-guide.png' })
  }
})

test('不可能的輸出尺寸在開始前就說明，修正後可以繼續', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/compliant-product-image/')
  await page.getByLabel('通路規格', { exact: true }).selectOption('ruten-main')
  await page.getByLabel('選擇商品圖片', { exact: true }).setInputFiles(await productFile(page))
  await page.locator('#compliant-width').fill('3000')
  await page.locator('#compliant-height').fill('400')

  await expect(page.locator('.compliant-product-image__settings .field-error')).toContainText('長寬比不在這個通路允許的範圍內')
  await expect(page.getByRole('button', { name: '產生輸出', exact: true })).toBeDisabled()

  await page.locator('#compliant-height').fill('1000')
  await expect(page.getByRole('button', { name: '產生輸出', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '產生輸出', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toContainText('3000 × 1000')
})

test('鍵盤可完成取消、重試與下載，離頁後釋放 Blob URL', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const NativeWorker = Worker
    window.Worker = class extends NativeWorker {
      override postMessage(message: unknown, transfer?: Transferable[]) {
        if ((message as { type?: string }).type === 'run') setTimeout(() => super.postMessage(message, transfer ?? []), 500)
        else super.postMessage(message, transfer ?? [])
      }
    }
    const active = new Set<string>()
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = blob => { const url = create(blob); active.add(url); return url }
    URL.revokeObjectURL = (url) => { active.delete(url); revoke(url) }
    Object.assign(window, { activeImageUrls: active })
  })
  await gotoHydrated(page, '/zh-tw/tools/compliant-product-image/')
  await page.getByLabel('選擇商品圖片', { exact: true }).setInputFiles(await productFile(page))

  const start = page.getByRole('button', { name: '產生輸出', exact: true })
  await start.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('progressbar')).toBeVisible()
  const cancel = page.getByRole('button', { name: '取消', exact: true })
  await cancel.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.compliant-product-image__status')).toContainText('已取消')
  await expect(page.getByRole('link', { name: '下載輸出' })).toHaveCount(0)

  await start.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('[data-image-result]')).toBeVisible()
  const download = page.getByRole('link', { name: '下載輸出' })
  await download.focus()
  expect(await download.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
  const started = page.waitForEvent('download')
  await page.keyboard.press('Enter')
  expect((await started).suggestedFilename()).toBe('google-merchant-center-main.jpg')

  await page.getByRole('button', { name: '清除圖片', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'activeImageUrls').size)).toBe(0)
  await page.locator('.breadcrumbs a').click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'activeImageUrls').size)).toBe(0)
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'artifacts/compliant-product-image-desktop.png', fullPage: true })
})

test('超過本機上限與損毀的輸入可修正，不遺失原檔', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/compliant-product-image/')
  const oversized = Buffer.alloc(33)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversized)
  oversized.writeUInt32BE(13, 8); oversized.write('IHDR', 12); oversized.writeUInt32BE(9000, 16); oversized.writeUInt32BE(9000, 20)
  await page.getByLabel('選擇商品圖片', { exact: true }).setInputFiles({ name: 'private-product-canary.png', mimeType: 'image/png', buffer: oversized })
  await page.getByRole('button', { name: '產生輸出', exact: true }).click()
  await expect(page.locator('#compliant-error')).toContainText('圖片超過本機處理上限')
  await expect(page.locator('.compliant-product-image__filename')).toContainText('private-product-canary.png')

  await page.getByLabel('選擇商品圖片', { exact: true }).setInputFiles(await productFile(page))
  await page.getByRole('button', { name: '產生輸出', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toBeVisible()
})

for (const locale of ['zh-tw', 'en'] as const) {
  test(`${locale} 解碼前拒絕 HEIC、雙語 SEO、響應式與 axe`, async ({ page }, testInfo) => {
    await gotoHydrated(page, `/${locale}/tools/compliant-product-image/`)
    await page.getByLabel(locale === 'en' ? 'Choose product image' : '選擇商品圖片', { exact: true })
      .setInputFiles({ name: 'renamed-product.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0, 109, 105, 102, 49, 104, 101, 105, 99]) })
    await expect(page.locator('#compliant-error')).toContainText(locale === 'en' ? 'HEIC/HEIF from iPhone is not supported' : '第一版不支援 iPhone HEIC／HEIF')
    await expect(page.getByRole('progressbar')).toHaveCount(0)

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://toolsliang.com/${locale}/tools/compliant-product-image/`)
    await expect(page.locator('link[hreflang="zh-Hant-TW"]')).toHaveAttribute('href', 'https://toolsliang.com/zh-tw/tools/compliant-product-image/')
    await expect(page.locator('.tool-contract--faq')).toContainText(locale === 'en' ? 'guarantee' : '保證')

    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.setViewportSize({ width: 375, height: 900 })
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: locale === 'en' ? 'Toggle color theme' : '切換色彩模式' }).click()
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
      if (testInfo.project.name === 'chromium') await page.screenshot({ path: `artifacts/compliant-product-image-${locale}-${theme}-375.png`, fullPage: true })
    }
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.locator('body').evaluate(element => element.style.zoom = '2')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('12 MP 商品圖在本機預算內完成，主執行緒保持回應', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await gotoHydrated(page, '/zh-tw/tools/compliant-product-image/')
  await page.getByLabel('通路規格', { exact: true }).selectOption('momo-store-main')
  await page.getByLabel('選擇商品圖片', { exact: true }).setInputFiles(await productFile(page, 4000, 3000))
  await page.evaluate(() => {
    const metrics = { start: performance.now(), progressAt: 0, maxGap: 0, last: performance.now() }
    const timer = setInterval(() => { const now = performance.now(); metrics.maxGap = Math.max(metrics.maxGap, now - metrics.last); metrics.last = now }, 20)
    const observer = new MutationObserver(() => { if (!metrics.progressAt && document.querySelector('[role=progressbar]')) metrics.progressAt = performance.now() })
    observer.observe(document.body, { childList: true, subtree: true })
    Object.assign(window, { renderMetrics: metrics, stopMetrics: () => { clearInterval(timer); observer.disconnect() } })
    ;(document.querySelector('.compliant-product-image button[type=submit]') as HTMLButtonElement).click()
  })
  await expect(page.locator('[data-image-result]')).toContainText('1000 × 1000', { timeout: 10_000 })

  const metrics = await page.evaluate(() => {
    Reflect.get(window, 'stopMetrics')()
    const metrics = Reflect.get(window, 'renderMetrics')
    return { elapsed: performance.now() - metrics.start, progress: metrics.progressAt - metrics.start, maxGap: metrics.maxGap }
  })
  // §12.9: one 12 MP image renders within ten seconds on the reference desktop.
  expect(metrics.elapsed).toBeLessThan(10_000)
  expect(metrics.progress).toBeGreaterThan(0)
  expect(metrics.progress).toBeLessThanOrEqual(250)
  expect(metrics.maxGap).toBeLessThan(250)
  await testInfo.attach('本機桌面效能量測', { body: JSON.stringify(metrics), contentType: 'application/json' })
})

test('首次載入後可離線重新產生，商品圖與檔名不進入快取或偏好', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Service Worker 生命週期僅在 Chromium 驗證')
  const html = await (await page.request.get('/zh-tw/tools/compliant-product-image/')).text()
  expect(html).toMatch(/href="\/_nuxt\/compliant-image\.worker-[^"]+\.js"/)
  await page.route('**/sw.js', async (route) => { await new Promise(resolve => setTimeout(resolve, 500)); await route.continue() })
  await gotoHydrated(page, '/zh-tw/tools/compliant-product-image/')
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    const keys = await caches.keys()
    const paths = (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat()
    return paths.some(path => /compliant-image\.worker-.*\.js$/.test(path))
  }, undefined, { timeout: 20_000 })

  expectOfflineRequests(page)
  await context.setOffline(true)
  await page.reload()
  await page.getByLabel('通路規格', { exact: true }).selectOption('momo-store-main')
  await page.getByLabel('選擇商品圖片', { exact: true }).setInputFiles(await productFile(page))
  await page.getByRole('button', { name: '產生輸出', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toContainText('1000 × 1000')

  const stored = await page.evaluate(async () => {
    const keys = await caches.keys()
    return {
      local: localStorage.length,
      session: sessionStorage.length,
      urls: (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat(),
    }
  })
  expect(stored.local).toBe(0)
  expect(stored.session).toBe(0)
  expect(stored.urls.some(url => url.includes('private-product-canary') || url.startsWith('blob:'))).toBe(false)
})
