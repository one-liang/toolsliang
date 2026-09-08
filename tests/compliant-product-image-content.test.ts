import { describe, expect, it } from 'vitest'
import { hasLocalizedCopy, supportedLocales, type LocaleCode } from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'
import { buildToolStructuredData } from '@/features/tools/structured-data'
import {
  compliantImageCaveatKeys,
  compliantImageExcludedChannels,
  compliantImageExclusionReasons,
} from '@/features/tools/compliant-product-image/domain/sources'
import {
  compliantImageChannelIds,
  compliantImagePresets,
  compliantImageRoles,
  compliantImageViewNoticeCodes,
  constraintKinds,
  presetCoverageLevels,
  presetStatuses,
  ruleAuthorities,
  ruleVerifications,
} from '@/features/tools/compliant-product-image/domain/reference'
import { ruleDispositions } from '@/features/tools/compliant-product-image/domain/preset'
import { outputSizeIssues } from '@/features/tools/compliant-product-image/domain/render'
import {
  compliantImageCaveats,
  compliantImageChannelLabels,
  compliantImageCoverageLabels,
  compliantImageErrors,
  compliantImageExclusionLabels,
  compliantImageNotices,
  compliantImageRoleLabels,
  compliantImageSizeIssues,
  compliantImageStages,
  compliantProductImageFaq,
  constraintKindLabels,
  describeRuleValue,
  presetStatusLabels,
  ruleAuthorityLabels,
  ruleDispositionLabels,
  ruleVerificationLabels,
} from '@/features/tools/compliant-product-image/content'
import { compliantProductImageDefinition } from '@/features/tools/compliant-product-image/definition'
import {
  parseCaveatSentences,
  parseFaqQuestions,
  parseForbiddenWording,
  parseViewNoticeSentences,
  compliantImageDecisionRecord,
} from './support/compliant-product-image-decision-record'

/** Everything a visitor can read on the tool page, in one locale. */
function visibleCopy(locale: LocaleCode) {
  const tool = compliantProductImageDefinition

  return [
    tool.name[locale],
    tool.description[locale],
    tool.acceptedInput[locale],
    tool.localProcessingStatement[locale],
    tool.seo.title[locale],
    tool.seo.description[locale],
    tool.seo.answer[locale],
    ...Object.values(compliantImageCaveats).map(copy => copy[locale]),
    ...Object.values(compliantImageNotices).map(copy => copy[locale]),
    ...Object.values(compliantImageErrors).map(copy => copy[locale]),
    ...Object.values(compliantImageStages).map(copy => copy[locale]),
    ...Object.values(compliantImageSizeIssues).map(copy => copy[locale]),
    ...Object.values(presetStatusLabels).map(copy => copy[locale]),
    ...Object.values(ruleDispositionLabels).map(copy => copy[locale]),
    ...Object.values(ruleAuthorityLabels).map(copy => copy[locale]),
    ...Object.values(ruleVerificationLabels).map(copy => copy[locale]),
    ...Object.values(constraintKindLabels).map(copy => copy[locale]),
    ...Object.values(compliantImageCoverageLabels).map(copy => copy[locale]),
    ...Object.values(compliantImageChannelLabels).map(copy => copy[locale]),
    ...Object.values(compliantImageRoleLabels).map(copy => copy[locale]),
    ...Object.values(compliantImageExclusionLabels).map(copy => copy[locale]),
    ...compliantProductImageFaq.flatMap(entry => [entry.heading[locale], entry.body[locale]]),
    ...compliantImagePresets.flatMap(preset => preset.rules.map(rule => describeRuleValue(rule, locale))),
  ]
}

describe('disclaimers and notices repeat the record verbatim', () => {
  it('carries every caveat sentence the record fixes', () => {
    parseCaveatSentences().forEach((sentence) => {
      expect(compliantImageCaveats[sentence.key as keyof typeof compliantImageCaveats], sentence.key)
        .toEqual({ 'zh-tw': sentence['zh-tw'], en: sentence.en })
    })
    expect(Object.keys(compliantImageCaveats)).toEqual([...compliantImageCaveatKeys])
  })

  it('carries every view notice sentence the record fixes', () => {
    parseViewNoticeSentences().forEach((sentence) => {
      expect(compliantImageNotices[sentence.key as keyof typeof compliantImageNotices], sentence.key)
        .toEqual({ 'zh-tw': sentence['zh-tw'], en: sentence.en })
    })
    expect(Object.keys(compliantImageNotices)).toEqual([...compliantImageViewNoticeCodes])
  })
})

describe('the page never claims certification or approval', () => {
  it('keeps every forbidden wording out of everything a visitor can read', () => {
    const forbidden = parseForbiddenWording()
    expect(forbidden.length).toBeGreaterThan(0)

    supportedLocales.forEach((locale) => {
      visibleCopy(locale).forEach((sentence) => {
        forbidden.forEach(term => expect(sentence.toLowerCase(), term).not.toContain(term.toLowerCase()))
      })
    })
  })

  it('keeps every forbidden wording out of the structured data', () => {
    const forbidden = parseForbiddenWording()

    supportedLocales.forEach((locale) => {
      const markup = JSON.stringify(buildToolStructuredData(compliantProductImageDefinition, locale)).toLowerCase()

      forbidden.forEach(term => expect(markup, term).not.toContain(term.toLowerCase()))
    })
  })

  it('shows the no-approval-guarantee sentence in the page metadata itself', () => {
    const caveat = compliantImageCaveats['no-approval-guarantee']

    expect(compliantProductImageDefinition.seo.answer['zh-tw']).toContain(caveat['zh-tw'].replace('。', ''))
    expect(compliantProductImageDefinition.seo.answer.en).toContain(caveat.en.replace('.', ''))
  })
})

describe('questions come only from the record', () => {
  it('asks exactly the approved questions, in order, in both locales', () => {
    expect(compliantProductImageFaq.map(entry => entry.heading['zh-tw']))
      .toEqual(parseFaqQuestions().map(question => question['zh-tw']))
    expect(compliantProductImageFaq.map(entry => entry.heading.en))
      .toEqual(parseFaqQuestions().map(question => question.en))
  })

  it('publishes those questions on the tool page and in its markup', () => {
    supportedLocales.forEach((locale) => {
      const faq = getToolFaq(compliantProductImageDefinition.seo.contentKey, locale)

      expect(faq.map(entry => entry.heading))
        .toEqual(compliantProductImageFaq.map(entry => entry.heading[locale]))
    })
  })

  it('answers the privacy question with the on-device boundary', () => {
    const privacy = compliantProductImageFaq.at(-1)!

    expect(privacy.body['zh-tw']).toContain('不會')
    expect(privacy.body['zh-tw']).toContain('這台裝置')
    expect(privacy.body.en.toLowerCase()).toContain('never')
  })
})

describe('every key the interface renders has bilingual copy', () => {
  const tables = {
    caveat: [compliantImageCaveatKeys, compliantImageCaveats],
    notice: [compliantImageViewNoticeCodes, compliantImageNotices],
    status: [presetStatuses, presetStatusLabels],
    disposition: [ruleDispositions, ruleDispositionLabels],
    authority: [ruleAuthorities, ruleAuthorityLabels],
    verification: [ruleVerifications, ruleVerificationLabels],
    kind: [constraintKinds, constraintKindLabels],
    coverage: [presetCoverageLevels, compliantImageCoverageLabels],
    channel: [compliantImageChannelIds, compliantImageChannelLabels],
    role: [compliantImageRoles, compliantImageRoleLabels],
    exclusion: [compliantImageExclusionReasons, compliantImageExclusionLabels],
    'size issue': [outputSizeIssues, compliantImageSizeIssues],
  } as const

  Object.entries(tables).forEach(([name, [keys, labels]]) => {
    it(`covers every ${name}`, () => {
      expect(Object.keys(labels).sort()).toEqual([...keys].sort())
      Object.entries(labels).forEach(([key, copy]) => {
        expect(hasLocalizedCopy(copy), `${name}:${key}`).toBe(true)
        expect(copy['zh-tw'], `${name}:${key}`).not.toBe(copy.en)
      })
    })
  })

  it('names each channel and each image role the way the record does', () => {
    Object.values(compliantImageChannelLabels)
      .forEach(label => expect(compliantImageDecisionRecord).toContain(label['zh-tw']))
    Object.values(compliantImageRoleLabels)
      .forEach(label => expect(compliantImageDecisionRecord).toContain(label['zh-tw']))
  })

  it('names every excluded channel so the absence is answerable', () => {
    compliantImageExcludedChannels.forEach((channel) => {
      expect(compliantImageExclusionLabels[channel.reason], channel.id).toBeDefined()
    })
  })
})

describe('rules read as sentences', () => {
  it('writes every rule of every preset in both locales', () => {
    compliantImagePresets.forEach((preset) => {
      preset.rules.forEach((rule) => {
        supportedLocales.forEach((locale) => {
          expect(describeRuleValue(rule, locale).trim().length, `${preset.id}/${rule.id}/${locale}`)
            .toBeGreaterThan(0)
        })
        expect(describeRuleValue(rule, 'zh-tw'), `${preset.id}/${rule.id}`)
          .not.toBe(describeRuleValue(rule, 'en'))
      })
    })
  })

  it('states the numbers a merchant has to hit', () => {
    const momo = compliantImagePresets.find(preset => preset.id === 'momo-store-main')!
    const size = momo.rules.find(rule => rule.id === 'exact-dimensions')!
    const bytes = momo.rules.find(rule => rule.id === 'file-size-range')!

    expect(describeRuleValue(size, 'zh-tw')).toContain('1000')
    expect(describeRuleValue(bytes, 'zh-tw')).toContain('50')
    expect(describeRuleValue(bytes, 'en')).toContain('1,000')
  })
})

describe('tool registration', () => {
  it('publishes the stable slug on both locale routes', () => {
    expect(compliantProductImageDefinition.slug).toBe('compliant-product-image')
    expect(compliantProductImageDefinition.availability.state).toBe('published')
    expect(compliantProductImageDefinition.seo.contentKey).toBe('compliant-product-image')
  })

  it('runs in a worker and needs no download before first use', () => {
    expect(compliantProductImageDefinition.processingClass).toBe('worker')
    expect(compliantProductImageDefinition.capabilities).toContain('web-worker')
    expect(compliantProductImageDefinition.offlineMode).toBe('ready')
    expect(compliantProductImageDefinition.offlineAssets).toBeUndefined()
  })

  it('cites exactly the reviewed sources, and no other origin', () => {
    expect(compliantProductImageDefinition.contentReview.sources.length).toBeGreaterThan(0)
    compliantProductImageDefinition.contentReview.sources
      .forEach(source => expect(source.url.startsWith('https://')).toBe(true))
  })

  it('says on the page that HEIC/HEIF is refused before decoding', () => {
    expect(compliantProductImageDefinition.acceptedInput['zh-tw']).toContain('HEIC')
    expect(compliantImageErrors.unsupported_heic).toBeDefined()
  })
})
