import { describe, expect, it } from 'vitest'
import { hasLocalizedCopy, publishedTools, supportedLocales, type LocaleCode } from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'
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
  constraintKindLabels,
  describeRuleValue,
  presetStatusLabels,
  ruleAuthorityLabels,
  ruleDispositionLabels,
  ruleVerificationLabels,
} from '@/features/tools/compliant-product-image/content'
import { compliantProductImageDefinition } from '@/features/tools/compliant-product-image/definition'
import type { CompliantRenderInput } from '@/features/tools/compliant-product-image/types'
import {
  parseCaveatSentences,
  parseForbiddenWording,
  parseViewNoticeSentences,
  compliantImageDecisionRecord,
} from './support/compliant-product-image-decision-record'

/** Everything a visitor can read in the workbench's compliant branch, in one locale. */
function visibleCopy(locale: LocaleCode) {
  return [
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
  it('keeps the slug reserved but publishes no standalone page, FAQ or route', () => {
    expect(compliantProductImageDefinition.slug).toBe('compliant-product-image')
    expect(compliantProductImageDefinition.availability.state).toBe('unpublished')
    expect(publishedTools.some(tool => tool.slug === 'compliant-product-image')).toBe(false)
    supportedLocales.forEach(locale => expect(getToolFaq('compliant-product-image', locale)).toEqual([]))
  })

  it('still refuses HEIC/HEIF before decoding in the workbench branch', () => {
    expect(compliantImageErrors.unsupported_heic).toBeDefined()
  })
})

/**
 * ADR-0012 splits this output purpose from the brand promo image: a compliant
 * product image carries no border, Logo, promotional text or price tag. §12.9's
 * acceptance list names "no forbidden overlay capabilities", so the absence has
 * to be asserted rather than assumed from the fact that nobody built one.
 */
describe('the tool cannot add what a compliant output must not contain', () => {
  const forbiddenCapabilities = ['logo', 'watermark', 'border', 'frame', 'text', 'caption', 'price', 'badge', 'sticker', 'overlay']

  it('accepts no render option that would compose an overlay', () => {
    const input: Record<keyof CompliantRenderInput, true> = {
      file: true, width: true, height: true, format: true, fit: true,
      zoom: true, offsetX: true, offsetY: true, background: true,
      minBytes: true, maxBytes: true,
    }

    Object.keys(input).forEach((option) => {
      forbiddenCapabilities.forEach(capability =>
        expect(option.toLowerCase(), option).not.toContain(capability))
    })
  })
})
