import { imageInputLimits } from '@/features/images/limits'
import { resolveRuleState } from './preset'
import type {
  CompliantImageFormat,
  CompliantImagePreset,
  CompliantImagePresetRule,
  RuleAuthority,
} from './reference'

/**
 * What one produced image is allowed to be, read off a preset.
 *
 * The reference module says what each channel published; this module turns that
 * into the three answers an editor needs before it can render anything: how big
 * the canvas may be, which formats it may be written in, and how many bytes it
 * may occupy. Nothing here decides whether an output complies — that stays with
 * `checkOutputAgainstPreset`, which reads the finished file.
 *
 * Two separations run through every function. A requirement constrains what the
 * tool will produce; a recommendation only moves the suggested starting point,
 * so a merchant is never blocked by advice. And a rule that is not yet in force
 * is invisible here, exactly as it is invisible to the check.
 */

/** The formats a browser canvas can be asked to write. */
export const encodableFormats = ['jpeg', 'png', 'webp'] as const

export type EncodableFormat = typeof encodableFormats[number]

export type EncodableMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

export const formatMimeTypes: Record<EncodableFormat, EncodableMimeType> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** The side used when no reviewed source states or recommends a dimension. */
export const defaultOutputSide = 1000

export function formatOfMimeType(mimeType: string): EncodableFormat | undefined {
  return encodableFormats.find(format => formatMimeTypes[format] === mimeType)
}

/**
 * The canvas a preset permits, already intersected with what this device can
 * decode. `exact` wins over every range: a channel that states one size has not
 * left the merchant a choice.
 */
export interface OutputBounds {
  exact?: { width: number, height: number }
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
  minLongestSide?: number
  maxLongestSide?: number
  ratio?: number
  minRatio?: number
  maxRatio?: number
  maxPixels: number
}

/** Why a requested canvas cannot be produced, in the order the checks run. */
export const outputSizeIssues = [
  'too-small',
  'not-exact',
  'ratio',
  'longest-side',
  'too-large',
  'too-many-pixels',
] as const

export type OutputSizeIssue = typeof outputSizeIssues[number]

export interface OccupancyGuide {
  ruleId: string
  ratio: number
  authority: RuleAuthority
}

export interface SafeAreaGuide {
  ruleId: string
  top: number
  right: number
  bottom: number
  left: number
}

/** Two ratios written as decimals never land on the same float; compare with a tolerance. */
const aspectRatioTolerance = 1e-6

function inForceRules(preset: CompliantImagePreset, today: string) {
  return preset.rules.filter(rule => resolveRuleState(rule, today) === 'in-force')
}

/** Only a requirement the tool can read off one file may narrow what it produces. */
function bindingRules(preset: CompliantImagePreset, today: string) {
  return inForceRules(preset, today)
    .filter(rule => rule.authority === 'requirement' && rule.verification === 'automatic')
}

export function resolveOutputBounds(preset: CompliantImagePreset, today: string): OutputBounds {
  const bounds: OutputBounds = {
    minWidth: 1,
    maxWidth: imageInputLimits.maxSide,
    minHeight: 1,
    maxHeight: imageInputLimits.maxSide,
    maxPixels: imageInputLimits.maxPixels,
  }

  for (const rule of bindingRules(preset, today)) {
    if (rule.kind === 'dimension-exact') bounds.exact = { ...rule.value }
    if (rule.kind === 'dimension-range') {
      bounds.minWidth = Math.max(bounds.minWidth, rule.value.minWidth ?? 1)
      bounds.minHeight = Math.max(bounds.minHeight, rule.value.minHeight ?? 1)
      bounds.maxWidth = Math.min(bounds.maxWidth, rule.value.maxWidth ?? bounds.maxWidth)
      bounds.maxHeight = Math.min(bounds.maxHeight, rule.value.maxHeight ?? bounds.maxHeight)
    }
    if (rule.kind === 'longest-side-range') {
      if (rule.value.min !== undefined) bounds.minLongestSide = Math.max(bounds.minLongestSide ?? 0, rule.value.min)
      if (rule.value.max !== undefined) {
        // The channel's own ceiling stays visible; the device budget narrows the canvas separately.
        bounds.maxLongestSide = Math.min(bounds.maxLongestSide ?? Number.POSITIVE_INFINITY, rule.value.max)
        bounds.maxWidth = Math.min(bounds.maxWidth, rule.value.max)
        bounds.maxHeight = Math.min(bounds.maxHeight, rule.value.max)
      }
    }
    if (rule.kind === 'aspect-ratio-exact') bounds.ratio = rule.value.ratio
    if (rule.kind === 'aspect-ratio-range') {
      if (rule.value.min !== undefined) bounds.minRatio = Math.max(bounds.minRatio ?? 0, rule.value.min)
      if (rule.value.max !== undefined) bounds.maxRatio = Math.min(bounds.maxRatio ?? Number.POSITIVE_INFINITY, rule.value.max)
    }
    if (rule.kind === 'megapixel-max') bounds.maxPixels = Math.min(bounds.maxPixels, rule.value.max * 1_000_000)
  }

  return bounds
}

export function describeSizeIssue(
  bounds: OutputBounds,
  width: number,
  height: number,
): OutputSizeIssue | undefined {
  if (![width, height].every(value => Number.isInteger(value) && value >= 1)) return 'too-small'
  if (bounds.exact && (width !== bounds.exact.width || height !== bounds.exact.height)) return 'not-exact'

  const ratio = width / height
  if (bounds.ratio !== undefined && Math.abs(ratio - bounds.ratio) > aspectRatioTolerance) return 'ratio'
  if (bounds.minRatio !== undefined && ratio < bounds.minRatio) return 'ratio'
  if (bounds.maxRatio !== undefined && ratio > bounds.maxRatio) return 'ratio'

  const longestSide = Math.max(width, height)
  if (bounds.minLongestSide !== undefined && longestSide < bounds.minLongestSide) return 'longest-side'
  if (bounds.maxLongestSide !== undefined && longestSide > bounds.maxLongestSide) return 'longest-side'

  if (width < bounds.minWidth || height < bounds.minHeight) return 'too-small'
  if (width > bounds.maxWidth || height > bounds.maxHeight) return 'too-large'
  if (width * height > bounds.maxPixels) return 'too-many-pixels'
}

/** The largest side any in-force rule asks for, advice included. */
function recommendedSide(preset: CompliantImagePreset, today: string) {
  return inForceRules(preset, today)
    .filter(rule => rule.verification === 'automatic')
    .reduce((side, rule) => {
      if (rule.kind === 'dimension-range') return Math.max(side, rule.value.minWidth ?? 0, rule.value.minHeight ?? 0)
      if (rule.kind === 'longest-side-range') return Math.max(side, rule.value.min ?? 0)

      return side
    }, 0)
}

/**
 * Where the editor starts. It aims at the largest size the channel asks for,
 * including what it only recommends, then pulls the canvas back inside every
 * requirement — so the suggestion is generous but always producible.
 */
export function suggestOutputSize(preset: CompliantImagePreset, today: string) {
  const bounds = resolveOutputBounds(preset, today)
  if (bounds.exact) return { ...bounds.exact }

  const side = Math.max(defaultOutputSide, recommendedSide(preset, today), bounds.minWidth, bounds.minHeight)
  const ratio = bounds.ratio ?? 1
  let width = side
  let height = Math.round(side / ratio)

  const shrink = Math.min(
    1,
    bounds.maxWidth / width,
    bounds.maxHeight / height,
    (bounds.maxLongestSide ?? Number.POSITIVE_INFINITY) / Math.max(width, height),
    Math.sqrt(bounds.maxPixels / (width * height)),
  )
  width = Math.max(1, Math.floor(width * shrink))
  height = Math.max(1, Math.round(width / ratio))

  return { width, height }
}

/**
 * The formats a merchant may pick. A channel that publishes no format rule
 * leaves the choice open rather than inheriting another channel's list, which
 * is why an empty set of rules returns everything this browser can write.
 */
export function resolveOutputFormats(
  preset: CompliantImagePreset,
  today: string,
  available: readonly EncodableFormat[],
): EncodableFormat[] {
  const allowed = bindingRules(preset, today)
    .filter((rule): rule is Extract<CompliantImagePresetRule, { kind: 'format-set' }> => rule.kind === 'format-set')
    .map(rule => rule.value.formats as readonly CompliantImageFormat[])

  return encodableFormats.filter(format =>
    available.includes(format) && allowed.every(formats => formats.includes(format)))
}

export function resolveByteRange(preset: CompliantImagePreset, today: string) {
  const range: { min?: number, max?: number } = {}

  for (const rule of bindingRules(preset, today)) {
    if (rule.kind !== 'byte-range') continue
    if (rule.value.min !== undefined) range.min = Math.max(range.min ?? 0, rule.value.min)
    if (rule.value.max !== undefined) range.max = Math.min(range.max ?? Number.POSITIVE_INFINITY, rule.value.max)
  }

  return range
}

/**
 * The occupancy ratios the editor can draw a guide for. They are never a check:
 * the tool cannot see where the product ends, so it offers a frame and says who
 * asked for it — a requirement from momo reads differently from Amazon's advice.
 */
export function resolveOccupancyGuides(preset: CompliantImagePreset, today: string): OccupancyGuide[] {
  return inForceRules(preset, today)
    .filter(rule => rule.kind === 'occupancy-min')
    .map(rule => ({
      ruleId: rule.id,
      ratio: (rule.value as { ratio: number }).ratio,
      authority: rule.authority,
    }))
}

/**
 * The keep-out margins the editor can draw. No reviewed channel publishes one,
 * so this is empty today; it exists because the preset model can carry insets
 * and the next channel that publishes them must not be rewritten as occupancy.
 */
export function resolveSafeAreaInsets(preset: CompliantImagePreset, today: string): SafeAreaGuide[] {
  return inForceRules(preset, today)
    .filter(rule => rule.kind === 'safe-area-inset')
    .map(rule => ({ ruleId: rule.id, ...(rule.value as Omit<SafeAreaGuide, 'ruleId'>) }))
}
