import { expect, test } from '@playwright/test'
import { getWithdrawnToolRedirects } from '../../app/features/tools/catalog'
import { waitForHydration } from './support/hydration'

/**
 * A withdrawn tool page is still bookmarked and still in search results, so its
 * address keeps answering (ADR-0011, ADR-0021). The server answers it with a
 * permanent redirect rather than a 404, and the visitor lands on a working page.
 */
const redirects = getWithdrawnToolRedirects()

test('下架工具的舊網址永久轉到接手的工具頁，含不帶結尾斜線的寫法', async ({ request }) => {
  expect(redirects.length, '註冊表需要有下架工具才能驗證轉址').toBeGreaterThan(0)

  for (const { from, to } of redirects) {
    for (const path of [from, from.replace(/\/$/, '')]) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status(), `${path} 必須是永久轉址`).toBe(301)
      expect(response.headers().location, `${path} 必須轉到 ${to}`).toBe(to)
    }
  }
})

test('從舊網址進來的人落在可用的台灣行事曆，而不是錯誤頁', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  for (const [from, heading] of [['/zh-tw/tools/custom-calendar/', '台灣行事曆'], ['/en/tools/custom-calendar/', 'Taiwan Calendar']] as const) {
    const response = await page.goto(from, { waitUntil: 'domcontentloaded' })
    await waitForHydration(page)

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(new RegExp(`${from.replace('custom-calendar', 'taiwan-calendar')}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
  }

  expect(pageErrors).toEqual([])
})
