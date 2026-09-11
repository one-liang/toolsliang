import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { gotoHydrated } from './support/hydration'
import { guardToolContentBoundary } from './support/tool-content-boundary'
import { pdfSignatureCanaries } from '../support/pdf-signature-canaries'
import { buildFixtures, fixturePassword } from '../../scripts/pdf-engine/fixtures.mjs'

/**
 * The signing flow through the public tool page.
 *
 * Every document here is drawn from code by `scripts/pdf-engine/fixtures.mjs`,
 * the same generator T24 measured with, so no real PDF is ever used. The output
 * is checked as bytes rather than as pixels: an unencrypted export has to *start
 * with the original file*, which is what "the pages you did not sign keep their
 * original bytes" means, and an encrypted one has to come back without its
 * `/Encrypt` dictionary. Pixel-level placement and transparency are measured
 * separately by `scripts/verify-pdf-signature-output.mjs`, whose results
 * `tests/pdf-signature-output.test.ts` holds the product to.
 */
guardToolContentBoundary(pdfSignatureCanaries, { allowedOrigins: ['http://127.0.0.1:4173'] })

const fixtures = buildFixtures()

function fixture(name: string) {
  const entry = fixtures.find(item => item.name === name)
  if (!entry) throw new Error(`unknown fixture: ${name}`)
  return entry
}

function upload(name: string, fileName = 'private-pdf-canary.pdf') {
  return { name: fileName, mimeType: 'application/pdf', buffer: Buffer.from(fixture(name).bytes) }
}

test.beforeEach(({ page }) => {
  page.on('console', (message) => {
    expect(pdfSignatureCanaries.some(canary => message.text().includes(canary.value)), '主控台不得包含工具內容').toBe(false)
  })
})

/** Draws a short stroke on the pad with the pointer, as a visitor would. */
async function drawSignature(page: Page) {
  const pad = page.locator('.signature-pad__canvas').first()
  /* Pointer coordinates are viewport coordinates: the pad has to be in view first. */
  await pad.scrollIntoViewIfNeeded()
  const box = (await pad.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.7)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.25, { steps: 6 })
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.75, { steps: 6 })
  await page.mouse.up()
}

/** The exported file, read back in Node so its structure can be inspected. */
async function exportedBytes(page: Page) {
  const href = await page.getByRole('link', { name: /Download the signed PDF|下載已簽名的 PDF/ }).getAttribute('href')
  const base64 = await page.evaluate(async (url) => {
    const buffer = await fetch(url!).then(response => response.arrayBuffer())
    let binary = ''
    for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
    return btoa(binary)
  }, href)

  return Buffer.from(base64, 'base64')
}

test('多頁與旋轉 PDF：開啟、放置、預覽、輸出並保留未簽頁的原始位元組', async ({ page }, testInfo) => {
  await gotoHydrated(page, '/en/tools/pdf-signature/')
  const source = fixture('rotated-pages')

  await page.getByLabel('Choose a PDF').setInputFiles(upload('rotated-pages'))
  await expect(page.locator('[data-document-summary]')).toContainText('4 pages')
  await expect(page.locator('[data-document-summary]')).toContainText('not protected')
  await expect(page.locator('[data-page-preview] img').first()).toBeVisible()

  await drawSignature(page)
  await page.locator('[data-signature-use]').click()
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(1)
  await expect(page.locator('[data-placement-summary]')).toContainText('Page 1')

  // The quarter-turned page: its display box swaps edges, so the summary has to follow.
  await page.getByLabel('Page', { exact: true }).selectOption('1')
  await expect(page.locator('[data-page-preview] img').first()).toBeVisible()
  await page.getByRole('button', { name: 'Place on this page' }).first().click()
  await expect(page.locator('[data-placement-summary]')).toContainText('Page 2')
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(1)

  await page.locator('[data-export]').click()
  await expect(page.locator('[data-export-summary]')).toContainText('4 pages')

  const exported = await exportedBytes(page)
  expect(exported.subarray(0, source.bytes.length).equals(Buffer.from(source.bytes))).toBe(true)
  expect(exported.length).toBeGreaterThan(source.bytes.length)
  expect(exported.toString('latin1')).toContain('/Subtype /Image')

  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download the signed PDF' }).click()
  expect((await download).suggestedFilename()).toBe('signed.pdf')

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'artifacts/pdf-signature-signed-desktop.png', fullPage: true })
})

test('純鍵盤可以完成定位：方向鍵、數值欄位與文字摘要', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/pdf-signature/')
  await page.getByLabel('Choose a PDF').setInputFiles(upload('offset-crop-box'))
  await expect(page.locator('[data-document-summary]')).toContainText('2 pages')

  // The typed form is the pointer-free way to make a signature.
  await page.getByRole('radio', { name: 'Type' }).check()
  await page.getByLabel('Name to write').fill('簽名測試用字')
  await page.locator('[data-signature-use]').click()
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(1)

  await page.getByLabel('From the left (pt)').fill('100')
  await page.getByLabel('From the left (pt)').blur()
  await page.getByLabel('From the top (pt)').fill('200')
  await page.getByLabel('From the top (pt)').blur()
  await page.getByLabel('Width (pt)').fill('180')
  await page.getByLabel('Width (pt)').blur()
  await expect(page.locator('[data-placement-summary]'))
    .toContainText('100 pt from the left, 200 pt from the top, 180 pt wide')

  const placement = page.locator('.pdf-signature__placement')
  await placement.focus()
  await placement.press('ArrowRight')
  await expect(page.locator('[data-placement-summary]')).toContainText('101 pt from the left')
  await placement.press('Shift+ArrowDown')
  await expect(page.locator('[data-placement-summary]')).toContainText('210 pt from the top')
  await placement.press('+')
  await expect(page.getByLabel('Width (pt)')).toHaveValue('198')
  await placement.press('Delete')
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(1)
  await expect(page.locator('[data-export]')).toBeEnabled()
})

test('密碼保護檔：密碼留在裝置上，輸出不再帶有原本的保護', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/pdf-signature/')
  const source = fixture('encrypted-rc4-128')

  await page.getByLabel('Choose a PDF').setInputFiles(upload('encrypted-rc4-128', 'private-locked-canary.pdf'))
  await expect(page.getByRole('alert')).toContainText('needs its open password')
  await page.getByLabel('Open password').fill('wrong-password')
  await page.getByRole('button', { name: 'Open with password' }).click()
  await expect(page.getByRole('alert')).toContainText('did not open the file')

  await page.getByLabel('Open password').fill(fixturePassword)
  await page.getByRole('button', { name: 'Open with password' }).click()
  await expect(page.locator('[data-document-summary]')).toContainText('password protected')
  // The file that comes out is no longer protected, and that is said before it exists.
  await expect(page.locator('[data-decrypted-notice]')).toBeVisible()

  await page.getByRole('radio', { name: 'Type' }).check()
  await page.getByLabel('Name to write').fill('簽名測試用字')
  await page.locator('[data-signature-use]').click()
  await page.locator('[data-export]').click()
  await expect(page.locator('[data-export-summary]')).toContainText('2 pages')

  const exported = await exportedBytes(page)
  /* A full rewrite, not an append: the original bytes are not the prefix. */
  expect(exported.subarray(0, source.bytes.length).equals(Buffer.from(source.bytes))).toBe(false)
  expect(exported.toString('latin1')).not.toContain('/Encrypt')
  expect(exported.subarray(0, 5).toString('latin1')).toBe('%PDF-')
})

test('權限不允許修改、損毀檔、超量與非 PDF 都有可理解且可恢復的說明', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/pdf-signature/')
  const file = page.getByLabel('Choose a PDF')

  await file.setInputFiles(upload('owner-password-restricted'))
  await expect(page.getByRole('alert')).toContainText('permissions do not allow')
  await expect(page.getByRole('alert')).toContainText('unchanged')

  await file.setInputFiles(upload('truncated'))
  await expect(page.getByRole('alert')).toContainText('damaged')

  await file.setInputFiles(upload('page-cap-120'))
  await expect(page.getByRole('alert')).toContainText('more than the local limit of 100 pages')

  await file.setInputFiles({ name: 'private-signature-canary.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) })
  await expect(page.getByRole('alert')).toContainText('not a PDF')

  // Still usable afterwards: a refusal is not a dead end.
  await file.setInputFiles(upload('object-stream'))
  await expect(page.locator('[data-document-summary]')).toContainText('3 pages')
  await expect(page.getByRole('alert')).toHaveText('')
})

test('簽名圖片必須可透明，不透明或不支援的格式會被擋下', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/pdf-signature/')
  await page.getByLabel('Choose a PDF').setInputFiles(upload('object-stream'))
  await expect(page.locator('[data-document-summary]')).toContainText('3 pages')

  await page.getByRole('radio', { name: 'Import image' }).check()
  const opaque = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 60
    canvas.height = 20
    const context = canvas.getContext('2d')!
    context.fillStyle = '#000000'
    context.fillRect(0, 0, 60, 20)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'))
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  await page.getByLabel('Transparent PNG or WebP').setInputFiles({ name: 'private-signature-canary.png', mimeType: 'image/png', buffer: Buffer.from(opaque) })
  await expect(page.locator('.signature-pad .field-error')).toContainText('no transparent area')

  const transparent = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 60
    canvas.height = 20
    const context = canvas.getContext('2d')!
    context.fillStyle = '#000000'
    context.fillRect(0, 0, 30, 20)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'))
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  await page.getByLabel('Transparent PNG or WebP').setInputFiles({ name: 'private-signature-canary.png', mimeType: 'image/png', buffer: Buffer.from(transparent) })
  await page.locator('[data-signature-use]').click()
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(1)
})

test('保存的簽名是本機資產，可在工具頁重複使用與刪除', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/pdf-signature/')
  await page.getByLabel('選擇 PDF 檔').setInputFiles(upload('object-stream'))
  await expect(page.locator('[data-document-summary]')).toContainText('共 3 頁')

  await page.getByRole('radio', { name: '輸入文字' }).check()
  await page.getByLabel('要寫上的文字').fill('簽名測試用字')
  await page.locator('[data-signature-use]').click()
  await page.getByLabel('保存時的名稱').fill('我的簽名')
  await page.getByRole('button', { name: '保存在這台裝置' }).click()
  await expect(page.locator('.pdf-signature__saved')).toContainText('我的簽名')

  await page.reload()
  await expect(page.locator('.pdf-signature__saved')).toContainText('我的簽名')

  // Nothing about the signature may reach a preference namespace.
  const stored = await page.evaluate(() => ({
    local: Object.entries(localStorage).map(([key, value]) => `${key}=${value}`).join('|'),
    session: Object.entries(sessionStorage).map(([key, value]) => `${key}=${value}`).join('|'),
  }))
  expect(stored.local).not.toContain('我的簽名')
  expect(stored.session).not.toContain('我的簽名')

  await page.getByRole('button', { name: '刪除' }).first().click()
  await expect(page.locator('.pdf-signature__saved')).toHaveCount(0)
})

test('雙語工具頁說明本機邊界與限制，並指向同一個工具', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/pdf-signature/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PDF 手寫簽名')
  await expect(page.locator('.pdf-signature__scope').first()).toContainText('不是憑證式數位簽章')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://toolsliang.com/zh-tw/tools/pdf-signature/')
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://toolsliang.com/en/tools/pdf-signature/')

  await page.getByLabel('選擇 PDF 檔').setInputFiles({ name: 'private-signature-canary.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) })
  await expect(page.getByRole('alert')).toContainText('這個檔案不是 PDF')

  await gotoHydrated(page, '/en/tools/pdf-signature/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PDF Handwritten Signature')
})

test('手機版面：簽名與定位的操作目標足夠大，亮暗模式都通過 axe', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await gotoHydrated(page, '/zh-tw/tools/pdf-signature/')
  await page.getByLabel('選擇 PDF 檔').setInputFiles(upload('rotated-pages'))
  await expect(page.locator('[data-document-summary]')).toContainText('共 4 頁')
  await drawSignature(page)
  await page.locator('[data-signature-use]').click()
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(1)

  for (const name of ['使用這個簽名', '加上簽名並準備下載', '下一頁', '復原']) {
    const box = await page.getByRole('button', { name }).first().boundingBox()
    expect(box!.height, `${name} 的觸控目標高度`).toBeGreaterThanOrEqual(44)
    expect(box!.width, `${name} 的觸控目標寬度`).toBeGreaterThanOrEqual(44)
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations, `${scheme} 模式的 axe 違規`).toEqual([])
  }
})

test('代表性 20 頁 20 MiB 文件符合首頁預覽與匯出預算', async ({ page }, testInfo) => {
  /* A desktop budget, measured once on the browser that reports timings consistently. */
  test.skip(testInfo.project.name !== 'chromium', '效能預算只在 chromium 量測一次')
  test.setTimeout(120_000)

  await gotoHydrated(page, '/en/tools/pdf-signature/')
  const started = Date.now()
  await page.getByLabel('Choose a PDF').setInputFiles(upload('reference-20-page'))
  await expect(page.locator('[data-page-preview] img').first()).toBeVisible({ timeout: 30_000 })
  const previewMs = Date.now() - started
  await expect(page.locator('[data-document-summary]')).toContainText('20 pages')

  await page.getByRole('radio', { name: 'Type' }).check()
  await page.getByLabel('Name to write').fill('簽名測試用字')
  await page.locator('[data-signature-use]').click()
  const exportStarted = Date.now()
  await page.locator('[data-export]').click()
  await expect(page.locator('[data-export-summary]')).toContainText('20 pages', { timeout: 30_000 })
  const exportMs = Date.now() - exportStarted

  expect(previewMs, `首頁預覽 ${previewMs}ms`).toBeLessThan(3_000)
  expect(exportMs, `匯出 ${exportMs}ms`).toBeLessThan(15_000)
})
