/**
 * Sampling decisions for the local random picker: the ceilings a list has to
 * stay inside, the two duplicate policies, the order the checks run in, and the
 * vectors an implementation has to reproduce. Every value is traceable to
 * docs/research/003-random-picker-fairness-and-sources.md, and
 * tests/random-picker-reference.test.ts keeps the two from drifting apart.
 */

/**
 * Section 4.4. The entry ceiling follows the performance budget of the product
 * specification; the wheel ceilings follow what a 375px-wide screen can still
 * render as readable slices.
 */
export const randomPickerLimits = {
  maxEntries: 10_000,
  maxEntryLength: 120,
  wheelMinEntries: 2,
  wheelMaxEntries: 48,
} as const

/**
 * Section 4.3. `keep` gives every line its own chance, `merge` collapses lines
 * whose trimmed text is identical. The choice belongs to the visitor because
 * both readings of a repeated name are legitimate.
 */
export const duplicatePolicies = ['keep', 'merge'] as const

export type DuplicatePolicy = typeof duplicatePolicies[number]

/** How the drawn result is shown. The wheel never takes part in choosing it. */
export const randomPickerPresentations = ['list', 'wheel'] as const

export type RandomPickerPresentation = typeof randomPickerPresentations[number]

/**
 * Section 5.3, listed in the order the checks run: the first one that fails is
 * the error the visitor sees, and only that one. The order decides which
 * message wins when two boundaries meet — the random source before anything
 * else, the list before the draw count, and the entry length before the entry
 * count.
 */
export const randomPickerErrorCodes = [
  'randomness-unavailable',
  'empty',
  'no-entries',
  'entry-too-long',
  'too-many-entries',
  'draw-count-invalid',
  'draw-count-exceeds-entries',
] as const

export type RandomPickerErrorCode = typeof randomPickerErrorCodes[number]

export interface RandomPickerListVector {
  /** Exactly what the visitor pasted, before any normalization. */
  input: string
  policy: DuplicatePolicy
  entries: string[]
  blankLines: number
  mergedDuplicates: number
}

/** Section 6.1: every parsing decision the document pins down, as data. */
export const randomPickerListVectors: RandomPickerListVector[] = [
  { input: 'Amy\nBob\nCindy', policy: 'keep', entries: ['Amy', 'Bob', 'Cindy'], blankLines: 0, mergedDuplicates: 0 },
  { input: 'Amy\r\nBob\rCindy', policy: 'keep', entries: ['Amy', 'Bob', 'Cindy'], blankLines: 0, mergedDuplicates: 0 },
  { input: '  Amy  \n\tBob\t', policy: 'keep', entries: ['Amy', 'Bob'], blankLines: 0, mergedDuplicates: 0 },
  { input: '　王小明　\n李小美', policy: 'keep', entries: ['王小明', '李小美'], blankLines: 0, mergedDuplicates: 0 },
  { input: 'Amy\n\n  \nBob', policy: 'keep', entries: ['Amy', 'Bob'], blankLines: 2, mergedDuplicates: 0 },
  { input: 'Amy\nBob\n', policy: 'keep', entries: ['Amy', 'Bob'], blankLines: 0, mergedDuplicates: 0 },
  { input: '\n\n', policy: 'keep', entries: [], blankLines: 2, mergedDuplicates: 0 },
  { input: '', policy: 'keep', entries: [], blankLines: 0, mergedDuplicates: 0 },
  { input: '   ', policy: 'keep', entries: [], blankLines: 1, mergedDuplicates: 0 },
  { input: 'A, B\nC', policy: 'keep', entries: ['A, B', 'C'], blankLines: 0, mergedDuplicates: 0 },
  { input: 'Amy\nAmy\nBob', policy: 'keep', entries: ['Amy', 'Amy', 'Bob'], blankLines: 0, mergedDuplicates: 0 },
  { input: 'Amy\nAmy\nBob\nAmy', policy: 'merge', entries: ['Amy', 'Bob'], blankLines: 0, mergedDuplicates: 2 },
  { input: 'Amy\namy', policy: 'merge', entries: ['Amy', 'amy'], blankLines: 0, mergedDuplicates: 0 },
  { input: ' Amy\nAmy ', policy: 'merge', entries: ['Amy'], blankLines: 0, mergedDuplicates: 1 },
]

export interface RandomPickerRejectionVector {
  /**
   * Built on demand: two of these cases are lists of ten thousand entries, and
   * a vector table is not a reason to hold them in memory from module load.
   */
  buildText: () => string
  drawCount: number
  hasSecureRandom: boolean
  code: RandomPickerErrorCode
}

const overlongEntry = 'A'.repeat(randomPickerLimits.maxEntryLength + 1)

function repeatEntries(count: number, entry = 'entry') {
  return Array.from({ length: count }, (_, index) => `${entry}-${index}`).join('\n')
}

/** Section 6.2: one case per error key, plus the two order-sensitive collisions. */
export const randomPickerRejectionVectors: RandomPickerRejectionVector[] = [
  { buildText: () => 'Amy\nBob', drawCount: 1, hasSecureRandom: false, code: 'randomness-unavailable' },
  { buildText: () => '', drawCount: 1, hasSecureRandom: true, code: 'empty' },
  { buildText: () => '   \n  ', drawCount: 1, hasSecureRandom: true, code: 'no-entries' },
  { buildText: () => overlongEntry, drawCount: 1, hasSecureRandom: true, code: 'entry-too-long' },
  { buildText: () => repeatEntries(randomPickerLimits.maxEntries + 1), drawCount: 1, hasSecureRandom: true, code: 'too-many-entries' },
  { buildText: () => 'Amy\nBob', drawCount: 0, hasSecureRandom: true, code: 'draw-count-invalid' },
  { buildText: () => 'Amy\nBob', drawCount: 1.5, hasSecureRandom: true, code: 'draw-count-invalid' },
  { buildText: () => 'Amy\nBob', drawCount: 3, hasSecureRandom: true, code: 'draw-count-exceeds-entries' },
  {
    buildText: () => `${overlongEntry}\n${repeatEntries(randomPickerLimits.maxEntries + 1)}`,
    drawCount: 1,
    hasSecureRandom: true,
    code: 'entry-too-long',
  },
]
