import { expect, it } from 'vitest'
import { defaultOutputFormat } from '@/features/tools/image-compressor/output-settings'

const all = ['image/png', 'image/jpeg', 'image/webp'] as const

it.each([
  ['image/jpeg', all, 'image/jpeg'],
  ['image/webp', all, 'image/webp'],
  ['image/png', all, 'image/jpeg'],
  [undefined, all, 'image/jpeg'],
  ['image/webp', ['image/png', 'image/jpeg'], 'image/jpeg'],
  ['image/jpeg', ['image/png'], 'image/png'],
] as const)('來源 %s、可用 %j 時預設輸出 %s', (source, available, expected) => {
  expect(defaultOutputFormat(source, available)).toBe(expected)
})
