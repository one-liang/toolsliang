import { describe, expect, it } from 'vitest'
import {
  ntdChequeNumerals,
  ntdDigits,
  ntdErrorCodes,
  ntdGoldenVectors,
  ntdInputRules,
  ntdLargeUnits,
  ntdPurposeRules,
  ntdPurposes,
  ntdRejectionVectors,
  ntdSmallUnits,
  ntdWords,
  type NtdErrorCode,
  type NtdGoldenVector,
  type NtdPurpose,
} from '@/features/tools/ntd-uppercase/domain/reference'
import {
  ntdCaveatKeys,
  ntdContentReview,
  ntdReferenceVersion,
} from '@/features/tools/ntd-uppercase/domain/sources'
import {
  ntdDecisionRecord as decisionRecord,
  parseCaveatKeys,
  parseErrorCodes,
  parseRejectionVectors,
  parseWordingVectors,
} from './support/ntd-decision-record'
import { decodeWordingInFen, normalizedInFen } from './support/ntd-wording'

/** Characters a wording may contain, beyond the numerals its purpose allows. */
const structuralCharacters = [ntdWords.currency, ntdWords.yuan, ntdWords.whole, ntdWords.jiao, ntdWords.fen]
  .join('')
  .split('')

function allowedCharacters(purpose: NtdPurpose) {
  const rule = ntdPurposeRules[purpose]
  const largeUnits = ntdLargeUnits.slice(1, rule.maxLargeUnitIndex + 1)

  return new Set([
    ...ntdDigits,
    ...ntdSmallUnits.filter(unit => unit !== ''),
    ...largeUnits,
    ...structuralCharacters,
  ])
}

function vectorsFor(purpose: NtdPurpose) {
  return ntdGoldenVectors.filter(vector => vector.purpose === purpose)
}

/** A wording is whole-yuan when it names neither 角 nor 分. */
function isWholeYuan(vector: NtdGoldenVector) {
  return !vector.wording.includes(ntdWords.jiao) && !vector.wording.includes(ntdWords.fen)
}

/**
 * The accounting vector standing for the same yuan amount. Every cheque vector
 * and every non-zero treasury vector must have one, so this throws rather than
 * letting invariants 7 and 8 quietly assert nothing.
 */
function accountingCounterpart(normalizedWholeAmount: string) {
  const counterpart = vectorsFor('accounting')
    .find(vector => vector.normalized === `${normalizedWholeAmount}.00`)
  if (!counterpart) throw new Error(`No accounting vector for NT$${normalizedWholeAmount}`)

  return counterpart
}

describe('ntd character set', () => {
  it('uses the formal digits in the order they stand for', () => {
    expect([...ntdDigits]).toEqual(['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'])
    expect([...ntdSmallUnits]).toEqual(['', '拾', '佰', '仟'])
    expect([...ntdLargeUnits]).toEqual(['', '萬', '億', '兆'])
  })

  it('writes the currency name with the formal 臺', () => {
    expect(ntdWords.currency).toBe('新臺幣')
  })

  it('lists the cheque numerals as the Central Bank rule does, and 兆 is not among them', () => {
    expect([...ntdChequeNumerals]).toEqual([
      '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖', '拾', '佰', '仟', '萬', '億', '零',
    ])
    expect(ntdChequeNumerals).not.toContain('兆')
  })

  it('gives the cheque purpose exactly the numerals that source list allows', () => {
    const rule = ntdPurposeRules.cheque
    const reachable = new Set([
      ...ntdDigits,
      ...ntdSmallUnits.slice(1),
      ...ntdLargeUnits.slice(1, rule.maxLargeUnitIndex + 1),
    ])

    expect([...reachable].sort()).toEqual([...ntdChequeNumerals].sort())
  })
})

describe('purpose rules', () => {
  it('publishes exactly the three researched purposes', () => {
    expect([...ntdPurposes]).toEqual(['accounting', 'cheque', 'treasury'])
    expect(Object.keys(ntdPurposeRules).sort()).toEqual([...ntdPurposes].sort())
  })

  it('derives the integer capacity from the largest large unit each purpose may use', () => {
    ntdPurposes.forEach((purpose) => {
      const rule = ntdPurposeRules[purpose]
      expect(rule.maxIntegerDigits).toBe(4 * (rule.maxLargeUnitIndex + 1))
    })
  })

  it('states the upper bound as the largest amount those digits can express', () => {
    ntdPurposes.forEach((purpose) => {
      const rule = ntdPurposeRules[purpose]
      const [integer, fraction = ''] = rule.maxAmount.split('.')

      expect(integer).toBe('9'.repeat(rule.maxIntegerDigits))
      expect(fraction).toBe('9'.repeat(rule.wordingFractionDigits))
    })
  })

  it('caps the cheque at 億 because 兆 is outside its character set', () => {
    expect(ntdPurposeRules.cheque.maxLargeUnitIndex).toBe(ntdLargeUnits.indexOf('億'))
    expect(ntdPurposeRules.cheque.maxAmount).toBe('999999999999')
  })

  it('keeps 角 and 分 only where the source allows them', () => {
    expect(ntdPurposeRules.accounting.wordingFractionDigits).toBe(2)
    expect(ntdPurposeRules.accounting.fractionPolicy).toBe('keep')
    expect(ntdPurposeRules.cheque.wordingFractionDigits).toBe(0)
    expect(ntdPurposeRules.cheque.fractionPolicy).toBe('reject')
    expect(ntdPurposeRules.treasury.wordingFractionDigits).toBe(0)
    expect(ntdPurposeRules.treasury.fractionPolicy).toBe('round-half-up')
  })

  it('omits the internal 零 only on the treasury voucher', () => {
    expect(ntdPurposeRules.accounting.internalZero).toBe('write')
    expect(ntdPurposeRules.cheque.internalZero).toBe('write')
    expect(ntdPurposeRules.treasury.internalZero).toBe('omit')
  })

  it('accepts at most two decimal places from the field, whatever the purpose', () => {
    expect(ntdInputRules.maxDecimalDigits).toBe(2)
    ntdPurposes.forEach((purpose) => {
      expect(ntdPurposeRules[purpose].wordingFractionDigits).toBeLessThanOrEqual(ntdInputRules.maxDecimalDigits)
    })
  })
})

describe('wording vectors', () => {
  it('matches the decision record row for row', () => {
    const documented = parseWordingVectors()

    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual(ntdGoldenVectors.map(({ input, purpose, normalized, wording }) => ({
      input,
      purpose,
      normalized,
      wording,
    })))
  })

  it('opens every wording with the currency name and states 元', () => {
    ntdGoldenVectors.forEach((vector) => {
      expect(vector.wording.startsWith(ntdWords.currency)).toBe(true)
      expect(vector.wording).toContain(ntdWords.yuan)
    })
  })

  it('never uses a character its purpose does not allow', () => {
    ntdGoldenVectors.forEach((vector) => {
      const allowed = allowedCharacters(vector.purpose)
      const unexpected = [...vector.wording].filter(character => !allowed.has(character))

      expect(unexpected).toEqual([])
    })
  })

  it('never writes a bare 拾, so 壹拾 cannot be read as an omission', () => {
    ntdGoldenVectors.forEach((vector) => {
      const digits = new Set<string>(ntdDigits)

      ;[...vector.wording].forEach((character, index) => {
        if (character !== '拾') return
        expect(digits.has(vector.wording[index - 1] ?? '')).toBe(true)
      })
    })
  })

  it('never doubles 零, never writes 另, and closes the yuan on a digit unless the amount is under one yuan', () => {
    ntdGoldenVectors.forEach((vector) => {
      const startsBelowOneYuan = vector.normalized.startsWith('0')

      expect(vector.wording).not.toContain('零零')
      expect(vector.wording).not.toContain('另')
      expect(vector.wording.includes(`零${ntdWords.yuan}`)).toBe(startsBelowOneYuan)
    })
  })

  it('closes with 整 exactly when the amount has no 角 and no 分', () => {
    ntdGoldenVectors.forEach((vector) => {
      expect(vector.wording.endsWith(ntdWords.whole)).toBe(isWholeYuan(vector))
    })
  })

  it('writes the treasury voucher as the accounting wording with every 零 removed', () => {
    const treasuryVectors = vectorsFor('treasury').filter(vector => normalizedInFen(vector.normalized) !== 0n)

    expect(treasuryVectors.length).toBeGreaterThan(0)
    treasuryVectors.forEach((vector) => {
      expect(vector.wording).toBe(accountingCounterpart(vector.normalized).wording.replaceAll('零', ''))
    })
  })

  it('writes a cheque exactly like the accounting wording for the same amount', () => {
    const chequeVectors = vectorsFor('cheque')

    expect(chequeVectors.length).toBeGreaterThan(0)
    chequeVectors.forEach((vector) => {
      expect(vector.wording).toBe(accountingCounterpart(vector.normalized).wording)
    })
  })

  it('reads every wording back to the amount it normalized', () => {
    ntdGoldenVectors.forEach((vector) => {
      expect(decodeWordingInFen(vector.wording)).toBe(normalizedInFen(vector.normalized))
    })
  })

  it('leaves a treasury wording that reads as a larger amount colloquially', () => {
    const hazard = vectorsFor('treasury').find(vector => vector.input === '101')

    expect(hazard?.wording).toBe('新臺幣壹佰壹元整')
    expect(accountingCounterpart(hazard!.normalized).wording).toBe('新臺幣壹佰零壹元整')
  })

  it('normalizes to the fraction digits its purpose publishes', () => {
    ntdGoldenVectors.forEach((vector) => {
      const [, fraction = ''] = vector.normalized.split('.')

      expect(fraction.length).toBe(ntdPurposeRules[vector.purpose].wordingFractionDigits)
    })
  })
})

describe('rejection vectors', () => {
  it('matches the decision record row for row', () => {
    const documented = parseRejectionVectors()

    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual(ntdRejectionVectors.map(({ input, purpose, code }) => ({ input, purpose, code })))
  })

  it('publishes the same error keys as the decision record, in the same check order', () => {
    expect(parseErrorCodes()).toEqual([...ntdErrorCodes])
  })

  it('orders the keys so precision beats the purpose rule and the purpose rule beats the range', () => {
    const order = (code: NtdErrorCode) => ntdErrorCodes.indexOf(code)

    expect(order('too-many-decimals')).toBeLessThan(order('fraction-not-supported'))
    expect(order('fraction-not-supported')).toBeLessThan(order('out-of-range'))
    expect(order('negative')).toBeLessThan(order('too-many-decimals'))
  })

  it('pins the case each ordering rule decides', () => {
    const casesFor = (input: string, purpose: NtdPurpose) =>
      ntdRejectionVectors.find(vector => vector.input === input && vector.purpose === purpose)?.code

    expect(casesFor('12.345', 'cheque')).toBe('too-many-decimals')
    expect(casesFor('999999999999.4', 'cheque')).toBe('fraction-not-supported')
    expect(casesFor('9999999999999999.5', 'treasury')).toBe('out-of-range')
    expect(casesFor('-0.01', 'treasury')).toBe('negative')
  })

  it('exercises every error key at least once', () => {
    ntdErrorCodes.forEach((code) => {
      expect(ntdRejectionVectors.some(vector => vector.code === code)).toBe(true)
    })
  })

  it('only rejects with a published key', () => {
    ntdRejectionVectors.forEach((vector) => {
      expect(ntdErrorCodes).toContain(vector.code)
      expect(ntdPurposes).toContain(vector.purpose)
    })
  })
})

describe('sources and caveats', () => {
  it('names the reviewed rule version in the decision record, dated by its review', () => {
    expect(decisionRecord).toContain(ntdReferenceVersion)
    expect(ntdReferenceVersion).toContain(ntdContentReview.reviewedAt)
  })

  it('dates the review and the newest edition it cites', () => {
    expect(ntdContentReview.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(ntdContentReview.sourceEffectiveAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('cites every source the tool page will link', () => {
    expect(ntdContentReview.sources.length).toBeGreaterThan(0)
    ntdContentReview.sources.forEach((source) => {
      expect(source.url.startsWith('https://')).toBe(true)
      expect(decisionRecord).toContain(source.url)
      expect(source.title['zh-tw'].length).toBeGreaterThan(0)
      expect(source.title.en.length).toBeGreaterThan(0)
    })
  })

  it('reviews the sources no earlier than the newest edition it cites', () => {
    expect(ntdContentReview.reviewedAt >= ntdContentReview.sourceEffectiveAt).toBe(true)
  })

  it('publishes the same caveat keys as the decision record', () => {
    expect(parseCaveatKeys()).toEqual([...ntdCaveatKeys])
  })
})
