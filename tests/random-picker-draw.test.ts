import { describe, expect, it } from 'vitest'
import {
  drawRandomPicks,
  planRandomPicker,
  randomIndexBelow,
  randomWordCeiling,
  rejectionLimit,
  secureRandomWords,
  type RandomWords,
} from '@/features/tools/random-picker/domain/draw'
import {
  randomPickerLimits,
  randomPickerRejectionVectors,
} from '@/features/tools/random-picker/domain/reference'

/** A source that hands out exactly the words a test names, in order. */
function scriptedWords(words: number[]): RandomWords {
  let cursor = 0

  return (count: number) => {
    const drawn = words.slice(cursor, cursor + count)
    if (drawn.length < count) throw new Error('scripted random source ran out of words')
    cursor += count

    return Uint32Array.from(drawn)
  }
}

function listOf(size: number) {
  return Array.from({ length: size }, (_, index) => `entry-${index}`)
}

describe('unbiased index sampling', () => {
  it('accepts only a window whose length is a whole multiple of the bound', () => {
    for (const bound of [1, 2, 3, 5, 6, 7, 10, 999, 10_000]) {
      const limit = rejectionLimit(bound)

      expect(limit % bound, `${bound} 的接受區間必須整除`).toBe(0)
      expect(randomWordCeiling - limit, `丟棄區間必須小於 ${bound}`).toBeLessThan(bound)
    }
    expect(rejectionLimit(1), '單一項目不需要丟棄任何隨機值').toBe(randomWordCeiling)
  })

  it('discards a word from the incomplete tail instead of folding it back', () => {
    const bound = 3
    const limit = rejectionLimit(bound)

    expect(randomIndexBelow(bound, scriptedWords([limit, limit, 7])), '尾段的隨機值必須丟棄重取').toBe(1)
    expect(randomIndexBelow(bound, scriptedWords([limit - 1]))).toBe((limit - 1) % bound)
  })

  it('returns a value inside the bound for every accepted word', () => {
    for (const bound of [1, 2, 3, 17]) {
      for (const word of [0, 1, 2, 3, bound, rejectionLimit(bound) - 1]) {
        const index = randomIndexBelow(bound, scriptedWords([word]))

        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(bound)
      }
    }
  })

  it('stops instead of guessing when the random source never yields an acceptable word', () => {
    const stuck = () => Uint32Array.from([randomWordCeiling - 1])

    expect(() => randomIndexBelow(3, stuck)).toThrow(/random/i)
  })

  it('never draws the same position twice, and draws exactly what was asked for', () => {
    const entries = listOf(8)
    const picks = drawRandomPicks(entries, 3, secureRandomWords(globalThis.crypto)!)

    expect(picks).toHaveLength(3)
    expect(new Set(picks.map(pick => pick.index)).size, '多人抽選不得重複中選').toBe(3)
    for (const pick of picks) expect(entries[pick.index]).toBe(pick.entry)
  })

  it('produces a permutation when every entry is drawn', () => {
    const entries = listOf(25)
    const picks = drawRandomPicks(entries, entries.length, secureRandomWords(globalThis.crypto)!)

    expect(picks.map(pick => pick.entry).sort()).toEqual([...entries].sort())
  })

  it('depends on the random words alone, never on the text of an entry', () => {
    const words = [11, 29, 5, 41, 7]
    const first = drawRandomPicks(listOf(5), 3, scriptedWords(words))
    const second = drawRandomPicks(['甲', '乙', '丙', '丁', '戊'], 3, scriptedWords(words))

    expect(second.map(pick => pick.index), '同一段隨機位元必須抽出同一組位置').toEqual(first.map(pick => pick.index))
    expect(drawRandomPicks(listOf(5), 3, scriptedWords(words)).map(pick => pick.entry))
      .toEqual(first.map(pick => pick.entry))
  })

  it('spreads a real draw evenly enough to catch a gross implementation error', () => {
    const entries = listOf(6)
    const rounds = 60_000
    const counts = new Map(entries.map(entry => [entry, 0]))
    const randomWords = secureRandomWords(globalThis.crypto)!

    for (let round = 0; round < rounds; round += 1) {
      const [pick] = drawRandomPicks(entries, 1, randomWords)
      counts.set(pick!.entry, counts.get(pick!.entry)! + 1)
    }

    const expected = rounds / entries.length
    for (const [entry, count] of counts) {
      expect(count, `${entry} 的出現次數應接近期望值`).toBeGreaterThan(expected * 0.95)
      expect(count, `${entry} 的出現次數應接近期望值`).toBeLessThan(expected * 1.05)
    }
  })

  it('parses and draws a full-size list well inside the performance budget', () => {
    const text = listOf(randomPickerLimits.maxEntries).join('\n')
    const randomWords = secureRandomWords(globalThis.crypto)!

    const startedAt = performance.now()
    const outcome = planRandomPicker({ text, duplicates: 'keep', drawCount: 10, hasSecureRandom: true })
    if (outcome.state !== 'ready') throw new Error(`planning failed: ${outcome.code}`)
    const picks = drawRandomPicks(outcome.list.entries, outcome.drawCount, randomWords)
    const duration = performance.now() - startedAt

    expect(picks).toHaveLength(10)
    expect(duration, '一萬筆名單的解析與抽選需在 200ms 內完成').toBeLessThan(200)
  })
})

describe('random picker planning', () => {
  it('accepts a usable list and reports what the draw will run on', () => {
    const outcome = planRandomPicker({ text: 'Amy\nBob\nCindy', duplicates: 'keep', drawCount: 2, hasSecureRandom: true })

    expect(outcome).toMatchObject({
      state: 'ready',
      drawCount: 2,
      list: { entries: ['Amy', 'Bob', 'Cindy'] },
    })
  })

  it('reports the parsed list on a refusal too, so the page never counts the entries twice', () => {
    const outcome = planRandomPicker({ text: 'Amy\n\nBob', duplicates: 'keep', drawCount: 9, hasSecureRandom: true })

    expect(outcome.list, '被拒絕的名單仍要說得出它解析到什麼').toMatchObject({
      entries: ['Amy', 'Bob'],
      blankLines: 1,
    })
  })

  it('refuses every documented rejection case with its own error key', () => {
    for (const vector of randomPickerRejectionVectors) {
      const outcome = planRandomPicker({
        text: vector.buildText(),
        duplicates: 'keep',
        drawCount: vector.drawCount,
        hasSecureRandom: vector.hasSecureRandom,
      })

      expect(outcome.state).toBe('error')
      expect(outcome.state === 'error' && outcome.code, vector.code).toBe(vector.code)
    }
  })

  it('checks the list before the draw count, and the entry length before the entry count', () => {
    const tooMany = listOf(randomPickerLimits.maxEntries + 1).join('\n')

    expect(planRandomPicker({ text: tooMany, duplicates: 'keep', drawCount: 0, hasSecureRandom: true }))
      .toMatchObject({ state: 'error', code: 'too-many-entries' })
    expect(planRandomPicker({
      text: `${'A'.repeat(randomPickerLimits.maxEntryLength + 1)}\n${tooMany}`,
      duplicates: 'keep',
      drawCount: 1,
      hasSecureRandom: true,
    }), '貼錯整份文件時，過長的項目才是使用者要看到的線索').toMatchObject({ state: 'error', code: 'entry-too-long' })
  })

  it('quotes the numbers a refusal needs and never the entries themselves', () => {
    const outcome = planRandomPicker({ text: 'Amy\nBob', duplicates: 'keep', drawCount: 5, hasSecureRandom: true })
    if (outcome.state !== 'error') throw new Error('這筆抽選應該被拒絕')

    expect(outcome.code).toBe('draw-count-exceeds-entries')
    expect(outcome.values).toEqual({ count: 5, entries: 2 })
    expect(Object.values(outcome.values).every(value => typeof value === 'number'), '錯誤數值不得帶出名單文字')
      .toBe(true)
  })

  it('counts merged duplicates against the ceiling, because merging is what the draw runs on', () => {
    const text = [...listOf(randomPickerLimits.maxEntries), 'entry-0'].join('\n')

    expect(planRandomPicker({ text, duplicates: 'merge', drawCount: 1, hasSecureRandom: true }))
      .toMatchObject({ state: 'ready' })
    expect(planRandomPicker({ text, duplicates: 'keep', drawCount: 1, hasSecureRandom: true }))
      .toMatchObject({ state: 'error', code: 'too-many-entries' })
  })
})

describe('secure random source', () => {
  it('reports nothing when the browser has no cryptographic source, instead of falling back', () => {
    expect(secureRandomWords(undefined)).toBeUndefined()
    expect(secureRandomWords({} as Crypto)).toBeUndefined()
    expect(secureRandomWords(globalThis.crypto)).toBeTypeOf('function')
  })

  it('fills the exact number of words asked for', () => {
    const words = secureRandomWords(globalThis.crypto)!(4)

    expect(words).toBeInstanceOf(Uint32Array)
    expect(words).toHaveLength(4)
  })
})
