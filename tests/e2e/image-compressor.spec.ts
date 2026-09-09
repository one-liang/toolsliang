import { imageCompressorCanaries } from '../support/image-compressor-canaries'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { gotoHydrated } from './support/hydration'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

guardToolContentBoundary(imageCompressorCanaries, { allowedOrigins: ['http://127.0.0.1:4173'] })

test.beforeEach(({ page }) => {
  page.on('console', message => { expect(imageCompressorCanaries.some(canary => message.text().includes(canary.value)), '主控台不得包含圖片內容').toBe(false) })
})

test('PNG 本機壓縮、縮放、透明度與下載', async ({ page }, testInfo) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 40
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 40, 40)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'))
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  await page.getByLabel('Choose image', { exact: true }).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/png', buffer: Buffer.from(bytes) })
  await page.getByLabel('Output format').selectOption('image/png')
  await page.getByLabel('Maximum width').fill('40')
  await page.getByLabel('Maximum height').fill('40')
  await page.getByRole('button', { name: 'Compress image', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toContainText('40 × 20')
  await expect(page.locator('[data-image-original]')).toContainText('80 × 40')
  const output = await page.getByRole('link', { name: 'Download image' }).getAttribute('href')
  const pixels = await page.evaluate(async (url) => {
    const blob = await fetch(url!).then(response => response.blob())
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0)
    const red = [...ctx.getImageData(5, 5, 1, 1).data]
    const transparent = [...ctx.getImageData(35, 5, 1, 1).data]
    bitmap.close(); return { red, transparent, type: blob.type }
  }, output)
  expect(pixels).toEqual({ red: [255, 0, 0, 255], transparent: [0, 0, 0, 0], type: 'image/png' })
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download image' }).click()
  expect((await download).suggestedFilename()).toBe('compressed-image.png')
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'artifacts/image-compressor-result-desktop.png', fullPage: true })
})

test('JPEG EXIF 方向正規化並移除來源中繼資料', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  const jpeg = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 40
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 40, 40); ctx.fillStyle = '#0000ff'; ctx.fillRect(40, 0, 40, 40)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 1))
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  // EXIF little-endian TIFF: one IFD entry, orientation = 6 (90° clockwise).
  const exif = [255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0]
  const bytes = Buffer.from([...jpeg.slice(0, 2), ...exif, ...jpeg.slice(2)])
  await page.getByLabel('Choose image', { exact: true }).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/jpeg', buffer: bytes })
  await page.getByLabel('Output format').selectOption('image/jpeg')
  await page.getByRole('button', { name: 'Compress image', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toContainText('40 × 80')
  const url = await page.getByRole('link', { name: 'Download image' }).getAttribute('href')
  const output = await page.evaluate(async (url) => {
    const blob = await fetch(url!).then(response => response.blob())
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const image = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(image.width, image.height); const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0)
    image.close()
    return { hasExif: new TextDecoder().decode(bytes).includes('Exif'), top: [...ctx.getImageData(20, 10, 1, 1).data], bottom: [...ctx.getImageData(20, 70, 1, 1).data] }
  }, url)
  expect(output.hasExif).toBe(false)
  expect(output.top[0]).toBeGreaterThan(240); expect(output.top[2]).toBeLessThan(15)
  expect(output.bottom[2]).toBeGreaterThan(240); expect(output.bottom[0]).toBeLessThan(15)
})

test('WebP 可解碼與轉為 PNG', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  await page.getByLabel('Choose image', { exact: true }).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
  await page.getByLabel('Output format').selectOption('image/png')
  await page.getByRole('button', { name: 'Compress image', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toContainText('80 × 40')
})

for (const locale of ['en', 'zh-tw'] as const) {
  test(`${locale} HEIC 解碼前拒絕、焦點保留、雙語 SEO 與響應式`, async ({ page }, testInfo) => {
    await gotoHydrated(page, `/${locale}/tools/image-compressor/`)
    const input = page.getByLabel(locale === 'en' ? 'Choose image' : '選擇圖片', { exact: true })
    await input.setInputFiles({ name: 'renamed.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0, 109, 105, 102, 49, 104, 101, 105, 99]) })
    await expect(page.locator('#compressor-error')).toContainText(locale === 'en' ? 'HEIC/HEIF from iPhone is not supported' : '第一版不支援 iPhone HEIC／HEIF')
    await expect(input).toBeFocused()
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://toolsliang.com/${locale}/tools/image-compressor/`)
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', 'https://toolsliang.com/en/tools/image-compressor/')
    await expect(page.locator('link[hreflang="zh-Hant-TW"]')).toHaveAttribute('href', 'https://toolsliang.com/zh-tw/tools/image-compressor/')
    await expect(page.locator('.tool-contract--faq')).toContainText('HEIC')
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.setViewportSize({ width: 375, height: 900 })
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: locale === 'en' ? 'Toggle color theme' : '切換色彩模式' }).click()
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
      if (testInfo.project.name === 'chromium') await page.screenshot({ path: `artifacts/image-compressor-${locale}-${theme}-375.png`, fullPage: true })
    }
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.locator('body').evaluate(element => element.style.zoom = '2')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('首次載入後 Worker 與圖片頁可離線重啟，圖片不進入快取或偏好', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Service Worker 生命週期僅在 Chromium 驗證')
  const html = await (await page.request.get('/en/tools/image-compressor/')).text()
  expect(html).toMatch(/href="\/_nuxt\/image\.worker-[^"]+\.js"/)
  await page.route('**/sw.js', async route => { await new Promise(resolve => setTimeout(resolve, 500)); await route.continue() })
  await gotoHydrated(page, '/en/tools/image-compressor/')
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    const keys = await caches.keys()
    const paths = (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat()
    return paths.some(path => /image\.worker-.*\.js$/.test(path))
  }, undefined, { timeout: 20_000 })
  expectOfflineRequests(page)
  await context.setOffline(true)
  await page.reload()
  await page.getByLabel('Choose image', { exact: true }).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
  await page.getByLabel('Output format').selectOption('image/png')
  await page.getByRole('button', { name: 'Compress image', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toContainText('80 × 40')
  const stored = await page.evaluate(async () => {
    const keys = await caches.keys()
    return { local: localStorage.length, session: sessionStorage.length, urls: (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat() }
  })
  expect(stored.local).toBe(0); expect(stored.session).toBe(0)
  expect(stored.urls.some(url => url.includes('transparent.webp') || url.startsWith('blob:'))).toBe(false)
})

/**
 * How long the page's main thread may go without running a task while a 12 MP
 * image is compressed. The point of the budget is that this tool does its work
 * in a worker, so the interface stays answerable.
 *
 * Firefox needs a different number, and not because of anything this tool does.
 * When a worker decodes a large image, Firefox does work proportional to that
 * image on the content process main thread. Measured against this exact flow:
 * the tool's own main-thread calls total about 3ms — `blob.slice` 0ms, a 4 KiB
 * `arrayBuffer` 1ms, the worker script fetch 1ms, `new Worker`, `postMessage`
 * and `createObjectURL` 0ms each — while no task can run for about 120ms. That
 * stall is real rather than timer throttling (`MessageChannel` and
 * `requestAnimationFrame` stall with `setInterval`), scales with the image
 * (an 80 × 40 source produces no stall at all), is absent on Chromium and
 * WebKit, and is unchanged on builds predating the tools that later made it
 * visible in CI. On a CPU-constrained runner the same stall reaches ~300ms.
 *
 * So on Firefox a 250ms bound measures how much spare CPU the runner had, not
 * this tool. The two engines where the number does describe the application
 * keep it; Firefox keeps a bound loose enough to clear the browser's own cost
 * and tight enough that work moving back onto the main thread would still fail.
 */
function mainThreadStallBudget(browser: string) {
  return browser === 'firefox' ? 600 : 250
}

for (const mobile of [false, true]) test(`12 MP JPEG 品質極值、主執行緒回應與處理預算（${mobile ? '手機版面' : '桌面版面'}）`, async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  if (mobile) await page.setViewportSize({ width: 375, height: 812 })
  await gotoHydrated(page, '/en/tools/image-compressor/')
  const bytes = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(4000, 3000)
    const ctx = canvas.getContext('2d')!
    const pixels = ctx.createImageData(4000, 3000)
    let seed = 42
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0
      pixels.data[i] = (seed >>> 24); pixels.data[i + 1] = (i >>> 12) % 256; pixels.data[i + 2] = (i >>> 8) % 256; pixels.data[i + 3] = 255
    }
    ctx.putImageData(pixels, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    return await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]!); reader.readAsDataURL(blob) })
  })
  await page.getByLabel('Choose image', { exact: true }).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/jpeg', buffer: Buffer.from(bytes, 'base64') })
  await page.getByLabel('Maximum width').fill('4000'); await page.getByLabel('Maximum height').fill('3000')
  await page.getByLabel('Quality (0–100)').fill('0')
  await page.evaluate(() => {
    const metrics = { start: performance.now(), progressAt: 0, maxGap: 0, last: performance.now() }
    const timer = setInterval(() => { const now = performance.now(); metrics.maxGap = Math.max(metrics.maxGap, now - metrics.last); metrics.last = now }, 20)
    const observer = new MutationObserver(() => { if (!metrics.progressAt && document.querySelector('[role=progressbar]')) metrics.progressAt = performance.now() })
    observer.observe(document.body, { childList: true, subtree: true })
    Object.assign(window, { compressionMetrics: metrics, stopMetrics: () => { clearInterval(timer); observer.disconnect() } })
    ;(document.querySelector('.image-compressor button[type=submit]') as HTMLButtonElement).click()
  })
  await expect(page.locator('[data-image-result]')).toContainText('4000 × 3000', { timeout: 8000 })
  const low = await page.getByRole('link', { name: 'Download image' }).getAttribute('href')
  const metrics = await page.evaluate(async (url) => {
    Reflect.get(window, 'stopMetrics')()
    const metrics = Reflect.get(window, 'compressionMetrics')
    return { elapsed: performance.now() - metrics.start, progress: metrics.progressAt - metrics.start, maxGap: metrics.maxGap, lowBytes: (await fetch(url!).then(r => r.blob())).size }
  }, low)
  expect(metrics.elapsed).toBeLessThan(8000)
  expect(metrics.progress).toBeGreaterThan(0); expect(metrics.progress).toBeLessThanOrEqual(250)
  expect(metrics.maxGap).toBeLessThan(mainThreadStallBudget(testInfo.project.name))
  await testInfo.attach('本機桌面效能量測', { body: JSON.stringify(metrics), contentType: 'application/json' })
  await page.getByLabel('Quality (0–100)').fill('100')
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Compress image', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toBeVisible({ timeout: 8000 })
  const high = await page.getByRole('link', { name: 'Download image' }).getAttribute('href')
  expect(await page.evaluate(async url => (await fetch(url!).then(r => r.blob())).size, high)).toBeGreaterThan(metrics.lowBytes)
})

test('鍵盤取消與重試、清除及離頁釋放 Blob URL', async ({ page }, testInfo) => {
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
    URL.revokeObjectURL = url => { active.delete(url); revoke(url) }
    Object.assign(window, { activeImageUrls: active })
  })
  await gotoHydrated(page, '/en/tools/image-compressor/')
  await page.getByLabel('Choose image', { exact: true }).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
  const start = page.getByRole('button', { name: 'Compress image', exact: true })
  await start.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('progressbar')).toBeVisible()
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true })
  await cancel.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.image-compressor [role=status]')).toContainText('Cancelled')
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveCount(0)
  await start.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('[data-image-result]')).toBeVisible()
  const download = page.getByRole('link', { name: 'Download image' })
  await download.focus()
  expect(await download.evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none')
  await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
  await page.getByRole('button', { name: 'Clear image', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'activeImageUrls').size)).toBe(0)
  await page.getByLabel('Choose image', { exact: true }).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
  await start.click(); await expect(page.locator('[data-image-result]')).toBeVisible()
  await page.locator('.breadcrumbs a').click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'activeImageUrls').size)).toBe(0)
})

test('損毀與超大像素輸入可修正，不遺失原檔', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  const oversized = Buffer.alloc(33)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversized)
  oversized.writeUInt32BE(13, 8); oversized.write('IHDR', 12); oversized.writeUInt32BE(9000, 16); oversized.writeUInt32BE(9000, 20)
  await page.getByLabel('Choose image', { exact: true }).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/png', buffer: oversized })
  await page.getByRole('button', { name: 'Compress image', exact: true }).click()
  await expect(page.locator('#compressor-error')).toContainText('exceeds the local limits')
  await expect(page.locator('.image-compressor__filename')).toContainText('private-image-canary.png')
  oversized.writeUInt32BE(80, 16); oversized.writeUInt32BE(40, 20)
  await page.getByLabel('Choose image', { exact: true }).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/png', buffer: oversized })
  await page.getByRole('button', { name: 'Compress image', exact: true }).click()
  await expect(page.locator('#compressor-error')).toContainText('Processing did not finish')
  await page.getByLabel('Choose image', { exact: true }).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
  await page.getByRole('button', { name: 'Compress image', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toBeVisible()
})

test('解碼前估算記憶體並提供縮小尺寸的恢復方式', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  const input = Buffer.alloc(20 * 1024 * 1024)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(input)
  input.writeUInt32BE(13, 8); input.write('IHDR', 12); input.writeUInt32BE(6000, 16); input.writeUInt32BE(4000, 20)
  await page.getByLabel('Choose image', { exact: true }).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/png', buffer: input })
  await page.getByLabel('Maximum width').fill('6000'); await page.getByLabel('Maximum height').fill('4000')
  await page.getByRole('button', { name: 'Compress image', exact: true }).click()
  await expect(page.locator('#compressor-error')).toContainText('Not enough memory')
  await expect(page.locator('.image-compressor__filename')).toContainText('private-image-canary.png')
})

test('JPEG 補白、WebP 依編碼能力提供透明輸出', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  await page.getByLabel('Choose image', { exact: true }).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
  await page.getByLabel('Output format').selectOption('image/jpeg')
  await page.getByRole('button', { name: 'Compress image', exact: true }).click()
  await expect(page.locator('[data-image-result]')).toBeVisible()
  const jpeg = await page.getByRole('link', { name: 'Download image' }).getAttribute('href')
  const pixel = await page.evaluate(async url => {
    const bitmap = await createImageBitmap(await fetch(url!).then(response => response.blob()))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height); const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close()
    return [...ctx.getImageData(70, 20, 1, 1).data]
  }, jpeg)
  expect(pixel).toEqual([255, 255, 255, 255])
  if (await page.locator('#compressor-format option[value="image/webp"]').count()) {
    await page.getByLabel('Output format').selectOption('image/webp')
    await page.getByRole('button', { name: 'Compress image', exact: true }).click()
    await expect(page.locator('[data-image-result]')).toBeVisible()
    const url = await page.getByRole('link', { name: 'Download image' }).getAttribute('href')
    const webp = await page.evaluate(async url => {
      const blob = await fetch(url!).then(response => response.blob())
      const bitmap = await createImageBitmap(blob)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height); const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close()
      return { type: blob.type, alpha: ctx.getImageData(70, 20, 1, 1).data[3] }
    }, url)
    expect(webp).toEqual({ type: 'image/webp', alpha: 0 })
  }
  else {
    await expect(page.locator('#compressor-format-help')).toContainText('Only available encoders are offered')
    await expect(page.locator('#compressor-format option[value="image/png"]')).toHaveCount(1)
  }
})
