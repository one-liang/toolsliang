import type { Page } from '@playwright/test'

/**
 * Waits for the CSS transitions running on the page to reach their end state.
 *
 * A click leaves the pointer resting on what it clicked, so a primary button
 * starts its hover transition from ink on paper to ink on yellow. Contrast is a
 * property of those two resting states; an accessibility scan started inside
 * the 150 ms between them reads a blend of both and reports a ratio no visitor
 * can hold still long enough to see. Looping animations never finish, so only
 * transitions are awaited.
 */
export async function settleTransitions(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter(animation => 'transitionProperty' in animation)
    .map(animation => animation.finished.catch(() => undefined))))
}
