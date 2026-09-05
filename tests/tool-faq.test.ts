import { describe, expect, it } from 'vitest'
import { getToolFaq, validateToolFaq } from '@/features/tools/faq'
import { buildToolStructuredData } from '@/features/tools/structured-data'
import { getTool, supportedLocales } from '@/features/tools/catalog'

function graphOf(slug: string, locale: 'zh-tw' | 'en') {
  return buildToolStructuredData(getTool(slug)!, locale)['@graph'] as Array<Record<string, unknown>>
}

describe('tool faq registry', () => {
  it('passes its own validation', () => {
    expect(validateToolFaq()).toEqual([])
  })

  it('localizes the questions a tool answers on its own page', () => {
    const chinese = getToolFaq('bmi-calculator', 'zh-tw')
    const english = getToolFaq('bmi-calculator', 'en')

    expect(chinese).toHaveLength(8)
    expect(english).toHaveLength(chinese.length)
    expect(chinese[0]!.heading).not.toBe(english[0]!.heading)
    for (const entry of [...chinese, ...english]) {
      expect(entry.heading.trim()).not.toBe('')
      expect(entry.body.trim()).not.toBe('')
    }
  })

  it('registers the questions of every published tool under its own content key', () => {
    expect(getToolFaq('ntd-uppercase', 'zh-tw')).toHaveLength(9)
    expect(getToolFaq('ntd-uppercase', 'en')[0]!.heading).not.toBe(getToolFaq('ntd-uppercase', 'zh-tw')[0]!.heading)
  })

  it('leaves a tool without approved questions with none', () => {
    expect(getToolFaq('a-content-key-that-does-not-exist', 'zh-tw')).toEqual([])
  })
})

describe('tool structured data', () => {
  it('describes the tool and its breadcrumb trail per locale', () => {
    expect(graphOf('bmi-calculator', 'en')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        '@type': 'WebApplication',
        name: 'BMI Calculator',
        url: 'https://toolsliang.com/en/tools/bmi-calculator/',
      }),
      expect.objectContaining({ '@type': 'BreadcrumbList' }),
    ]))

    const breadcrumb = graphOf('bmi-calculator', 'zh-tw')
      .find(node => node['@type'] === 'BreadcrumbList')!.itemListElement as Array<Record<string, unknown>>
    expect(breadcrumb.map(item => item.item)).toEqual([
      'https://toolsliang.com/zh-tw/tools/',
      'https://toolsliang.com/zh-tw/tools/bmi-calculator/',
    ])
  })

  it('publishes only questions the page shows, in the language it shows them', () => {
    for (const locale of supportedLocales) {
      const faq = getToolFaq('bmi-calculator', locale)
      const mainEntity = graphOf('bmi-calculator', locale)
        .find(node => node['@type'] === 'FAQPage')!.mainEntity as Array<Record<string, never>>

      expect(mainEntity.map(entry => entry.name)).toEqual(faq.map(entry => entry.heading))
      expect(mainEntity.map(entry => (entry.acceptedAnswer as Record<string, string>).text))
        .toEqual(faq.map(entry => entry.body))
    }
  })

  it('omits the FAQ node for a tool that answers no questions', () => {
    const tool = getTool('ntd-uppercase')!
    const unreviewed = { ...tool, seo: { ...tool.seo, contentKey: 'a-content-key-that-does-not-exist' } }
    const graph = buildToolStructuredData(unreviewed, 'zh-tw')['@graph'] as Array<Record<string, unknown>>

    expect(graph.map(node => node['@type'])).toEqual(['WebApplication', 'BreadcrumbList'])
  })
})
