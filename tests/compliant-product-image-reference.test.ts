import { describe, expect, it } from 'vitest'
import {
  byteUnitFactor,
  compliantImageChannelIds,
  compliantImageFormats,
  compliantImageIngestionErrorCodes,
  compliantImagePresets,
  compliantImageRegions,
  compliantImageRoles,
  compliantImageViewNoticeCodes,
  constraintKinds,
  outputCheckVectors,
  presetCoverageLevels,
  presetReviewGraceDays,
  presetReviewIntervalDays,
  presetStatuses,
  presetStatusVectors,
  ruleAuthorities,
  ruleStates,
  ruleStateVectors,
  ruleVerifications,
  type CompliantImageOutput,
  type CompliantImagePreset,
  type CompliantImagePresetRule,
} from '@/features/tools/compliant-product-image/domain/reference'
import {
  automaticConstraintKinds,
  checkOutputAgainstPreset,
  findCompliantImagePreset,
  resolvePresetStatus,
  resolveRuleState,
} from '@/features/tools/compliant-product-image/domain/preset'
import {
  compliantImageCaveatKeys,
  compliantImageContentReview,
  compliantImageExcludedChannels,
  compliantImageExclusionReasons,
  compliantImageReferenceVersion,
  compliantImageSourceRetrievability,
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
  parseOutputCheckVectors,
  parsePresets,
  parsePresetStatusKeys,
  parsePresetStatusVectors,
  parseRetrievabilityKeys,
  parseRoleKeys,
  parseRules,
  parseRuleStateKeys,
  parseRuleStateVectors,
  parseSources,
  parseSourceTiers,
  parseVerificationKeys,
  parseViewNoticeCodes,
  parseViewNoticeSentences,
  type DocumentedOutputCheckVector,
} from './support/compliant-product-image-decision-record'

/** Every rule of every preset, flattened the way the document tabulates them. */
const allRules = compliantImagePresets.flatMap(preset =>
  preset.rules.map(rule => ({ presetId: preset.id, rule })),
)

function presetById(id: string): CompliantImagePreset {
  const preset = findCompliantImagePreset(id)
  if (!preset) throw new Error(`No preset ${id}`)

  return preset
}

function ruleOf(presetId: string, ruleId: string): CompliantImagePresetRule {
  const rule = presetById(presetId).rules.find(candidate => candidate.id === ruleId)
  if (!rule) throw new Error(`Preset ${presetId} has no rule ${ruleId}`)

  return rule
}

/** Rejects a documented candidate whose format is outside the published vocabulary. */
function toOutput(candidate: DocumentedOutputCheckVector['candidate']): CompliantImageOutput {
  const format = compliantImageFormats.find(known => known === candidate.format)
  if (!format) throw new Error(`Unknown output format ${candidate.format}`)

  return { ...candidate, format }
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
    expect([...compliantImageSourceRetrievability]).toEqual(parseRetrievabilityKeys())
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
      expect(source.retrievability).toBe('static-html')
    })
  })

  it('names a publisher and a bilingual title for every source', () => {
    compliantImageSources.forEach((source) => {
      expect(source.publisher['zh-tw'].length).toBeGreaterThan(0)
      expect(source.publisher.en.length).toBeGreaterThan(0)
      expect(source.title['zh-tw'].length).toBeGreaterThan(0)
      expect(source.title.en.length).toBeGreaterThan(0)
      expect(source.url.startsWith('https://')).toBe(true)
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
    const excluded = new Set(compliantImageExcludedChannels.map(channel => channel.id))

    compliantImagePresets.forEach((preset) => {
      expect(excluded.has(preset.channelId)).toBe(false)
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

  it('draws every preset field from the published vocabulary', () => {
    compliantImagePresets.forEach((preset) => {
      expect(compliantImageChannelIds).toContain(preset.channelId)
      expect(compliantImageRoles).toContain(preset.role)
      expect(compliantImageRegions).toContain(preset.region)
      expect(presetCoverageLevels).toContain(preset.coverage)
    })
  })

  it('points every preset at a source this review actually read', () => {
    const sourceIds = new Set(compliantImageSources.map(source => source.id))

    compliantImagePresets.forEach((preset) => {
      expect(sourceIds.has(preset.sourceId)).toBe(true)
      expect(preset.reviewedAt)
        .toBe(compliantImageSources.find(source => source.id === preset.sourceId)!.checkedAt)
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

      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  it('quotes the source sentence behind every rule, so a reworded source fails review', () => {
    allRules.forEach(({ presetId, rule }) => {
      expect(rule.quote.length, `${presetId}/${rule.id}`).toBeGreaterThan(0)
      expect(decisionRecord).toContain(rule.quote)
    })
  })

  it('marks a rule automatic only when its constraint kind can be read off one output file', () => {
    allRules.forEach(({ presetId, rule }) => {
      if (rule.verification === 'automatic') {
        expect(automaticConstraintKinds, `${presetId}/${rule.id}`).toContain(rule.kind)
      }
      else {
        expect(automaticConstraintKinds).not.toContain(rule.kind)
      }
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

  it('marks a full preset as one whose source states dimensions, capacity and formats', () => {
    compliantImagePresets.forEach((preset) => {
      const kinds = new Set(preset.rules.map(rule => rule.kind))
      const statesEverything = ['dimension-range', 'dimension-exact', 'longest-side-range']
        .some(kind => kinds.has(kind as CompliantImagePresetRule['kind']))
        && kinds.has('byte-range')
        && kinds.has('format-set')

      expect(preset.coverage === 'full', preset.id).toBe(statesEverything)
    })
  })

  it('never invents a rule the source does not state', () => {
    const ruten = presetById('ruten-main')

    expect(ruten.rules.some(rule => rule.kind === 'dimension-range')).toBe(false)
    expect(ruten.rules.some(rule => rule.kind === 'dimension-exact')).toBe(false)
    expect(ruten.coverage).toBe('partial')
  })

  it('keeps Amazon occupancy and background as advice, never as a requirement', () => {
    const occupancy = ruleOf('amazon-main', 'product-occupancy')
    const background = ruleOf('amazon-main', 'background')

    expect(occupancy.authority).toBe('recommendation')
    expect(background.authority).toBe('recommendation')
  })

  it('keeps the same wording apart when two roles of one channel disagree', () => {
    const mainWatermark = ruleOf('momo-store-main', 'watermark-placement')
    const adWatermark = ruleOf('momo-store-ad', 'no-watermark')

    expect(mainWatermark.authority).toBe('permission')
    expect(adWatermark.authority).toBe('requirement')
  })
})

describe('review interval and preset status', () => {
  it('states a review interval and grace period the document fixes', () => {
    expect(presetReviewIntervalDays).toBe(90)
    expect(presetReviewGraceDays).toBe(30)
    expect(decisionRecord).toContain(`${presetReviewIntervalDays} 天`)
    expect(decisionRecord).toContain(`${presetReviewGraceDays} 天`)
  })

  it('reproduces every documented status vector', () => {
    parsePresetStatusVectors().forEach((vector) => {
      const preset = { ...presetById(vector.presetId), retiredAt: vector.retiredAt ?? undefined }

      expect(resolvePresetStatus(preset, vector.date), `${vector.presetId} on ${vector.date}`)
        .toBe(vector.status)
    })
  })

  it('turns a preset review-due the day after its interval and expired after the grace period', () => {
    compliantImagePresets.forEach((preset) => {
      const dueDay = addDays(preset.reviewedAt, presetReviewIntervalDays)
      const expiryDay = addDays(preset.reviewedAt, presetReviewIntervalDays + presetReviewGraceDays)

      expect(resolvePresetStatus(preset, dueDay)).toBe('active')
      expect(resolvePresetStatus(preset, addDays(dueDay, 1))).toBe('review-due')
      expect(resolvePresetStatus(preset, expiryDay)).toBe('review-due')
      expect(resolvePresetStatus(preset, addDays(expiryDay, 1))).toBe('expired')
    })
  })

  it('lets retirement outrank every date-derived status', () => {
    const preset = { ...presetById('google-merchant-center-main'), retiredAt: '2026-09-08' }

    expect(resolvePresetStatus(preset, '2026-09-07')).toBe('active')
    expect(resolvePresetStatus(preset, '2026-09-08')).toBe('retired')
    expect(resolvePresetStatus(preset, '2030-01-01')).toBe('retired')
  })

  it('has every preset active on the review date', () => {
    compliantImagePresets.forEach((preset) => {
      expect(resolvePresetStatus(preset, preset.reviewedAt)).toBe('active')
    })
  })
})

describe('rule effective dates', () => {
  it('reproduces every documented rule state vector', () => {
    parseRuleStateVectors().forEach((vector) => {
      expect(
        resolveRuleState(ruleOf(vector.presetId, vector.ruleId), vector.date),
        `${vector.presetId}/${vector.ruleId} on ${vector.date}`,
      ).toBe(vector.state)
    })
  })

  it('treats a rule without an effective date as always in force', () => {
    allRules
      .filter(({ rule }) => rule.effectiveFrom === undefined)
      .forEach(({ rule }) => {
        expect(resolveRuleState(rule, '1970-01-01')).toBe('in-force')
      })
  })
})

describe('checking one output against a preset', () => {
  it('reproduces every documented output check vector', () => {
    parseOutputCheckVectors().forEach((vector) => {
      const outcome = checkOutputAgainstPreset(
        presetById(vector.presetId),
        toOutput(vector.candidate),
        vector.date,
      )
      const label = `${vector.presetId} on ${vector.date}`

      expect(outcome.result, label).toBe(vector.result)
      expect([...outcome.failedRuleIds].sort(), label).toEqual([...vector.failedRuleIds].sort())
    })
  })

  it('refuses to judge an expired or retired preset instead of using stale rules', () => {
    const preset = presetById('google-merchant-center-main')
    const expiredDay = addDays(preset.reviewedAt, presetReviewIntervalDays + presetReviewGraceDays + 1)
    const good = { width: 1500, height: 1500, format: 'jpeg' as const, bytes: 800_000 }

    const expired = checkOutputAgainstPreset(preset, good, expiredDay)
    expect(expired.result).toBe('unavailable')
    expect(expired.notices).toContain('preset-expired')
    expect(expired.failedRuleIds).toEqual([])

    const retired = checkOutputAgainstPreset(
      { ...preset, retiredAt: '2026-09-01' },
      good,
      '2026-09-07',
    )
    expect(retired.result).toBe('unavailable')
    expect(retired.notices).toContain('preset-retired')
  })

  it('still judges a review-due preset, but says so', () => {
    const preset = presetById('google-merchant-center-main')
    const dueDay = addDays(preset.reviewedAt, presetReviewIntervalDays + 1)
    const outcome = checkOutputAgainstPreset(
      preset,
      { width: 1500, height: 1500, format: 'jpeg', bytes: 800_000 },
      dueDay,
    )

    expect(outcome.result).toBe('pass')
    expect(outcome.notices).toContain('preset-review-due')
  })

  it('never fails an output on a recommendation, and reports it as advice instead', () => {
    const outcome = checkOutputAgainstPreset(
      presetById('google-merchant-center-main'),
      { width: 800, height: 800, format: 'jpeg', bytes: 400_000 },
      '2026-09-07',
    )

    expect(outcome.result).toBe('pass')
    expect(outcome.failedRuleIds).toEqual([])
    expect(outcome.advisoryRuleIds).toContain('recommended-dimensions')
  })

  it('does not enforce a rule before its effective date, and lists it as scheduled', () => {
    const preset = presetById('google-merchant-center-main')
    const small = { width: 400, height: 400, format: 'jpeg' as const, bytes: 200_000 }

    const before = checkOutputAgainstPreset(preset, small, '2026-09-07')
    expect(before.failedRuleIds).not.toContain('min-dimensions')
    expect(before.scheduledRuleIds).toContain('min-dimensions')

    const after = checkOutputAgainstPreset(
      { ...preset, reviewedAt: '2027-02-01' },
      small,
      '2027-02-01',
    )
    expect(after.failedRuleIds).toContain('min-dimensions')
    expect(after.scheduledRuleIds).not.toContain('min-dimensions')
  })

  it('lists every rule it could not judge rather than passing silently', () => {
    const preset = presetById('momo-store-ad')
    const outcome = checkOutputAgainstPreset(
      preset,
      { width: 1000, height: 1000, format: 'jpeg', bytes: 400_000 },
      '2026-09-07',
    )
    const unjudged = [
      ...outcome.assistedRuleIds,
      ...outcome.manualRuleIds,
      ...outcome.outOfScopeRuleIds,
    ]

    expect(outcome.result).toBe('pass')
    expect(outcome.notices).toContain('rules-need-your-check')
    expect(unjudged).toContain('background')
    expect(unjudged).toContain('no-border')
  })

  it('accounts for every rule of the preset exactly once', () => {
    compliantImagePresets.forEach((preset) => {
      const outcome = checkOutputAgainstPreset(
        preset,
        { width: 1000, height: 1000, format: 'jpeg', bytes: 400_000 },
        preset.reviewedAt,
      )
      const accounted = [
        ...outcome.passedRuleIds,
        ...outcome.failedRuleIds,
        ...outcome.advisoryRuleIds,
        ...outcome.assistedRuleIds,
        ...outcome.manualRuleIds,
        ...outcome.outOfScopeRuleIds,
        ...outcome.scheduledRuleIds,
      ]

      expect(accounted.sort(), preset.id).toEqual(preset.rules.map(rule => rule.id).sort())
    })
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
  it('cites every source url and every exclusion evidence url', () => {
    compliantImageSources.forEach(source => expect(decisionRecord).toContain(source.url))
    compliantImageExcludedChannels
      .forEach(channel => expect(decisionRecord).toContain(channel.evidenceUrl))
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

/** Adds whole days to an ISO date, staying in UTC so no local zone shifts a boundary. */
function addDays(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)

  return shifted.toISOString().slice(0, 10)
}

describe('vectors cover the decisions that could go wrong', () => {
  it('exports the same vectors the record tabulates', () => {
    expect(presetStatusVectors.length).toBe(parsePresetStatusVectors().length)
    expect(ruleStateVectors.length).toBe(parseRuleStateVectors().length)
    expect(outputCheckVectors.length).toBe(parseOutputCheckVectors().length)
  })

  it('checks at least one output against every preset', () => {
    const covered = new Set(outputCheckVectors.map(vector => vector.presetId))

    compliantImagePresets.forEach(preset => expect(covered.has(preset.id)).toBe(true))
  })

  it('covers both a passing and a failing output', () => {
    expect(outputCheckVectors.some(vector => vector.result === 'pass')).toBe(true)
    expect(outputCheckVectors.some(vector => vector.result === 'fail')).toBe(true)
  })

  it('reaches every preset status through the status vectors', () => {
    const reached = new Set(presetStatusVectors.map(vector => vector.status))

    expect([...presetStatuses].every(status => reached.has(status))).toBe(true)
  })

  it('only names formats the platform can decode or encode', () => {
    outputCheckVectors.forEach((vector) => {
      expect(compliantImageFormats).toContain(vector.candidate.format)
    })
  })
})
