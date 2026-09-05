import { bmiFaq } from './bmi-calculator/content'
import { publishedTools, type LocaleCode, type LocalizedCopy } from './catalog'

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
  'bmi-calculator': bmiFaq,
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
      if (!entry.heading['zh-tw']?.trim() || !entry.heading.en?.trim() || !entry.body['zh-tw']?.trim() || !entry.body.en?.trim()) {
        issues.push(`[${contentKey}:${index}] requires both locales`)
      }
    }
  }

  return issues
}
