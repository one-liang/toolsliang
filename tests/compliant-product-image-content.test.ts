import { describe, expect, it } from 'vitest'
import { hasLocalizedCopy, publishedTools, supportedLocales } from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'
import { outputSizeIssues } from '@/features/tools/compliant-product-image/domain/render'
import {
  compliantImageErrors,
  compliantImageSizeIssues,
  compliantImageStages,
} from '@/features/tools/compliant-product-image/content'
import { compliantProductImageDefinition } from '@/features/tools/compliant-product-image/definition'

/** Everything the layout step can still say, in both locales. */
const tables = { compliantImageErrors, compliantImageStages, compliantImageSizeIssues }

describe('the layout step says what it can still do', () => {
  it.each(Object.entries(tables))('%s has bilingual copy for every key', (_name, table) => {
    for (const copy of Object.values(table)) expect(hasLocalizedCopy(copy)).toBe(true)
  })

  it('explains every reason a canvas cannot be produced', () => {
    expect(Object.keys(compliantImageSizeIssues).sort()).toEqual([...outputSizeIssues].sort())
  })

  it('still refuses HEIC/HEIF before decoding', () => {
    expect(compliantImageErrors.unsupported_heic).toBeDefined()
  })

  // ADR-0022 removed the channel presets, so no sentence may lean on one.
  it('mentions no channel, preset or compliance check', () => {
    const copy = Object.values(tables).flatMap(table => Object.values(table)).flatMap(entry => [entry['zh-tw'], entry.en])

    for (const text of copy) expect(text).not.toMatch(/通路|合規|規格|channel|preset|complian/i)
  })
})

describe('tool registration', () => {
  it('keeps the slug reserved but publishes no standalone page, FAQ or route', () => {
    expect(compliantProductImageDefinition.slug).toBe('compliant-product-image')
    expect(compliantProductImageDefinition.availability.state).toBe('unpublished')
    expect(publishedTools.some(tool => tool.slug === 'compliant-product-image')).toBe(false)
    supportedLocales.forEach(locale => expect(getToolFaq('compliant-product-image', locale)).toEqual([]))
  })
})
