import { parseRandomPickerList, type RandomPickerList } from './list'
import {
  randomPickerLimits,
  type DuplicatePolicy,
  type RandomPickerErrorCode,
} from './reference'

/**
 * The draw itself: a list as the visitor typed it plus how many names to take
 * in, the chosen positions out. It holds no state and reads nothing from the
 * browser — the random source is a parameter — so a candidate list never has to
 * leave the call, and a test can replay an exact sequence of random words.
 *
 * Equal probability is the whole product claim, so it is built rather than
 * assumed: `word % n` is never used on a raw random word, because 2³² is not a
 * multiple of most list lengths and the low residues would quietly get an extra
 * word each. Every rule is fixed by
 * docs/research/003-random-picker-fairness-and-sources.md.
 */

/** A source of uniform 32-bit words; the browser's is one implementation. */
export type RandomWords = (count: number) => Uint32Array

export interface RandomPickerPick {
  /** Position in the parsed list, which is what the wheel points at. */
  index: number
  entry: string
}

export interface RandomPickerRequest {
  text: string
  duplicates: DuplicatePolicy
  drawCount: number
  hasSecureRandom: boolean
}

export interface RandomPickerPlan {
  list: RandomPickerList
  drawCount: number
}

/** Numbers a refusal needs to be actionable. Never an entry: those stay on the page. */
export interface RandomPickerErrorValues {
  limit?: number
  count?: number
  entries?: number
}

export type RandomPickerOutcome =
  | { state: 'ready', plan: RandomPickerPlan }
  | { state: 'error', code: RandomPickerErrorCode, values: RandomPickerErrorValues }

export const randomWordCeiling = 2 ** 32
/**
 * At the ten-thousand entry ceiling a word is discarded with probability below
 * 2.4 × 10⁻⁶, so reaching this many rounds does not mean bad luck: it means the
 * source is not producing uniform words and must not be used for a draw.
 */
const MAX_REJECTION_ROUNDS = 64

/**
 * The largest multiple of `bound` that fits in a 32-bit word. Because the
 * accepted window is a whole number of bounds, every result inside it is backed
 * by exactly the same number of words — which is the equal-probability
 * guarantee, stated as arithmetic rather than as a claim.
 */
export function rejectionLimit(bound: number) {
  return randomWordCeiling - (randomWordCeiling % bound)
}

export function randomIndexBelow(bound: number, randomWords: RandomWords) {
  if (!Number.isInteger(bound) || bound < 1) throw new RangeError('A draw needs at least one position to choose from')

  const limit = rejectionLimit(bound)
  for (let round = 0; round < MAX_REJECTION_ROUNDS; round += 1) {
    const word = randomWords(1)[0]!
    if (word < limit) return word % bound
  }

  throw new Error('The random source produced no acceptable word, so an equal-probability draw is not possible')
}

/**
 * Fisher–Yates, stopped after the requested number of positions. Each step
 * chooses uniformly among the positions not yet taken, so no position can be
 * drawn twice and the ones left keep equal chances. Only positions are
 * swapped — the text of an entry never enters the arithmetic.
 */
export function drawRandomPicks(
  entries: readonly string[],
  drawCount: number,
  randomWords: RandomWords,
): RandomPickerPick[] {
  if (drawCount > entries.length) throw new RangeError('A draw cannot take more entries than the list holds')

  const positions = entries.map((_, index) => index)
  const picks: RandomPickerPick[] = []

  for (let taken = 0; taken < drawCount; taken += 1) {
    const chosen = taken + randomIndexBelow(positions.length - taken, randomWords)
    const position = positions[chosen]!
    positions[chosen] = positions[taken]!
    positions[taken] = position
    picks.push({ index: position, entry: entries[position]! })
  }

  return picks
}

/**
 * The browser's cryptographic source, or nothing at all. There is deliberately
 * no fallback: `Math.random()` would still return numbers, but the equal-chance
 * claim on the page would stop being something anyone could check.
 */
export function secureRandomWords(source: Crypto | undefined): RandomWords | undefined {
  if (typeof source?.getRandomValues !== 'function') return undefined

  return (count: number) => source.getRandomValues(new Uint32Array(count))
}

/**
 * Everything that has to be true before a draw can run, in the reviewed check
 * order. It returns the parsed list as well, so the page shows the same entry
 * count the draw would use rather than a second, separately derived one.
 */
export function planRandomPicker(request: RandomPickerRequest): RandomPickerOutcome {
  if (!request.hasSecureRandom) return refuse('randomness-unavailable')
  // An untouched field is not a mistake; a field holding only whitespace is.
  if (!request.text) return refuse('empty')

  const list = parseRandomPickerList(request.text, request.duplicates)
  if (!list.entries.length) return refuse('no-entries')
  if (list.overlongEntries) {
    return refuse('entry-too-long', { count: list.overlongEntries, limit: randomPickerLimits.maxEntryLength })
  }
  if (list.entries.length > randomPickerLimits.maxEntries) {
    return refuse('too-many-entries', { limit: randomPickerLimits.maxEntries, count: list.entries.length })
  }
  if (!Number.isInteger(request.drawCount) || request.drawCount < 1) return refuse('draw-count-invalid')
  if (request.drawCount > list.entries.length) {
    return refuse('draw-count-exceeds-entries', { count: request.drawCount, entries: list.entries.length })
  }

  return { state: 'ready', plan: { list, drawCount: request.drawCount } }
}

function refuse(code: RandomPickerErrorCode, values: RandomPickerErrorValues = {}): RandomPickerOutcome {
  return { state: 'error', code, values }
}
