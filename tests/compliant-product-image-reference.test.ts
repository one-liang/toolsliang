import { describe, expect, it } from 'vitest'
import {
  byteUnitFactor,
  compliantImageChannelIds,
  compliantImageIngestionErrorCodes,
  compliantImagePresets,
  compliantImageRegions,
  compliantImageRoles,
  compliantImageViewNoticeCodes,
  constraintKinds,
  presetCoverageLevels,
  presetReviewGraceDays,
  presetReviewIntervalDays,
  presetStatuses,
  ruleAuthorities,
  ruleStates,
  ruleVerifications,
  type CompliantImagePreset,
  type CompliantImagePresetRule,
} from '@/features/tools/compliant-product-image/domain/reference'
import { automaticConstraintKinds } from '@/features/tools/compliant-product-image/domain/preset'
import {
  compliantImageCaveatKeys,
  compliantImageContentReview,
  compliantImageExcludedChannels,
  compliantImageExclusionReasons,
  compliantImageReferenceVersion,
  compliantImageRetrievabilityLevels,
  compliantImageSources,
  compliantImageSourceTiers,
} from '@/features/tools/compliant-product-image/domain/sources'
import {
  compliantImageDecisionRecord as decisionRecord,
  parseAuthorityKeys,
  parseCaveatKeys,
  parseCaveatSentences,
  parseChannelIds,
  parseConstraintKinds,
  parseCoverageKeys,
  parseExclusionReasonKeys,
  parseExclusions,
  parseFaqQuestions,
  parseForbiddenWording,
  parseIngestionErrorCodes,
  parsePresets,
  parsePresetScopes,
  parsePresetStatusKeys,
  parseRetrievabilityKeys,
  parseRoleKeys,
  parseRules,
  parseRuleStateKeys,
  parseSources,
  parseSourceTiers,
  parseVerificationKeys,
  parseViewNoticeCodes,
  parseViewNoticeSentences,
} from './support/compliant-product-image-decision-record'

/** Every rule of every preset, flattened the way the document tabulates them. */
const allRules = compliantImagePresets.flatMap(preset =>
  preset.rules.map(rule => ({ presetId: preset.id, rule })),
)

function presetById(id: string): CompliantImagePreset {
  const preset = compliantImagePresets.find(candidate => candidate.id === id)
  if (!preset) throw new Error(`No preset ${id}`)

  return preset
}

function ruleOf(presetId: string, ruleId: string): CompliantImagePresetRule {
  const rule = presetById(presetId).rules.find(candidate => candidate.id === ruleId)
  if (!rule) throw new Error(`Preset ${presetId} has no rule ${ruleId}`)

  return rule
}

describe('vocabulary matches the decision record', () => {
  it('publishes exactly the documented channels', () => {
    expect([...compliantImageChannelIds]).toEqual(parseChannelIds())
  })

  it('publishes exactly the documented image roles', () => {
    expect([...compliantImageRoles]).toEqual(parseRoleKeys())
  })

  it('publishes exactly the documented rule authorities', () => {
    expect([...ruleAuthorities]).toEqual(parseAuthorityKeys())
  })

  it('publishes exactly the documented verification levels', () => {
    expect([...ruleVerifications]).toEqual(parseVerificationKeys())
  })

  it('publishes exactly the documented constraint kinds', () => {
    expect([...constraintKinds]).toEqual(parseConstraintKinds())
  })

  it('publishes exactly the documented coverage levels', () => {
    expect([...presetCoverageLevels]).toEqual(parseCoverageKeys())
  })

  it('publishes exactly the documented preset statuses', () => {
    expect([...presetStatuses]).toEqual(parsePresetStatusKeys())
  })

  it('publishes exactly the documented rule states', () => {
    expect([...ruleStates]).toEqual(parseRuleStateKeys())
  })

  it('publishes exactly the documented exclusion reasons', () => {
    expect([...compliantImageExclusionReasons]).toEqual(parseExclusionReasonKeys())
  })

  it('publishes exactly the documented re-check errors', () => {
    expect([...compliantImageIngestionErrorCodes]).toEqual(parseIngestionErrorCodes())
  })

  it('publishes exactly the documented view notices', () => {
    expect([...compliantImageViewNoticeCodes]).toEqual(parseViewNoticeCodes())
  })

  it('publishes exactly the documented source tiers and retrievability levels', () => {
    expect([...compliantImageSourceTiers]).toEqual(parseSourceTiers())
    expect([...compliantImageRetrievabilityLevels]).toEqual(parseRetrievabilityKeys())
  })
})

describe('sources', () => {
  it('carries every documented source with the same url, tier, retrievability and check date', () => {
    const documented = parseSources()

    expect(compliantImageSources.map(source => source.id)).toEqual(documented.map(row => row.id))
    documented.forEach((row) => {
      const source = compliantImageSources.find(candidate => candidate.id === row.id)!

      expect(source.url).toBe(row.url)
      expect(source.tier).toBe(row.tier)
      expect(source.retrievability).toBe(row.retrievability)
      expect(source.checkedAt).toBe(row.checkedAt)
    })
  })

  it('only admits sources a maintainer can re-read without a sign-in or a script block', () => {
    compliantImageSources.forEach((source) => {
      expect(source.retrievability, source.id).toBe('static-html')
    })
  })

  it('names a publisher, a bilingual title and a licence for every source', () => {
    compliantImageSources.forEach((source) => {
      expect(source.publisher['zh-tw'].length).toBeGreaterThan(0)
      expect(source.publisher.en.length).toBeGreaterThan(0)
      expect(source.title['zh-tw'].length).toBeGreaterThan(0)
      expect(source.title.en.length).toBeGreaterThan(0)
      expect(source.licence['zh-tw'].length, source.id).toBeGreaterThan(0)
      expect(source.licence.en.length, source.id).toBeGreaterThan(0)
      expect(source.url.startsWith('https://')).toBe(true)
    })
  })

  it('records the same usage basis for every source, because none is openly licensed', () => {
    compliantImageSources.forEach((source) => {
      expect(source.usage, source.id).toBe('quotation-and-outbound-link')
      expect(source.termsUrl === undefined || source.termsUrl.startsWith('https://')).toBe(true)
    })
  })

  it('states the review version by the date every source was checked', () => {
    const checkDates = [...new Set(compliantImageSources.map(source => source.checkedAt))]

    expect(checkDates).toHaveLength(1)
    expect(compliantImageReferenceVersion).toBe(`compliant-product-image-${checkDates[0]}`)
  })
})

describe('excluded channels', () => {
  it('carries every documented exclusion with the same reason, evidence and recheck date', () => {
    const documented = parseExclusions()

    expect(compliantImageExcludedChannels.map(channel => channel.id))
      .toEqual(documented.map(row => row.channelId))
    documented.forEach((row) => {
      const channel = compliantImageExcludedChannels.find(candidate => candidate.id === row.channelId)!

      expect(channel.reason).toBe(row.reason)
      expect(channel.evidenceUrl).toBe(row.evidenceUrl)
      expect(channel.recheckAt).toBe(row.recheckAt)
    })
  })

  it('never lets an excluded channel also ship a preset', () => {
    const excluded = new Set<string>(compliantImageExcludedChannels.map(channel => channel.id))

    compliantImagePresets.forEach((preset) => {
      expect(excluded.has(preset.channelId), preset.id).toBe(false)
    })
  })

  it('gives every exclusion a reason drawn from the documented list', () => {
    compliantImageExcludedChannels.forEach((channel) => {
      expect(compliantImageExclusionReasons).toContain(channel.reason)
    })
  })
})

describe('presets', () => {
  it('carries every documented preset with the same channel, role, region, source and coverage', () => {
    const documented = parsePresets()

    expect(compliantImagePresets.map(preset => preset.id)).toEqual(documented.map(row => row.id))
    documented.forEach((row) => {
      const preset = presetById(row.id)

      expect(preset.channelId).toBe(row.channelId)
      expect(preset.role).toBe(row.role)
      expect(preset.region).toBe(row.region)
      expect(preset.sourceId).toBe(row.sourceId)
      expect(preset.coverage).toBe(row.coverage)
      expect(preset.reviewedAt).toBe(row.reviewedAt)
    })
  })

  it('carries the documented scope and coverage gaps, in both locales', () => {
    const documented = parsePresetScopes()

    expect(documented.map(row => row.presetId)).toEqual(compliantImagePresets.map(p => p.id))
    documented.forEach((row) => {
      const preset = presetById(row.presetId)

      expect(preset.scope['zh-tw'], row.presetId).toBe(row['zh-tw'])
      expect(preset.scope.en, row.presetId).toBe(row.en)
      expect([...preset.coverageGaps], row.presetId).toEqual(row.coverageGaps)
    })
  })

  it('draws every preset field from the published vocabulary', () => {
    compliantImagePresets.forEach((preset) => {
      expect(compliantImageChannelIds).toContain(preset.channelId)
      expect(compliantImageRoles).toContain(preset.role)
      expect(compliantImageRegions).toContain(preset.region)
      expect(presetCoverageLevels).toContain(preset.coverage)
      preset.coverageGaps.forEach(gap => expect(constraintKinds).toContain(gap))
    })
  })

  it('points every preset at a source this review actually read, on the same day', () => {
    compliantImagePresets.forEach((preset) => {
      const source = compliantImageSources.find(candidate => candidate.id === preset.sourceId)

      expect(source, preset.id).toBeDefined()
      expect(preset.reviewedAt).toBe(source!.checkedAt)
    })
  })

  it('keeps every preset id unique and readable as channel plus role', () => {
    const ids = compliantImagePresets.map(preset => preset.id)

    expect(new Set(ids).size).toBe(ids.length)
    compliantImagePresets.forEach((preset) => {
      expect(preset.id.startsWith(preset.channelId)).toBe(true)
      expect(preset.id.endsWith(preset.role)).toBe(true)
    })
  })

  it('keeps at least one Taiwan channel in the first version', () => {
    expect(compliantImagePresets.some(preset => preset.region === 'tw')).toBe(true)
  })
})

describe('rules', () => {
  it('carries every documented rule with the same kind, authority, verification and value', () => {
    const documented = parseRules()

    expect(allRules.map(entry => `${entry.presetId}/${entry.rule.id}`))
      .toEqual(documented.map(row => `${row.presetId}/${row.ruleId}`))
    documented.forEach((row) => {
      const rule = ruleOf(row.presetId, row.ruleId)

      expect(rule.kind).toBe(row.kind)
      expect(rule.authority).toBe(row.authority)
      expect(rule.verification).toBe(row.verification)
      expect(rule.value).toEqual(row.value)
      expect(rule.effectiveFrom ?? null).toEqual(row.effectiveFrom)
    })
  })

  it('states the same rule count the handover section promises', () => {
    expect(decisionRecord).toContain(`6 個 preset 與 ${allRules.length} 條規則`)
  })

  it('draws every rule field from the published vocabulary', () => {
    allRules.forEach(({ rule }) => {
      expect(constraintKinds).toContain(rule.kind)
      expect(ruleAuthorities).toContain(rule.authority)
      expect(ruleVerifications).toContain(rule.verification)
    })
  })

  it('keeps rule ids unique inside one preset', () => {
    compliantImagePresets.forEach((preset) => {
      const ids = preset.rules.map(rule => rule.id)

      expect(new Set(ids).size, preset.id).toBe(ids.length)
    })
  })

  it('quotes the source sentence behind every rule, so a reworded source fails review', () => {
    allRules.forEach(({ presetId, rule }) => {
      expect(rule.quote.length, `${presetId}/${rule.id}`).toBeGreaterThan(0)
      expect(decisionRecord, `${presetId}/${rule.id}`).toContain(rule.quote)
    })
  })

  it('marks a rule automatic only when its constraint kind can be read off one output file', () => {
    allRules.forEach(({ presetId, rule }) => {
      const isAutomaticKind = automaticConstraintKinds.includes(rule.kind)

      expect(rule.verification === 'automatic', `${presetId}/${rule.id}`).toBe(isAutomaticKind)
    })
  })

  it('never gives a prohibition a value, and never leaves a measured rule without one', () => {
    allRules.forEach(({ presetId, rule }) => {
      if (rule.kind === 'prohibition') {
        expect(Object.keys(rule.value), `${presetId}/${rule.id}`).toEqual([])
      }
      else {
        expect(Object.keys(rule.value).length, `${presetId}/${rule.id}`).toBeGreaterThan(0)
      }
    })
  })

  it('only lets a permission describe something this tool does not do', () => {
    allRules
      .filter(({ rule }) => rule.authority === 'permission')
      .forEach(({ presetId, rule }) => {
        expect(rule.verification, `${presetId}/${rule.id}`).toBe('out-of-scope')
      })
  })

  it('reads every byte limit in decimal units, as the sources write them', () => {
    allRules.forEach(({ presetId, rule }) => {
      if (rule.kind !== 'byte-range') return

      const bounds = [rule.value.min, rule.value.max]
        .filter((bound): bound is number => bound !== undefined)

      expect(bounds.length, `${presetId}/${rule.id}`).toBeGreaterThan(0)
      bounds.forEach(bound => expect(bound % byteUnitFactor).toBe(0))
    })
  })

  it('calls a preset full exactly when its source left no gap', () => {
    compliantImagePresets.forEach((preset) => {
      const kinds = new Set<string>(preset.rules.map(rule => rule.kind))

      expect(preset.coverage === 'full', preset.id).toBe(preset.coverageGaps.length === 0)
      preset.coverageGaps.forEach(gap => expect(kinds.has(gap), `${preset.id}/${gap}`).toBe(false))
    })
  })

  it('never invents a rule the source does not state', () => {
    const ruten = presetById('ruten-main')

    expect(ruten.rules.some(rule => rule.kind === 'dimension-range')).toBe(false)
    expect(ruten.rules.some(rule => rule.kind === 'dimension-exact')).toBe(false)
    expect([...ruten.coverageGaps]).toContain('dimension-range')
  })

  it('carries no safe-area rule, because no reviewed channel publishes one', () => {
    expect(constraintKinds).toContain('safe-area-inset')
    expect(allRules.some(({ rule }) => rule.kind === 'safe-area-inset')).toBe(false)
  })

  it('keeps Amazon occupancy and background as advice, never as a requirement', () => {
    expect(ruleOf('amazon-main', 'product-occupancy').authority).toBe('recommendation')
    expect(ruleOf('amazon-main', 'background').authority).toBe('recommendation')
  })

  it('never reports the momo chroma rule as something one output file proves', () => {
    ;['momo-store-main', 'momo-store-ad'].forEach((presetId) => {
      expect(ruleOf(presetId, 'chroma-model').verification, presetId).toBe('assisted')
    })
  })

  it('keeps the same wording apart when two roles of one channel disagree', () => {
    expect(ruleOf('momo-store-main', 'watermark-placement').authority).toBe('permission')
    expect(ruleOf('momo-store-ad', 'no-watermark').authority).toBe('requirement')
  })
})

describe('review interval', () => {
  it('states the interval and grace period the document fixes', () => {
    expect(presetReviewIntervalDays).toBe(90)
    expect(presetReviewGraceDays).toBe(30)
    expect(decisionRecord).toContain(`${presetReviewIntervalDays} 天`)
    expect(decisionRecord).toContain(`${presetReviewGraceDays} 天`)
  })
})

describe('disclaimers and wording', () => {
  it('publishes exactly the documented caveat keys', () => {
    expect([...compliantImageCaveatKeys]).toEqual(parseCaveatKeys())
  })

  it('states the no-approval-guarantee sentence the product specification fixes', () => {
    const sentence = parseCaveatSentences().find(row => row.key === 'no-approval-guarantee')!

    expect(sentence['zh-tw']).toBe('規格輔助，不保證通路審核通過。')
    expect(sentence.en).toBe('Specification guidance, not a guarantee of channel approval.')
  })

  it('writes every caveat and notice in both locales', () => {
    ;[...parseCaveatSentences(), ...parseViewNoticeSentences()].forEach((row) => {
      expect(row['zh-tw'].length, row.key).toBeGreaterThan(0)
      expect(row.en.length, row.key).toBeGreaterThan(0)
      expect(row['zh-tw']).not.toBe(row.en)
    })
  })

  it('never uses a wording that claims certification or approval', () => {
    const forbidden = parseForbiddenWording()
    const copy = [
      ...parseCaveatSentences().flatMap(row => [row['zh-tw'], row.en]),
      ...parseViewNoticeSentences().flatMap(row => [row['zh-tw'], row.en]),
      ...parseFaqQuestions().flatMap(row => [row['zh-tw'], row.en]),
    ]

    expect(forbidden.length).toBeGreaterThan(0)
    forbidden.forEach((term) => {
      copy.forEach(sentence => expect(sentence.toLowerCase()).not.toContain(term.toLowerCase()))
    })
  })

  it('gives the tool page a bilingual FAQ drawn only from the record', () => {
    const questions = parseFaqQuestions()

    expect(questions.length).toBeGreaterThanOrEqual(4)
    questions.forEach((question) => {
      expect(question['zh-tw'].endsWith('？')).toBe(true)
      expect(question.en.endsWith('?')).toBe(true)
    })
  })

  it('hands T21 a content review naming every source it may cite', () => {
    expect(compliantImageContentReview.reviewedAt).toBe('2026-09-07')
    expect(compliantImageContentReview.sources.map(source => source.url).sort())
      .toEqual(compliantImageSources.map(source => source.url).sort())
  })
})

describe('the record itself', () => {
  it('cites every source url, terms url and exclusion evidence url', () => {
    compliantImageSources.forEach((source) => {
      expect(decisionRecord, source.id).toContain(source.url)
      if (source.termsUrl) expect(decisionRecord, source.id).toContain(source.termsUrl)
    })
    compliantImageExcludedChannels
      .forEach(channel => expect(decisionRecord, channel.id).toContain(channel.evidenceUrl))
  })

  it('states that the research touches no product image and no merchant data', () => {
    expect(decisionRecord).toContain('不需要商品圖片')
  })

  it('links the ADR that keeps compliant and promotional output apart', () => {
    expect(decisionRecord).toContain('0012-separate-compliant-and-promotional-product-images')
  })

  it('names the stable slug T21 has to publish under', () => {
    expect(decisionRecord).toContain('compliant-product-image')
  })
})
