import { expect, test } from '@playwright/test'
import { publishedTools, supportedLocales } from '../../app/features/tools/catalog'
import { isRewrittenElsewhere, selectorsRewrittenElsewhere, technicalTermsIn } from '../support/technical-terms'
import { gotoHydrated } from './support/hydration'

/**
 * #82, on the page a visitor actually gets: every word inside the tool page —
 * workspace, closed disclosures and the sections below included — read as one
 * text. The unit test checks the copy modules; this one also catches a sentence
 * written straight into a template.
 */
for (const tool of publishedTools.filter(candidate => !isRewrittenElsewhere(candidate.slug))) {
  for (const locale of supportedLocales) {
    test(`${tool.slug}（${locale}）的工具頁不出現 API、演算法、程式庫或規格名稱`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', '頁面文字與瀏覽器引擎無關，只在 Chromium 掃描一次')

      await gotoHydrated(page, `/${locale}/tools/${tool.slug}/`)
      const sentences = await page.locator('main').evaluate((main, skipped) => {
        const copy = main.cloneNode(true) as HTMLElement
        for (const selector of skipped) copy.querySelectorAll(selector).forEach(node => node.remove())
        // Every text node is read with the block around it, so a hit names the sentence it came from.
        const blocks = new Set<string>()
        const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) continue
          const block = node.parentElement?.closest('p, li, dt, dd, h1, h2, h3, label, legend, button, a, th, td, summary, div') ?? node.parentElement
          blocks.add(block?.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        }
        return [...blocks].filter(Boolean)
      }, selectorsRewrittenElsewhere(tool.slug))

      expect(sentences.length).toBeGreaterThan(5)
      const found = sentences.flatMap(text => technicalTermsIn(tool.slug, text, locale).map(term => `${term}｜${text}`))
      expect(found).toEqual([])
    })
  }
}
