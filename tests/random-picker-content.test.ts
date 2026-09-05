import { describe, expect, it } from 'vitest'
import { supportedLocales, type LocaleCode } from '@/features/tools/catalog'
import {
  getRandomPickerCaveats,
  getRandomPickerCopy,
  getRandomPickerMethod,
  getRandomPickerSummary,
  randomPickerCaveats,
  randomPickerCopyKeys,
  randomPickerErrorMessage,
  randomPickerFaq,
  validateRandomPickerContent,
} from '@/features/tools/random-picker/content'
import { parseRandomPickerList } from '@/features/tools/random-picker/domain/list'
import { randomPickerErrorCodes, randomPickerLimits } from '@/features/tools/random-picker/domain/reference'
import { randomPickerCaveatKeys } from '@/features/tools/random-picker/domain/sources'

/** Everything the tool says out loud, in the two languages it has to say it in. */
function everyVisibleString(locale: LocaleCode) {
  return [
    ...randomPickerCopyKeys.map(key => getRandomPickerCopy(locale)[key]),
    ...randomPickerCaveatKeys.map(key => randomPickerCaveats[key][locale]),
    ...randomPickerErrorCodes.map(code => randomPickerErrorMessage(code, { count: 3, limit: 5, entries: 2 }, locale)),
    ...getRandomPickerMethod(locale).flatMap(step => [step.title, step.body]),
    ...randomPickerFaq.flatMap(entry => [entry.heading[locale], entry.body[locale]]),
  ]
}

describe('random picker content', () => {
  it('accepts its own content contract', () => {
    expect(validateRandomPickerContent()).toEqual([])
  })

  it('says everything in both locales', () => {
    for (const locale of supportedLocales) {
      for (const text of everyVisibleString(locale)) expect(text.trim()).not.toBe('')
    }
    expect(getRandomPickerCopy('en').drawLabel).not.toBe(getRandomPickerCopy('zh-tw').drawLabel)
  })

  it('never claims a fairness the tool cannot back', () => {
    const banned = [
      '公平抽獎', '公證抽獎', '線上抽獎', '防作弊', '保證公平', '絕對公平',
      'online lottery', 'certified fair', 'provably fair', 'tamper-proof', 'guaranteed fair',
    ]

    for (const locale of supportedLocales) {
      for (const text of everyVisibleString(locale)) {
        for (const term of banned) expect(text.toLowerCase(), term).not.toContain(term.toLowerCase())
      }
    }
  })

  it('states the limit a refusal ran into, in numbers only', () => {
    expect(randomPickerErrorMessage('too-many-entries', { limit: randomPickerLimits.maxEntries, count: 12_000 }, 'zh-tw'))
      .toBe('名單最多 10,000 筆，目前有 12,000 筆。')
    expect(randomPickerErrorMessage('draw-count-exceeds-entries', { count: 5, entries: 2 }, 'en'))
      .toBe('You asked for 5 but the list only has 2 to draw from.')
    expect(randomPickerErrorMessage('entry-too-long', { count: 1, limit: randomPickerLimits.maxEntryLength }, 'zh-tw'))
      .toContain('120')
  })

  it('reports only the list facts that actually happened', () => {
    const clean = getRandomPickerSummary(parseRandomPickerList('Amy\nBob', 'keep'), 'zh-tw')
    expect(clean.map(item => item.key)).toEqual(['entries'])
    expect(clean[0]!.text).toContain('2')

    const messy = getRandomPickerSummary(parseRandomPickerList('Amy\n\nAmy\n  \nBob', 'merge'), 'zh-tw')
    expect(messy.map(item => item.key)).toEqual(['entries', 'blank', 'merged'])
  })

  it('explains a repeated name only while it really has more than one chance', () => {
    const withDuplicates = getRandomPickerCaveats('zh-tw', true).map(caveat => caveat.key)
    const withoutDuplicates = getRandomPickerCaveats('zh-tw', false).map(caveat => caveat.key)

    expect(withDuplicates).toEqual([...randomPickerCaveatKeys])
    expect(withoutDuplicates).not.toContain('duplicates-share-chances')
    expect(withoutDuplicates, '其餘免責一律呈現').toHaveLength(randomPickerCaveatKeys.length - 1)
  })

  it('says out loud that a local draw cannot be proven to anyone else', () => {
    expect(randomPickerCaveats['no-audit']['zh-tw']).toContain('無法向別人證明')
    expect(randomPickerCaveats['no-audit'].en.toLowerCase()).toContain('no third-party audit')
    expect(randomPickerCaveats['wheel-is-presentation']['zh-tw']).toContain('動畫開始前')
  })

  it('names the two algorithms the equal-chance claim rests on', () => {
    const method = getRandomPickerMethod('zh-tw')

    expect(method.length).toBeGreaterThanOrEqual(4)
    expect(method.map(step => step.body).join('')).toContain('getRandomValues')
    expect(method.map(step => step.body).join('')).toContain('Fisher–Yates')
    expect(getRandomPickerMethod('en').map(step => step.body).join('')).toContain('modulo')
  })

  it('publishes the reviewed questions once each', () => {
    expect(randomPickerFaq).toHaveLength(9)
    expect(new Set(randomPickerFaq.map(entry => entry.heading['zh-tw'])).size).toBe(randomPickerFaq.length)
    expect(randomPickerFaq.map(entry => entry.body['zh-tw']).join('')).toContain('不會')
  })
})
