import {
  ntdDigits,
  ntdInputRules,
  ntdLargeUnits,
  ntdPurposeRules,
  ntdSmallUnits,
  ntdWords,
  type NtdErrorCode,
  type NtdInternalZeroPolicy,
  type NtdPurpose,
  type NtdPurposeRule,
} from './reference'
import { ntdReferenceVersion } from './sources'

/**
 * The converter itself: an amount as the visitor typed it, plus the purpose
 * they picked, in — a wording they can copy onto a document out. It holds no
 * state and reads nothing from the browser, so an amount never has to leave the
 * call.
 *
 * The amount is carried as a decimal string and then as an integer count of 分.
 * Binary floating point is never the authoritative amount: the accounting upper
 * bound is past Number.MAX_SAFE_INTEGER, so a single `Number()` on the way
 * through would silently write a different amount than the one entered. Every
 * rule is fixed by docs/research/002-ntd-uppercase-rules-and-sources.md.
 */

/** The wording in the pieces it is assembled from, so a page can show them apart. */
export interface NtdWordingParts {
  currency: string
  integer: string
  yuan: string
  fraction: string
}

/** The amount that actually gets written, after the purpose rule applied. */
export interface NtdAmountParts {
  yuan: string
  jiao: number
  fen: number
}

export interface NtdConversion {
  purpose: NtdPurpose
  /** The reviewed rule set this wording follows, for the page to cite. */
  ruleVersion: string
  amount: NtdAmountParts
  /** The written amount, grouped, at the purpose's precision. */
  normalized: string
  /**
   * The amount as entered, present only when the purpose's rounding changed it.
   * A treasury voucher stops at 元, so a visitor has to see both numbers before
   * copying either one.
   */
  roundedFrom?: string
  parts: NtdWordingParts
  wording: string
}

export type NtdConversionOutcome =
  | { state: 'ready', conversion: NtdConversion }
  | { state: 'error', code: NtdErrorCode }

const FULL_WIDTH_DIGIT_OFFSET = 0xFEE0
const GROUP_DIGITS = 4
const FEN_PER_YUAN = 100n

export function convertNtd(input: string, purpose: NtdPurpose): NtdConversionOutcome {
  const rule = ntdPurposeRules[purpose]
  const compact = normalizeInput(input)
  if (!compact) return { state: 'error', code: 'empty' }

  /**
   * Section 5.6 lists the checks in the order they run. Exponents and a leading
   * minus sign pass the format check on purpose: both are recognisable
   * mistakes with an answer of their own, and a generic complaint about the
   * format would not tell the visitor what to write instead.
   */
  if (!isWellFormed(compact)) return { state: 'error', code: 'invalid-format' }
  if (/[eE]/.test(compact)) return { state: 'error', code: 'exponent-notation' }
  if (compact.startsWith('-')) return { state: 'error', code: 'negative' }

  const [integerText = '', fractionText = ''] = compact.split('.')
  if (!isGrouped(integerText) || fractionText.includes(',')) {
    return { state: 'error', code: 'ambiguous-separator' }
  }
  if (fractionText.length > ntdInputRules.maxDecimalDigits) {
    return { state: 'error', code: 'too-many-decimals' }
  }

  const enteredFen = toFen(integerText.replaceAll(',', ''), fractionText)
  if (rule.fractionPolicy === 'reject' && enteredFen % FEN_PER_YUAN !== 0n) {
    return { state: 'error', code: 'fraction-not-supported' }
  }

  const writtenFen = rule.fractionPolicy === 'round-half-up' ? roundToYuan(enteredFen) : enteredFen
  // The range is checked against the amount that would be written, not the one
  // entered, so rounding can never push a wording past its own unit table.
  if (writtenFen > maxFen(rule)) return { state: 'error', code: 'out-of-range' }

  return { state: 'ready', conversion: writeConversion(writtenFen, enteredFen, rule) }
}

function writeConversion(writtenFen: bigint, enteredFen: bigint, rule: NtdPurposeRule): NtdConversion {
  const yuan = writtenFen / FEN_PER_YUAN
  const jiao = Number((writtenFen % FEN_PER_YUAN) / 10n)
  const fen = Number(writtenFen % 10n)
  const parts: NtdWordingParts = {
    currency: ntdWords.currency,
    integer: writeInteger(yuan.toString(), rule.internalZero),
    yuan: ntdWords.yuan,
    fraction: writeFraction(jiao, fen, rule),
  }

  return {
    purpose: rule.id,
    ruleVersion: ntdReferenceVersion,
    amount: { yuan: yuan.toString(), jiao, fen },
    normalized: formatAmount(writtenFen, rule.wordingFractionDigits),
    ...writtenFen === enteredFen ? {} : { roundedFrom: formatAmount(enteredFen, ntdInputRules.maxDecimalDigits) },
    parts,
    wording: `${parts.currency}${parts.integer}${parts.yuan}${parts.fraction}`,
  }
}

/**
 * Section 5.1: absorbs the differences typing habits produce — full-width
 * digits from a Zhuyin keyboard, whitespace pasted out of a spreadsheet — and
 * nothing that could change the amount.
 */
function normalizeInput(value: string) {
  return value
    .replace(/[０-９]/g, digit => String.fromCharCode(digit.charCodeAt(0) - FULL_WIDTH_DIGIT_OFFSET))
    .replace(/，/g, ',')
    .replace(/．/g, '.')
    .replace(/\s/g, '')
}

function isWellFormed(compact: string) {
  const body = compact.startsWith('-') ? compact.slice(1) : compact

  return /^[\d,.eE]+$/.test(body)
    && /\d/.test(body)
    && body.split('.').length <= 2
}

/** Thousands separators are optional, and used only in exact three-digit groups. */
function isGrouped(integerText: string) {
  return !integerText.includes(',')
    || new RegExp(`^\\d{1,${ntdInputRules.groupSize}}(?:,\\d{${ntdInputRules.groupSize}})*$`).test(integerText)
}

function toFen(yuanDigits: string, fractionDigits: string) {
  return BigInt(yuanDigits || '0') * FEN_PER_YUAN + BigInt(fractionDigits.padEnd(2, '0') || '0')
}

/** Half-up at 元, as the National Treasury Administration writes it; amounts are never negative here. */
function roundToYuan(fen: bigint) {
  return (fen + FEN_PER_YUAN / 2n) / FEN_PER_YUAN * FEN_PER_YUAN
}

function maxFen(rule: NtdPurposeRule) {
  const [integer = '', fraction = ''] = rule.maxAmount.split('.')

  return toFen(integer, fraction)
}

/**
 * Section 3.2: four digits to a group, each group followed by its 萬/億/兆 unit.
 * A skipped position is spelled with a single 零 — never two, and never one at
 * the end — unless the purpose omits internal zeros altogether.
 */
function writeInteger(yuanDigits: string, internalZero: NtdInternalZeroPolicy) {
  const digits = yuanDigits.replace(/^0+(?=\d)/, '')
  if (digits === '0') return ntdDigits[0]!

  const padded = digits.padStart(Math.ceil(digits.length / GROUP_DIGITS) * GROUP_DIGITS, '0')
  const groups = padded.match(/\d{4}/g) ?? []
  const zero = internalZero === 'write' ? ntdDigits[0]! : ''

  let wording = ''
  let skippedGroup = false

  groups.forEach((group, position) => {
    const value = Number(group)
    if (value === 0) {
      skippedGroup = Boolean(wording)
      return
    }

    // A group that does not fill its 仟 position also opens with a skipped one.
    if (wording && (skippedGroup || value < 1000)) wording += zero
    wording += writeGroup(group, internalZero) + ntdLargeUnits[groups.length - 1 - position]
    skippedGroup = false
  })

  return wording
}

function writeGroup(group: string, internalZero: NtdInternalZeroPolicy) {
  let wording = ''
  let skippedPosition = false

  for (let position = ntdSmallUnits.length - 1; position >= 0; position -= 1) {
    const digit = Number(group[ntdSmallUnits.length - 1 - position])
    if (digit === 0) {
      if (wording) skippedPosition = true
      continue
    }

    if (skippedPosition && internalZero === 'write') wording += ntdDigits[0]
    wording += `${ntdDigits[digit]}${ntdSmallUnits[position]}`
    skippedPosition = false
  }

  return wording
}

/**
 * Only a purpose that keeps 角 and 分 can still carry a fraction here; the
 * others refused or rounded it away before the wording was written. 零 stands in
 * for a missing 角 so that 分 cannot be read one position too high.
 */
function writeFraction(jiao: number, fen: number, rule: NtdPurposeRule) {
  if (rule.wholeMarker === 'always' || (jiao === 0 && fen === 0)) return ntdWords.whole

  const jiaoText = jiao === 0 ? ntdDigits[0]! : `${ntdDigits[jiao]}${ntdWords.jiao}`

  return fen === 0 ? jiaoText : `${jiaoText}${ntdDigits[fen]}${ntdWords.fen}`
}

/** The amount beside the wording, grouped for the eye that has to compare the two. */
function formatAmount(fen: bigint, fractionDigits: number) {
  const yuan = groupNtdAmount((fen / FEN_PER_YUAN).toString())
  if (fractionDigits === 0) return yuan

  return `${yuan}.${(fen % FEN_PER_YUAN).toString().padStart(fractionDigits, '0')}`
}

/**
 * Groups a decimal amount for reading. Error messages quote a purpose bound
 * through the same function the result panel uses, so a visitor compares two
 * amounts written the same way.
 */
export function groupNtdAmount(amount: string) {
  const [integer = '', fraction] = amount.split('.')
  const grouped = integer.replace(/\B(?=(?:\d{3})+$)/g, ',')

  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}
