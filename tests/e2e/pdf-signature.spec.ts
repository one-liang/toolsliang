import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { gotoHydrated } from './support/hydration'
import { settleTransitions } from './support/motion'
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
// Sub-pixel layout can report a 44px target as 43.999878; the same tolerance as the App Shell gate.
const TOUCH_TARGET_TOLERANCE_PX = 0.001

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

/**
 * Opening a document brings the workspace up with a smooth scroll. Pointer
 * coordinates read while it is moving point at where things were, so pointer
 * work waits until the page has stopped for two frames.
 */
async function settleScroll(page: Page) {
  await page.waitForFunction(() => new Promise<boolean>((resolve) => {
    const start = window.scrollY
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.scrollY === start)))
  }))
}

/** Draws a short stroke in the signature dialog with the pointer, as a visitor would, and adds it. */
async function drawSignature(page: Page) {
  await settleScroll(page)
  await page.locator('.pdf-signature__create').getByRole('button').first().click()
  const pad = page.locator('.signature-dialog .signature-pad__canvas')
  await expect(pad).toBeVisible()
  /* The dialog rises into place; pointer coordinates have to be read once it has landed. */
  await settleTransitions(page)
  const box = (await pad.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.7)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.25, { steps: 6 })
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.75, { steps: 6 })
  await page.mouse.up()
  await page.locator('[data-signature-add]').click()
  await expect(page.locator('.signature-dialog')).toHaveCount(0)
}

/** The keyboard way to make a signature: the typed form, submitted with Enter. */
async function typeSignature(page: Page, text = '簽名測試用字', { button = 'Type', field = 'Name to write' } = {}) {
  await page.getByRole('button', { name: button, exact: true }).click()
  await page.getByLabel(field).fill(text)
  await page.getByLabel(field).press('Enter')
  await expect(page.locator('.signature-dialog')).toHaveCount(0)
}

/** A small transparent PNG drawn in the page, so no picture of anyone is ever used. */
async function transparentPng(page: Page, opaque = false) {
  const bytes = await page.evaluate(async (fill) => {
    const canvas = document.createElement('canvas')
    canvas.width = 60
    canvas.height = 20
    const context = canvas.getContext('2d')!
    context.fillStyle = '#000000'
    context.fillRect(0, 0, fill ? 60 : 30, 20)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'))
    return [...new Uint8Array(await blob.arrayBuffer())]
  }, opaque)
  return { name: 'private-signature-canary.png', mimeType: 'image/png', buffer: Buffer.from(bytes) }
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

/** Whether the whole element sits inside the viewport right now, without scrolling. */
async function inView(locator: Locator, bottom: number) {
  const box = await locator.boundingBox()
  return Boolean(box && box.y >= 0 && box.y + box.height <= bottom + 0.5)
}

test('多頁與旋轉 PDF：開啟、放置、預覽、輸出並保留未簽頁的原始位元組', async ({ page }, testInfo) => {
  await gotoHydrated(page, '/en/tools/pdf-signature/')
  const source = fixture('rotated-pages')

  await page.getByLabel('Choose a PDF').setInputFiles(upload('rotated-pages'))
  await expect(page.locator('#pdf-signature-page option')).toHaveCount(4)
  await expect(page.locator('[data-page-preview] img').first()).toBeVisible()
  // #111: the page count lives in the page menu; there is no separate summary or protection line.
  await expect(page.locator('[data-document-summary]')).toHaveCount(0)

  await drawSignature(page)
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(1)
  await expect(page.locator('[data-placement-summary]')).toContainText('Page 1')

  // The quarter-turned page: its display box swaps edges, so the summary has to follow.
  await page.locator('#pdf-signature-page').selectOption('1')
  await expect(page.locator('[data-page-preview] img').first()).toBeVisible()
  await page.getByRole('button', { name: /^Place on page 2/ }).first().click()
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

  await settleTransitions(page)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'artifacts/pdf-signature-signed-desktop.png', fullPage: true })
})

/** The placement as numbers, read back from the spoken summary. */
async function placementNumbers(page: Page) {
  const text = await page.locator('[data-placement-summary]').textContent()
  const match = /([\d.,]+) pt from the left, ([\d.,]+) pt from the top, ([\d.,]+) pt wide and ([\d.,]+) pt tall/.exec(text ?? '')
  if (!match) throw new Error(`unreadable placement summary: ${text}`)
  const [left, top, width, height] = match.slice(1).map(value => Number(value.replace(/,/g, '')))
  return { left: left!, top: top!, width: width!, height: height! }
}

test('純鍵盤可以完成定位：方向鍵、加減號與文字摘要', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/pdf-signature/')
  await page.getByLabel('Choose a PDF').setInputFiles(upload('offset-crop-box'))
  await expect(page.locator('#pdf-signature-page option')).toHaveCount(2)
  // Opening hands focus to the page menu, because the file picker it came from is gone.
  await expect(page.locator('#pdf-signature-page')).toBeFocused()

  // The typed form is the pointer-free way to make a signature, from the key that opens it to Enter.
  await page.getByRole('button', { name: 'Type', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Name to write')).toBeFocused()
  await page.keyboard.type('簽名測試用字')
  await page.keyboard.press('Enter')
  const placement = page.locator('.pdf-signature__placement')
  await expect(placement).toHaveCount(1)
  // The new signature takes the focus, so the arrow keys work on it straight away.
  await expect(placement).toBeFocused()
  // The position is dragged or keyed, never typed into "from the left" fields.
  await expect(page.getByLabel('From the left (pt)')).toHaveCount(0)

  const start = await placementNumbers(page)
  await placement.press('ArrowRight')
  await expect.poll(async () => (await placementNumbers(page)).left).toBeCloseTo(start.left + 1, 1)
  await placement.press('Shift+ArrowUp')
  await expect.poll(async () => (await placementNumbers(page)).top).toBeCloseTo(start.top - 10, 1)
  await placement.press('+')
  await expect.poll(async () => (await placementNumbers(page)).width).toBeCloseTo(start.width * 1.1, 0)
  await placement.press('Delete')
  await expect(placement).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(1)
  // The delete beside the page does what the Delete key does, for whoever has no keyboard.
  await page.locator('.pdf-signature__placement').focus()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('[data-export]')).toBeEnabled()
})

test('在頁面預覽上直接拖曳簽名與拉角縮放，一次手勢一步復原', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/pdf-signature/')
  await page.getByLabel('Choose a PDF').setInputFiles(upload('rotated-pages'))
  await expect(page.locator('#pdf-signature-page option')).toHaveCount(4)
  await typeSignature(page)

  const placement = page.locator('.pdf-signature__placement')
  await expect(placement).toHaveCount(1)
  await placement.scrollIntoViewIfNeeded()
  await settleScroll(page)
  const start = await placementNumbers(page)
  const box = (await placement.boundingBox())!
  const pointPerPixel = start.width / box.width

  // Moving: the whole gesture lands, rather than stopping after the first pointer sample.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 80, { steps: 8 })
  await page.mouse.up()
  const moved = await placementNumbers(page)
  expect(moved.left).toBeCloseTo(start.left - 60 * pointPerPixel, 0)
  expect(moved.top).toBeCloseTo(start.top - 80 * pointPerPixel, 0)
  expect(moved.width).toBeCloseTo(start.width, 1)

  // Resizing from the bottom-right corner keeps the top-left corner and the signature's shape.
  const handle = (await page.locator('.pdf-signature__handle--bottom-right').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2 + 20, { steps: 6 })
  await page.mouse.up()
  const resized = await placementNumbers(page)
  expect(resized.left).toBeCloseTo(moved.left, 1)
  expect(resized.top).toBeCloseTo(moved.top, 1)
  expect(resized.width).toBeGreaterThan(moved.width)
  // Relative, because the summary rounds to a tenth of a point and the page is drawn at the size the screen allows.
  expect(Math.abs((resized.width / resized.height) / (moved.width / moved.height) - 1)).toBeLessThan(0.005)

  await page.getByRole('button', { name: 'Undo' }).click()
  expect((await placementNumbers(page)).width).toBeCloseTo(moved.width, 1)
  await page.getByRole('button', { name: 'Undo' }).click()
  expect((await placementNumbers(page)).left).toBeCloseTo(start.left, 1)
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
  await expect(page.locator('#pdf-signature-page option')).toHaveCount(2)
  // The file that comes out is no longer protected, and that is said beside the download, before it exists.
  await expect(page.locator('[data-decrypted-notice]')).toBeVisible()

  await typeSignature(page)
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
  await expect(page.locator('#pdf-signature-page option')).toHaveCount(3)
  await expect(page.getByRole('alert')).toHaveText('')
})

test('匯入透明 PNG 立刻成為清單裡的預覽並放到頁面上，不透明的圖片會被擋下（#111）', async ({ page }) => {
  await gotoHydrated(page, '/en/tools/pdf-signature/')
  const image = page.getByLabel(/transparent PNG or WebP/)

  await image.setInputFiles(await transparentPng(page, true))
  await expect(page.locator('#pdf-signature-error')).toContainText('no transparent area')
  await expect(page.locator('[data-session-signature]')).toHaveCount(0)

  // Before any PDF: choosing the picture is the whole step, and the list shows the picture itself.
  await image.setInputFiles(await transparentPng(page))
  const thumbnail = page.locator('[data-session-signature] .pdf-signature__thumb img')
  await expect(thumbnail).toHaveCount(1)
  await expect(thumbnail).toBeVisible()
  await expect.poll(() => thumbnail.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(page.locator('#pdf-signature-error')).toHaveText('')
  // The picture, not a description of the file.
  await expect(page.locator('.pdf-signature')).not.toContainText('private-signature-canary.png')
  await expect(page.locator('.pdf-signature')).not.toContainText(/pixels|像素/)

  // With a document open, importing puts it on the page as well.
  await page.getByLabel('Choose a PDF').setInputFiles(upload('object-stream'))
  await expect(page.locator('#pdf-signature-page option')).toHaveCount(3)
  await image.setInputFiles(await transparentPng(page))
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(1)
  await expect(page.locator('[data-session-signature]')).toHaveCount(2)
  await expect(page.locator('.pdf-signature__status')).toHaveText('Placed on page 1.')
})

test('保存的簽名以縮圖排在清單最前面，開啟 PDF 前就看得到，點一次就放到目前頁面，並在本機資產頁刪除（#111、ADR-0007）', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/pdf-signature/')

  // Made and saved before any document: the list does not wait for a PDF.
  await typeSignature(page, '簽名測試用字', { button: '文字', field: '要寫上的文字' })
  await page.locator('[data-session-signature]').getByRole('button', { name: /^保存/ }).click()
  await expect(page.locator('[data-saved-signature]')).toHaveCount(1)
  await expect(page.locator('[data-session-signature]')).toHaveCount(0)
  await expect(page.locator('.pdf-signature__status')).toHaveText('簽名已保存在這台裝置。')
  await expect(page.locator('.pdf-signature__storage')).toContainText('保存在這台裝置')

  await page.reload()
  const saved = page.locator('[data-saved-signature]')
  await expect(saved).toHaveCount(1)
  await expect(saved.getByRole('img', { name: '簽名測試用字' })).toBeVisible()
  await expect(saved).toContainText('已保存')

  // A signature of this session goes after the saved one.
  await drawSignature(page)
  await expect(page.locator('.pdf-signature__item').first()).toHaveAttribute('data-saved-signature', /.+/)
  await expect(page.locator('.pdf-signature__item').nth(1)).toHaveAttribute('data-session-signature', '')

  await page.getByLabel('選擇 PDF 檔').setInputFiles(upload('rotated-pages'))
  await expect(page.locator('#pdf-signature-page option')).toHaveCount(4)
  await page.locator('#pdf-signature-page').selectOption('2')
  await expect(page.locator('[data-page-preview] img')).toHaveAttribute('alt', '第 3 頁的預覽')
  await saved.getByRole('button', { name: '放到第 3 頁：簽名測試用字' }).click()
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(1)
  await expect(page.locator('[data-placement-summary]')).toContainText('第 3 頁')
  await expect(page.locator('[data-export]')).toBeEnabled()

  // Nothing about the signature may reach a preference namespace.
  const stored = await page.evaluate(() => ({
    local: Object.entries(localStorage).map(([key, value]) => `${key}=${value}`).join('|'),
    session: Object.entries(sessionStorage).map(([key, value]) => `${key}=${value}`).join('|'),
  }))
  expect(stored.local).not.toContain('簽名測試用字')
  expect(stored.session).not.toContain('簽名測試用字')

  // Deleting a saved signature is the saved-assets page's job, one link away.
  await expect(page.locator('.pdf-signature__storage').getByRole('link', { name: '管理' })).toHaveAttribute('href', '/zh-tw/storage/')
  await page.getByRole('button', { name: '換一份 PDF' }).click()
  await gotoHydrated(page, '/zh-tw/storage/')
  const row = page.locator('.local-assets__list .local-asset').filter({ hasText: '簽名測試用字' })
  await row.locator('[data-asset-action="delete"]').click()
  await page.locator('[data-asset-action="confirm-delete"]').click()
  await expect(row).toHaveCount(0)

  await gotoHydrated(page, '/zh-tw/tools/pdf-signature/')
  await expect(page.locator('.pdf-signature__create')).toBeVisible()
  await expect(page.locator('[data-saved-signature]')).toHaveCount(0)
})

test('1366×768 與 1920×1080：寬版工作區，開啟 PDF 後頁面預覽、簽名清單與下載都在第一畫面（#104、#111）', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await gotoHydrated(page, '/zh-tw/tools/pdf-signature/')
  const workspace = page.locator('.tool-page__workspace')
  const reading = page.locator('.tool-heading')
  expect((await workspace.boundingBox())!.width).toBeGreaterThan((await reading.boundingBox())!.width + 200)

  await page.setViewportSize({ width: 1366, height: 768 })
  expect((await workspace.boundingBox())!.width).toBeGreaterThan((await reading.boundingBox())!.width)
  await typeSignature(page, '簽名測試用字', { button: '文字', field: '要寫上的文字' })

  await page.getByLabel('選擇 PDF 檔').setInputFiles(upload('rotated-pages'))
  await expect(page.locator('#pdf-signature-page option')).toHaveCount(4)
  await settleTransitions(page)
  const preview = page.locator('[data-page-preview]')
  const list = page.locator('.pdf-signature__list')
  const exportButton = page.locator('[data-export]')
  // The workspace comes up by itself; the visitor does not scroll for any of the three.
  await expect.poll(async () => await inView(preview, 768) && await inView(list, 768) && await inView(exportButton, 768)).toBe(true)
  await expect(page.locator('#pdf-signature-page')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  await page.locator('[data-session-signature] .pdf-signature__thumb').click()
  await exportButton.click()
  await expect(page.getByRole('link', { name: '下載已簽名的 PDF' })).toBeVisible()
  expect(await inView(page.getByRole('link', { name: '下載已簽名的 PDF' }), 768)).toBe(true)
})

test('手機版面：主要動作不需要長距離捲動，操作目標足夠大，亮暗模式都通過 axe', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoHydrated(page, '/zh-tw/tools/pdf-signature/')
  await page.getByLabel('選擇 PDF 檔').setInputFiles(upload('rotated-pages'))
  await expect(page.locator('#pdf-signature-page option')).toHaveCount(4)
  await drawSignature(page)
  await expect(page.locator('.pdf-signature__placement')).toHaveCount(1)

  await page.evaluate(() => document.querySelector('.pdf-signature')!.scrollIntoView({ block: 'start', behavior: 'instant' }))
  // Under the page: the list starts on the same screen, and the download is less than half a screen further.
  const navTop = await page.locator('.mobile-nav').evaluate(element => element.getBoundingClientRect().top)
  expect(await inView(page.locator('[data-page-preview]'), navTop)).toBe(true)
  expect(await inView(page.locator('.pdf-signature__item').first(), navTop)).toBe(true)
  const exportBox = (await page.locator('[data-export]').boundingBox())!
  expect(exportBox.y + exportBox.height - navTop, '下載按鈕距離第一畫面的捲動量').toBeLessThan(812 / 2)

  for (const name of ['加上簽名並準備下載', '下一頁', '復原', '刪除', '手寫', '文字', '保存「手寫簽名」在這台裝置']) {
    const box = await page.getByRole('button', { name, exact: true }).first().boundingBox()
    expect(box!.height + TOUCH_TARGET_TOLERANCE_PX, `${name} 的觸控目標高度`).toBeGreaterThanOrEqual(44)
    expect(box!.width + TOUCH_TARGET_TOLERANCE_PX, `${name} 的觸控目標寬度`).toBeGreaterThanOrEqual(44)
  }
  const thumb = (await page.locator('.pdf-signature__thumb').first().boundingBox())!
  expect(thumb.height + TOUCH_TARGET_TOLERANCE_PX).toBeGreaterThanOrEqual(44)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations, `${scheme} 模式的 axe 違規`).toEqual([])
  }

  // The pad is a dialog of its own, and it passes the same checks.
  await page.getByRole('button', { name: '手寫', exact: true }).click()
  await expect(page.locator('.signature-dialog')).toBeVisible()
  await settleTransitions(page)
  const dialog = await new AxeBuilder({ page }).include('.signature-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(dialog.violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.locator('.signature-dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '手寫', exact: true })).toBeFocused()
})

test('雙語工具頁說明本機邊界與限制，並指向同一個工具', async ({ page }) => {
  await gotoHydrated(page, '/zh-tw/tools/pdf-signature/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PDF 手寫簽名')
  // #82: the workspace holds only the signing; what this is not is said below it.
  await expect(page.locator('.pdf-signature__scope')).toHaveCount(0)
  await page.getByRole('heading', { name: '開始前先知道' }).click()
  await expect(page.locator('.tool-contract__body')).toContainText('不是憑證式數位簽章')
  await expect(page.locator('.tool-contract__body')).toContainText('不會驗證簽署人身分')
  await expect(page.getByRole('heading', { name: '這個工具怎麼處理你的內容' })).toBeVisible()
  await expect(page.getByRole('link', { name: '這個工具用到的開放原始碼授權' })).toHaveAttribute('href', '/zh-tw/licenses/')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://toolsliang.com/zh-tw/tools/pdf-signature/')
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://toolsliang.com/en/tools/pdf-signature/')

  await page.getByLabel('選擇 PDF 檔').setInputFiles({ name: 'private-signature-canary.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) })
  await expect(page.getByRole('alert')).toContainText('這個檔案不是 PDF')

  await gotoHydrated(page, '/en/tools/pdf-signature/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PDF Handwritten Signature')
})

/**
 * A smoke bound, not the specification's budget. What is measured here includes
 * handing 20 MiB to the browser over the driver connection, which is the test
 * harness rather than the tool. §12.12's 3-second preview and 15-second export
 * are measured inside the browser by `scripts/verify-pdf-signature-output.mjs`
 * and enforced against those numbers in `tests/pdf-signature-output.test.ts`;
 * this test is here to catch a representative document becoming unusable.
 */
test('代表性 20 頁 20 MiB 文件在本機可用的時間內開啟與匯出', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '大檔案的煙霧量測只在 chromium 跑一次')
  test.setTimeout(120_000)

  await gotoHydrated(page, '/en/tools/pdf-signature/')
  const started = Date.now()
  await page.getByLabel('Choose a PDF').setInputFiles(upload('reference-20-page'))
  await expect(page.locator('[data-page-preview] img').first()).toBeVisible({ timeout: 30_000 })
  const previewMs = Date.now() - started
  await expect(page.locator('#pdf-signature-page option')).toHaveCount(20)

  await typeSignature(page)
  const exportStarted = Date.now()
  await page.locator('[data-export]').click()
  await expect(page.locator('[data-export-summary]')).toContainText('20 pages', { timeout: 30_000 })
  const exportMs = Date.now() - exportStarted

  expect(previewMs, `首頁預覽（含驅動端傳檔）${previewMs}ms`).toBeLessThan(20_000)
  expect(exportMs, `匯出 ${exportMs}ms`).toBeLessThan(20_000)
})
