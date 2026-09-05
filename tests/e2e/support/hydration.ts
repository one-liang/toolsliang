import type { Page } from '@playwright/test'

/** Interactive assertions must run after hydration, otherwise clicks reach static markup. */
export async function gotoHydrated(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
  return response
}

export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => Boolean(
    (document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null)?.__vue_app__,
  ))
}

/**
 * A tool page keeps loading after the app has mounted: its workspace is a
 * separate chunk that the registry resolves lazily. Reloading or navigating in
 * between aborts that import, which the browser reports as a page error even
 * though nothing went wrong, so a test that leaves a tool page waits for the
 * workspace itself rather than only for hydration.
 */
export async function gotoToolHydrated(page: Page, route: string) {
  const response = await gotoHydrated(page, route)
  await waitForToolWorkspace(page)
  return response
}

export async function waitForToolWorkspace(page: Page) {
  await page.locator('[data-capability-ready="true"]').waitFor()
  /**
   * The sidebar also prefetches the payload of every tool route it can see.
   * Reloading while those requests are in flight aborts them, which the browser
   * reports as an error even though the next load fetches them again, so a test
   * that is about to reload lets them finish first.
   */
  await page.waitForLoadState('networkidle')
}
