import { describe, expect, it } from 'vitest'
import { copy, getTool, supportedLocales, type LocaleCode } from '@/features/tools/catalog'
import {
  getRandomPickerCopy,
  getRandomPickerSummary,
  randomPickerCopyKeys,
  randomPickerErrorMessage,
  randomPickerFaq,
  validateRandomPickerContent,
} from '@/features/tools/random-picker/content'
import { parseRandomPickerList } from '@/features/tools/random-picker/domain/list'
import { randomPickerErrorCodes, randomPickerLimits } from '@/features/tools/random-picker/domain/reference'
import { randomPickerCaveatKeys, type RandomPickerCaveatKey } from '@/features/tools/random-picker/domain/sources'

/**
 * Everything the tool says out loud, in the two languages it has to say it in —
 * the registration copy included, because a search result is where a claim
 * about fairness would do the most damage.
 */
function everyVisibleString(locale: LocaleCode) {
  const tool = getTool('random-picker')!

  return [
    copy(tool.name, locale),
    copy(tool.description, locale),
    copy(tool.acceptedInput, locale),
    copy(tool.localProcessingStatement, locale),
    copy(tool.seo.title, locale),
    copy(tool.seo.description, locale),
    copy(tool.seo.answer, locale),
    ...tool.aliases[locale],
    ...tool.keywords[locale],
    ...randomPickerCopyKeys.map(key => getRandomPickerCopy(locale)[key]),
    ...randomPickerErrorCodes.map(code => randomPickerErrorMessage(code, { count: 3, limit: 5, entries: 2 }, locale)),
    ...randomPickerFaq.flatMap(entry => [entry.heading[locale], entry.body[locale]]),
  ]
}

/**
 * #83 took the §7.1 boundaries out of the workspace. Each one still has to be
 * said on the page, in plain words: here is the sentence that says it, in the
 * question that answers it, or in the workspace while it is true of the list.
 */
const boundaryWording: Record<RandomPickerCaveatKey, { question?: string, workspace?: string, 'zh-tw': string, en: string }> = {
  'equal-probability-scope': { question: '這個工具怎麼做到每個人機會一樣？', 'zh-tw': '都不會影響機會', en: 'never affect its chance' },
  'no-audit': { question: '這個結果可以拿來公證或事後稽核嗎？', 'zh-tw': '無法向別人證明', en: 'cannot prove' },
  'not-a-lottery': { question: '這個結果可以拿來公證或事後稽核嗎？', 'zh-tw': '主管機關核准', en: 'regulatory approval' },
  'duplicates-share-chances': { workspace: 'duplicatesShared', 'zh-tw': '各佔一個機會', en: 'its own chance' },
  'wheel-is-presentation': { question: '輪盤的動畫會影響抽選結果嗎？', 'zh-tw': '動畫開始前就已經抽好', en: 'drawn before the animation starts' },
  'local-processing': { question: '我的名單會被上傳嗎？', 'zh-tw': '不會送到', en: 'never stored' },
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

  it('still states every documented boundary somewhere on the page, in both locales', () => {
    expect(Object.keys(boundaryWording)).toEqual([...randomPickerCaveatKeys])

    for (const [key, wording] of Object.entries(boundaryWording)) {
      for (const locale of supportedLocales) {
        const said = wording.question
          ? randomPickerFaq.find(entry => entry.heading['zh-tw'] === wording.question)?.body[locale]
          : getRandomPickerCopy(locale)[wording.workspace as keyof ReturnType<typeof getRandomPickerCopy>]

        expect(said, `${key}｜${locale}`).toContain(wording[locale])
      }
    }
  })

  it('says out loud that a local draw cannot be proven to anyone else', () => {
    const audit = randomPickerFaq.find(entry => entry.heading['zh-tw'] === '這個結果可以拿來公證或事後稽核嗎？')!

    expect(audit.body['zh-tw']).toContain('不行')
    expect(audit.body.en.toLowerCase()).toContain('no third-party audit')
    expect(getTool('random-picker')!.seo.answer['zh-tw'], '「開始前先知道」也要說').toContain('無法由第三方稽核')
  })

  it('explains equal chances without naming an algorithm', () => {
    for (const locale of supportedLocales) {
      for (const text of everyVisibleString(locale)) {
        expect(text, text).not.toMatch(/Fisher|Yates|Durstenfeld|getRandomValues|Math\.random|拒絕取樣|模數|rejection sampling|\bmodulo\b/i)
      }
    }
  })

  it('publishes the reviewed questions once each', () => {
    expect(randomPickerFaq).toHaveLength(9)
    expect(new Set(randomPickerFaq.map(entry => entry.heading['zh-tw'])).size).toBe(randomPickerFaq.length)
    expect(randomPickerFaq.map(entry => entry.body['zh-tw']).join('')).toContain('不會')
  })
})
