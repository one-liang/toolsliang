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
