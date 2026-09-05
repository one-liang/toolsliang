import { describe, expect, it } from 'vitest'
import { convertNtd, type NtdConversionOutcome } from '@/features/tools/ntd-uppercase/domain/convert'
import {
  ntdGoldenVectors,
  ntdPurposeRules,
  ntdPurposes,
  ntdRejectionVectors,
  type NtdPurpose,
} from '@/features/tools/ntd-uppercase/domain/reference'
import { ntdReferenceVersion } from '@/features/tools/ntd-uppercase/domain/sources'
import { decodeWordingInFen, normalizedInFen } from './support/ntd-wording'

/** Reads a conversion the test expects to succeed, and says which code it got instead. */
function readyConversion(outcome: NtdConversionOutcome) {
  if (outcome.state !== 'ready') throw new Error(`Expected a conversion, received ${outcome.code}`)

  return outcome.conversion
}

/**
 * A repeatable amount generator. The property checks below have to cover unit
 * boundaries the vector table cannot enumerate, but a converter that fails only
 * on a Tuesday is worse than one that fails always, so the sequence is fixed.
 */
function* sampleAmounts(count: number) {
  let state = 20260905
  for (let index = 0; index < count; index += 1) {
    state = (state * 1103515245 + 12345) % 2 ** 31
    const digits = (state % 16) + 1
    const integer = String(state).repeat(3).slice(0, digits).replace(/^0+(?=\d)/, '')
    yield `${integer}.${String(state % 100).padStart(2, '0')}`
  }
}

describe('convertNtd', () => {
  it.each(ntdGoldenVectors.map(vector => [vector.purpose, vector.input, vector.wording, vector.normalized]))(
    'writes the %s wording for %s',
    (purpose, input, wording, normalized) => {
      const conversion = readyConversion(convertNtd(input, purpose as NtdPurpose))

      expect(conversion.wording).toBe(wording)
      expect(conversion.normalized).toBe(normalized)
    },
  )

  it.each(ntdRejectionVectors.map(vector => [vector.purpose, vector.input, vector.code]))(
    'refuses the %s amount %j with %s',
    (purpose, input, code) => {
      expect(convertNtd(input, purpose as NtdPurpose)).toEqual({ state: 'error', code })
    },
  )

  it('names the reviewed rule version the wording follows', () => {
    expect(readyConversion(convertNtd('1', 'accounting')).ruleVersion).toBe(ntdReferenceVersion)
  })

  it('assembles the wording from parts a page can show separately', () => {
    const conversion = readyConversion(convertNtd('12,850.05', 'accounting'))

    expect(conversion.parts).toEqual({
      currency: '新臺幣',
      integer: '壹萬貳仟捌佰伍拾',
      yuan: '元',
      fraction: '零伍分',
    })
    expect(Object.values(conversion.parts).join('')).toBe(conversion.wording)
    expect(conversion.amount).toEqual({ yuan: '12850', jiao: 0, fen: 5 })
  })

  it('keeps an amount past the safe integer range exact', () => {
    const input = '9007199254740993.01'
    expect(String(Number(input)), '這個金額本來就無法以二進位浮點數表示').not.toBe(input)

    const conversion = readyConversion(convertNtd(input, 'accounting'))

    expect(conversion.normalized).toBe('9,007,199,254,740,993.01')
    expect(conversion.wording).toContain('玖佰玖拾參元零壹分')
    expect(decodeWordingInFen(conversion.wording)).toBe(900719925474099301n)
  })

  it('absorbs typing habits that do not change the amount', () => {
    for (const input of ['　１，２３４．５ ', ' 1,234.5', '1234.50', '01234.5', '.5', '5.']) {
      expect(convertNtd(input, 'accounting').state, `${input} 不改變金額，應可接受`).toBe('ready')
    }
    expect(readyConversion(convertNtd('　１，２３４．５ ', 'accounting')).wording)
      .toBe('新臺幣壹仟貳佰參拾肆元伍角')
    expect(readyConversion(convertNtd('.5', 'accounting')).normalized).toBe('0.50')
    expect(readyConversion(convertNtd('5.', 'accounting')).normalized).toBe('5.00')
  })

  it('shows what the treasury rounding changed, and stays quiet when it changed nothing', () => {
    const rounded = readyConversion(convertNtd('12,850.5', 'treasury'))

    expect(rounded.roundedFrom, '四捨五入改變了金額，必須顯示捨入前後').toBe('12,850.50')
    expect(rounded.normalized).toBe('12,851')
    expect(readyConversion(convertNtd('0.05', 'treasury')).roundedFrom).toBe('0.05')
    expect(readyConversion(convertNtd('12,850', 'treasury')).roundedFrom).toBeUndefined()
    expect(readyConversion(convertNtd('12,850.00', 'treasury')).roundedFrom).toBeUndefined()
  })

  it('never rounds for a purpose that does not round', () => {
    expect(readyConversion(convertNtd('12850.50', 'accounting')).roundedFrom).toBeUndefined()
    expect(readyConversion(convertNtd('12850.00', 'cheque')).roundedFrom).toBeUndefined()
  })

  it('writes the same amount differently for each purpose the user picks', () => {
    const wordings = ntdPurposes.map(purpose => readyConversion(convertNtd('100000001', purpose)).wording)

    expect(wordings).toEqual([
      '新臺幣壹億零壹元整',
      '新臺幣壹億零壹元整',
      '新臺幣壹億壹元整',
    ])
    expect(readyConversion(convertNtd('100000001', 'cheque')).normalized).toBe('100,000,001')
  })

  it('refuses the first amount past each purpose bound and accepts the bound itself', () => {
    for (const purpose of ntdPurposes) {
      const rule = ntdPurposeRules[purpose]

      expect(convertNtd(rule.maxAmount, purpose).state, `${purpose} 上限本身必須可換寫`).toBe('ready')
      expect(convertNtd(`1${'0'.repeat(rule.maxIntegerDigits)}`, purpose))
        .toEqual({ state: 'error', code: 'out-of-range' })
    }
  })

  it('reads every wording it writes back to the amount beside it', () => {
    for (const amount of sampleAmounts(400)) {
      for (const purpose of ntdPurposes) {
        const outcome = convertNtd(amount, purpose)
        if (outcome.state !== 'ready') continue

        expect(decodeWordingInFen(outcome.conversion.wording), `${purpose} ${amount}`)
          .toBe(normalizedInFen(outcome.conversion.normalized))
      }
    }
  })

  it('keeps every purpose difference to the four the decision record names', () => {
    for (const amount of sampleAmounts(200)) {
      const accounting = convertNtd(amount.split('.')[0]!, 'accounting')
      if (accounting.state !== 'ready') continue
      const wording = accounting.conversion.wording

      const cheque = convertNtd(amount.split('.')[0]!, 'cheque')
      if (cheque.state === 'ready') expect(cheque.conversion.wording).toBe(wording)

      const treasury = convertNtd(amount.split('.')[0]!, 'treasury')
      if (treasury.state === 'ready' && normalizedInFen(treasury.conversion.normalized) !== 0n) {
        expect(treasury.conversion.wording).toBe(wording.replaceAll('零', ''))
      }
    }
  })

  it('answers the same question the same way every time', () => {
    expect(convertNtd('1,018', 'cheque')).toEqual(convertNtd('1018', 'cheque'))
  })
})
