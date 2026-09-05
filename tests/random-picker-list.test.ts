import { describe, expect, it } from 'vitest'
import { parseRandomPickerList } from '@/features/tools/random-picker/domain/list'
import { randomPickerLimits } from '@/features/tools/random-picker/domain/reference'

describe('random picker list parsing', () => {
  it('splits on line breaks only, so a name may contain a comma or a space', () => {
    const parsed = parseRandomPickerList('王小明, 業務二部\n李小美（代理）\nA B C', 'keep')

    expect(parsed.entries).toEqual(['王小明, 業務二部', '李小美（代理）', 'A B C'])
  })

  it('trims the whitespace a paste brings without touching the text itself', () => {
    const parsed = parseRandomPickerList('　王小明　\n\tＡｍｙ \n  Bob', 'keep')

    expect(parsed.entries, '全形空格也要去除，但全形字元本身保留').toEqual(['王小明', 'Ａｍｙ', 'Bob'])
  })

  it('skips blank lines and counts them, ignoring a single trailing line break', () => {
    expect(parseRandomPickerList('Amy\n\n  \nBob', 'keep')).toMatchObject({ entries: ['Amy', 'Bob'], blankLines: 2 })
    expect(parseRandomPickerList('Amy\nBob\n', 'keep'), '貼上常見的結尾換行不算略過一行').toMatchObject({
      entries: ['Amy', 'Bob'],
      blankLines: 0,
    })
    expect(parseRandomPickerList('', 'keep')).toMatchObject({ entries: [], blankLines: 0 })
  })

  it('keeps repeated entries apart by default and merges them only on request', () => {
    expect(parseRandomPickerList('Amy\nAmy\nBob', 'keep')).toMatchObject({
      entries: ['Amy', 'Amy', 'Bob'],
      mergedDuplicates: 0,
      hasDuplicates: true,
    })
    expect(parseRandomPickerList('Amy\nAmy\nBob\nAmy', 'merge')).toMatchObject({
      entries: ['Amy', 'Bob'],
      mergedDuplicates: 2,
      hasDuplicates: true,
    })
  })

  it('compares duplicates on the trimmed text, case and width included', () => {
    expect(parseRandomPickerList('Amy\namy', 'merge').entries, '大小寫不同就是不同項目').toEqual(['Amy', 'amy'])
    expect(parseRandomPickerList(' Amy\nAmy ', 'merge').entries, '只差前後空白的是同一項').toEqual(['Amy'])
  })

  it('reports the entries that exceed the documented length ceiling without repeating them', () => {
    const parsed = parseRandomPickerList(`Amy\n${'A'.repeat(randomPickerLimits.maxEntryLength + 1)}`, 'keep')

    expect(parsed.entries).toHaveLength(2)
    expect(parsed.overlongEntries).toBe(1)
    expect(parseRandomPickerList('A'.repeat(randomPickerLimits.maxEntryLength), 'keep').overlongEntries).toBe(0)
  })

  it('counts length in code points, so an emoji name is one character per glyph', () => {
    const parsed = parseRandomPickerList('🎲'.repeat(randomPickerLimits.maxEntryLength), 'keep')

    expect(parsed.overlongEntries, '不得以 UTF-16 長度誤判為過長').toBe(0)
  })
})
