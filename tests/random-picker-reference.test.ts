import { describe, expect, it } from 'vitest'
import { parseRandomPickerList } from '@/features/tools/random-picker/domain/list'
import {
  duplicatePolicies,
  randomPickerErrorCodes,
  randomPickerLimits,
  randomPickerListVectors,
  randomPickerRejectionVectors,
} from '@/features/tools/random-picker/domain/reference'
import { randomPickerCaveatKeys, randomPickerContentReview, randomPickerReferenceVersion } from '@/features/tools/random-picker/domain/sources'
import {
  parseCaveatKeys,
  parseDuplicatePolicies,
  parseErrorCodes,
  parseLimits,
  parseListVectors,
  parsePublishedSourceUrls,
  randomPickerDecisionRecord,
} from './support/random-picker-decision-record'

/**
 * The decision record and the modules are one specification kept in two files.
 * Every assertion here reads the document at run time, so a rule that changes
 * in one place without the other fails immediately rather than shipping.
 */
describe('random picker decision record', () => {
  it('keeps the documented ceilings and the module limits identical', () => {
    expect(parseLimits()).toEqual({
      maxEntries: randomPickerLimits.maxEntries,
      maxEntryLength: randomPickerLimits.maxEntryLength,
      wheelMinEntries: randomPickerLimits.wheelMinEntries,
      wheelMaxEntries: randomPickerLimits.wheelMaxEntries,
    })
  })

  it('keeps the documented duplicate policies and error keys in the documented order', () => {
    expect(parseDuplicatePolicies()).toEqual([...duplicatePolicies])
    expect(parseErrorCodes(), '列序就是檢查順序').toEqual([...randomPickerErrorCodes])
  })

  it('keeps the documented caveat keys complete', () => {
    expect(parseCaveatKeys()).toEqual([...randomPickerCaveatKeys])
  })

  it('publishes exactly the sources the document marks as shown on the page', () => {
    expect(randomPickerContentReview.sources.map(source => source.url)).toEqual(parsePublishedSourceUrls())
  })

  it('names the rule version the document fixed', () => {
    expect(randomPickerDecisionRecord).toContain(randomPickerReferenceVersion)
    expect(randomPickerContentReview.reviewedAt).toBe(randomPickerReferenceVersion.replace('random-picker-', ''))
  })

  it('parses every documented list vector exactly as the document records it', () => {
    const documented = parseListVectors()
    expect(documented.length).toBeGreaterThan(10)
    expect(randomPickerListVectors.map(vector => ({ ...vector }))).toEqual(documented)

    for (const vector of documented) {
      const parsed = parseRandomPickerList(vector.input, vector.policy as typeof duplicatePolicies[number])
      expect(parsed.entries, JSON.stringify(vector.input)).toEqual(vector.entries)
      expect(parsed.blankLines, JSON.stringify(vector.input)).toBe(vector.blankLines)
      expect(parsed.mergedDuplicates, JSON.stringify(vector.input)).toBe(vector.mergedDuplicates)
    }
  })

  it('covers every error key with at least one rejection vector', () => {
    expect(new Set(randomPickerRejectionVectors.map(vector => vector.code)))
      .toEqual(new Set(randomPickerErrorCodes))
  })

  it('forbids the fairness wording the document rules out', () => {
    const banned = ['公平抽獎', '公證抽獎', '線上抽獎', '防作弊', '保證公平', '絕對公平']
    for (const term of banned) {
      expect(randomPickerDecisionRecord.split('### 7.3 禁止用語')[0], `禁止用語不得出現在決策內文：${term}`)
        .not.toContain(term)
    }
  })
})
