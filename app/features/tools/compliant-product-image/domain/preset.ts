import {
  compliantImagePresets,
  presetReviewGraceDays,
  presetReviewIntervalDays,
  type CompliantImageOutput,
  type CompliantImagePreset,
  type CompliantImagePresetRule,
  type CompliantImageViewNoticeCode,
  type ConstraintKind,
  type PresetStatus,
  type RuleState,
} from './reference'

/**
 * Behaviour of the preset model: how old a preset is allowed to be, when a rule
 * starts binding, and what one produced image can honestly be said to satisfy.
 *
 * The one thing this module refuses to do is answer "does it comply". It sorts
 * a preset's rules into what it checked, what it could only assist with, and
 * what only the user can judge, and it hands back all three. A caller that
 * shows a single green tick is misreading the result, not the channel.
 *
 * Every rule is fixed by docs/research/005-compliant-product-image-presets-and-sources.md.
 */

/**
 * The constraint kinds that can be decided from one output file alone. §4.5 of
 * the decision record binds each kind to exactly one verification level, so a
 * kind is either always automatic or never automatic.
 */
export const automaticConstraintKinds = [
  'dimension-exact',
  'dimension-range',
  'longest-side-range',
  'aspect-ratio-exact',
  'aspect-ratio-range',
  'megapixel-max',
  'byte-range',
  'format-set',
  'chroma-model',
] as const satisfies readonly ConstraintKind[]

/** Two ratios written as decimals never land on the same float, so compare with a tolerance. */
const aspectRatioTolerance = 1e-6

export function findCompliantImagePreset(id: string): CompliantImagePreset | undefined {
  return compliantImagePresets.find(preset => preset.id === id)
}

/** Adds whole days to an ISO date in UTC, so no local zone can shift a deadline. */
function addDays(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)

  return shifted.toISOString().slice(0, 10)
}

/**
 * Where a preset stands on `today`. Retirement wins over every date-derived
 * status: a preset whose source is gone must not become usable again just
 * because someone re-read it yesterday. The deadlines are inclusive — a preset
 * reviewed 90 days ago is still active on the ninetieth day.
 */
export function resolvePresetStatus(
  preset: Pick<CompliantImagePreset, 'reviewedAt' | 'retiredAt'>,
  today: string,
): PresetStatus {
  if (preset.retiredAt !== undefined && today >= preset.retiredAt) return 'retired'
  if (today > addDays(preset.reviewedAt, presetReviewIntervalDays + presetReviewGraceDays)) {
    return 'expired'
  }
  if (today > addDays(preset.reviewedAt, presetReviewIntervalDays)) return 'review-due'

  return 'active'
}

/** A rule with no effective date binds from the beginning; one with a future date does not yet. */
export function resolveRuleState(
  rule: Pick<CompliantImagePresetRule, 'effectiveFrom'>,
  today: string,
): RuleState {
  if (rule.effectiveFrom === undefined) return 'in-force'

  return today >= rule.effectiveFrom ? 'in-force' : 'scheduled'
}

/** Whether one automatic rule is satisfied by one output. */
function isSatisfied(rule: CompliantImagePresetRule, output: CompliantImageOutput): boolean {
  const longestSide = Math.max(output.width, output.height)

  switch (rule.kind) {
    case 'dimension-exact':
      return output.width === rule.value.width && output.height === rule.value.height
    case 'dimension-range':
      return withinRange(output.width, rule.value.minWidth, rule.value.maxWidth)
        && withinRange(output.height, rule.value.minHeight, rule.value.maxHeight)
    case 'longest-side-range':
      return withinRange(longestSide, rule.value.min, rule.value.max)
    case 'aspect-ratio-exact':
      return Math.abs(output.width / output.height - rule.value.ratio) <= aspectRatioTolerance
    case 'aspect-ratio-range':
      return withinRange(output.width / output.height, rule.value.min, rule.value.max)
    case 'megapixel-max':
      return output.width * output.height <= rule.value.max * 1_000_000
    case 'byte-range':
      return withinRange(output.bytes, rule.value.min, rule.value.max)
    case 'format-set':
      return rule.value.formats.includes(output.format)
    case 'chroma-model':
      // YCbCr is what a JPEG encoder produces; every other output format is RGB.
      return rule.value.model === 'YCbCr' && output.format === 'jpeg'
    default:
      throw new Error(`${rule.id} is not a rule one output file can decide`)
  }
}

function withinRange(value: number, min: number | undefined, max: number | undefined) {
  return (min === undefined || value >= min) && (max === undefined || value <= max)
}

/**
 * Every rule of the preset, sorted into what happened to it. The seven lists
 * partition the preset's rules: a caller can render all of them and know it has
 * shown the user everything the channel asked for.
 */
export interface PresetCheckOutcome {
  status: PresetStatus
  /** `unavailable` when the preset is disabled — never a verdict from stale rules. */
  result: 'pass' | 'fail' | 'unavailable'
  notices: readonly CompliantImageViewNoticeCode[]
  passedRuleIds: readonly string[]
  failedRuleIds: readonly string[]
  /** Recommendations the output does not meet. They never turn the result into a failure. */
  advisoryRuleIds: readonly string[]
  /** Rules the tool can only draw an overlay for, such as product occupancy. */
  assistedRuleIds: readonly string[]
  /** Rules only the user can judge, such as promotional text. */
  manualRuleIds: readonly string[]
  /** Rules about something this tool deliberately does not do. */
  outOfScopeRuleIds: readonly string[]
  /** Announced rules that do not bind yet. */
  scheduledRuleIds: readonly string[]
}

const emptyOutcome = {
  passedRuleIds: [],
  failedRuleIds: [],
  advisoryRuleIds: [],
  assistedRuleIds: [],
  manualRuleIds: [],
  outOfScopeRuleIds: [],
  scheduledRuleIds: [],
} as const

/**
 * Checks one produced image against one preset on one day.
 *
 * A disabled preset returns `unavailable` rather than a verdict: judging an
 * output against rules nobody has re-read is worse than saying nothing, because
 * the user would act on it. Only in-force requirements the tool can verify can
 * produce a failure; an unmet recommendation is advice, and anything the tool
 * cannot see is handed back for the user to check.
 */
export function checkOutputAgainstPreset(
  preset: CompliantImagePreset,
  output: CompliantImageOutput,
  today: string,
): PresetCheckOutcome {
  const status = resolvePresetStatus(preset, today)

  if (status === 'retired' || status === 'expired') {
    return {
      ...emptyOutcome,
      status,
      result: 'unavailable',
      notices: [status === 'retired' ? 'preset-retired' : 'preset-expired'],
    }
  }

  const passedRuleIds: string[] = []
  const failedRuleIds: string[] = []
  const advisoryRuleIds: string[] = []
  const assistedRuleIds: string[] = []
  const manualRuleIds: string[] = []
  const outOfScopeRuleIds: string[] = []
  const scheduledRuleIds: string[] = []

  preset.rules.forEach((rule) => {
    if (resolveRuleState(rule, today) === 'scheduled') {
      scheduledRuleIds.push(rule.id)

      return
    }

    if (rule.verification === 'assisted') return void assistedRuleIds.push(rule.id)
    if (rule.verification === 'manual') return void manualRuleIds.push(rule.id)
    if (rule.verification === 'out-of-scope') return void outOfScopeRuleIds.push(rule.id)

    if (isSatisfied(rule, output)) passedRuleIds.push(rule.id)
    else if (rule.authority === 'requirement') failedRuleIds.push(rule.id)
    else advisoryRuleIds.push(rule.id)
  })

  const notices: CompliantImageViewNoticeCode[] = []
  if (status === 'review-due') notices.push('preset-review-due')
  if (scheduledRuleIds.length > 0) notices.push('rule-not-in-force')
  if (assistedRuleIds.length + manualRuleIds.length + outOfScopeRuleIds.length > 0) {
    notices.push('rules-need-your-check')
  }

  return {
    status,
    result: failedRuleIds.length > 0 ? 'fail' : 'pass',
    notices,
    passedRuleIds,
    failedRuleIds,
    advisoryRuleIds,
    assistedRuleIds,
    manualRuleIds,
    outOfScopeRuleIds,
    scheduledRuleIds,
  }
}
