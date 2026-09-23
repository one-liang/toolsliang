import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { backgroundRemoverCanaries } from '../support/image-background-remover-canaries'
import { gotoHydrated } from './support/hydration'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

guardToolContentBoundary(backgroundRemoverCanaries, { allowedOrigins: ['http://127.0.0.1:4173'] })

/** Preparing a session and running it on the WebAssembly baseline is the slow part. */
test.setTimeout(240_000)
const MODEL_READY = '[data-model-preparation][data-model-ready="true"]'

test.beforeEach(({ page }) => {
  page.on('console', message => { expect(backgroundRemoverCanaries.some(canary => message.text().includes(canary.value)), '主控台不得包含圖片內容').toBe(false) })
})

/**
 * A drawn head and shoulders. Nothing here is a photograph, and the file name
 * is the canary the boundary guard watches for.
 */
async function portraitFile(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const context = canvas.getContext('2d')!
    context.fillStyle = '#3b6ea5'
    context.fillRect(0, 0, 512, 512)
    context.fillStyle = '#e8c39e'
    context.beginPath(); context.arc(256, 190, 90, 0, Math.PI * 2); context.fill()
    context.fillStyle = '#2f2a26'
    context.beginPath(); context.ellipse(256, 430, 150, 130, 0, 0, Math.PI * 2); context.fill()
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'))
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  return { name: 'private-portrait-canary.png', mimeType: 'image/png', buffer: Buffer.from(bytes) }
}

async function prepareModel(page: Page) {
  await page.getByRole('button', { name: '下載模型' }).click()
  await page.locator(MODEL_READY).waitFor({ timeout: 180_000 })
}

test('下載模型後在本機去背，並下載透明 PNG', async ({ page }, testInfo) => {
  await gotoHydrated(page, '/zh-tw/tools/image-background-remover/')

  await expect(page.locator('[data-model-preparation]')).toHaveAttribute('data-model-ready', 'false')
  await expect(page.locator('[data-model-preparation]')).toContainText('首次使用需下載')
  await expect(page.getByRole('button', { name: '開始去背' })).toBeDisabled()
  await prepareModel(page)
  await expect(page.locator('[data-model-preparation]')).toContainText('模型已在這台裝置')

  await page.getByLabel('選擇人像圖片', { exact: true }).setInputFiles(await portraitFile(page))
  await page.getByRole('button', { name: '開始去背' }).click()
  await expect(page.locator('[data-image-result]')).toBeVisible({ timeout: 180_000 })
  await expect(page.locator('[data-image-result]')).toContainText('512 × 512')
  await expect(page.locator('[data-image-original]')).toContainText('512 × 512')

  const output = await page.getByRole('link', { name: '下載透明 PNG' }).getAttribute('href')
  const pixels = await page.evaluate(async (url) => {
    const blob = await fetch(url!).then(response => response.blob())
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.drawImage(bitmap, 0, 0)
    const { width, height } = bitmap
    const data = context.getImageData(0, 0, width, height).data
    let opaque = 0
    for (let index = 3; index < data.length; index += 4) if (data[index]! > 200) opaque += 1
    bitmap.close()
    return {
      type: blob.type,
      corner: [...context.getImageData(2, 2, 1, 1).data],
      face: [...context.getImageData(256, 190, 1, 1).data],
      opaqueShare: opaque / (width * height),
    }
  }, output)

  expect(pixels.type).toBe('image/png')
  // The drawn background must become transparent and the drawn person must not.
  expect(pixels.corner[3]).toBeLessThan(16)
  expect(pixels.face[3]).toBeGreaterThan(200)
  expect(pixels.opaqueShare).toBeGreaterThan(0.1)
  expect(pixels.opaqueShare).toBeLessThan(0.8)

  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: '下載透明 PNG' }).click()
  expect((await download).suggestedFilename()).toBe('background-removed.png')

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'artifacts/image-background-remover-result.png', fullPage: true })
})

test('先說明只處理人像，並在載入模型前拒絕 HEIC／HEIF', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/image-background-remover/')
  await expect(page.getByText('僅適用人像照片', { exact: false }).first()).toBeVisible()

  await page.getByLabel('選擇人像圖片', { exact: true }).setInputFiles({
    name: 'renamed.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0, 109, 105, 102, 49, 104, 101, 105, 99]),
  })
  await expect(page.getByRole('alert')).toContainText('第一版不支援 iPhone HEIC／HEIF')
  await expect(page.locator('[data-model-preparation]')).toHaveAttribute('data-model-ready', 'false')
  await expect(page.getByRole('button', { name: '開始去背' })).toBeDisabled()
})

test('離線時說明無法下載模型，回到連線後可重試', async ({ page, context }) => {
  await gotoHydrated(page, '/zh-tw/tools/image-background-remover/')
  // Cutting the connection before the capability check answers would test a
  // half-loaded page instead of an offline one.
  await expect(page.getByRole('button', { name: '下載模型' })).toBeEnabled()
  expectOfflineRequests(page)
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(page.locator('[data-model-preparation]')).toContainText('目前離線，還無法下載模型。')
  await expect(page.getByRole('button', { name: '下載模型' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '開始去背' })).toBeDisabled()

  await context.setOffline(false)
  await page.waitForFunction(() => navigator.onLine)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByRole('button', { name: '下載模型' })).toBeEnabled()
  await prepareModel(page)
})

test('取消推論後不交付部分結果，重試仍可完成', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/image-background-remover/')
  await prepareModel(page)
  await page.getByLabel('選擇人像圖片', { exact: true }).setInputFiles(await portraitFile(page))

  await page.getByRole('button', { name: '開始去背' }).click()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.getByText('已取消。原圖未變更，可重新去背。')).toBeVisible()
  await expect(page.locator('[data-image-result]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '下載透明 PNG' })).toHaveCount(0)

  await page.getByRole('button', { name: '開始去背' }).click()
  await expect(page.locator('[data-image-result]')).toBeVisible({ timeout: 180_000 })
})

test('鍵盤可完成準備、去背與下載，且觸控目標夠大', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoHydrated(page, '/zh-tw/tools/image-background-remover/')
  await prepareModel(page)
  await page.getByLabel('選擇人像圖片', { exact: true }).setInputFiles(await portraitFile(page))

  const remove = page.getByRole('button', { name: '開始去背' })
  await remove.focus()
  await expect(remove).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-image-result]')).toBeVisible({ timeout: 180_000 })

  const zoom = page.getByLabel('預覽放大倍率（100–400%）')
  await zoom.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('目前以 125% 檢視兩張預覽', { exact: false })).toBeVisible()

  for (const target of [remove, page.getByRole('link', { name: '下載透明 PNG' })]) {
    const box = (await target.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
})

test('英文頁以英文說明範圍與限制', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/image-background-remover/')
  await expect(page.getByText('This tool runs a portrait matting model', { exact: false }).first()).toBeVisible()
  await page.getByLabel('Choose portrait image', { exact: true }).setInputFiles({
    name: 'renamed.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0, 109, 105, 102, 49, 104, 101, 105, 99]),
  })
  await expect(page.getByRole('alert')).toContainText('HEIC/HEIF from iPhone is not supported')
})

test('模型下載後可離線重啟並重跑，圖片不進入快取或偏好', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Service Worker 生命週期僅在 Chromium 驗證')
  await page.route('**/sw.js', async (route) => { await new Promise(resolve => setTimeout(resolve, 500)); await route.continue() })
  await gotoHydrated(page, '/zh-tw/tools/image-background-remover/')
  await prepareModel(page)
  // The worker chunk is fetched by the capability check, which is what puts it
  // in the immutable-asset cache; without it an offline restart cannot run.
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    const keys = await caches.keys()
    const paths = (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat()
    return paths.some(path => /background-removal\.worker-.*\.js$/.test(path))
      && paths.some(path => path.endsWith('/zh-tw/tools/image-background-remover/'))
  }, undefined, { timeout: 60_000 })

  expectOfflineRequests(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator(MODEL_READY)).toBeVisible()
  await page.getByLabel('選擇人像圖片', { exact: true }).setInputFiles(await portraitFile(page))
  await page.getByRole('button', { name: '開始去背' }).click()
  await expect(page.locator('[data-image-result]')).toBeVisible({ timeout: 180_000 })
})

test('模型與圖片的儲存邊界：只有公開資產進入快取', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/image-background-remover/')
  await prepareModel(page)
  await page.getByLabel('選擇人像圖片', { exact: true }).setInputFiles(await portraitFile(page))
  await page.getByRole('button', { name: '開始去背' }).click()
  await expect(page.locator('[data-image-result]')).toBeVisible({ timeout: 180_000 })

  const stored = await page.evaluate(async () => {
    const names = await caches.keys()
    const entries: string[] = []
    for (const name of names) {
      const cache = await caches.open(name)
      entries.push(...(await cache.keys()).map(request => request.url))
    }
    return {
      names,
      entries,
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }
  })

  expect(stored.names.every(name => name.startsWith('toolsliang-'))).toBe(true)
  expect(stored.entries.some(url => url.includes('/assets/offline/image-background-remover/'))).toBe(true)
  for (const value of [...stored.entries, ...stored.local, ...stored.session]) {
    expect(backgroundRemoverCanaries.some(canary => value.includes(canary.value)), '快取或偏好不得包含圖片內容').toBe(false)
  }
})

/**
 * §12.8 budgets one cached 12 MP run at 30 s on a reference desktop, and §11
 * requires the progress UI within 250 ms of starting. The measurement runs on
 * local desktop hardware and does not stand in for a reference phone.
 */
test('已快取的 12 MP 去背符合桌機時間預算，且進度即時出現', async ({ page }, testInfo) => {
  await gotoHydrated(page, '/zh-tw/tools/image-background-remover/')
  await prepareModel(page)

  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 4000
    canvas.height = 3000
    const context = canvas.getContext('2d')!
    context.fillStyle = '#3b6ea5'
    context.fillRect(0, 0, 4000, 3000)
    context.fillStyle = '#e8c39e'
    context.beginPath(); context.arc(2000, 1100, 620, 0, Math.PI * 2); context.fill()
    context.fillStyle = '#2f2a26'
    context.beginPath(); context.ellipse(2000, 2600, 1100, 900, 0, 0, Math.PI * 2); context.fill()
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.9))
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  await page.getByLabel('選擇人像圖片', { exact: true }).setInputFiles({ name: 'private-portrait-canary.png', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) })

  const started = Date.now()
  await page.getByRole('button', { name: '開始去背' }).click()
  await page.locator('[role="progressbar"]').first().waitFor()
  const progressVisible = Date.now() - started
  await expect(page.locator('[data-image-result]')).toBeVisible({ timeout: 120_000 })
  const elapsed = Date.now() - started

  expect(progressVisible).toBeLessThanOrEqual(250)
  expect(elapsed).toBeLessThan(30_000)
  await expect(page.locator('[data-image-result]')).toContainText('4000 × 3000')
  await testInfo.attach('本機桌面效能量測', { body: JSON.stringify({ progressVisible, elapsed }), contentType: 'application/json' })
})
