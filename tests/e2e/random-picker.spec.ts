import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { guardToolContentBoundary } from './support/tool-content-boundary'

const TOOL_ROUTE = '/zh-tw/tools/random-picker/'
const FIRST = '抽選測試甲-9c41'
const SECOND = '抽選測試乙-9c41'
const THIRD = '抽選測試丙-9c41'
const CANDIDATES = [FIRST, SECOND, THIRD].join('\n')
const ADDED = '抽選測試丁-9c41'
/** The list size #83 is accepted against: long enough to fill the field on a phone. */
const TWENTY = Array.from({ length: 20 }, (_, index) => `抽選名單${String(index + 1).padStart(2, '0')}-9c41`)
const TOUCH_TARGET_TOLERANCE_PX = 0.001
const NETWORK_BOUNDARY_POLICY = { allowedOrigins: ['http://127.0.0.1:4173'] }
/**
 * Every candidate this suite types and every name it reads back. The suffix
 * keeps a candidate from also matching a hashed asset filename and failing the
 * boundary check for the wrong reason.
 */
const TOOL_CONTENT = [
  { label: '輸入', value: FIRST },
  { label: '輸入', value: SECOND },
  { label: '輸入', value: THIRD },
  { label: '輸入', value: ADDED },
  ...TWENTY.map(value => ({ label: '輸入', value })),
]
/** The two windows #83 names: a common laptop and a common phone. */
const SINGLE_SCREEN_VIEWPORTS = [
  { name: '桌面 1366×768', width: 1366, height: 768 },
  { name: '手機 375×812', width: 375, height: 812 },
] as const

guardToolContentBoundary(TOOL_CONTENT, NETWORK_BOUNDARY_POLICY)

async function gotoTool(page: Page, route = TOOL_ROUTE) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-capability-ready="true"]').waitFor()
  return response
}

/**
 * Pins the draw so a test can name the winner. Only the 32-bit words the picker
 * asks for are replaced; anything else in the page keeps the real source.
 */
async function alwaysDrawTheFirstEntry(page: Page) {
  await page.addInitScript(() => {
    const source = crypto as Crypto & { getRandomValues: (array: ArrayBufferView) => ArrayBufferView }
    const original = source.getRandomValues.bind(source)
    Object.defineProperty(source, 'getRandomValues', {
      configurable: true,
      value: (array: ArrayBufferView) => (array instanceof Uint32Array ? array.fill(0) : original(array)),
    })
  })
}

async function fillCandidates(page: Page, candidates = CANDIDATES) {
  await page.getByLabel('候選名單').fill(candidates)
}

function scrollTop(page: Page) {
  return page.evaluate(() => window.scrollY)
}

/** The scroll position once it has stopped moving for a few frames. */
async function settledScrollTop(page: Page) {
  return page.evaluate(() => new Promise<number>((resolve) => {
    let last = window.scrollY
    let still = 0
    const check = () => {
      still = window.scrollY === last ? still + 1 : 0
      last = window.scrollY
      if (still >= 5) resolve(last)
      else requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  }))
}

/** Whether the element at the centre of the target is the target itself, not something docked over it. */
async function expectUncovered(target: Locator, message: string) {
  const uncovered = await target.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return Boolean(hit && (element === hit || element.contains(hit)))
  })
  expect(uncovered, message).toBe(true)
}

/**
 * Presses a control the way a visitor would without scrolling first: it has to
 * be fully on screen and uncovered already, the press lands where it is drawn
 * (a locator click would scroll it into view first), and pressing it must not
 * move the page either.
 */
async function pressInPlace(page: Page, target: Locator, scrollBefore: number) {
  await expect(target, '不捲動就要看得到').toBeInViewport({ ratio: 1 })
  await expectUncovered(target, '不能被其他介面蓋住')
  const box = (await target.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  expect(await settledScrollTop(page), '按下後畫面不得移動').toBe(scrollBefore)
}

async function expectResultInView(page: Page) {
  const result = page.locator('.picker-result')
  await expect(result, '結果要在畫面內').toBeInViewport({ ratio: 1 })
  await expectUncovered(result, '結果不能被蓋住')
}

test('工具開啟即可操作，作法與界線集中在下方常見問題', async ({ page }) => {
  const response = await gotoTool(page)
  expect(response?.ok(), `${TOOL_ROUTE} 應成功載入`).toBe(true)

  await expect(page).toHaveTitle(/抽籤與輪盤/)
  await expect(page.getByRole('heading', { level: 1, name: '抽籤與輪盤' })).toBeVisible()
  await expect(page.locator('body'), '#83：名稱不再使用「本機」').not.toContainText('本機抽選')
  await expect(page.getByRole('radio', { name: '保留重複（各佔一個機會）' })).toBeChecked()
  await expect(page.getByRole('radio', { name: '名單' })).toBeChecked()
  await expect(page.locator('.picker-result')).toContainText('準備好名單後按')

  // #83: the workspace keeps only what a draw needs; the boundaries are answered below it.
  await expect(page.locator('.picker-caveats, .picker-method, .picker-source')).toHaveCount(0)
  const faq = page.locator('.tool-contract--faq')
  await expect(page.getByRole('heading', { name: '關於這個工具的常見問題' })).toBeVisible()
  await expect(faq, '無法稽核仍寫在工具頁上').toContainText('無法向別人證明')
  await expect(faq).toContainText('動畫開始前就已經抽好')
  await expect(faq).toContainText('不會送到 toolsliang 或第三方服務')
  // #82: specifications and algorithms are not content sources.
  await expect(page.getByRole('heading', { name: '資料來源與審閱' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '這個工具怎麼處理你的內容' })).toBeVisible()
})

test.describe('一個畫面完成抽選（#83）', () => {
  // A waiting application update would open its notice over the corner these tests measure.
  test.use({ serviceWorkers: 'block' })

  for (const viewport of SINGLE_SCREEN_VIEWPORTS) {
    for (const presentation of ['名單', '輪盤'] as const) {
      test(`${viewport.name}以${presentation}呈現：貼上 20 筆後不捲動就能抽選、再抽一次與重設`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await gotoTool(page)
        await page.getByLabel('候選名單').fill(TWENTY.join('\n'))
        await expect(page.locator('.picker-summary')).toContainText('可抽選項目 20 筆')
        // Focusing the field may lift it clear of the docked stage; from here on nothing may move.
        const scrollBefore = await settledScrollTop(page)

        if (presentation === '輪盤') {
          await pressInPlace(page, page.getByRole('radio', { name: '輪盤' }), scrollBefore)
          await expect(page.locator('.picker-wheel'), '輪盤也在畫面內').toBeInViewport({ ratio: 1 })
        }

        await pressInPlace(page, page.getByRole('button', { name: '開始抽選' }), scrollBefore)
        const drawn = page.locator('.picker-result__item')
        await expect(drawn).toHaveCount(1)
        expect(TWENTY).toContain(await drawn.innerText())
        await expectResultInView(page)

        await pressInPlace(page, page.getByRole('button', { name: '再抽一次' }), scrollBefore)
        await expect(page.locator('.picker-result')).toHaveAttribute('aria-busy', 'false')
        await expect(drawn).toHaveCount(1)
        await expectResultInView(page)

        await pressInPlace(page, page.getByRole('button', { name: '重設' }), scrollBefore)
        await expect(page.getByLabel('候選名單')).toHaveValue('')
        await expect(page.locator('.picker-result')).toContainText('準備好名單後按')
        await expectResultInView(page)
        expect(await scrollTop(page)).toBe(scrollBefore)
      })
    }
  }
})

test('抽選結果由 live region 宣告，多名抽選不重複中選', async ({ page }) => {
  await gotoTool(page)
  await fillCandidates(page)
  await expect(page.locator('.picker-summary')).toContainText('可抽選項目 3 筆')

  await page.getByLabel('抽出幾名').fill('2')
  await page.getByRole('button', { name: '開始抽選' }).click()

  const result = page.locator('.picker-result')
  await expect(result).toHaveAttribute('role', 'status')
  await expect(result).toHaveAttribute('aria-live', 'polite')
  await expect(page.locator('.picker-result__item')).toHaveCount(2)

  const drawn = await page.locator('.picker-result__item').allInnerTexts()
  expect(new Set(drawn).size, '多人抽選不得重複中選').toBe(2)
  for (const entry of drawn) expect([FIRST, SECOND, THIRD]).toContain(entry)
})

test('逐項新增與空白行處理都看得見', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('候選名單').fill(`${FIRST}\n\n  \n${SECOND}`)
  await expect(page.locator('.picker-summary')).toContainText('略過空白行 2 行')

  await page.getByLabel('逐項新增').fill(ADDED)
  await page.getByRole('button', { name: '加入名單' }).click()
  await expect(page.getByLabel('候選名單')).toHaveValue(`${FIRST}\n\n  \n${SECOND}\n${ADDED}`)
  await expect(page.locator('.picker-summary')).toContainText('可抽選項目 3 筆')
})

test('重複項目策略由使用者決定，並說明目前的機會分配', async ({ page }) => {
  await gotoTool(page)
  await page.getByLabel('候選名單').fill(`${FIRST}\n${FIRST}\n${SECOND}`)
  const note = page.locator('.picker-duplicates-note')
  await expect(note).toContainText('目前各佔一個機會')
  await expect(page.getByRole('radio', { name: '保留重複（各佔一個機會）' }), '說明掛在設定上').toHaveAccessibleDescription(/目前各佔一個機會/)

  await page.getByRole('radio', { name: '合併重複（同名只算一次）' }).check()
  await expect(page.locator('.picker-summary')).toContainText('合併重複 1 筆')
  await expect(note).toHaveCount(0)
})

test('輪盤可以跳過，跳過後仍是同一個已決定的結果', async ({ page }) => {
  await alwaysDrawTheFirstEntry(page)
  await gotoTool(page)
  await fillCandidates(page)
  await page.getByRole('radio', { name: '輪盤' }).check()
  await expect(page.locator('.picker-wheel')).toBeVisible()
  await expect(page.locator('.picker-candidates'), '輪盤旁必須有可讀的候選名單').toContainText(THIRD)

  await page.getByRole('button', { name: '開始抽選' }).click()
  await expect(page.locator('.picker-result')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('progressbar', { name: '輪盤進度' })).toBeVisible()
  await expect(page.locator('.picker-result__item'), '動畫還沒停就不得宣告結果').toHaveCount(0)

  await page.getByRole('button', { name: '跳過動畫' }).click()
  await expect(page.locator('.picker-result')).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.picker-result__item')).toHaveText([FIRST])
  await expect(page.getByRole('button', { name: '跳過動畫' })).toHaveCount(0)
  // #106: skipping stops the wheel on the result instead of letting it keep turning.
  expect(await page.locator('.picker-wheel__disc').evaluate(disc => disc.getAnimations().length), '跳過後輪盤不再轉動').toBe(0)
  await expect(page.locator('.picker-wheel__won'), '停下來後中選的扇形突出').toBeVisible()
})

test('reduced motion 下不播動畫，結果立刻可讀', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await alwaysDrawTheFirstEntry(page)
  await gotoTool(page)
  await fillCandidates(page)
  await page.getByRole('radio', { name: '輪盤' }).check()
  await page.getByRole('button', { name: '開始抽選' }).click()

  await expect(page.locator('.picker-result__item')).toHaveText([FIRST])
  await expect(page.getByRole('button', { name: '跳過動畫' }), '沒有動畫就不需要跳過鍵').toHaveCount(0)
  await expect(page.locator('.picker-wheel'), '輪盤仍然看得到中選的扇形').toBeVisible()
  await expect(page.locator('.picker-wheel__won'), '中選的扇形突出在指針下').toBeVisible()
})

test('抽出人數與呈現方式的限制都說明可以怎麼改，中英文各一次', async ({ page }) => {
  await gotoTool(page)
  await fillCandidates(page)
  await page.getByLabel('抽出幾名').fill('5')

  await expect(page.getByRole('alert')).toHaveText('要抽 5 名，但名單只有 3 筆可抽。')
  await expect(page.getByRole('button', { name: '開始抽選' })).toBeDisabled()

  await page.getByRole('radio', { name: '輪盤' }).check()
  await expect(page.locator('.picker-wheel-note')).toContainText('抽 1 名')

  await page.getByLabel('抽出幾名').fill('2')
  await expect(page.getByRole('alert'), '修正後錯誤訊息必須消失').toHaveCount(0)

  await gotoTool(page, '/en/tools/random-picker/')
  await page.getByLabel('Candidates').fill(CANDIDATES)
  await page.getByLabel('How many to draw').fill('5')
  await expect(page.getByRole('alert')).toHaveText('You asked for 5 but the list only has 3 to draw from.')
})

test('核心流程可用鍵盤完成，操作目標在手機上可觸控', async ({ page }, testInfo) => {
  await alwaysDrawTheFirstEntry(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await gotoTool(page)

  const candidates = page.getByLabel('候選名單')
  await candidates.focus()
  await candidates.fill(CANDIDATES)
  const drawButton = page.locator('.picker-draw')
  await drawButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.picker-result__item')).toHaveText([FIRST])
  await expect(drawButton, '抽完後焦點留在結果旁的按鈕').toBeFocused()
  await expect(drawButton).toHaveText('再抽一次')

  await page.keyboard.press('Enter')
  await expect(page.locator('.picker-result__item')).toHaveText([FIRST])
  await expect(drawButton).toBeFocused()

  // The stage reads in the order it is used: how to show it, then the buttons that act on the result.
  const stageOrder = await page.locator('.picker-stage').evaluate(stage => [...stage.querySelectorAll('input, button, [tabindex="0"]')]
    .map(element => element.getAttribute('value') ?? element.textContent?.trim()))
  expect(stageOrder).toEqual(['list', 'wheel', '再抽一次', '重設'])

  await page.getByRole('button', { name: '重設' }).focus()
  await page.keyboard.press('Enter')
  await expect(candidates).toHaveValue('')
  await expect(page.locator('.picker-result')).toContainText('準備好名單後按')
  await expect(page.getByRole('button', { name: '重設' }), '重設後焦點仍在結果區').toBeFocused()

  const dimensions = await page.locator('html').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(dimensions.scrollWidth, `${testInfo.project.name} 375px 不得有橫向跑版`).toBeLessThanOrEqual(dimensions.clientWidth + 1)

  await candidates.fill(CANDIDATES)
  for (const target of [
    candidates,
    page.getByLabel('抽出幾名'),
    page.locator('.picker-option').first(),
    page.locator('.picker-view__option').first(),
    page.getByRole('button', { name: '加入名單' }),
    drawButton,
    page.getByRole('button', { name: '重設' }),
  ]) {
    const box = await target.boundingBox()
    expect((box?.width ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標寬度至少 44px').toBeGreaterThanOrEqual(44)
    expect((box?.height ?? 0) + TOUCH_TARGET_TOLERANCE_PX, '主要操作目標高度至少 44px').toBeGreaterThanOrEqual(44)
  }
})

for (const viewport of [{ name: '桌面', width: 1280, height: 720 }, { name: '手機底部結果區', width: 375, height: 812 }]) {
  test(`${viewport.name}的輪盤與結果在 light 與 dark 模式皆通過 WCAG 2.2 AA 自動檢查`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await alwaysDrawTheFirstEntry(page)
    await gotoTool(page)
    await fillCandidates(page)
    await page.getByRole('radio', { name: '輪盤' }).check()
    await page.getByRole('button', { name: '開始抽選' }).click()
    await expect(page.locator('.picker-result__item')).toHaveText([FIRST])

    for (const mode of ['light', 'dark'] as const) {
      if (mode === 'dark') {
        await page.getByRole('button', { name: '切換色彩模式' }).click()
        await expect(page.locator('html')).toHaveClass(/dark/)
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()

      expect(results.violations, `${mode} 模式無障礙違規：\n${results.violations.map(item => `${item.id}: ${item.help}`).join('\n')}`).toEqual([])
    }
  })
}
