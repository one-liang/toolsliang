import type { LocaleCode } from '../../app/features/tools/catalog'

/**
 * #82: a tool page explains what the tool does, where its answer comes from and
 * what it cannot do, in words a visitor without a technical background reads
 * the same way. These name how a tool is built — a browser interface, an
 * algorithm, a library or model, a specification — and none of them helps that
 * visitor decide anything. Code comments and docs/research keep them.
 */
export const technicalTerms: Array<{ name: string, pattern: RegExp, locales?: LocaleCode[] }> = [
  { name: 'browser randomness interface', pattern: /getRandomValues|\bcrypto\.|Math\.random/i },
  { name: 'shuffle algorithm', pattern: /Fisher|Yates|Durstenfeld|部分洗牌|partial shuffle/i },
  { name: 'sampling algorithm', pattern: /拒絕取樣|rejection sampling|模數偏差|\bmodulo\b/i },
  { name: 'browser storage interface', pattern: /IndexedDB|localStorage|sessionStorage|Cache Storage|Service Worker|\bPWA\b/i },
  { name: 'standards body or specification', pattern: /WHATWG|\bW3C\b|ECMAScript|\bIntl\b|\bMDN\b|ISO 32000|\bRFC ?\d|NIST SP|Handbook 44/i },
  { name: 'programming interface', pattern: /\bAPI\b|端點|\bendpoints?\b/ },
  { name: 'model runtime', pattern: /ONNX|WebAssembly|\bWASM\b|WebGL|WebGPU|\bruntime\b/i },
  { name: 'drawing interface', pattern: /OffscreenCanvas|ImageBitmap|HTML Canvas|\bCanvas\b/ },
  // English says "canvas" for the artboard a visitor lays out; Chinese copy says 畫布.
  { name: 'drawing interface', pattern: /canvas/i, locales: ['zh-tw'] },
  { name: 'background thread', pattern: /\bWorker\b|背景執行緒|background thread/ },
  { name: 'library or model name', pattern: /pdf\.js|pdfjs|pdf-lib|MODNet/i },
  { name: 'file internals', pattern: /SHA-256|\bEXIF\b|\bXFA\b|增量更新|incremental update|位元組|建置時|build time|烘焙|baked/i },
]

/**
 * Copy another open issue is rewriting. Each entry names the issue, so the
 * exemption goes with the copy it covers; a stale one only stops exempting.
 * `selectors` are workspace blocks that issue removes from the rendered page.
 */
export const rewrittenElsewhere: Array<{ issue: string, slug: string, terms?: string[], selectors?: string[] }> = [
  // The whole tool is being withdrawn.
  { issue: '#89', slug: 'custom-calendar' },
  // The cutout's download, offline and preparation copy (the model version shown beside the download
  // included), which the workbench borrows for its cutout step.
  { issue: '#86', slug: 'image-background-remover', terms: ['model runtime', 'file internals', 'library or model name'] },
  { issue: '#86', slug: 'product-image-workbench', terms: ['model runtime'] },
  // The two explanation blocks inside the random picker workspace.
  { issue: '#83', slug: 'random-picker', selectors: ['.picker-caveats', '.picker-method'] },
  // The two explanation blocks inside the Taiwan calendar workspace.
  { issue: '#88', slug: 'taiwan-calendar', selectors: ['.calendar-caveats', '.calendar-sources'] },
]

export function isRewrittenElsewhere(slug: string) {
  return rewrittenElsewhere.some(entry => entry.slug === slug && !entry.terms && !entry.selectors)
}

export function selectorsRewrittenElsewhere(slug: string) {
  return rewrittenElsewhere.filter(entry => entry.slug === slug).flatMap(entry => entry.selectors ?? [])
}

function exempt(slug: string, termName: string) {
  return rewrittenElsewhere.some(entry => entry.slug === slug && !entry.selectors && (!entry.terms || entry.terms.includes(termName)))
}

/** The technical terms a sentence on a tool's page uses, minus what another issue is already rewriting. */
export function technicalTermsIn(slug: string, text: string, locale?: LocaleCode) {
  return technicalTerms
    .filter(term => !term.locales || (locale && term.locales.includes(locale)))
    .filter(term => term.pattern.test(text) && !exempt(slug, term.name))
    .map(term => term.name)
}
