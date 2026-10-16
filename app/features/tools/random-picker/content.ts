import type { RandomPickerErrorValues } from './domain/draw'
import type { RandomPickerList } from './domain/list'
import {
  duplicatePolicies,
  randomPickerErrorCodes,
  randomPickerLimits,
  randomPickerPresentations,
  type DuplicatePolicy,
  type RandomPickerErrorCode,
  type RandomPickerPresentation,
} from './domain/reference'
import type { ToolFaqEntry } from '../faq'
import { hasLocalizedCopy, type LocaleCode, type LocalizedCopy } from '../catalog'

/**
 * Everything the random picker workspace and page say out loud. It sits beside
 * the sampling modules rather than inside the component because the fairness
 * boundary is reviewed as content: the questions keep the ones approved in
 * docs/research/003-random-picker-fairness-and-sources.md §7.4 and, since #83,
 * also carry the §7.1 boundaries the workspace used to list; the error messages
 * keep §5.2. The workspace itself only says what depends on the current list:
 * a repeated name holding more than one chance. Ceilings are read from the
 * reviewed limits, never retyped, so a sentence cannot promise a list size the
 * planner does not accept.
 */

const groupedMaxEntries = randomPickerLimits.maxEntries.toLocaleString('en-US')

const randomPickerCopyEntries = {
  listLabel: { 'zh-tw': '候選名單', en: 'Candidates' },
  listHint: {
    'zh-tw': `一行一個項目，最多 ${groupedMaxEntries} 筆。逗號、頓號與空格都算在項目文字裡，不會被當成分隔符號。`,
    en: `One entry per line, up to ${groupedMaxEntries}. Commas and spaces are part of the entry, never a separator.`,
  },
  listPlaceholder: { 'zh-tw': '王小明\n李小美\n陳大文', en: 'Amy\nBob\nCindy' },
  addLabel: { 'zh-tw': '逐項新增', en: 'Add one entry' },
  addPlaceholder: { 'zh-tw': '輸入一個項目', en: 'Type one entry' },
  addButton: { 'zh-tw': '加入名單', en: 'Add to list' },
  summaryLabel: { 'zh-tw': '目前名單', en: 'This list' },
  duplicatesLegend: { 'zh-tw': '重複項目', en: 'Repeated entries' },
  duplicatesHint: {
    'zh-tw': '同名的項目要各佔一個機會，還是只算一次？',
    en: 'Should a repeated entry get one chance each, or only one in total?',
  },
  countLabel: { 'zh-tw': '抽出幾名', en: 'How many to draw' },
  countHint: {
    'zh-tw': '抽出的每一名都不同，不會有人被抽到兩次。',
    en: 'Every drawn entry is different; nothing is drawn twice.',
  },
  duplicatesShared: {
    'zh-tw': '名單裡有重複的項目，目前各佔一個機會；要讓同一個名字只算一次，請改選「合併重複」。',
    en: 'Some entries repeat, and each repeat has its own chance; choose Merge repeats to give a repeated name a single chance.',
  },
  presentationLegend: { 'zh-tw': '呈現方式', en: 'How to show it' },
  wheelUnavailable: {
    'zh-tw': `輪盤只在抽 1 名、名單有 ${randomPickerLimits.wheelMinEntries}–${randomPickerLimits.wheelMaxEntries} 筆時可用，目前以名單呈現結果。`,
    en: `The wheel is available when drawing one entry from ${randomPickerLimits.wheelMinEntries}–${randomPickerLimits.wheelMaxEntries} candidates; this draw is shown as a list.`,
  },
  drawLabel: { 'zh-tw': '開始抽選', en: 'Draw' },
  drawAgainLabel: { 'zh-tw': '再抽一次', en: 'Draw again' },
  skipLabel: { 'zh-tw': '跳過動畫', en: 'Skip the animation' },
  resetLabel: { 'zh-tw': '重設', en: 'Reset' },
  resultLabel: { 'zh-tw': '抽選結果', en: 'Result' },
  resultEmpty: {
    'zh-tw': '準備好名單後按「開始抽選」，中選名單會出現在這裡。',
    en: 'Prepare the list and press Draw; the drawn entries appear here.',
  },
  spinningLabel: {
    'zh-tw': '輪盤轉動中，結果已經決定了。',
    en: 'The wheel is spinning; the result is already decided.',
  },
  progressLabel: { 'zh-tw': '輪盤進度', en: 'Wheel progress' },
  wheelCaption: { 'zh-tw': '抽籤輪盤', en: 'Draw wheel' },
  candidatesLabel: { 'zh-tw': '輪盤上的項目', en: 'On the wheel' },
} satisfies Record<string, LocalizedCopy>

export type RandomPickerCopyKey = keyof typeof randomPickerCopyEntries
export const randomPickerCopyKeys = Object.keys(randomPickerCopyEntries) as RandomPickerCopyKey[]
export const randomPickerCopy: Record<RandomPickerCopyKey, LocalizedCopy> = randomPickerCopyEntries

export const duplicatePolicyLabels: Record<DuplicatePolicy, LocalizedCopy> = {
  keep: { 'zh-tw': '保留重複（各佔一個機會）', en: 'Keep repeats (one chance each)' },
  merge: { 'zh-tw': '合併重複（同名只算一次）', en: 'Merge repeats (one chance in total)' },
}

export const presentationLabels: Record<RandomPickerPresentation, LocalizedCopy> = {
  list: { 'zh-tw': '名單', en: 'List' },
  wheel: { 'zh-tw': '輪盤', en: 'Wheel' },
}

const randomPickerErrorCopy: Record<RandomPickerErrorCode, LocalizedCopy> = {
  'randomness-unavailable': {
    'zh-tw': '這個瀏覽器沒有提供可用的安全隨機來源，無法保證等機率抽選；請改用最新版瀏覽器或其他裝置。',
    en: 'This browser has no usable secure random source, so an equal-probability draw cannot be guaranteed; use an up-to-date browser or another device.',
  },
  'empty': {
    'zh-tw': '請先貼上或逐項輸入候選名單，一行一個。',
    en: 'Paste or add your candidates first, one per line.',
  },
  'no-entries': {
    'zh-tw': '名單裡沒有可抽選的項目，請確認每一行都有文字。',
    en: 'The list has no entry to draw from; make sure each line has text.',
  },
  'entry-too-long': {
    'zh-tw': '有 {count} 個項目超過 {limit} 個字，請縮短後再抽。',
    en: '{count} entries are longer than {limit} characters; shorten them before drawing.',
  },
  'too-many-entries': {
    'zh-tw': '名單最多 {limit} 筆，目前有 {count} 筆。',
    en: 'The list holds at most {limit} entries; it currently has {count}.',
  },
  'draw-count-invalid': {
    'zh-tw': '抽出人數請填 1 以上的整數。',
    en: 'Enter a whole number of at least 1 for how many to draw.',
  },
  'draw-count-exceeds-entries': {
    'zh-tw': '要抽 {count} 名，但名單只有 {entries} 筆可抽。',
    en: 'You asked for {count} but the list only has {entries} to draw from.',
  },
}

/** What the list summary says, kept here so a count phrase is reviewed like any other sentence. */
const summaryCopy = {
  entries: { 'zh-tw': '可抽選項目 {count} 筆', en: '{count} entries to draw from' },
  blank: { 'zh-tw': '略過空白行 {count} 行', en: '{count} blank lines skipped' },
  merged: { 'zh-tw': '合併重複 {count} 筆', en: '{count} duplicates merged' },
} satisfies Record<string, LocalizedCopy>

/** Section 7.4: the visible questions, and the only ones the page publishes as structured data. */
export const randomPickerFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': '這個工具怎麼做到每個人機會一樣？', en: 'How does every entry get the same chance?' },
    body: {
      'zh-tw': '工具用瀏覽器內建的安全隨機來源決定結果，而且只採用剛好能平均分給每個位置的隨機值：分不平均的那一小段會丟掉重抽，所以每個位置被抽中的機會完全相同。名字寫什麼、排在第幾行，都不會影響機會。',
      en: 'The tool uses the secure random source built into your browser and only keeps random values that divide evenly across every position: the small leftover range that would not divide evenly is thrown away and drawn again, so every position has exactly the same chance. What an entry says and which line it is on never affect its chance.',
    },
  },
  {
    heading: { 'zh-tw': '抽很多次以後，會不會比較常抽到前面幾個？', en: 'Over many draws, do the first entries come up more often?' },
    body: {
      'zh-tw': '不會。如果把隨機數直接平均切給名單，切不完的餘數會讓前面幾個位置多一點點機會；差距很小，但不會因為抽得多就消失。工具會把這段分不平均的隨機值丟掉重抽，所以不管抽幾次，每個位置的機會都一樣。',
      en: 'No. Splitting a random number across the list naively leaves a remainder that gives the first positions a tiny extra chance — small, but it never evens out however often you draw. The tool throws that uneven part away and draws again, so every position keeps the same chance however many times you draw.',
    },
  },
  {
    heading: { 'zh-tw': '抽多名時會不會有人被抽到兩次？', en: 'Can the same entry be drawn twice?' },
    body: {
      'zh-tw': '不會。每抽出一個就把它從候選名單拿掉，下一次只在剩下的項目裡抽。名單裡有兩筆文字相同的項目時，它們是兩個不同的位置，可能同時中選，這在「保留重複」設定下是預期行為。',
      en: 'No. Each drawn entry is taken out of the pool, so the next draw only sees what is left. Two lines with identical text are two different positions and can both be drawn; that is what the keep-repeats setting means.',
    },
  },
  {
    heading: { 'zh-tw': '名單裡有重複的名字怎麼辦？', en: 'What happens to duplicate names?' },
    body: {
      'zh-tw': '由你決定。「保留重複」讓每一行各佔一個機會，適合名單本來就有同名的人或同一品項多份；「合併重複」讓去除前後空白後完全相同的文字只算一次。比對區分大小寫與全形半形，工具不會替你判斷兩個相近的名字是不是同一個人。',
      en: 'You decide. Keep repeats gives every line its own chance, which is right when two people really share a name or an item appears several times; merge repeats collapses lines whose trimmed text is identical. The comparison is case- and width-sensitive, and the tool never guesses that two similar names are the same person.',
    },
  },
  {
    heading: { 'zh-tw': '輪盤的動畫會影響抽選結果嗎？', en: 'Does the wheel animation change the result?' },
    body: {
      'zh-tw': '不會。結果在動畫開始前就已經抽好，輪盤的停止角度是從中選項目反推的。跳過動畫、取消動畫，或在系統設定裡開啟減少動態效果，得到的都是同一個結果。',
      en: 'No. The result is drawn before the animation starts and the stopping angle is derived from it. Skipping the animation, cancelling it, or turning on reduced motion in your system settings all give the same result.',
    },
  },
  {
    heading: { 'zh-tw': '這個結果可以拿來公證或事後稽核嗎？', en: 'Can this result be notarised or audited afterwards?' },
    body: {
      'zh-tw': '不行。抽選完全在你的裝置上執行，沒有伺服器見證、沒有第三方稽核，也不保存紀錄，因此任何人都可以重抽到滿意為止，而你無法向別人證明沒有這樣做。需要主管機關核准或紀錄留存的活動，請改用符合該規定的方式辦理。',
      en: 'No. The draw runs entirely on your device with no server witness, no third-party audit, and no retained record, so anyone can re-roll until they like the outcome and you cannot prove that they did not. Events that need regulatory approval or a retained record have to be run another way.',
    },
  },
  {
    heading: { 'zh-tw': '名單最多可以放幾筆？', en: 'How many entries can the list hold?' },
    body: {
      'zh-tw': `最多 ${groupedMaxEntries} 筆，單筆最長 ${randomPickerLimits.maxEntryLength} 個字。超過時工具會直接說出目前筆數與上限，不會自動幫你刪掉項目——刪掉任何一筆都會改變其他人的機會。輪盤在抽 1 名且名單有 ${randomPickerLimits.wheelMinEntries}–${randomPickerLimits.wheelMaxEntries} 筆時可用，更長的名單改以名單呈現。`,
      en: `Up to ${groupedMaxEntries} entries, each at most ${randomPickerLimits.maxEntryLength} characters. Beyond that the tool names the current count and the ceiling instead of trimming the list for you, because removing any entry changes everyone else's chance. The wheel is available when drawing one entry from ${randomPickerLimits.wheelMinEntries}–${randomPickerLimits.wheelMaxEntries} candidates; longer lists are shown as a list.`,
    },
  },
  {
    heading: { 'zh-tw': '關掉分頁以後還找得到結果嗎？', en: 'Is the result still there after I close the tab?' },
    body: {
      'zh-tw': '不會。名單、設定與結果只存在這個分頁的記憶體裡，重新整理或關閉分頁就消失，工具不保存抽選歷史。需要留存的話，請自行複製或截圖。',
      en: 'No. The list, the settings, and the result live only in this tab; a reload or a close clears them, and no draw history is kept. Copy or screenshot the result yourself if you need to keep it.',
    },
  },
  {
    heading: { 'zh-tw': '我的名單會被上傳嗎？', en: 'Is my list uploaded?' },
    body: {
      'zh-tw': '不會。名單、抽選設定與結果都只在這個瀏覽器分頁處理，不會被保存、不會寫進網址，也不會送到 toolsliang 或第三方服務。',
      en: 'No. The list, the settings, and the result are processed in this browser tab only; they are never stored, written into the URL, or sent to toolsliang or a third-party service.',
    },
  },
]

const randomPickerContentIssues = validateRandomPickerContent()
if (randomPickerContentIssues.length) {
  throw new Error(`Invalid random picker content:\n${randomPickerContentIssues.join('\n')}`)
}

export function getRandomPickerCopy(locale: LocaleCode): Record<RandomPickerCopyKey, string> {
  return Object.fromEntries(
    randomPickerCopyKeys.map(key => [key, randomPickerCopy[key][locale]]),
  ) as Record<RandomPickerCopyKey, string>
}

/** The message a refused draw gets, with the numbers that make it actionable. */
export function randomPickerErrorMessage(
  code: RandomPickerErrorCode,
  values: RandomPickerErrorValues,
  locale: LocaleCode,
) {
  return randomPickerErrorCopy[code][locale].replace(
    /\{(limit|count|entries)\}/g,
    (match, key: 'limit' | 'count' | 'entries') => {
      const value = values[key]
      return value === undefined ? match : value.toLocaleString('en-US')
    },
  )
}

/** What the page says about the list it is about to draw from, and nothing more. */
export function getRandomPickerSummary(list: RandomPickerList, locale: LocaleCode) {
  const summary = [{ key: 'entries', text: countPhrase('entries', list.entries.length, locale) }]
  if (list.blankLines) summary.push({ key: 'blank', text: countPhrase('blank', list.blankLines, locale) })
  if (list.mergedDuplicates) summary.push({ key: 'merged', text: countPhrase('merged', list.mergedDuplicates, locale) })

  return summary
}

function countPhrase(key: keyof typeof summaryCopy, count: number, locale: LocaleCode) {
  return summaryCopy[key][locale].replace('{count}', count.toLocaleString('en-US'))
}

export function validateRandomPickerContent() {
  const issues: string[] = []

  for (const key of randomPickerCopyKeys) {
    if (!hasLocalizedCopy(randomPickerCopy[key])) issues.push(`[copy:${key}] requires both locales`)
  }

  for (const code of randomPickerErrorCodes) {
    if (!hasLocalizedCopy(randomPickerErrorCopy[code])) issues.push(`[error:${code}] requires both locales`)
  }
  for (const policy of duplicatePolicies) {
    if (!hasLocalizedCopy(duplicatePolicyLabels[policy])) issues.push(`[duplicates:${policy}] requires both locales`)
  }
  for (const presentation of randomPickerPresentations) {
    if (!hasLocalizedCopy(presentationLabels[presentation])) issues.push(`[presentation:${presentation}] requires both locales`)
  }
  for (const [key, copy] of Object.entries(summaryCopy)) {
    if (!hasLocalizedCopy(copy)) issues.push(`[summary:${key}] requires both locales`)
  }

  const questions = new Set<string>()
  for (const [index, entry] of randomPickerFaq.entries()) {
    if (!hasLocalizedCopy(entry.heading) || !hasLocalizedCopy(entry.body)) {
      issues.push(`[faq:${index}] requires both locales`)
    }
    if (questions.has(entry.heading['zh-tw'])) issues.push(`[faq:${index}] duplicate question`)
    questions.add(entry.heading['zh-tw'])
  }

  return issues
}
