import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { gotoHydrated, waitForHydration } from './support/hydration'
import { expectOfflineRequests, guardToolContentBoundary } from './support/tool-content-boundary'

const STORAGE_ROUTE = '/zh-tw/storage/'
const EN_STORAGE_ROUTE = '/en/storage/'
const TOOL_ROUTE = '/zh-tw/tools/ntd-uppercase/'
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
// Sub-pixel layout can report a 44px target as 43.999996; the same tolerance as the App Shell gate.
const TOUCH_TARGET_TOLERANCE_PX = 0.001

/**
 * Stand-ins for the tool content a real asset holds. Every one of them has to
 * stay inside the device: none may appear in a request, in a Service Worker
 * cache, or in the preference namespace.
 */
const ASSET_NAME = 'canary-簽名-liang'
const SECOND_ASSET_NAME = 'canary-行事曆-liang'
const CALENDAR_ENTRY = 'canary-company-holiday-0917'
const SIGNATURE_MARK = 'canary-signature-bytes'

const toolContent = [
  { label: '資產名稱', value: ASSET_NAME },
  { label: '資產名稱', value: SECOND_ASSET_NAME },
  { label: '行事曆項目', value: CALENDAR_ENTRY },
  { label: '簽名內容', value: SIGNATURE_MARK },
]

guardToolContentBoundary(toolContent, NETWORK_BOUNDARY_POLICY)

function bundle(assets: Array<{ id: string, kind: string, name: string, text: string }>) {
  return JSON.stringify({
    format: 'toolsliang.local-assets',
    version: 1,
    exportedAt: '2026-09-07T02:00:00.000Z',
    assets: assets.map(asset => ({
      id: asset.id,
      kind: asset.kind,
      name: asset.name,
      createdAt: '2026-09-07T02:00:00.000Z',
      updatedAt: '2026-09-07T02:00:00.000Z',
      payload: { format: 'text', mediaType: 'application/json', text: asset.text },
    })),
  })
}

const sampleBundle = bundle([
  { id: 'canary-signature', kind: 'signature', name: ASSET_NAME, text: SIGNATURE_MARK },
  { id: 'canary-calendar', kind: 'calendar', name: SECOND_ASSET_NAME, text: CALENDAR_ENTRY },
])

async function importBundle(page: Page, contents = sampleBundle) {
  await page.setInputFiles('#local-asset-import', {
    name: 'canary-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contents, 'utf8'),
  })
  await expect(page.locator('.local-assets__status')).toContainText('已匯入')
}

function rows(page: Page) {
  return page.locator('.local-assets__list .local-asset')
}

test('匯入、更名、刪除與清除都由使用者確認，並在重新載入後保留', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, STORAGE_ROUTE)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('本機資產')
  await expect(page.locator('.local-assets__empty')).toBeVisible()
  await expect(page.locator('[data-asset-action="export"]'), '沒有資產時不提供匯出').toHaveCount(0)

  await importBundle(page)
  await expect(rows(page)).toHaveCount(2)
  await expect(page.locator('.local-assets__usage')).toContainText('本機資產合計')
  await expect(page.locator('.local-assets__kinds')).toContainText('簽名')

  // Reading the device again shows the same assets: they are persisted, not in memory.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
  await expect(rows(page)).toHaveCount(2)

  const first = rows(page).first()
  await first.locator('[data-asset-action="rename"]').click()
  await first.locator('[data-asset-field="name"]').fill('canary-簽名-liang 正式版')
  await first.locator('[data-asset-action="save-name"]').click()
  await expect(page.locator('.local-assets__status')).toContainText('已更名為')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
  await expect(rows(page).first().locator('.local-asset__name')).toHaveText('canary-簽名-liang 正式版')

  // Deleting asks first, and the question is where the keyboard lands.
  await rows(page).last().locator('[data-asset-action="delete"]').click()
  await expect(page.locator('[data-asset-action="confirm-delete"]')).toBeFocused()
  await page.locator('[data-asset-action="cancel-delete"]').click()
  await expect(rows(page)).toHaveCount(2)

  await rows(page).last().locator('[data-asset-action="delete"]').click()
  await page.locator('[data-asset-action="confirm-delete"]').click()
  await expect(rows(page)).toHaveCount(1)
  await expect(page.locator('.local-assets__status')).toContainText('已刪除')

  await page.locator('[data-asset-action="clear"]').click()
  await expect(page.locator('.local-assets__confirm')).toContainText('建議先匯出備份')
  await page.locator('[data-asset-action="confirm-clear"]').click()
  await expect(rows(page)).toHaveCount(0)
  await expect(page.locator('.local-assets__empty')).toBeVisible()

  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
  await expect(page.locator('.local-assets__empty'), '清除後重新載入不得復活').toBeVisible()
})

test('匯出由使用者觸發，檔名只帶日期，內容留在裝置', async ({ page }) => {
  await gotoHydrated(page, STORAGE_ROUTE)
  await importBundle(page)

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-asset-action="export"]').click(),
  ]).then(([event]) => event)

  expect(download.suggestedFilename(), '檔名不得帶出資產名稱').toMatch(/^toolsliang-local-assets-\d{4}-\d{2}-\d{2}\.json$/)
  await expect(page.locator('.local-assets__status')).toContainText('toolsliang-local-assets-')
  await expect(page.locator('.local-assets__status'), '狀態訊息不得帶出資產名稱').not.toContainText(ASSET_NAME)
  await download.delete()
})

test('讀不到的資料仍可辨識與刪除，不影響其他資產', async ({ page }) => {
  await gotoHydrated(page, STORAGE_ROUTE)
  await importBundle(page)

  // A record damaged on the device, and one written by a release this build does not know.
  await page.evaluate(async ([damagedId, newerId, newerName]) => {
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open('toolsliang-local-assets')
      opening.onerror = () => reject(opening.error)
      opening.onsuccess = () => {
        const transaction = opening.result.transaction('assets', 'readwrite')
        const store = transaction.objectStore('assets')
        store.put({ id: damagedId, kind: 'signature', name: 42 })
        store.put({
          id: newerId,
          version: 99,
          kind: 'signature',
          name: newerName,
          bytes: 4,
          payload: { format: 'text', mediaType: 'text/plain', text: 'x' },
          createdAt: '2026-09-07T02:00:00.000Z',
          updatedAt: '2026-09-07T02:00:00.000Z',
        })
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      }
    })
  }, ['canary-damaged', 'canary-newer', '未來版本資產'])

  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForHydration(page)

  const unreadable = page.locator('.local-assets__unreadable .local-asset')
  await expect(unreadable).toHaveCount(2)
  await expect(unreadable.first()).toContainText('已損毀')
  await expect(unreadable.last()).toContainText('較新版本')
  await expect(unreadable.first().locator('[data-asset-action="rename"]'), '讀不到的資料不提供更名').toHaveCount(0)
  await expect(rows(page), '讀不到的資料不影響可讀資產').toHaveCount(2)

  await unreadable.first().locator('[data-asset-action="delete"]').click()
  await page.locator('[data-asset-action="confirm-delete"]').click()
  await expect(page.locator('.local-assets__unreadable .local-asset')).toHaveCount(1)
  await expect(rows(page)).toHaveCount(2)
})

test('資產不進入網路請求、Service Worker 快取或偏好命名空間', async ({ page }) => {
  await gotoHydrated(page, STORAGE_ROUTE)
  await importBundle(page)
  await expect(rows(page)).toHaveCount(2)

  const cacheEntries = await page.evaluate(async () => {
    if (!('caches' in window)) return []

    const names = await caches.keys()
    const entries: Array<{ cache: string, url: string, body: string }> = []
    for (const name of names) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) {
        const response = await cache.match(request)
        entries.push({ cache: name, url: request.url, body: response ? await response.clone().text() : '' })
      }
    }

    return entries
  })

  for (const entry of cacheEntries) {
    expect(entry.cache, '只允許版本化的應用資產快取').toMatch(/^toolsliang-/)
    for (const canary of toolContent) {
      expect(entry.url.includes(canary.value), `快取項目 URL 含有工具內容（${canary.label}）`).toBe(false)
      expect(entry.body.includes(canary.value), `快取內容含有工具內容（${canary.label}）`).toBe(false)
    }
  }

  const deviceStorage = await page.evaluate(() => ({
    local: Object.entries(window.localStorage).map(([key, value]) => `${key}=${value}`).join('\n'),
    session: Object.entries(window.sessionStorage).map(([key, value]) => `${key}=${value}`).join('\n'),
  }))

  for (const canary of toolContent) {
    expect(deviceStorage.local.includes(canary.value), `偏好命名空間含有工具內容（${canary.label}）`).toBe(false)
    expect(deviceStorage.session.includes(canary.value), `session 儲存含有工具內容（${canary.label}）`).toBe(false)
  }

  // Leaving the manager for a tool page must not carry an asset into the URL either.
  await page.waitForLoadState('networkidle')
  await gotoHydrated(page, TOOL_ROUTE)
  expect(page.url()).not.toContain(encodeURIComponent(ASSET_NAME))
})

test('手機寬度可鍵盤與觸控操作，且通過 WCAG 2.2 AA', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoHydrated(page, STORAGE_ROUTE)
  await importBundle(page)

  const layout = await page.locator('html').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(layout.scrollWidth, '本機資產頁不得有橫向跑版').toBeLessThanOrEqual(layout.clientWidth + 1)

  for (const control of await rows(page).first().locator('button').all()) {
    const box = await control.boundingBox()
    expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '資產操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
    expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '資產操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
  }

  const importLabel = page.locator('.local-assets__import label')
  const importBox = await importLabel.boundingBox()
  expect((importBox?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '匯入操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
  await page.locator('#local-asset-import').focus()
  const importFocus = await importLabel.evaluate((element) => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) }
  })
  expect(importFocus.style, '匯入控制項聚焦時必須有可見輪廓').not.toBe('none')
  expect(importFocus.width, '匯入 focus 輪廓至少 3px').toBeGreaterThanOrEqual(3)

  const rename = rows(page).first().locator('[data-asset-action="rename"]')
  await rename.focus()
  const focusStyle = await rename.evaluate((element) => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) }
  })
  expect(focusStyle.style, 'focus 必須有可見輪廓').not.toBe('none')
  expect(focusStyle.width, 'focus 輪廓至少 3px').toBeGreaterThanOrEqual(3)

  await page.keyboard.press('Enter')
  await expect(rows(page).first().locator('[data-asset-field="name"]')).toBeFocused()
  await page.keyboard.type('-2')
  await page.keyboard.press('Enter')
  await expect(page.locator('.local-assets__status')).toContainText('已更名為')

  for (const mode of ['light', 'dark'] as const) {
    if (mode === 'dark') {
      await page.getByRole('button', { name: '切換色彩模式' }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations, `${mode} 模式本機資產無障礙違規：\n${results.violations.map(item => `${item.id}: ${item.help}`).join('\n')}`).toEqual([])
  }
})

test('無法讀取的匯入檔不改變裝置上的資產，並說明如何處理', async ({ page }) => {
  await gotoHydrated(page, STORAGE_ROUTE)
  await importBundle(page)

  await page.setInputFiles('#local-asset-import', {
    name: 'not-a-bundle.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"other.tool","version":1,"assets":[]}', 'utf8'),
  })

  const alert = page.locator('.local-assets__error')
  await expect(alert).toContainText('不是可讀的本機資產匯出檔')
  await expect(alert).toContainText('這次沒有匯入任何資料')
  await expect(rows(page), '失敗的匯入不得改變裝置上的資產').toHaveCount(2)
})

test('英文頁面提供同一份說明與操作', async ({ page }) => {
  await gotoHydrated(page, EN_STORAGE_ROUTE)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Local assets')
  await expect(page.locator('.local-assets__boundary')).toContainText('never uploaded')
  await expect(page.locator('.local-assets__empty')).toContainText('No local assets')

  await page.setInputFiles('#local-asset-import', {
    name: 'canary-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(sampleBundle, 'utf8'),
  })
  await expect(page.locator('.local-assets__status')).toContainText('Imported')
})

/**
 * Restarting offline needs the Service Worker to serve the App Shell, and only
 * Chromium exposes a verifiable Service Worker lifecycle in Playwright. The
 * device database itself is covered browser-independently by the unit suite.
 */
test.describe('離線後的本機資產', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Service Worker 生命週期只在 Chromium 可驗證')

  test('離線重新啟動仍可檢視與清除本機資產', async ({ page, context }) => {
    await gotoHydrated(page, STORAGE_ROUTE)
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20_000 })
    await importBundle(page)
    await page.waitForLoadState('networkidle')

    expectOfflineRequests(page)
    await context.setOffline(true)
    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForHydration(page)

      await expect(rows(page)).toHaveCount(2)
      await rows(page).first().locator('[data-asset-action="delete"]').click()
      await page.locator('[data-asset-action="confirm-delete"]').click()
      await expect(rows(page)).toHaveCount(1)
    }
    finally {
      await context.setOffline(false)
    }
  })
})
