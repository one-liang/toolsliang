import { expect, test, type Page } from '@playwright/test'
import { gotoHydrated } from './support/hydration'
import { guardToolContentBoundary } from './support/tool-content-boundary'

guardToolContentBoundary([{ label: '批次圖片檔名', value: 'private-batch-layout-canary' }], { allowedOrigins: ['http://127.0.0.1:4173'] })

type Files = { name: string, mimeType: string, buffer: Buffer }[]

/** Flat PNGs drawn in the page, never real photographs; the file names are the canary the guard watches. */
async function photos(page: Page, count: number): Promise<Files> {
  const all = await page.evaluate(async (count) => {
    const out: number[][] = []
    for (let index = 0; index < count; index++) {
      const canvas = new OffscreenCanvas(120 + index * 7, 160)
      const context = canvas.getContext('2d')!
      context.fillStyle = `hsl(${index * 18} 70% 55%)`
      context.fillRect(0, 0, canvas.width, canvas.height)
      out.push([...new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer())])
    }
    return out
  }, count)
  return all.map((bytes, index) => ({ name: `private-batch-layout-canary-${index + 1}-with-a-long-file-name.png`, mimeType: 'image/png', buffer: Buffer.from(bytes) }))
}

/** Each tool, the way a visitor fills it with a full batch, and the column that holds its controls. */
const tools: { slug: string, panel: string, fill: (page: Page) => Promise<void> }[] = [
  {
    slug: 'image-compressor',
    panel: '.image-compressor__panel',
    fill: async page => page.locator('.image-compressor [data-batch-input]').setInputFiles(await photos(page, 20)),
  },
  {
    slug: 'image-background-remover',
    panel: '.image-background-remover__panel',
    fill: async page => page.locator('.image-background-remover [data-batch-input]').setInputFiles(await photos(page, 20)),
  },
  {
    slug: 'product-image-workbench',
    panel: '.workbench__panel',
    fill: async page => page.locator('.workbench [data-batch-input]').setInputFiles(await photos(page, 20)),
  },
  {
    slug: 'brand-promo-image',
    panel: '.brand-promo__side',
    fill: async (page) => {
      const [first, ...rest] = await photos(page, 20)
      let chooser = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: '加入商品圖', exact: true }).click()
      await (await chooser).setFiles(first!)
      await expect(page.getByRole('status').filter({ hasText: '已加入圖層' })).toBeVisible()
      chooser = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: '套用到多張商品圖', exact: true }).click()
      await (await chooser).setFiles(rest)
      await expect(page.getByRole('status').filter({ hasText: '已加入商品圖' })).toBeVisible()
    },
  },
]

/** Where the strip, the picture beside it and the control column landed, measured in the page. */
async function measure(page: Page, panel: string) {
  return page.evaluate((panel) => {
    const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect()
    const list = document.querySelector<HTMLElement>('.image-batch-strip__list')!
    const card = getComputedStyle(document.querySelector('.tool-workspace')!)
    const cardBox = box('.tool-workspace')!
    const pictures = ['.image-batch-strip', '.brand-promo__stage-frame', '.workbench__view', '.image-compressor__stage', '.image-background-remover__stage']
      .flatMap(selector => [...document.querySelectorAll(selector)].map(element => ({ selector, box: element.getBoundingClientRect() })))
      .filter(item => item.box.width > 0)
    const side = box(panel)
    const strip = list.getBoundingClientRect()
    const besides = !!side && side.left > strip.left + 1 && side.top < strip.bottom
    return {
      pageFits: document.documentElement.scrollWidth <= innerWidth,
      stripScrolls: list.scrollWidth > list.clientWidth,
      contentRight: cardBox.right - parseFloat(card.paddingRight) - parseFloat(card.borderRightWidth),
      sideLeft: besides ? side!.left : null,
      pictures: pictures.map(item => ({ selector: item.selector, right: Math.round(item.box.right) })),
    }
  }, panel)
}

for (const tool of tools) {
  test(`${tool.slug}：20 張圖片時縮圖列在自己的欄內捲動，不撐開版面`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await gotoHydrated(page, `/zh-tw/tools/${tool.slug}/`)
    await tool.fill(page)
    await expect(page.getByRole('listbox', { name: '這批圖片' }).getByRole('option')).toHaveCount(20)

    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${viewport.width}px 頁面不能橫向捲動`).toBe(true)
      const found = await measure(page, tool.panel)
      expect(found.stripScrolls, `${viewport.width}px 縮圖列要在自己的欄內捲動`).toBe(true)
      for (const picture of found.pictures) {
        expect(picture.right, `${viewport.width}px ${picture.selector} 不能超出工作區`).toBeLessThanOrEqual(found.contentRight + 1)
        if (found.sideLeft !== null) expect(picture.right, `${viewport.width}px ${picture.selector} 不能壓到右側操作欄`).toBeLessThanOrEqual(found.sideLeft + 1)
      }
    }
  })
}
