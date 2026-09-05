import type { LocalizedCopy } from '@/features/tools/catalog'

/**
 * Wording decisions for the NTD uppercase tool: the character set, the three
 * document purposes and what separates them, the input rules and the vectors an
 * implementation has to reproduce. The converter, copy and page belong to the
 * implementation ticket; this module only carries what was researched.
 * Every value is traceable to docs/research/002-ntd-uppercase-rules-and-sources.md,
 * and tests/ntd-uppercase-reference.test.ts keeps the two from drifting apart.
 */

/** The formal digits, indexed by the value each one stands for. */
export const ntdDigits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'] as const

/** Positional units inside a four-digit group; index 0 is the ones place. */
export const ntdSmallUnits = ['', '拾', '佰', '仟'] as const

/** Group units; 兆 sits at index 3 and is outside the cheque character set. */
export const ntdLargeUnits = ['', '萬', '億', '兆'] as const

/** The fixed words a wording is assembled from, never abbreviated. */
export const ntdWords = {
  currency: '新臺幣',
  yuan: '元',
  jiao: '角',
  fen: '分',
  whole: '整',
} as const

/**
 * The numerals a cheque amount is limited to, in the order the Central Bank
 * rule lists them. 兆 is absent, and that absence is what caps the cheque range.
 */
export const ntdChequeNumerals = [
  '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖', '拾', '佰', '仟', '萬', '億', '零',
] as const

export const ntdPurposes = ['accounting', 'cheque', 'treasury'] as const

export type NtdPurpose = typeof ntdPurposes[number]

/** What happens to 角 and 分 the user typed. */
export type NtdFractionPolicy = 'keep' | 'reject' | 'round-half-up'

/** Whether a skipped unit position is spelled out with 零. */
export type NtdInternalZeroPolicy = 'write' | 'omit'

export interface NtdPurposeRule {
  id: NtdPurpose
  label: LocalizedCopy
  /** Largest usable index of ntdLargeUnits. */
  maxLargeUnitIndex: number
  /** Integer digits the wording can express, which follows from the units. */
  maxIntegerDigits: number
  /** Inclusive upper bound as a decimal string; it is never parsed as a float. */
  maxAmount: string
  /** Fraction digits the normalized amount and the wording keep. */
  wordingFractionDigits: 0 | 2
  fractionPolicy: NtdFractionPolicy
  internalZero: NtdInternalZeroPolicy
  /** 整 always closes the wording, or only when the amount is whole 元. */
  wholeMarker: 'always' | 'when-whole'
}

/**
 * The three purposes differ in four places only: how far the numerals reach,
 * what happens below one yuan, whether a skipped position is spelled with 零,
 * and whether 整 always closes the wording. Everything else is shared.
 */
export const ntdPurposeRules = {
  accounting: {
    id: 'accounting',
    label: { 'zh-tw': '一般會計', en: 'Accounting' },
    maxLargeUnitIndex: 3,
    maxIntegerDigits: 16,
    maxAmount: '9999999999999999.99',
    wordingFractionDigits: 2,
    fractionPolicy: 'keep',
    internalZero: 'write',
    wholeMarker: 'when-whole',
  },
  cheque: {
    id: 'cheque',
    label: { 'zh-tw': '支票填寫參考', en: 'Cheque reference' },
    maxLargeUnitIndex: 2,
    maxIntegerDigits: 12,
    maxAmount: '999999999999',
    wordingFractionDigits: 0,
    fractionPolicy: 'reject',
    internalZero: 'write',
    wholeMarker: 'always',
  },
  treasury: {
    id: 'treasury',
    label: { 'zh-tw': '國庫付款憑單', en: 'Treasury payment voucher' },
    maxLargeUnitIndex: 3,
    maxIntegerDigits: 16,
    maxAmount: '9999999999999999',
    wordingFractionDigits: 0,
    fractionPolicy: 'round-half-up',
    internalZero: 'omit',
    wholeMarker: 'always',
  },
} as const satisfies Record<NtdPurpose, NtdPurposeRule>

/**
 * What the amount field accepts before any purpose rule applies. The decimal
 * cap is on the field, not on the purpose: a cheque rejects 角 and 分 with its
 * own message rather than pretending they were never typed.
 */
export const ntdInputRules = {
  maxDecimalDigits: 2,
  /** Thousands separators are accepted only in exact three-digit groups. */
  groupSize: 3,
  /** Full-width digits, commas and dots are folded to ASCII before parsing. */
  normalizesFullWidth: true,
  /** Whitespace anywhere in the field is dropped, including full-width spaces. */
  stripsWhitespace: true,
} as const

export const ntdErrorCodes = [
  'empty',
  'invalid-format',
  'exponent-notation',
  'negative',
  'ambiguous-separator',
  'too-many-decimals',
  'fraction-not-supported',
  'out-of-range',
] as const

export type NtdErrorCode = typeof ntdErrorCodes[number]

export interface NtdGoldenVector {
  /** Exactly what the user types, before normalization. */
  input: string
  purpose: NtdPurpose
  /** The amount after normalization, grouped, at the purpose's precision. */
  normalized: string
  wording: string
}

/**
 * Every case the decision record pins down, including the two worked examples
 * published by the sources: NT$1,018 for the cheque wording and NT$10,215 for
 * the treasury voucher.
 */
export const ntdGoldenVectors = [
  { input: '0', purpose: 'accounting', normalized: '0.00', wording: '新臺幣零元整' },
  { input: '1', purpose: 'accounting', normalized: '1.00', wording: '新臺幣壹元整' },
  { input: '10', purpose: 'accounting', normalized: '10.00', wording: '新臺幣壹拾元整' },
  { input: '100', purpose: 'accounting', normalized: '100.00', wording: '新臺幣壹佰元整' },
  { input: '101', purpose: 'accounting', normalized: '101.00', wording: '新臺幣壹佰零壹元整' },
  { input: '1018', purpose: 'accounting', normalized: '1,018.00', wording: '新臺幣壹仟零壹拾捌元整' },
  { input: '10215', purpose: 'accounting', normalized: '10,215.00', wording: '新臺幣壹萬零貳佰壹拾伍元整' },
  { input: '100000', purpose: 'accounting', normalized: '100,000.00', wording: '新臺幣壹拾萬元整' },
  { input: '305000', purpose: 'accounting', normalized: '305,000.00', wording: '新臺幣參拾萬伍仟元整' },
  { input: '1000100', purpose: 'accounting', normalized: '1,000,100.00', wording: '新臺幣壹佰萬零壹佰元整' },
  { input: '100000000', purpose: 'accounting', normalized: '100,000,000.00', wording: '新臺幣壹億元整' },
  { input: '100010000', purpose: 'accounting', normalized: '100,010,000.00', wording: '新臺幣壹億零壹萬元整' },
  { input: '100000001', purpose: 'accounting', normalized: '100,000,001.00', wording: '新臺幣壹億零壹元整' },
  { input: '1000000000000', purpose: 'accounting', normalized: '1,000,000,000,000.00', wording: '新臺幣壹兆元整' },
  { input: '12850.5', purpose: 'accounting', normalized: '12,850.50', wording: '新臺幣壹萬貳仟捌佰伍拾元伍角' },
  { input: '100000000.09', purpose: 'accounting', normalized: '100,000,000.09', wording: '新臺幣壹億元零玖分' },
  { input: '0.5', purpose: 'accounting', normalized: '0.50', wording: '新臺幣零元伍角' },
  { input: '0.05', purpose: 'accounting', normalized: '0.05', wording: '新臺幣零元零伍分' },
  { input: '1,234.5', purpose: 'accounting', normalized: '1,234.50', wording: '新臺幣壹仟貳佰參拾肆元伍角' },
  { input: '１２３４', purpose: 'accounting', normalized: '1,234.00', wording: '新臺幣壹仟貳佰參拾肆元整' },
  {
    input: '9999999999999999.99',
    purpose: 'accounting',
    normalized: '9,999,999,999,999,999.99',
    wording: '新臺幣玖仟玖佰玖拾玖兆玖仟玖佰玖拾玖億玖仟玖佰玖拾玖萬玖仟玖佰玖拾玖元玖角玖分',
  },
  { input: '0', purpose: 'cheque', normalized: '0', wording: '新臺幣零元整' },
  { input: '100.00', purpose: 'cheque', normalized: '100', wording: '新臺幣壹佰元整' },
  { input: '101', purpose: 'cheque', normalized: '101', wording: '新臺幣壹佰零壹元整' },
  { input: '10215', purpose: 'cheque', normalized: '10,215', wording: '新臺幣壹萬零貳佰壹拾伍元整' },
  { input: '100000', purpose: 'cheque', normalized: '100,000', wording: '新臺幣壹拾萬元整' },
  {
    input: '999999999999',
    purpose: 'cheque',
    normalized: '999,999,999,999',
    wording: '新臺幣玖仟玖佰玖拾玖億玖仟玖佰玖拾玖萬玖仟玖佰玖拾玖元整',
  },
  { input: '0', purpose: 'treasury', normalized: '0', wording: '新臺幣零元整' },
  { input: '101', purpose: 'treasury', normalized: '101', wording: '新臺幣壹佰壹元整' },
  { input: '1018', purpose: 'treasury', normalized: '1,018', wording: '新臺幣壹仟壹拾捌元整' },
  { input: '10215', purpose: 'treasury', normalized: '10,215', wording: '新臺幣壹萬貳佰壹拾伍元整' },
  { input: '100000', purpose: 'treasury', normalized: '100,000', wording: '新臺幣壹拾萬元整' },
  { input: '305000', purpose: 'treasury', normalized: '305,000', wording: '新臺幣參拾萬伍仟元整' },
  { input: '1000100', purpose: 'treasury', normalized: '1,000,100', wording: '新臺幣壹佰萬壹佰元整' },
  { input: '100010000', purpose: 'treasury', normalized: '100,010,000', wording: '新臺幣壹億壹萬元整' },
  { input: '100000001', purpose: 'treasury', normalized: '100,000,001', wording: '新臺幣壹億壹元整' },
  { input: '12850.5', purpose: 'treasury', normalized: '12,851', wording: '新臺幣壹萬貳仟捌佰伍拾壹元整' },
  { input: '12850.49', purpose: 'treasury', normalized: '12,850', wording: '新臺幣壹萬貳仟捌佰伍拾元整' },
  { input: '100000000.09', purpose: 'treasury', normalized: '100,000,000', wording: '新臺幣壹億元整' },
  { input: '0.05', purpose: 'treasury', normalized: '0', wording: '新臺幣零元整' },
] as const satisfies readonly NtdGoldenVector[]

export interface NtdRejectionVector {
  input: string
  purpose: NtdPurpose
  code: NtdErrorCode
}

/** One case per error key, plus the boundaries each purpose refuses to cross. */
export const ntdRejectionVectors = [
  { input: '', purpose: 'accounting', code: 'empty' },
  { input: '   ', purpose: 'accounting', code: 'empty' },
  { input: 'abc', purpose: 'accounting', code: 'invalid-format' },
  { input: '1.2.3', purpose: 'accounting', code: 'invalid-format' },
  { input: '.', purpose: 'accounting', code: 'invalid-format' },
  { input: '+1', purpose: 'accounting', code: 'invalid-format' },
  { input: '1e3', purpose: 'accounting', code: 'exponent-notation' },
  { input: '1E3', purpose: 'accounting', code: 'exponent-notation' },
  { input: '-1', purpose: 'accounting', code: 'negative' },
  { input: '-0.01', purpose: 'treasury', code: 'negative' },
  { input: '1,23,4', purpose: 'accounting', code: 'ambiguous-separator' },
  { input: '12,34', purpose: 'accounting', code: 'ambiguous-separator' },
  { input: '12.345', purpose: 'accounting', code: 'too-many-decimals' },
  { input: '12.345', purpose: 'treasury', code: 'too-many-decimals' },
  { input: '100.5', purpose: 'cheque', code: 'fraction-not-supported' },
  { input: '0.01', purpose: 'cheque', code: 'fraction-not-supported' },
  { input: '1000000000000', purpose: 'cheque', code: 'out-of-range' },
  { input: '10000000000000000', purpose: 'accounting', code: 'out-of-range' },
  { input: '10000000000000000', purpose: 'treasury', code: 'out-of-range' },
] as const satisfies readonly NtdRejectionVector[]
