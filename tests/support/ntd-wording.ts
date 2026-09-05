import {
  ntdDigits,
  ntdLargeUnits,
  ntdSmallUnits,
  ntdWords,
} from '@/features/tools/ntd-uppercase/domain/reference'

/**
 * Reads a formal wording back to an amount, following section 3.2 of
 * docs/research/002-ntd-uppercase-rules-and-sources.md in reverse. It is the one
 * check that consults neither the vector table nor the converter: if a wording
 * and the amount beside it ever disagree, it fails even when both copies of the
 * table agree with each other.
 *
 * It counts in BigInt because the accounting upper bound is past
 * Number.MAX_SAFE_INTEGER, which is why the decision record refuses binary
 * floating point for the amount.
 */
export function decodeWordingInFen(wording: string) {
  const digitOf = new Map<string, bigint>(ntdDigits.map((digit, value) => [digit, BigInt(value)]))
  const smallUnitOf = new Map<string, bigint>(
    ntdSmallUnits.map((unit, power) => [unit, 10n ** BigInt(power)]).slice(1),
  )
  const largeUnitOf = new Map<string, bigint>(
    ntdLargeUnits.map((unit, index) => [unit, 10n ** BigInt(4 * index)]).slice(1),
  )

  const body = wording.slice(ntdWords.currency.length)
  const yuanAt = body.indexOf(ntdWords.yuan)
  if (yuanAt === -1) throw new Error(`Wording names no ${ntdWords.yuan}: ${wording}`)

  let total = 0n
  let group = 0n
  let digit = 0n

  for (const character of body.slice(0, yuanAt)) {
    const value = digitOf.get(character)
    if (value !== undefined) {
      digit = value
      continue
    }

    const smallUnit = smallUnitOf.get(character)
    if (smallUnit !== undefined) {
      group += digit * smallUnit
      digit = 0n
      continue
    }

    const largeUnit = largeUnitOf.get(character)
    if (largeUnit === undefined) throw new Error(`Unreadable character ${character} in ${wording}`)
    total += (group + digit) * largeUnit
    group = 0n
    digit = 0n
  }

  const fraction = body.slice(yuanAt + ntdWords.yuan.length)
  const jiao = digitOf.get(fraction[fraction.indexOf(ntdWords.jiao) - 1] ?? '') ?? 0n
  const fen = digitOf.get(fraction[fraction.indexOf(ntdWords.fen) - 1] ?? '') ?? 0n

  return (total + group + digit) * 100n + jiao * 10n + fen
}

/** A published amount as 分, so a decoded wording can be compared to it. */
export function normalizedInFen(normalized: string) {
  const [yuan = '0', fraction = ''] = normalized.replaceAll(',', '').split('.')

  return BigInt(yuan) * 100n + BigInt(fraction.padEnd(2, '0') || '0')
}
