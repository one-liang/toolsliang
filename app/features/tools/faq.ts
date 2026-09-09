import { brandPromoImageFaq } from './brand-promo-image/content'
import { compliantProductImageFaq } from './compliant-product-image/content'
import { imageBackgroundRemoverFaq } from './image-background-remover/content'
import { imageCompressorFaq } from './image-compressor/content'
import { productImageWorkbenchFaq } from './product-image-workbench/content'
import { customCalendarFaq } from './custom-calendar/content'
import { deviceTimeFaq } from './device-time/content'
import { bmiFaq } from './bmi-calculator/content'
import { ntdFaq } from './ntd-uppercase/content'
import { randomPickerFaq } from './random-picker/content'
import { taiwanCalendarFaq } from './taiwan-calendar/content'
import { hasLocalizedCopy, publishedTools, type LocaleCode, type LocalizedCopy } from './catalog'

/**
 * Questions a tool answers on its own page. A tool registers them under the
 * `seo.contentKey` it already declares, and the page renders the same list it
 * publishes as `FAQPage` structured data — so a question can never be marked up
 * for search without a visitor being able to read it.
 */
export interface ToolFaqEntry {
  heading: LocalizedCopy
  body: LocalizedCopy
}

const toolFaqByContentKey: Record<string, ToolFaqEntry[]> = {
  'brand-promo-image': brandPromoImageFaq,
  'bmi-calculator': bmiFaq,
  'ntd-uppercase': ntdFaq,
  'random-picker': randomPickerFaq,
  'taiwan-calendar': taiwanCalendarFaq,
  'device-time': deviceTimeFaq,
  'image-compressor': imageCompressorFaq,
  'image-background-remover': imageBackgroundRemoverFaq,
  'compliant-product-image': compliantProductImageFaq,
  'product-image-workbench': productImageWorkbenchFaq,
  'custom-calendar': customCalendarFaq,
}

const toolFaqIssues = validateToolFaq()
if (toolFaqIssues.length) {
  throw new Error(`Invalid tool FAQ:\n${toolFaqIssues.join('\n')}`)
}

/** Nothing for a tool that has not had questions reviewed; the page then shows no FAQ. */
export function getToolFaq(contentKey: string, locale: LocaleCode) {
  return (toolFaqByContentKey[contentKey] ?? []).map(entry => ({
    heading: entry.heading[locale],
    body: entry.body[locale],
  }))
}

export function validateToolFaq() {
  const issues: string[] = []
  const contentKeys = new Set(publishedTools.map(tool => tool.seo.contentKey))

  for (const [contentKey, entries] of Object.entries(toolFaqByContentKey)) {
    if (!contentKeys.has(contentKey)) issues.push(`[${contentKey}] questions must belong to a published tool`)
    if (!entries.length) issues.push(`[${contentKey}] registered without a question`)

    for (const [index, entry] of entries.entries()) {
      if (!hasLocalizedCopy(entry.heading) || !hasLocalizedCopy(entry.body)) {
        issues.push(`[${contentKey}:${index}] requires both locales`)
      }
    }
  }

  return issues
}
