import { describe, expect, it } from 'vitest'
import { convertNtd } from '@/features/tools/ntd-uppercase/domain/convert'

describe('convertNtd', () => {
  it.each([
    ['0', '新台幣零元整'],
    ['10', '新台幣壹拾元整'],
    ['101', '新台幣壹佰零壹元整'],
    ['10001', '新台幣壹萬零壹元整'],
    ['12850.50', '新台幣壹萬貳仟捌佰伍拾元伍角'],
    ['100000000.09', '新台幣壹億元玖分'],
  ])('converts %s using formal Chinese numerals', (input, expected) => {
    expect(convertNtd(input).uppercase).toBe(expected)
  })

  it('normalizes an amount without sending or mutating input', () => {
    expect(convertNtd('1,234.5').normalized).toBe('1,234.50')
  })

  it.each(['-1', '12.345', 'abc', '', '1e3'])('rejects invalid amount %s', (input) => {
    expect(() => convertNtd(input)).toThrow()
  })
})
