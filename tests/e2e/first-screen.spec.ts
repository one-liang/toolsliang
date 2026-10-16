import { expect, test, type Locator, type Page } from '@playwright/test'
import { gotoHydrated } from './support/hydration'
import { guardToolContentBoundary } from './support/tool-content-boundary'

/*
 * #91: a visitor who lands on a tool page sees, without scrolling, where to put
 * their input, the button that acts on it and where the result appears. The
 * two screens are the issue's own: a 1366×768 laptop and a 375×812 phone.
 * Nothing is typed here, so the canary list is empty; the guard still fails a
 * test on any console error or request outside the site.
 */
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
// Sub-pixel layout can report a 44px target as 43.999996; the same tolerance as the tool quality gate.
const TOUCH_TARGET_TOLERANCE_PX = 0.001

guardToolContentBoundary([], NETWORK_BOUNDARY_POLICY)

const VIEWPORTS = [
  { name: '桌面', width: 1366, height: 768 },
  { name: '手機', width: 375, height: 812 },
] as const

interface FirstScreen {
  slug: string
  name: string
  /** Waits for whatever the workspace still has to load after hydration. */
  ready?: (page: Page) => Promise<void>
  input: (page: Page) => Locator
  action: (page: Page) => Locator
  /** The result itself, or the region it appears in when nothing has been entered yet. */
  result: (page: Page) => Locator
}

const TOOLS: FirstScreen[] = [
  {
    slug: 'bmi-calculator',
    name: 'BMI 計算',
    input: page => page.getByLabel('體重（公斤）'),
    // The reading updates as the numbers are typed; clearing them is the workspace's one button.
    action: page => page.getByRole('button', { name: '重設' }),
    result: page => page.locator('.bmi-result'),
  },
  {
    slug: 'ntd-uppercase',
    name: '新臺幣國字大寫',
    input: page => page.getByLabel('輸入金額（新臺幣）'),
    action: page => page.getByRole('button', { name: '複製結果' }),
    result: page => page.locator('.ntd-result'),
  },
  {
    slug: 'device-time',
    name: '裝置時間',
    ready: page => page.locator('[data-device-clock]').waitFor(),
    input: page => page.getByRole('radio', { name: '12 小時制' }),
    action: page => page.getByRole('button', { name: '複製時間資訊' }),
    result: page => page.locator('[data-device-clock]'),
  },
  {
    slug: 'taiwan-calendar',
    name: '台灣行事曆',
    ready: page => page.locator('[data-calendar-state="ready"]').waitFor(),
    input: page => page.getByLabel('年份', { exact: true }),
    action: page => page.getByRole('button', { name: '回到今天' }),
    // The month is taller than a laptop screen; its first week is where the answer starts.
    result: page => page.locator('.calendar-grid tbody tr').first(),
  },
  {
    slug: 'roc-year-converter',
    name: '民國西元對照',
    input: page => page.getByLabel('民國年份'),
    // The year converts as it is typed; switching direction is the one control that acts on it.
    action: page => page.getByRole('radio', { name: '西元年' }),
    result: page => page.locator('.roc-year__result'),
  },
  {
    slug: 'random-picker',
    name: '抽籤與輪盤',
    input: page => page.getByLabel('候選名單'),
    action: page => page.getByRole('button', { name: '開始抽選' }),
    result: page => page.locator('.picker-stage'),
  },
  {
    slug: 'brand-promo-image',
    name: '品牌宣傳圖',
    ready: page => expect(page.locator('[data-promo-add]').first()).toBeEnabled(),
    input: page => page.locator('[data-promo-add]').last(),
    action: page => page.getByRole('button', { name: '產生 PNG', exact: true }),
    result: page => page.locator('[data-promo-stage]'),
  },
]

/** The lowest visible line: the viewport, or the top of the phone's floating bottom navigation. */
async function foldOf(page: Page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.mobile-nav')
    const navTop = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight
    return Math.min(innerHeight, navTop)
  })
}

async function expectAboveFold(target: Locator, label: string, fold: number) {
  await expect(target, `${label}要在畫面上`).toBeVisible()
  const box = (await target.boundingBox())!
  expect(box.y, `${label}不能被頂欄蓋住`).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height, `${label}不捲動就要完整看得到`).toBeLessThanOrEqual(fold)
}

test.describe('第一個畫面就看得到主要輸入、動作與結果（#91）', () => {
  // A waiting application update would open its notice over the corner these tests measure.
  test.use({ serviceWorkers: 'block' })

  for (const viewport of VIEWPORTS) {
    for (const tool of TOOLS) {
      test(`${viewport.name} ${viewport.width}×${viewport.height}：${tool.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await gotoHydrated(page, `/zh-tw/tools/${tool.slug}/`)
        await page.locator('[data-capability-ready="true"]').waitFor()
        await tool.ready?.(page)

        expect(await page.evaluate(() => scrollY), '從頁首開始量').toBe(0)
        const fold = await foldOf(page)
        await expectAboveFold(tool.input(page), '主要輸入', fold)
        await expectAboveFold(tool.action(page), '主要動作按鈕', fold)
        await expectAboveFold(tool.result(page), '結果的位置', fold)

        // Making room never shrinks a control below the 44px target.
        for (const target of [tool.input(page), tool.action(page)]) {
          const box = (await target.boundingBox())!
          const hit = await target.evaluate((element) => {
            // A radio is tapped through the pill around it, which carries the target size.
            const pill = element.closest('label') ?? element
            const rect = pill.getBoundingClientRect()
            return { width: rect.width, height: rect.height }
          })
          expect(Math.max(box.height, hit.height) + TOUCH_TARGET_TOLERANCE_PX, '操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
          expect(Math.max(box.width, hit.width) + TOUCH_TARGET_TOLERANCE_PX, '操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
        }
      })
    }
  }
})
