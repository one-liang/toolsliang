/**
 * Data contract for the compliant product image tool: the channels whose public
 * specifications survived the inclusion bar, the vocabulary a preset rule is
 * allowed to use, and the vectors an implementation has to reproduce. The
 * editor, the worker engine and the tool page belong to the implementation
 * ticket; this module only carries what was researched.
 *
 * Two axes run through every rule and are the reason this module exists. A rule
 * carries an `authority` — is the channel stating a requirement, a
 * recommendation, or a permission it grants — and a `verification` — can this
 * tool read the answer off one output file, only assist, or not judge at all.
 * Collapsing either axis is how a photography tip turns into a claim about
 * channel approval, which is exactly what this research had to prevent.
 *
 * Every value is traceable to
 * docs/research/005-compliant-product-image-presets-and-sources.md, and
 * tests/compliant-product-image-reference.test.ts keeps the two from drifting
 * apart.
 */

/** The channels whose public specification met the §3.1 inclusion bar. */
export const compliantImageChannelIds = [
  'google-merchant-center',
  'amazon',
  'momo-store',
  'ruten',
] as const

export type CompliantImageChannelId = typeof compliantImageChannelIds[number]

/**
 * What the image is for. A role is part of a preset's identity rather than a
 * flag on one preset, because one channel can rule two roles in opposite
 * directions: momo permits a watermark on a main image and forbids one on an
 * ad image.
 */
export const compliantImageRoles = ['main', 'ad', 'variant'] as const

export type CompliantImageRole = typeof compliantImageRoles[number]

export const compliantImageRegions = ['global', 'tw'] as const

export type CompliantImageRegion = typeof compliantImageRegions[number]

/** The image formats this contract can name, in a preset rule or in an output. */
export const compliantImageFormats = ['jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'] as const

export type CompliantImageFormat = typeof compliantImageFormats[number]

/**
 * How binding a rule is. `permission` is not a rule the output has to satisfy:
 * it records something the channel allows and this tool deliberately does not
 * do, so the page can say so instead of staying silent (ADR-0012).
 */
export const ruleAuthorities = ['requirement', 'recommendation', 'permission'] as const

export type RuleAuthority = typeof ruleAuthorities[number]

/**
 * How far the tool can go in judging a rule. Only `automatic` ever decides
 * whether an output passes; the other three are listed to the user, never
 * silently treated as satisfied.
 */
export const ruleVerifications = ['automatic', 'assisted', 'manual', 'out-of-scope'] as const

export type RuleVerification = typeof ruleVerifications[number]

/** The shape a rule's value takes. §4.5 binds each kind to one verification. */
export const constraintKinds = [
  'dimension-exact',
  'dimension-range',
  'longest-side-range',
  'aspect-ratio-exact',
  'aspect-ratio-range',
  'megapixel-max',
  'byte-range',
  'format-set',
  'chroma-model',
  'count-range',
  'occupancy-min',
  'overlay-area-max',
  'background',
  'metadata-preservation',
  'placement-allowance',
  'prohibition',
] as const

export type ConstraintKind = typeof constraintKinds[number]

/** Whether the source states dimensions, capacity and formats, or only some of them. */
export const presetCoverageLevels = ['full', 'partial'] as const

export type PresetCoverage = typeof presetCoverageLevels[number]

/**
 * Where a preset stands against its review deadline. `expired` and `retired`
 * both stop the preset being used, but they stay apart: one means nobody has
 * re-read the source lately, the other means the source is gone for good.
 */
export const presetStatuses = ['active', 'review-due', 'expired', 'retired'] as const

export type PresetStatus = typeof presetStatuses[number]

export const ruleStates = ['in-force', 'scheduled'] as const

export type RuleState = typeof ruleStates[number]

/** A preset stays usable for this long after its sources were last read. */
export const presetReviewIntervalDays = 90
/** After the interval, this much longer with a visible warning, then it is disabled. */
export const presetReviewGraceDays = 30

/**
 * Sources write `16MB`, `1000 kb` and `5MB` without saying whether they mean
 * powers of ten or two, so every byte bound in this contract is decimal. That
 * is the stricter reading of an upper bound and the looser reading of a lower
 * one; §10 of the decision record carries the risk.
 */
export const byteUnitFactor = 1000

/** The value each constraint kind carries. A prohibition carries none. */
export interface ConstraintValueByKind {
  'dimension-exact': { width: number, height: number }
  'dimension-range': {
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
  }
  'longest-side-range': { min?: number, max?: number }
  'aspect-ratio-exact': { ratio: number }
  'aspect-ratio-range': { min?: number, max?: number }
  'megapixel-max': { max: number }
  'byte-range': { min?: number, max?: number }
  'format-set': { formats: readonly CompliantImageFormat[] }
  'chroma-model': { model: 'YCbCr' }
  'count-range': { min?: number, max?: number }
  'occupancy-min': { ratio: number }
  'overlay-area-max': { ratio: number }
  'background': { mode: 'solid' | 'pure-white', rgb?: readonly [number, number, number] }
  'metadata-preservation': { tags: readonly string[] }
  'placement-allowance': { positions: readonly string[] }
  'prohibition': Record<string, never>
}

/**
 * One rule of one preset. `quote` is the source sentence the rule was read
 * from: a re-check compares it verbatim, so a channel that reworded its page
 * fails review instead of quietly keeping the old number.
 */
export type CompliantImagePresetRule = {
  [Kind in ConstraintKind]: {
    id: string
    kind: Kind
    authority: RuleAuthority
    verification: RuleVerification
    value: ConstraintValueByKind[Kind]
    quote: string
    /** Announced but not yet binding; the rule is listed and not judged until this date. */
    effectiveFrom?: string
  }
}[ConstraintKind]

export interface CompliantImagePreset {
  id: string
  channelId: CompliantImageChannelId
  role: CompliantImageRole
  region: CompliantImageRegion
  sourceId: string
  coverage: PresetCoverage
  /** The day the source behind this preset was last read end to end. */
  reviewedAt: string
  /** Set only when the preset is deliberately taken out of service. */
  retiredAt?: string
  rules: readonly CompliantImagePresetRule[]
}

/**
 * The six presets the review confirmed. Only the Google preset is `full`: the
 * other three channels do not publish all of dimensions, capacity and formats,
 * and a missing field stays missing rather than borrowing another channel's
 * number.
 */
export const compliantImagePresets = [
  {
    id: 'google-merchant-center-main',
    channelId: 'google-merchant-center',
    role: 'main',
    region: 'global',
    sourceId: 'google-merchant-image-link',
    coverage: 'full',
    reviewedAt: '2026-09-07',
    rules: [
      {
        id: 'min-dimensions',
        kind: 'dimension-range',
        authority: 'requirement',
        verification: 'automatic',
        value: { minWidth: 500, minHeight: 500 },
        quote: 'At least 500 x 500 pixels',
        effectiveFrom: '2027-01-31',
      },
      {
        id: 'recommended-dimensions',
        kind: 'dimension-range',
        authority: 'recommendation',
        verification: 'automatic',
        value: { minWidth: 1500, minHeight: 1500 },
        quote: 'we recommend that you provide images around 1500x1500 pixels or above',
      },
      {
        id: 'max-megapixels',
        kind: 'megapixel-max',
        authority: 'requirement',
        verification: 'automatic',
        value: { max: 64 },
        quote: 'No image larger than 64 megapixels',
      },
      {
        id: 'file-size-range',
        kind: 'byte-range',
        authority: 'requirement',
        verification: 'automatic',
        value: { max: 16_000_000 },
        quote: 'No image file larger than 16MB',
      },
      {
        id: 'allowed-formats',
        kind: 'format-set',
        authority: 'requirement',
        verification: 'automatic',
        value: { formats: ['jpeg', 'webp', 'png', 'gif', 'bmp', 'tiff'] },
        quote: 'JPEG (.jpg/.jpeg), WebP (.webp), PNG (.png), GIF (.gif), BMP (.bmp), and TIFF (.tif/.tiff)',
      },
      {
        id: 'no-border',
        kind: 'prohibition',
        authority: 'requirement',
        verification: 'manual',
        value: {},
        quote: 'use an image with a border',
      },
      {
        id: 'no-promotional-overlay',
        kind: 'prohibition',
        authority: 'requirement',
        verification: 'manual',
        value: {},
        quote: 'an image that contains promotional elements or content that covers the product',
      },
      {
        id: 'no-placeholder',
        kind: 'prohibition',
        authority: 'requirement',
        verification: 'manual',
        value: {},
        quote: 'use a placeholder or an image that',
      },
      {
        id: 'preserve-ai-metadata',
        kind: 'metadata-preservation',
        authority: 'requirement',
        verification: 'manual',
        value: { tags: ['IPTC DigitalSourceType'] },
        quote: 'All images created using generative AI must contain meta data indicating that the image was AI-generated',
      },
    ],
  },
  {
    id: 'amazon-main',
    channelId: 'amazon',
    role: 'main',
    region: 'global',
    sourceId: 'amazon-product-photos',
    coverage: 'partial',
    reviewedAt: '2026-09-07',
    rules: [
      {
        id: 'longest-side-range',
        kind: 'longest-side-range',
        authority: 'requirement',
        verification: 'automatic',
        value: { min: 500, max: 10_000 },
        quote: '500 to 10,000 pixels on their longest side',
      },
      {
        id: 'allowed-formats',
        kind: 'format-set',
        authority: 'requirement',
        verification: 'automatic',
        value: { formats: ['jpeg', 'tiff', 'png', 'gif'] },
        quote: 'In JPEG, TIFF, PNG, or non-animated GIF file formats',
      },
      {
        id: 'recommended-dimensions',
        kind: 'dimension-range',
        authority: 'recommendation',
        verification: 'automatic',
        value: { minWidth: 1000, minHeight: 1000 },
        quote: '1,000 pixels on each side to allow for zoom',
      },
      {
        id: 'image-clarity',
        kind: 'prohibition',
        authority: 'requirement',
        verification: 'manual',
        value: {},
        quote: 'Clear, unpixellated, and have no jagged edges',
      },
      {
        id: 'image-count',
        kind: 'count-range',
        authority: 'requirement',
        verification: 'manual',
        value: { min: 1 },
        quote: 'Every product on Amazon must have at least one image',
      },
      {
        id: 'recommended-image-count',
        kind: 'count-range',
        authority: 'recommendation',
        verification: 'manual',
        value: { min: 6 },
        quote: 'we recommend having at least six',
      },
      {
        id: 'product-occupancy',
        kind: 'occupancy-min',
        authority: 'recommendation',
        verification: 'assisted',
        value: { ratio: 0.85 },
        quote: 'Have the product fill 85% or more of the frame',
      },
      {
        id: 'background',
        kind: 'background',
        authority: 'recommendation',
        verification: 'assisted',
        value: { mode: 'pure-white', rgb: [255, 255, 255] },
        quote: 'product shots should be taken against a white background (RGB color values: 255, 255, 255)',
      },
    ],
  },
  {
    id: 'momo-store-main',
    channelId: 'momo-store',
    role: 'main',
    region: 'tw',
    sourceId: 'momo-store-publish-rules',
    coverage: 'partial',
    reviewedAt: '2026-09-07',
    rules: [
      {
        id: 'exact-dimensions',
        kind: 'dimension-exact',
        authority: 'requirement',
        verification: 'automatic',
        value: { width: 1000, height: 1000 },
        quote: '圖檔尺寸：1000 px * 1000 px',
      },
      {
        id: 'file-size-range',
        kind: 'byte-range',
        authority: 'requirement',
        verification: 'automatic',
        value: { min: 50_000, max: 1_000_000 },
        quote: '大小：50 kb - 1000 kb',
      },
      {
        id: 'chroma-model',
        kind: 'chroma-model',
        authority: 'requirement',
        verification: 'automatic',
        value: { model: 'YCbCr' },
        quote: '主圖需調整為YCbCr type並檢核',
      },
      {
        id: 'image-count',
        kind: 'count-range',
        authority: 'requirement',
        verification: 'manual',
        value: { min: 1, max: 6 },
        quote: '主圖最少需上傳 1 張圖片，最多 6 張',
      },
      {
        id: 'product-occupancy',
        kind: 'occupancy-min',
        authority: 'requirement',
        verification: 'assisted',
        value: { ratio: 0.8 },
        quote: '販售商品需佔圖片 80 % 以上',
      },
      {
        id: 'overlay-area-max',
        kind: 'overlay-area-max',
        authority: 'requirement',
        verification: 'manual',
        value: { ratio: 0.2 },
        quote: '「插圖」、「配件」、「文字」不可佔圖片 20 % 以上',
      },
      {
        id: 'no-packaging-cover',
        kind: 'prohibition',
        authority: 'requirement',
        verification: 'manual',
        value: {},
        quote: '產品不可被包裝包覆',
      },
      {
        id: 'watermark-placement',
        kind: 'placement-allowance',
        authority: 'permission',
        verification: 'out-of-scope',
        value: { positions: ['bottom-left', 'bottom-right'] },
        quote: '「浮水印」蓋在左下 or 右下，但不可重複及大面積覆蓋商品',
      },
      {
        id: 'logo-placement',
        kind: 'placement-allowance',
        authority: 'permission',
        verification: 'out-of-scope',
        value: { positions: ['empty-area'] },
        quote: '「店家 logo / 品牌 logo」可放置空白處',
      },
    ],
  },
  {
    id: 'momo-store-ad',
    channelId: 'momo-store',
    role: 'ad',
    region: 'tw',
    sourceId: 'momo-store-publish-rules',
    coverage: 'partial',
    reviewedAt: '2026-09-07',
    rules: [
      {
        id: 'exact-dimensions',
        kind: 'dimension-exact',
        authority: 'requirement',
        verification: 'automatic',
        value: { width: 1000, height: 1000 },
        quote: '尺寸 1000 px * 1000 px',
      },
      {
        id: 'file-size-range',
        kind: 'byte-range',
        authority: 'requirement',
        verification: 'automatic',
        value: { min: 50_000, max: 1_000_000 },
        quote: '大小 50 kb ~ 1000 kb',
      },
      {
        id: 'exact-aspect-ratio',
        kind: 'aspect-ratio-exact',
        authority: 'requirement',
        verification: 'automatic',
        value: { ratio: 1 },
        quote: '正方形圖片，不可有白/黑邊',
      },
      {
        id: 'chroma-model',
        kind: 'chroma-model',
        authority: 'requirement',
        verification: 'automatic',
        value: { model: 'YCbCr' },
        quote: '廣告用圖需調整為YCbCr type並檢核',
      },
      {
        id: 'background',
        kind: 'background',
        authority: 'requirement',
        verification: 'assisted',
        value: { mode: 'solid' },
        quote: '需為純色背景',
      },
      {
        id: 'product-occupancy',
        kind: 'occupancy-min',
        authority: 'requirement',
        verification: 'assisted',
        value: { ratio: 0.8 },
        quote: '販售商品需佔圖片 80 % 以上',
      },
      {
        id: 'no-border',
        kind: 'prohibition',
        authority: 'requirement',
        verification: 'manual',
        value: {},
        quote: '請上傳無壓標、無壓框、無浮水印的商品圖',
      },
      {
        id: 'no-watermark',
        kind: 'prohibition',
        authority: 'requirement',
        verification: 'manual',
        value: {},
        quote: '請上傳無壓標、無壓框、無浮水印的商品圖',
      },
      {
        id: 'no-promotional-overlay',
        kind: 'prohibition',
        authority: 'requirement',
        verification: 'manual',
        value: {},
        quote: '請上傳無壓標、無壓框、無浮水印的商品圖',
      },
      {
        id: 'no-white-or-black-edge',
        kind: 'prohibition',
        authority: 'requirement',
        verification: 'manual',
        value: {},
        quote: '正方形圖片，不可有白/黑邊',
      },
    ],
  },
  {
    id: 'momo-store-variant',
    channelId: 'momo-store',
    role: 'variant',
    region: 'tw',
    sourceId: 'momo-store-publish-rules',
    coverage: 'partial',
    reviewedAt: '2026-09-07',
    rules: [
      {
        id: 'exact-dimensions',
        kind: 'dimension-exact',
        authority: 'requirement',
        verification: 'automatic',
        value: { width: 1000, height: 1000 },
        quote: '規格圖尺寸 : 1000 px * 1000 px',
      },
      {
        id: 'file-size-range',
        kind: 'byte-range',
        authority: 'requirement',
        verification: 'automatic',
        value: { min: 50_000, max: 1_000_000 },
        quote: '大小 : 50 kb - 1000 kb',
      },
      {
        id: 'exact-aspect-ratio',
        kind: 'aspect-ratio-exact',
        authority: 'recommendation',
        verification: 'automatic',
        value: { ratio: 1 },
        quote: '請上傳正方形圖片，不可有白/黑邊',
      },
      {
        id: 'background',
        kind: 'background',
        authority: 'recommendation',
        verification: 'assisted',
        value: { mode: 'solid' },
        quote: '圖片需為純色背景',
      },
      {
        id: 'product-occupancy',
        kind: 'occupancy-min',
        authority: 'recommendation',
        verification: 'assisted',
        value: { ratio: 0.8 },
        quote: '販售商品需佔圖片 80 % 以上',
      },
      {
        id: 'no-white-or-black-edge',
        kind: 'prohibition',
        authority: 'recommendation',
        verification: 'manual',
        value: {},
        quote: '請上傳正方形圖片，不可有白/黑邊',
      },
    ],
  },
  {
    id: 'ruten-main',
    channelId: 'ruten',
    role: 'main',
    region: 'tw',
    sourceId: 'ruten-store-faq',
    coverage: 'partial',
    reviewedAt: '2026-09-07',
    rules: [
      {
        id: 'allowed-formats',
        kind: 'format-set',
        authority: 'requirement',
        verification: 'automatic',
        value: { formats: ['jpeg', 'png'] },
        quote: '檔案格式限 jpg、jpeg、png',
      },
      {
        id: 'file-size-range',
        kind: 'byte-range',
        authority: 'requirement',
        verification: 'automatic',
        value: { max: 5_000_000 },
        quote: '檔案大小限 5MB 以內',
      },
      {
        id: 'aspect-ratio-range',
        kind: 'aspect-ratio-range',
        authority: 'requirement',
        verification: 'automatic',
        value: { min: 0.2, max: 5 },
        quote: '長寬比不得超過 5:1 或 1:5',
      },
      {
        id: 'image-count',
        kind: 'count-range',
        authority: 'requirement',
        verification: 'manual',
        value: { max: 9 },
        quote: '每項商品最多可上傳9張圖片',
      },
    ],
  },
] as const satisfies readonly CompliantImagePreset[]

/**
 * Failures a maintainer can hit when re-reading the sources, in the order the
 * checks run. They never reach a visitor: a preset that hits one is not updated
 * to a new version, so the visitor sees the previous review or a disabled preset.
 */
export const compliantImageIngestionErrorCodes = [
  'source-unreachable',
  'source-requires-javascript',
  'source-requires-sign-in',
  'automated-access-restricted',
  'specification-text-changed',
  'unit-ambiguous',
  'conflicting-rules',
  'unknown-constraint-kind',
] as const

export type CompliantImageIngestionErrorCode = typeof compliantImageIngestionErrorCodes[number]

/**
 * What a visitor can be told, in the order the checks run: whether the preset
 * exists, then whether it is still maintained, then whether it is still fresh,
 * and only then anything about individual rules.
 */
export const compliantImageViewNoticeCodes = [
  'preset-unknown',
  'preset-retired',
  'preset-expired',
  'preset-review-due',
  'rule-not-in-force',
  'rules-need-your-check',
] as const

export type CompliantImageViewNoticeCode = typeof compliantImageViewNoticeCodes[number]

export interface PresetStatusVector {
  presetId: string
  retiredAt: string | null
  date: string
  status: PresetStatus
}

/**
 * Retirement has to outrank every date-derived status, and the review deadline
 * has to be inclusive on the day it falls. Both are off-by-one traps, so the
 * boundaries are pinned on either side rather than sampled.
 */
export const presetStatusVectors = [
  { presetId: 'google-merchant-center-main', retiredAt: null, date: '2026-09-07', status: 'active' },
  { presetId: 'google-merchant-center-main', retiredAt: null, date: '2026-12-06', status: 'active' },
  { presetId: 'google-merchant-center-main', retiredAt: null, date: '2026-12-07', status: 'review-due' },
  { presetId: 'google-merchant-center-main', retiredAt: null, date: '2027-01-05', status: 'review-due' },
  { presetId: 'google-merchant-center-main', retiredAt: null, date: '2027-01-06', status: 'expired' },
  { presetId: 'google-merchant-center-main', retiredAt: '2026-10-01', date: '2026-09-30', status: 'active' },
  { presetId: 'google-merchant-center-main', retiredAt: '2026-10-01', date: '2026-10-01', status: 'retired' },
  { presetId: 'momo-store-main', retiredAt: '2026-10-01', date: '2027-06-01', status: 'retired' },
  { presetId: 'ruten-main', retiredAt: null, date: '2027-01-06', status: 'expired' },
] as const satisfies readonly PresetStatusVector[]

export interface RuleStateVector {
  presetId: string
  ruleId: string
  date: string
  state: RuleState
}

/**
 * Google announced a 500 x 500 minimum that only binds from 2027-01-31, so the
 * same rule has two answers depending on the day. A rule without an effective
 * date is in force from the beginning, which the last two rows pin.
 */
export const ruleStateVectors = [
  { presetId: 'google-merchant-center-main', ruleId: 'min-dimensions', date: '2026-09-07', state: 'scheduled' },
  { presetId: 'google-merchant-center-main', ruleId: 'min-dimensions', date: '2027-01-30', state: 'scheduled' },
  { presetId: 'google-merchant-center-main', ruleId: 'min-dimensions', date: '2027-01-31', state: 'in-force' },
  { presetId: 'google-merchant-center-main', ruleId: 'max-megapixels', date: '2026-09-07', state: 'in-force' },
  { presetId: 'momo-store-main', ruleId: 'exact-dimensions', date: '2026-09-07', state: 'in-force' },
] as const satisfies readonly RuleStateVector[]

/** One produced image, described by what a preset can actually be checked against. */
export interface CompliantImageOutput {
  width: number
  height: number
  format: CompliantImageFormat
  bytes: number
}

export interface OutputCheckVector {
  presetId: string
  date: string
  candidate: CompliantImageOutput
  result: 'pass' | 'fail'
  failedRuleIds: readonly string[]
}

/**
 * One passing and one failing output for every preset that has automatic rules.
 * The two momo rows using the same 1000 x 1000 PNG are the point of the set: it
 * fails `momo-store-main` on the YCbCr rule and passes `momo-store-variant`,
 * because momo only wrote that rule for main and ad images.
 */
export const outputCheckVectors = [
  {
    presetId: 'google-merchant-center-main',
    date: '2026-09-07',
    candidate: { width: 1500, height: 1500, format: 'jpeg', bytes: 800_000 },
    result: 'pass',
    failedRuleIds: [],
  },
  {
    presetId: 'google-merchant-center-main',
    date: '2026-09-07',
    candidate: { width: 9000, height: 9000, format: 'png', bytes: 20_000_000 },
    result: 'fail',
    failedRuleIds: ['max-megapixels', 'file-size-range'],
  },
  {
    presetId: 'amazon-main',
    date: '2026-09-07',
    candidate: { width: 1600, height: 1600, format: 'jpeg', bytes: 900_000 },
    result: 'pass',
    failedRuleIds: [],
  },
  {
    presetId: 'amazon-main',
    date: '2026-09-07',
    candidate: { width: 400, height: 400, format: 'webp', bytes: 100_000 },
    result: 'fail',
    failedRuleIds: ['longest-side-range', 'allowed-formats'],
  },
  {
    presetId: 'momo-store-main',
    date: '2026-09-07',
    candidate: { width: 1000, height: 1000, format: 'jpeg', bytes: 400_000 },
    result: 'pass',
    failedRuleIds: [],
  },
  {
    presetId: 'momo-store-main',
    date: '2026-09-07',
    candidate: { width: 1200, height: 1000, format: 'png', bytes: 30_000 },
    result: 'fail',
    failedRuleIds: ['exact-dimensions', 'file-size-range', 'chroma-model'],
  },
  {
    presetId: 'momo-store-ad',
    date: '2026-09-07',
    candidate: { width: 1000, height: 1000, format: 'jpeg', bytes: 400_000 },
    result: 'pass',
    failedRuleIds: [],
  },
  {
    presetId: 'momo-store-ad',
    date: '2026-09-07',
    candidate: { width: 1200, height: 800, format: 'jpeg', bytes: 1_500_000 },
    result: 'fail',
    failedRuleIds: ['exact-dimensions', 'exact-aspect-ratio', 'file-size-range'],
  },
  {
    presetId: 'momo-store-variant',
    date: '2026-09-07',
    candidate: { width: 1000, height: 1000, format: 'png', bytes: 200_000 },
    result: 'pass',
    failedRuleIds: [],
  },
  {
    presetId: 'ruten-main',
    date: '2026-09-07',
    candidate: { width: 1200, height: 900, format: 'jpeg', bytes: 900_000 },
    result: 'pass',
    failedRuleIds: [],
  },
  {
    presetId: 'ruten-main',
    date: '2026-09-07',
    candidate: { width: 3000, height: 400, format: 'webp', bytes: 6_000_000 },
    result: 'fail',
    failedRuleIds: ['allowed-formats', 'aspect-ratio-range', 'file-size-range'],
  },
] as const satisfies readonly OutputCheckVector[]
