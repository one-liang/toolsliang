import { describe, expect, it } from 'vitest'
import {
  compliantImageFormats,
  compliantImagePresets,
  outputCheckVectors,
  presetStatuses,
  presetStatusVectors,
  ruleStateVectors,
  type CompliantImageOutput,
  type CompliantImagePreset,
  type CompliantImagePresetRule,
} from '@/features/tools/compliant-product-image/domain/reference'
import {
  checkOutputAgainstPreset,
  findCompliantImagePreset,
  presetReviewDeadlines,
  resolvePresetStatus,
  resolveRuleState,
  ruleDispositions,
} from '@/features/tools/compliant-product-image/domain/preset'
import {
  parseOutputCheckVectors,
  parsePresetStatusVectors,
  parseRuleStateVectors,
  type DocumentedOutputCheckVector,
} from './support/compliant-product-image-decision-record'

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

/** Adds whole days to an ISO date, staying in UTC so no local zone shifts a boundary. */
function addDays(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)

  return shifted.toISOString().slice(0, 10)
}

const goodGoogleOutput = {
  width: 1500,
  height: 1500,
  format: 'jpeg',
  bytes: 800_000,
} as const satisfies CompliantImageOutput

describe('preset status', () => {
  it('reproduces every documented status vector', () => {
    parsePresetStatusVectors().forEach((vector) => {
      const preset = { ...presetById(vector.presetId), retiredAt: vector.retiredAt ?? undefined }

      expect(resolvePresetStatus(preset, vector.date), `${vector.presetId} on ${vector.date}`)
        .toBe(vector.status)
    })
  })

  it('keeps both review deadlines inclusive', () => {
    compliantImagePresets.forEach((preset) => {
      const { activeUntil, usableUntil } = presetReviewDeadlines(preset)

      expect(resolvePresetStatus(preset, activeUntil), preset.id).toBe('active')
      expect(resolvePresetStatus(preset, addDays(activeUntil, 1))).toBe('review-due')
      expect(resolvePresetStatus(preset, usableUntil)).toBe('review-due')
      expect(resolvePresetStatus(preset, addDays(usableUntil, 1))).toBe('expired')
    })
  })

  it('lets retirement outrank every date-derived status', () => {
    const preset = { ...presetById('google-merchant-center-main'), retiredAt: '2026-09-08' }

    expect(resolvePresetStatus(preset, '2026-09-07')).toBe('active')
    expect(resolvePresetStatus(preset, '2026-09-08')).toBe('retired')
    expect(resolvePresetStatus(preset, '2030-01-01')).toBe('retired')
  })

  it('has every preset active on the day its source was read', () => {
    compliantImagePresets.forEach((preset) => {
      expect(resolvePresetStatus(preset, preset.reviewedAt), preset.id).toBe('active')
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
    compliantImagePresets
      .flatMap(preset => preset.rules)
      .filter(rule => rule.effectiveFrom === undefined)
      .forEach(rule => expect(resolveRuleState(rule, '1970-01-01')).toBe('in-force'))
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
      expect([...outcome.ruleIds.failed].sort(), label).toEqual([...vector.failedRuleIds].sort())
    })
  })

  it('refuses to judge an expired or retired preset instead of using stale rules', () => {
    const preset = presetById('google-merchant-center-main')
    const expiredDay = addDays(presetReviewDeadlines(preset).usableUntil, 1)

    const expired = checkOutputAgainstPreset(preset, goodGoogleOutput, expiredDay)
    expect(expired.result).toBe('unavailable')
    expect(expired.notices).toContain('preset-expired')
    expect(expired.ruleIds.failed).toEqual([])
    expect(expired.ruleIds.passed).toEqual([])

    const retired = checkOutputAgainstPreset(
      { ...preset, retiredAt: '2026-09-01' },
      goodGoogleOutput,
      '2026-09-07',
    )
    expect(retired.result).toBe('unavailable')
    expect(retired.notices).toContain('preset-retired')
  })

  it('still judges a review-due preset, but says so', () => {
    const preset = presetById('google-merchant-center-main')
    const dueDay = addDays(presetReviewDeadlines(preset).activeUntil, 1)
    const outcome = checkOutputAgainstPreset(preset, goodGoogleOutput, dueDay)

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
    expect(outcome.ruleIds.failed).toEqual([])
    expect(outcome.ruleIds.advisory).toContain('recommended-dimensions')
  })

  it('does not enforce a rule before its effective date, and lists it as scheduled', () => {
    const preset = presetById('google-merchant-center-main')
    const small = { width: 400, height: 400, format: 'jpeg', bytes: 200_000 } as const

    const before = checkOutputAgainstPreset(preset, small, '2026-09-07')
    expect(before.ruleIds.failed).not.toContain('min-dimensions')
    expect(before.ruleIds.scheduled).toContain('min-dimensions')
    expect(before.notices).toContain('rule-not-in-force')

    const after = checkOutputAgainstPreset(
      { ...preset, reviewedAt: '2027-02-01' },
      small,
      '2027-02-01',
    )
    expect(after.ruleIds.failed).toContain('min-dimensions')
    expect(after.ruleIds.scheduled).not.toContain('min-dimensions')
  })

  it('hands back every rule it could not judge rather than passing silently', () => {
    const outcome = checkOutputAgainstPreset(
      presetById('momo-store-ad'),
      { width: 1000, height: 1000, format: 'jpeg', bytes: 400_000 },
      '2026-09-07',
    )
    const unjudged = [
      ...outcome.ruleIds.assisted,
      ...outcome.ruleIds.manual,
      ...outcome.ruleIds['out-of-scope'],
    ]

    expect(outcome.result).toBe('pass')
    expect(outcome.notices).toContain('rules-need-your-check')
    expect(unjudged).toContain('background')
    expect(unjudged).toContain('chroma-model')
    expect(unjudged).toContain('no-border')
  })

  it('accounts for every rule of the preset exactly once', () => {
    compliantImagePresets.forEach((preset) => {
      const outcome = checkOutputAgainstPreset(
        preset,
        { width: 1000, height: 1000, format: 'jpeg', bytes: 400_000 },
        preset.reviewedAt,
      )
      const accounted = ruleDispositions.flatMap(disposition => [...outcome.ruleIds[disposition]])

      expect(accounted.sort(), preset.id).toEqual(preset.rules.map(rule => rule.id).sort())
    })
  })
})

describe('vectors cover the decisions that could go wrong', () => {
  it('exports the same vectors the record tabulates', () => {
    expect(presetStatusVectors.length).toBe(parsePresetStatusVectors().length)
    expect(ruleStateVectors.length).toBe(parseRuleStateVectors().length)
    expect(outputCheckVectors.length).toBe(parseOutputCheckVectors().length)
  })

  it('checks at least one output against every preset', () => {
    const covered = new Set(outputCheckVectors.map(vector => vector.presetId))

    compliantImagePresets.forEach(preset => expect(covered.has(preset.id), preset.id).toBe(true))
  })

  it('covers both a passing and a failing output', () => {
    expect(outputCheckVectors.some(vector => vector.result === 'pass')).toBe(true)
    expect(outputCheckVectors.some(vector => vector.result === 'fail')).toBe(true)
  })

  it('reaches every preset status through the status vectors', () => {
    const reached = new Set(presetStatusVectors.map(vector => vector.status))

    expect([...presetStatuses].every(status => reached.has(status))).toBe(true)
  })

  it('only names formats the contract recognises', () => {
    outputCheckVectors.forEach((vector) => {
      expect(compliantImageFormats).toContain(vector.candidate.format)
    })
  })
})
