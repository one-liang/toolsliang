/**
 * Reads what a prerendered App Shell page needs in order to boot from the
 * cache. Precaching the HTML alone is not enough: without its route chunk the
 * page loads offline and then fails to hydrate, which is worse than an honest
 * offline explanation.
 */

const SHELL_ASSET_REFERENCE = /(?:href|src)="(\/_nuxt\/[^"?#]+)"/g
const CSS_FONT_REFERENCE = /url\(\s*["']?([^"')\s]+\.woff2)["']?\s*\)/g

/**
 * Latin is the only script the supported locales render from a downloaded font;
 * Traditional Chinese uses the fonts already on the device. The other subsets
 * the font package ships stay online-only.
 */
const PRECACHED_FONT_SUBSET = '-latin-'

export function extractShellAssets(html: string): string[] {
  return [...new Set([...html.matchAll(SHELL_ASSET_REFERENCE)].map(match => match[1]!))]
}

/**
 * Fonts are declared inside the stylesheet rather than the page, so they are
 * read from the precached CSS and resolved against its own URL. If the font
 * package ever renames its subsets, this over-caches instead of silently
 * leaving an offline visitor with a fallback font.
 */
export function extractShellFonts(css: string, cssUrl: string): string[] {
  const referenced = [...new Set([...css.matchAll(CSS_FONT_REFERENCE)]
    .map(match => resolveAgainst(match[1]!, cssUrl))
    .filter((url): url is string => Boolean(url)))]

  const forSupportedLocales = referenced.filter(url => url.includes(PRECACHED_FONT_SUBSET))
  return forSupportedLocales.length ? forSupportedLocales : referenced
}

function resolveAgainst(reference: string, cssUrl: string) {
  try {
    return new URL(reference, cssUrl).pathname
  }
  catch {
    return undefined
  }
}
