const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖']
const smallUnits = ['', '拾', '佰', '仟']
const largeUnits = ['', '萬', '億', '兆']

function convertGroup(value: number) {
  let output = ''
  let zeroPending = false

  for (let position = 3; position >= 0; position -= 1) {
    const divisor = 10 ** position
    const digit = Math.floor(value / divisor) % 10
    if (digit === 0) {
      if (output) zeroPending = true
      continue
    }
    if (zeroPending) output += digits[0]
    output += `${digits[digit]}${smallUnits[position]}`
    zeroPending = false
  }

  return output
}

function convertInteger(value: number) {
  if (value === 0) return digits[0]

  const groups: number[] = []
  let remaining = value
  while (remaining > 0) {
    groups.push(remaining % 10000)
    remaining = Math.floor(remaining / 10000)
  }

  let output = ''
  let needsZero = false
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index] ?? 0
    if (group === 0) {
      needsZero = Boolean(output)
      continue
    }
    if (output && (needsZero || group < 1000)) output += digits[0]
    output += `${convertGroup(group)}${largeUnits[index]}`
    needsZero = false
  }
  return output
}

export interface NtdConversion {
  normalized: string
  uppercase: string
}

export type NtdConversionErrorCode = 'invalid-format' | 'out-of-range'

export class NtdConversionError extends Error {
  constructor(public readonly code: NtdConversionErrorCode) {
    super(code)
    this.name = 'NtdConversionError'
  }
}

export function convertNtd(input: string | number): NtdConversion {
  const compact = String(input).replaceAll(',', '').trim()
  if (!/^\d+(\.\d{0,2})?$/.test(compact)) {
    throw new NtdConversionError('invalid-format')
  }

  const amount = Number(compact)
  if (!Number.isSafeInteger(Math.round(amount * 100)) || amount > 89_000_000_000_000) {
    throw new NtdConversionError('out-of-range')
  }

  const cents = Math.round(amount * 100)
  const integer = Math.floor(cents / 100)
  const jiao = Math.floor((cents % 100) / 10)
  const fen = cents % 10
  let fraction = ''
  if (jiao) fraction += `${digits[jiao]}角`
  if (fen) fraction += `${digits[fen]}分`
  if (!fraction) fraction = '整'

  return {
    normalized: (cents / 100).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    uppercase: `新臺幣${convertInteger(integer)}元${fraction}`,
  }
}
