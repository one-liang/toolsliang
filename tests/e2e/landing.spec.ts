import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { unpublishedToolSlugs } from '../../app/features/tools/catalog'
import { gotoHydrated } from './support/hydration'
import { inspectNetworkRequest, redactToolContent } from './support/privacy-boundary'

const LANDING_ROUTE = '/zh-tw/'
const SEARCH_QUERY = '支票'
const SEARCH_CANARY = [{ label: '搜尋字串', value: SEARCH_QUERY }]
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
const VIEWPORTS = [
  { label: '手機', width: 375, height: 812 },
  { label: '平板', width: 768, height: 1024 },
  { label: '桌面', width: 1024, height: 800 },
  { label: '寬桌面', width: 1440, height: 900 },
]

async function pressFocusForward(page: Page, testInfo: TestInfo) {
  await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
}

const findingsByPage = new WeakMap<Page, { consoleErrors: string[]; pageErrors: string[]; networkFindings: string[] }>()

test.beforeEach(({ page }) => {
  const findings = { consoleErrors: [] as string[], pageErrors: [] as string[], networkFindings: [] as string[] }
  findingsByPage.set(page, findings)

  page.on('console', (message) => {
    if (message.type() === 'error') findings.consoleErrors.push(redactToolContent(message.text(), SEARCH_CANARY))
  })
  page.on('pageerror', error => findings.pageErrors.push(redactToolContent(error.message, SEARCH_CANARY)))
  page.context().on('request', (request) => {
    findings.networkFindings.push(...inspectNetworkRequest({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      body: request.postData(),
    }, SEARCH_CANARY, NETWORK_BOUNDARY_POLICY))
  })
})

test.afterEach(({ page }) => {
  const findings = findingsByPage.get(page)
  expect(findings?.networkFindings ?? [], '首頁不得把查詢或內容送出裝置').toEqual([])
  expect(findings?.consoleErrors ?? [], '首頁不得產生 console 錯誤').toEqual([])
  expect(findings?.pageErrors ?? [], '首頁不得產生未捕捉例外').toEqual([])
})

test('首頁以鍵盤搜尋即可進入已發布工具，且查詢不離開裝置', async ({ page }) => {
  await gotoHydrated(page, LANDING_ROUTE)

  const search = page.getByRole('searchbox', { name: '搜尋全部工具' })
  await search.click()
  await page.keyboard.type(SEARCH_QUERY)

  const result = page.locator('.tool-search__result').first()
  await expect(result).toHaveAttribute('href', '/zh-tw/tools/ntd-uppercase/')

  await result.press('Enter')
  await expect(page).toHaveURL(/\/zh-tw\/tools\/ntd-uppercase\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('首頁的分類網格連到每個已發布工具，且沒有未發布入口', async ({ page }) => {
  await gotoHydrated(page, LANDING_ROUTE)

  await expect(page.locator('.landing-catalog .tool-card__link[href="/zh-tw/tools/ntd-uppercase/"]')).toBeVisible()
  await expect(page.locator('.landing-featured .tool-card__link')).not.toHaveCount(0)

  const html = await page.content()
  expect(unpublishedToolSlugs.length, '註冊表需要有未發布工具才能驗證邊界').toBeGreaterThan(0)
  for (const slug of unpublishedToolSlugs) {
    expect(html, `${slug} 尚未發布，不得出現在首頁`).not.toContain(slug)
  }
})

test('首頁使用 Landing 佈局，不顯示 App Shell 導覽', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoHydrated(page, LANDING_ROUTE)

  await expect(page.locator('.app-sidebar')).toHaveCount(0)
  await expect(page.locator('.mobile-nav')).toHaveCount(0)
  await expect(page.locator('.site-header')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
})

test('雙語 metadata、canonical、hreflang 與 structured data 可驗證', async ({ page }) => {
  for (const [locale, lang, expectedLangAttribute] of [['zh-tw', 'zh-Hant-TW', 'zh-Hant-TW'], ['en', 'en', 'en']] as const) {
    await gotoHydrated(page, `/${locale}/`)

    await expect(page.locator('html')).toHaveAttribute('lang', expectedLangAttribute)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://toolsliang.com/${locale}/`)
    await expect(page.locator('link[rel="alternate"][hreflang="zh-Hant-TW"]')).toHaveAttribute('href', 'https://toolsliang.com/zh-tw/')
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://toolsliang.com/en/')
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', 'https://toolsliang.com/zh-tw/')
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `https://toolsliang.com/${locale}/`)
    await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute('content', '')
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', locale === 'en' ? 'en' : 'zh_TW')
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute('content', locale === 'en' ? 'zh_TW' : 'en')

    const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').first().innerText())
    const types = (graph['@graph'] as Array<{ '@type': string }>).map(node => node['@type'])
    expect(types).toContain('WebSite')
    expect(types).toContain('Organization')
    expect(types).toContain('FAQPage')

    const website = (graph['@graph'] as Array<Record<string, string>>).find(node => node['@type'] === 'WebSite')!
    expect(website.inLanguage).toBe(lang)
    expect(JSON.stringify(graph)).not.toContain('SearchAction')

    const questions = (graph['@graph'] as Array<Record<string, Array<{ name: string }>>>)
      .find(node => (node as unknown as { '@type': string })['@type'] === 'FAQPage')!.mainEntity
    for (const question of questions) {
      await expect(page.locator('.landing-faq__question', { hasText: question.name })).toHaveCount(1)
    }
  }
})

for (const viewport of VIEWPORTS) {
  test(`首頁在 ${viewport.label} ${viewport.width}px 無橫向跑版`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await gotoHydrated(page, LANDING_ROUTE)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, '首頁不得出現橫向捲動').toBeLessThanOrEqual(1)

    const searchBox = await page.getByRole('searchbox', { name: '搜尋全部工具' }).boundingBox()
    expect(searchBox!.height, '搜尋框需維持可觸控高度').toBeGreaterThanOrEqual(44)
  })
}

test('首頁可只用鍵盤依視覺順序走訪每個區段，且 focus 清楚可見', async ({ page }, testInfo) => {
  await gotoHydrated(page, LANDING_ROUTE)

  await page.getByRole('searchbox', { name: '搜尋全部工具' }).focus()

  // Tab order must reach the hero action, the featured highlight and the category grid in visual order.
  const expectedOrder = [
    page.getByRole('link', { name: '瀏覽全部工具' }),
    page.locator('.landing-featured .tool-card__link').first(),
    page.locator('.landing-catalog .tool-card__link').first(),
  ]

  for (const target of expectedOrder) {
    for (let step = 0; step < 12 && !(await target.evaluate(element => element === document.activeElement)); step += 1) {
      await pressFocusForward(page, testInfo)
    }
    await expect(target).toBeFocused()

    const outlineWidth = await target.evaluate(element => Number.parseFloat(getComputedStyle(element).outlineWidth))
    expect(outlineWidth, '聚焦項目需要可見的 focus ring').toBeGreaterThanOrEqual(3)
  }
})

test('首頁在 light 與 dark 皆通過 WCAG 2.2 AA 自動檢查', async ({ page }) => {
  await gotoHydrated(page, LANDING_ROUTE)

  for (const mode of ['light', 'dark'] as const) {
    if (mode === 'dark') {
      await page.getByRole('button', { name: '切換色彩模式' }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    }

    // Search results are an overlay, so they need their own contrast and role check.
    await page.getByRole('searchbox', { name: '搜尋全部工具' }).fill(SEARCH_QUERY)
    await expect(page.locator('.tool-search__result').first()).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    expect(results.violations, `${mode} 模式首頁無障礙違規：\n${results.violations.map(item => `${item.id}: ${item.help}`).join('\n')}`).toEqual([])
  }
})
