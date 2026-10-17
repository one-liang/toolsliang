import { imageCompressorCanaries } from '../support/image-compressor-canaries'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { gotoHydrated } from './support/hydration'
import { settleTransitions } from './support/motion'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

guardToolContentBoundary(imageCompressorCanaries, { allowedOrigins: ['http://127.0.0.1:4173'] })

test.beforeEach(({ page }) => {
  page.on('console', message => { expect(imageCompressorCanaries.some(canary => message.text().includes(canary.value)), '主控台不得包含圖片內容').toBe(false) })
})

/** The picker's own file input: the visible control is its button, so files are handed to the input directly. */
const files = (page: Page) => page.locator('.image-compressor [data-batch-input]')

/** Clearing the batch asks once before it lets go of the results. */
async function clearAll(page: Page) {
  await page.getByRole('button', { name: 'Clear all', exact: true }).click()
  await page.getByRole('button', { name: 'Clear all', exact: true }).click()
  await expect(page.locator('[data-image-original]')).toHaveCount(0)
}

test('PNG 本機壓縮、維持原尺寸、透明度與下載', async ({ page }, testInfo) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 40
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 40, 40)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'))
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  await files(page).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/png', buffer: Buffer.from(bytes) })
  await expect(page.getByLabel('Maximum width')).toHaveCount(0)
  await expect(page.getByLabel('Quality (0–100)')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Compress image', exact: true })).toHaveCount(0)
  await expect(page.locator('.image-compressor')).not.toContainText('private-image-canary.png')
  await expect(page.getByRole('img', { name: 'Original image thumbnail' })).toBeVisible()
  await expect(page.locator('[data-image-original]')).toContainText('80 × 40')
  await expect(page.locator('[data-image-original]')).toContainText(/\d KB/)
  // Choosing the image compresses it: Automatic keeps a PNG a PNG, and each format chosen compresses it again.
  await expect(page.locator('[data-image-result]')).toContainText('PNG')
  await expect(page.locator('.image-compressor')).toContainText('Each image keeps its format; PNG shrinks by using fewer colours and keeps transparency.')
  await page.getByLabel('Output format').selectOption('image/jpeg')
  await expect(page.locator('[data-image-result]')).toContainText('JPEG')
  await page.getByLabel('Output format').selectOption('image/png')
  await expect(page.locator('[data-image-result]')).toContainText('PNG')
  await expect(page.locator('[data-image-result]')).toContainText('80 × 40')
  await expect(page.locator('[data-image-result]')).toContainText(/\d KB/)
  await expect(page.locator('[data-image-result]')).toContainText(/% (smaller|larger)|Same size/)
  await expect(page.getByRole('img', { name: 'Compressed image thumbnail' })).toBeVisible()
  await expect(page.locator('[data-image-original]')).toContainText('80 × 40')
  await expect(page.locator('.image-compressor')).not.toContainText(/\bbytes\b|compressed-image/)
  const output = await page.getByRole('link', { name: 'Download image' }).getAttribute('href')
  const pixels = await page.evaluate(async (url) => {
    const blob = await fetch(url!).then(response => response.blob())
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0)
    const red = [...ctx.getImageData(5, 5, 1, 1).data]
    const transparent = [...ctx.getImageData(70, 5, 1, 1).data]
    bitmap.close(); return { red, transparent, type: blob.type }
  }, output)
  expect(pixels).toEqual({ red: [255, 0, 0, 255], transparent: [0, 0, 0, 0], type: 'image/png' })
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download image' }).click()
  expect((await download).suggestedFilename()).toBe('private-image-canary-compressed.png')
  await settleTransitions(page)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'artifacts/image-compressor-result-desktop.png', fullPage: true })
})

test('自動格式把多色 PNG 減到 256 色以內，仍是 PNG、保留透明且變小', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  // A gradient body with a soft edge and a soft shadow on a transparent ground, like a product cut out of its photo.
  const bytes = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(480, 360)
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 480, 360)
    gradient.addColorStop(0, '#1d4ed8'); gradient.addColorStop(0.5, '#f97316'); gradient.addColorStop(1, '#16a34a')
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12
    ctx.fillStyle = gradient
    ctx.beginPath(); ctx.ellipse(240, 170, 180, 120, 0, 0, Math.PI * 2); ctx.fill()
    return [...new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer())]
  })
  await files(page).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/png', buffer: Buffer.from(bytes) })
  await expect(page.locator('[data-image-result]')).toContainText('PNG')
  await expect(page.locator('[data-image-result]')).toContainText('480 × 360')
  await expect(page.locator('[data-image-result]')).toContainText(/\d+% smaller/)
  await expect(page.locator('.image-compressor')).not.toContainText('kept the original image data')
  const output = await page.getByRole('link', { name: 'Download image' }).getAttribute('href')
  const result = await page.evaluate(async ({ url, source }) => {
    const blob = await fetch(url!).then(response => response.blob())
    const png = new Uint8Array(await blob.arrayBuffer())
    const read = async (bytes: Uint8Array) => {
      const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height); const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close()
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data
    }
    const before = await read(new Uint8Array(source)), after = await read(png)
    let opaqueKept = true, transparentKept = true, error = 0
    for (let i = 0; i < before.length; i += 4) {
      if (before[i + 3] === 255 && after[i + 3] !== 255) opaqueKept = false
      if (before[i + 3] === 0 && after[i + 3] !== 0) transparentKept = false
      for (let c = 0; c < 4; c++) error += Math.abs(before[i + c]! - after[i + c]!)
    }
    return { type: blob.type, size: blob.size, colourType: png[25], opaqueKept, transparentKept, meanError: error / before.length }
  }, { url: output, source: bytes })
  // Colour type 3: an indexed PNG, every opaque pixel still opaque and every transparent one still transparent.
  expect(result).toMatchObject({ type: 'image/png', colourType: 3, opaqueKept: true, transparentKept: true })
  expect(result.size).toBeLessThan(bytes.length)
  expect(result.meanError).toBeLessThan(4)
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download image' }).click()
  expect((await download).suggestedFilename()).toBe('private-image-canary-compressed.png')
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
  await files(page).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/jpeg', buffer: bytes })
  await page.getByLabel('Output format').selectOption('image/jpeg')
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
  await files(page).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
  await page.getByLabel('Output format').selectOption('image/png')
  await expect(page.locator('[data-image-result]')).toContainText('PNG')
  await expect(page.locator('[data-image-result]')).toContainText('80 × 40')
})

for (const locale of ['en', 'zh-tw'] as const) {
  test(`${locale} HEIC 解碼前拒絕、雙語 SEO 與響應式`, async ({ page }, testInfo) => {
    await gotoHydrated(page, `/${locale}/tools/image-compressor/`)
    await files(page).setInputFiles({ name: 'renamed.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0, 109, 105, 102, 49, 104, 101, 105, 99]) })
    await expect(page.locator('[data-batch-issue="unsupported_heic"]')).toContainText(locale === 'en' ? 'HEIC/HEIF from iPhone is not supported' : '第一版不支援 iPhone HEIC／HEIF')
    await expect(page.locator('[data-image-original]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: locale === 'en' ? 'Choose images' : '選擇圖片', exact: true })).toBeEnabled()
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
  await files(page).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
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

for (const mobile of [false, true]) test(`12 MP JPEG 建議品質、主執行緒回應與處理預算（${mobile ? '手機版面' : '桌面版面'}）`, async ({ page }, testInfo) => {
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
  // Choosing the file starts the work, so the clock starts when the input reports the file, not when the test hands it over.
  // The stall budget is for the compression, which runs in a worker. Showing the 12 MP original means the browser
  // decodes it for the screen, which WebKit does on the main thread; as before #108, when the preview was shown before
  // the clock started, the stall is measured from the moment that preview is on screen.
  await page.evaluate(() => {
    const metrics = { start: 0, progressAt: 0, maxGap: 0, last: performance.now(), measuring: false }
    const timer = setInterval(() => { const now = performance.now(); if (metrics.measuring) metrics.maxGap = Math.max(metrics.maxGap, now - metrics.last); metrics.last = now }, 20)
    const observer = new MutationObserver(() => {
      if (metrics.start && !metrics.progressAt && document.querySelector('[role=progressbar]')) metrics.progressAt = performance.now()
      const preview = document.querySelector<HTMLImageElement>('[data-image-original] img')
      if (preview && !preview.dataset.watched) {
        preview.dataset.watched = 'true'
        void preview.decode().catch(() => undefined).then(() => { metrics.last = performance.now(); metrics.measuring = true })
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    document.querySelector('.image-compressor [data-batch-input]')!.addEventListener('change', () => { metrics.start = performance.now() }, { once: true })
    Object.assign(window, { compressionMetrics: metrics, stopMetrics: () => { clearInterval(timer); observer.disconnect() } })
  })
  await files(page).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/jpeg', buffer: Buffer.from(bytes, 'base64') })
  await expect(page.locator('[data-image-result]')).toContainText('4000 × 3000', { timeout: 8000 })
  const output = await page.getByRole('link', { name: 'Download image' }).getAttribute('href')
  const metrics = await page.evaluate(async (url) => {
    Reflect.get(window, 'stopMetrics')()
    const metrics = Reflect.get(window, 'compressionMetrics')
    return { elapsed: performance.now() - metrics.start, progress: metrics.progressAt - metrics.start, maxGap: metrics.maxGap, outputBytes: (await fetch(url!).then(r => r.blob())).size }
  }, output)
  expect(metrics.elapsed).toBeLessThan(8000)
  expect(metrics.progress).toBeGreaterThan(0); expect(metrics.progress).toBeLessThanOrEqual(250)
  expect(metrics.maxGap).toBeLessThan(mainThreadStallBudget(testInfo.project.name))
  await testInfo.attach('本機桌面效能量測', { body: JSON.stringify(metrics), contentType: 'application/json' })
  // A q90 export re-encoded at the recommended quality must shrink, not merely fall back to the original.
  expect(metrics.outputBytes).toBeLessThan(Buffer.from(bytes, 'base64').length)
  await expect(page.locator('.image-compressor')).not.toContainText('kept the original image data')
  await page.getByLabel('Output format').selectOption('image/png')
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveCount(0)
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
  const activeUrls = () => page.evaluate(() => Reflect.get(window, 'activeImageUrls').size)
  await files(page).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
  await expect(page.getByRole('progressbar')).toBeVisible()
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true })
  await cancel.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.image-compressor__status')).toContainText('Cancelled')
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveCount(0)
  const resume = page.getByRole('button', { name: 'Continue', exact: true })
  await resume.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('[data-image-result]')).toBeVisible()
  // The original's preview, the output's small preview and the output's download link.
  await expect.poll(activeUrls).toBe(3)
  const download = page.getByRole('link', { name: 'Download image' })
  await download.focus()
  expect(await download.evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none')
  await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
  await clearAll(page)
  await expect.poll(activeUrls).toBe(0)
  await files(page).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
  await expect(page.locator('[data-image-result]')).toBeVisible()
  await page.locator('.breadcrumbs a').click()
  await expect.poll(activeUrls).toBe(0)
})

test('已壓縮過的 JPEG／WebP 以預設設定處理時，輸出不比原檔大', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  // A product shot on a soft gradient, saved below the default quality: the shape of image that grew by 48%.
  const sources = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(1000, 1000)
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 0, 1000)
    gradient.addColorStop(0, '#e4e4e6'); gradient.addColorStop(1, '#ffffff')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1000, 1000)
    let seed = 7
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 2 ** 32 }
    for (let i = 0; i < 1500; i++) {
      const shade = 30 + Math.floor(random() * 90), radius = 4 + random() * 30
      ctx.fillStyle = `rgb(${shade},${shade},${shade + Math.floor(random() * 30)})`
      ctx.beginPath(); ctx.ellipse(250 + random() * 500, 150 + random() * 700, radius, radius * (0.3 + random()), random() * Math.PI, 0, Math.PI * 2); ctx.fill()
    }
    const sources: Array<{ type: string, base64: string, size: number }> = []
    for (const [type, quality] of [['image/jpeg', 0.5], ['image/webp', 0.6]] as const) {
      const blob = await canvas.convertToBlob({ type, quality })
      if (blob.type !== type) continue
      const base64 = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]!); reader.readAsDataURL(blob) })
      sources.push({ type, base64, size: blob.size })
    }
    return sources
  })
  for (const source of sources) {
    await files(page).setInputFiles({ name: 'private-image-canary.png', mimeType: source.type, buffer: Buffer.from(source.base64, 'base64') })
    await expect(page.getByLabel('Output format')).toHaveValue('auto')
    await expect(page.locator('[data-image-result]')).toContainText('1000 × 1000')
    const url = await page.getByRole('link', { name: 'Download image' }).getAttribute('href')
    const output = await page.evaluate(async url => { const blob = await fetch(url!).then(response => response.blob()); return { size: blob.size, type: blob.type } }, url)
    expect(output.type).toBe(source.type)
    expect(output.size, `${source.type} 輸出不得比原檔大`).toBeLessThanOrEqual(source.size)
    await expect(page.locator('.image-compressor')).toContainText('kept the original image data')
    await clearAll(page)
  }
})

test('損毀與超大像素輸入可修正，不遺失原檔', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  const oversized = Buffer.alloc(33)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversized)
  oversized.writeUInt32BE(13, 8); oversized.write('IHDR', 12); oversized.writeUInt32BE(9000, 16); oversized.writeUInt32BE(9000, 20)
  await files(page).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/png', buffer: oversized })
  await expect(page.locator('#compressor-error')).toContainText('exceeds the local limits')
  // Trying again cannot help a picture over the limits, so it is not offered.
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0)
  await clearAll(page)
  oversized.writeUInt32BE(80, 16); oversized.writeUInt32BE(40, 20)
  await files(page).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/png', buffer: oversized })
  await expect(page.locator('#compressor-error')).toContainText(/Processing did not finish|could not be read/)
  await clearAll(page)
  await files(page).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
  await expect(page.locator('[data-image-result]')).toBeVisible()
})

test('解碼前估算記憶體並提供恢復方式', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  const input = Buffer.alloc(20 * 1024 * 1024)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(input)
  input.writeUInt32BE(13, 8); input.write('IHDR', 12); input.writeUInt32BE(6000, 16); input.writeUInt32BE(4000, 20)
  await files(page).setInputFiles({ name: 'private-image-canary.png', mimeType: 'image/png', buffer: input })
  await expect(page.locator('#compressor-error')).toContainText('needs more memory than this device can spare')
  await expect(page.locator('#compressor-error')).toContainText('Close other tabs and retry')
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Clear all', exact: true })).toBeVisible()
})

test('JPEG 補白、WebP 依編碼能力提供透明輸出', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  await files(page).setInputFiles('tests/fixtures/image-compressor/transparent.webp')
  await page.getByLabel('Output format').selectOption('image/jpeg')
  await expect(page.locator('[data-image-result]')).toContainText('JPEG')
  const jpeg = await page.getByRole('link', { name: 'Download image' }).getAttribute('href')
  const pixel = await page.evaluate(async url => {
    const bitmap = await createImageBitmap(await fetch(url!).then(response => response.blob()))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height); const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close()
    return [...ctx.getImageData(70, 20, 1, 1).data]
  }, jpeg)
  expect(pixel).toEqual([255, 255, 255, 255])
  if (await page.locator('#compressor-format option[value="image/webp"]').count()) {
    await page.getByLabel('Output format').selectOption('image/webp')
    await expect(page.locator('[data-image-result]')).toContainText('WEBP')
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
    // Only the encoders this browser has are offered.
    await expect(page.locator('#compressor-format option[value="image/png"]')).toHaveCount(1)
  }
})

test('一次壓縮多張，顯示合計並打包 ZIP 下載', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-compressor/')
  const webp = 'tests/fixtures/image-compressor/transparent.webp'
  await files(page).setInputFiles([webp, webp, webp])
  await expect(page.locator('[data-compressor-summary]')).toContainText('3 of 3 images')
  await expect(page.getByRole('listbox', { name: 'Images in this batch' }).getByRole('option')).toHaveCount(3)
  // A picture goes on screen when it is chosen from the strip.
  await page.getByRole('listbox', { name: 'Images in this batch' }).getByRole('option').nth(1).click()
  await expect(page.locator('[data-batch-current]')).toContainText('2 of 3')
  await expect(page.locator('[data-image-result]')).toContainText('80 × 40')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download all (ZIP)', exact: true }).click()
  const zip = await download
  expect(zip.suggestedFilename()).toBe('compressed-images.zip')
  const { readFile } = await import('node:fs/promises')
  const bytes = (await readFile((await zip.path())!)).toString('latin1')
  for (const name of ['transparent-compressed.webp', 'transparent-compressed-2.webp', 'transparent-compressed-3.webp']) expect(bytes).toContain(name)
  await settleTransitions(page)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
})

test.describe('第一個畫面就看得到預覽、大小變化與下載（#108）', () => {
  // A waiting application update would open its notice over the corner these tests measure.
  test.use({ serviceWorkers: 'block' })
  for (const viewport of [{ width: 1366, height: 768 }, { width: 375, height: 812 }]) {
    test(`${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport)
      await gotoHydrated(page, '/zh-tw/tools/image-compressor/')
      // A portrait photo much taller than its frame: it has to shrink to fit, not overflow.
      const photo = await page.evaluate(async () => {
        const canvas = new OffscreenCanvas(1344, 1920)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#86bbff'; ctx.fillRect(0, 0, 1344, 1920)
        ctx.fillStyle = '#0b0b0b'; ctx.fillRect(400, 600, 544, 900)
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 })
        return [...new Uint8Array(await blob.arrayBuffer())]
      })
      await files(page).setInputFiles({ name: 'private-image-canary.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo) })
      await expect(page.locator('[data-image-result]')).toContainText('1344 × 1920')
      expect(await page.evaluate(() => scrollY)).toBe(0)
      // The lowest visible line: the viewport, or the top of the phone's floating bottom navigation.
      const fold = await page.evaluate(() => {
        const nav = document.querySelector('.mobile-nav')
        const navTop = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight
        return Math.min(innerHeight, navTop)
      })
      for (const [label, target] of [
        ['原圖預覽', page.getByRole('img', { name: '原圖縮圖' })],
        ['壓縮後預覽', page.getByRole('img', { name: '壓縮後縮圖' })],
        ['大小變化', page.locator('.image-compressor__change')],
        ['下載按鈕', page.getByRole('link', { name: '下載圖片' })],
      ] as const) {
        const box = (await target.boundingBox())!
        expect(box.y + box.height, `${label}不捲動就要完整看得到`).toBeLessThanOrEqual(fold)
      }
      // A preview is shown whole, never scrolled inside its frame.
      for (const view of await page.locator('.image-compressor__view').all()) {
        expect(await view.evaluate(element => element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth)).toBe(true)
      }
      if (testInfo.project.name === 'chromium') await page.screenshot({ path: `artifacts/image-compressor-first-screen-${viewport.width}.png` })
    })
  }
})
