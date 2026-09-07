import {
  compliantImagePresets,
  presetReviewGraceDays,
  presetReviewIntervalDays,
  type CompliantImageOutput,
  type CompliantImagePreset,
  type CompliantImagePresetRule,
  type CompliantImageViewNoticeCode,
  type ConstraintKind,
  type ConstraintValueByKind,
  type PresetStatus,
  type RuleState,
} from './reference'

/**
 * Behaviour of the preset model: how old a preset is allowed to be, when a rule
 * starts binding, and what one produced image can honestly be said to satisfy.
 *
 * The one thing this module refuses to do is answer "does it comply". It sorts
 * a preset's rules into what it checked, what it could only assist with, and
 * what only the user can judge, and hands back all of them. A caller that shows
 * a single green tick is misreading the result, not the channel.
 *
 * Every rule is fixed by docs/research/005-compliant-product-image-presets-and-sources.md.
 */

/** Reads one constraint's value against one output. */
type Predicate<Kind extends ConstraintKind> = (
  value: ConstraintValueByKind[Kind],
  output: CompliantImageOutput,
) => boolean

/** Two ratios written as decimals never land on the same float, so compare with a tolerance. */
const aspectRatioTolerance = 1e-6

function withinRange(value: number, min: number | undefined, max: number | undefined) {
  return (min === undefined || value >= min) && (max === undefined || value <= max)
}

/**
 * The constraint kinds one output file can decide, each with the predicate that
 * decides it. Membership and behaviour live in the same place so a kind can
 * never be classified as automatic without something to run, or the other way
 * round.
 */
const automaticPredicates: { [Kind in ConstraintKind]?: Predicate<Kind> } = {
  'dimension-exact': (value, output) =>
    output.width === value.width && output.height === value.height,
  'dimension-range': (value, output) =>
    withinRange(output.width, value.minWidth, value.maxWidth)
    && withinRange(output.height, value.minHeight, value.maxHeight),
  'longest-side-range': (value, output) =>
    withinRange(Math.max(output.width, output.height), value.min, value.max),
  'aspect-ratio-exact': (value, output) =>
    Math.abs(output.width / output.height - value.ratio) <= aspectRatioTolerance,
  'aspect-ratio-range': (value, output) =>
    withinRange(output.width / output.height, value.min, value.max),
  'megapixel-max': (value, output) => output.width * output.height <= value.max * 1_000_000,
  'byte-range': (value, output) => withinRange(output.bytes, value.min, value.max),
  'format-set': (value, output) => value.formats.includes(output.format),
}

/** The kinds `automaticPredicates` can decide, for the record's §4.5 table to answer to. */
export const automaticConstraintKinds = Object.keys(automaticPredicates) as readonly ConstraintKind[]

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
 * The two dates a preset's freshness turns on, both inclusive: it stays active
 * through `activeUntil` and usable with a warning through `usableUntil`. The
 * page shows the first so a merchant can see how current the specification is.
 */
export function presetReviewDeadlines(preset: Pick<CompliantImagePreset, 'reviewedAt'>) {
  return {
    activeUntil: addDays(preset.reviewedAt, presetReviewIntervalDays),
    usableUntil: addDays(preset.reviewedAt, presetReviewIntervalDays + presetReviewGraceDays),
  }
}

/**
 * Where a preset stands on `today`. Retirement wins over every date-derived
 * status: a preset whose source is gone must not become usable again just
 * because someone re-read it yesterday.
 */
export function resolvePresetStatus(
  preset: Pick<CompliantImagePreset, 'reviewedAt' | 'retiredAt'>,
  today: string,
): PresetStatus {
  const { activeUntil, usableUntil } = presetReviewDeadlines(preset)

  if (preset.retiredAt !== undefined && today >= preset.retiredAt) return 'retired'
  if (today > usableUntil) return 'expired'
  if (today > activeUntil) return 'review-due'

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

/**
 * What happened to one rule during a check. The seven values partition a
 * preset's rules, so a caller that renders all seven has shown the user
 * everything the channel asked for — including the parts nobody checked.
 */
export const ruleDispositions = [
  'passed',
  'failed',
  'advisory',
  'assisted',
  'manual',
  'out-of-scope',
  'scheduled',
] as const

export type RuleDisposition = typeof ruleDispositions[number]

export interface PresetCheckOutcome {
  status: PresetStatus
  /** `unavailable` when the preset is disabled — never a verdict from stale rules. */
  result: 'pass' | 'fail' | 'unavailable'
  notices: readonly CompliantImageViewNoticeCode[]
  ruleIds: Readonly<Record<RuleDisposition, readonly string[]>>
}

function emptyRuleIds(): Record<RuleDisposition, string[]> {
  return Object.fromEntries(
    ruleDispositions.map(disposition => [disposition, [] as string[]]),
  ) as Record<RuleDisposition, string[]>
}

/** Runs the predicate for an automatic rule, or throws if the kind has none. */
function isSatisfied(rule: CompliantImagePresetRule, output: CompliantImageOutput) {
  const predicate = automaticPredicates[rule.kind] as Predicate<typeof rule.kind> | undefined
  if (!predicate) throw new Error(`${rule.id} is not a rule one output file can decide`)

  return predicate(rule.value, output)
}

function dispositionOf(
  rule: CompliantImagePresetRule,
  output: CompliantImageOutput,
  today: string,
): RuleDisposition {
  if (resolveRuleState(rule, today) === 'scheduled') return 'scheduled'
  if (rule.verification !== 'automatic') return rule.verification
  if (isSatisfied(rule, output)) return 'passed'

  return rule.authority === 'requirement' ? 'failed' : 'advisory'
}

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
  const ruleIds = emptyRuleIds()

  if (status === 'retired' || status === 'expired') {
    return {
      status,
      result: 'unavailable',
      notices: [status === 'retired' ? 'preset-retired' : 'preset-expired'],
      ruleIds,
    }
  }

  preset.rules.forEach(rule => ruleIds[dispositionOf(rule, output, today)].push(rule.id))

  const unjudged = ruleIds.assisted.length + ruleIds.manual.length + ruleIds['out-of-scope'].length
  const notices: CompliantImageViewNoticeCode[] = []
  if (status === 'review-due') notices.push('preset-review-due')
  if (ruleIds.scheduled.length > 0) notices.push('rule-not-in-force')
  if (unjudged > 0) notices.push('rules-need-your-check')

  return {
    status,
    result: ruleIds.failed.length > 0 ? 'fail' : 'pass',
    notices,
    ruleIds,
  }
}
