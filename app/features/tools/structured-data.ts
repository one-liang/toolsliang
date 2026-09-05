import { copy, localeUrl, type LocaleCode, type PublishedToolDefinition } from './catalog'
import { getToolFaq } from './faq'

/**
 * The structured data of one tool page, built from the same registration and
 * the same questions the page renders. It stays a pure function of the tool so
 * the markup can be asserted without mounting the page, and so nothing a
 * visitor types can ever reach it.
 */
export function buildToolStructuredData(
  tool: PublishedToolDefinition,
  locale: LocaleCode,
): Record<string, unknown> {
  const toolUrl = localeUrl(locale, `/tools/${tool.slug}/`)
  const faq = getToolFaq(tool.seo.contentKey, locale)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: copy(tool.name, locale),
        description: copy(tool.seo.description, locale),
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        url: toolUrl,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'TWD' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: locale === 'en' ? 'All tools' : '全部工具',
            item: localeUrl(locale, '/tools/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: copy(tool.name, locale),
            item: toolUrl,
          },
        ],
      },
      ...faq.length
        ? [{
            '@type': 'FAQPage',
            '@id': `${toolUrl}#faq`,
            inLanguage: locale === 'en' ? 'en' : 'zh-Hant-TW',
            mainEntity: faq.map(entry => ({
              '@type': 'Question',
              name: entry.heading,
              acceptedAnswer: { '@type': 'Answer', text: entry.body },
            })),
          }]
        : [],
    ],
  }
}
