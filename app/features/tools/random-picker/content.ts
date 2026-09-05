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
import { randomPickerCaveatKeys, type RandomPickerCaveatKey } from './domain/sources'
import type { ToolFaqEntry } from '../faq'
import { hasLocalizedCopy, type LocaleCode, type LocalizedCopy } from '../catalog'

/**
 * Everything the random picker workspace and page say out loud. It sits beside
 * the sampling modules rather than inside the component because the fairness
 * boundary is reviewed as content: the caveats keep the wording published in
 * docs/research/003-random-picker-fairness-and-sources.md §7.1, the questions
 * keep the ones approved in §7.4, and the error messages keep §5.2. Ceilings
 * are read from the reviewed limits, never retyped, so a sentence cannot
 * promise a list size the planner does not accept.
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
  presentationLegend: { 'zh-tw': '呈現方式', en: 'How to show it' },
  presentationHint: {
    'zh-tw': '兩種方式抽出的結果一樣，只有畫面不同。',
    en: 'Both show the same draw; only the presentation differs.',
  },
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
  caveatsTitle: { 'zh-tw': '看結果前要知道', en: 'Before you use this result' },
  sourceLabel: { 'zh-tw': '作法依據', en: 'Method source' },
  ruleVersionLabel: { 'zh-tw': '規則版本', en: 'Rule version' },
  methodEyebrow: { 'zh-tw': '等機率作法', en: 'Equal chance' },
  methodTitle: { 'zh-tw': '每個項目的機會是怎麼算出來的', en: 'How every entry gets the same chance' },
  methodIntro: {
    'zh-tw': '機會相同不是靠畫面看起來公平，而是靠下面四個步驟；每一步都有對應的自動測試。',
    en: 'Equal chances come from these four steps, each covered by its own automated test, not from how the animation looks.',
  },
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

/** Section 7.1: shown next to the result, complete, in both locales. */
export const randomPickerCaveats: Record<RandomPickerCaveatKey, LocalizedCopy> = {
  'equal-probability-scope': {
    'zh-tw': '每個有效項目的中選機率相同；機率由取樣演算法保證，不受項目順序或文字影響。',
    en: 'Every valid entry has the same chance of being drawn; that comes from the sampling algorithm, not from the order or the text of the entries.',
  },
  'no-audit': {
    'zh-tw': '抽選只在這台裝置執行，沒有伺服器見證，也沒有第三方稽核，無法向別人證明結果沒有被重抽。',
    en: 'The draw runs on this device only, with no server witness and no third-party audit, so you cannot prove to anyone else that a result was not re-rolled.',
  },
  'not-a-lottery': {
    'zh-tw': '這不是可稽核的抽獎系統，不適用需要主管機關核准、公證或紀錄留存的活動。',
    en: 'This is not an auditable prize-draw system and is not suitable for events that require regulatory approval, notarisation, or a retained record.',
  },
  'duplicates-share-chances': {
    'zh-tw': '名單裡有重複的項目，目前設定讓它們各佔一個機會；要讓同一個名字只有一次機會，請改選合併重複。',
    en: 'The list contains repeated entries and the current setting gives each of them its own chance; switch to merging duplicates to give a repeated name a single chance.',
  },
  'wheel-is-presentation': {
    'zh-tw': '輪盤只是呈現方式，結果在動畫開始前就已經決定；跳過或取消動畫都不會改變結果。',
    en: 'The wheel is presentation only: the result is decided before the animation starts, and skipping or cancelling it changes nothing.',
  },
  'local-processing': {
    'zh-tw': '名單與結果只在你的瀏覽器處理，不會送出、不會保存，關閉分頁後就消失。',
    en: 'The list and the result are processed in your browser only; nothing is sent or stored, and both are gone when you close the tab.',
  },
}

const randomPickerErrorCopy: Record<RandomPickerErrorCode, LocalizedCopy> = {
  'randomness-unavailable': {
    'zh-tw': '這個瀏覽器沒有提供安全隨機來源，無法保證等機率抽選；請改用最新版瀏覽器或其他裝置。',
    en: 'This browser provides no secure random source, so an equal-probability draw cannot be guaranteed; use an up-to-date browser or another device.',
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

/** Section 3, in the order the steps actually run inside the draw. */
const randomPickerMethodSteps: Array<{ title: LocalizedCopy, body: LocalizedCopy }> = [
  {
    title: { 'zh-tw': '1. 取得隨機位元', en: '1. Take random bits' },
    body: {
      'zh-tw': '用瀏覽器的 crypto.getRandomValues 取得 32 位元隨機值，不使用 Math.random；瀏覽器沒有這個功能時，工具直接停下來說明，不改用其他來源。',
      en: 'The browser\'s crypto.getRandomValues supplies 32-bit random words; Math.random is never used, and a browser without it stops the draw instead of falling back to something weaker.',
    },
  },
  {
    title: { 'zh-tw': '2. 去掉模數偏差', en: '2. Remove the modulo bias' },
    body: {
      'zh-tw': '直接取餘數會讓前幾個位置多分到一個隨機值。工具改用拒絕取樣：落在尾段不完整區間的隨機值丟掉重取，剩下的區間長度剛好是名單長度的整數倍。',
      en: 'Taking a raw remainder would hand the first positions one extra word each. Rejection sampling discards any word in the incomplete tail, leaving a window whose length is a whole multiple of the list — the modulo is only applied inside it.',
    },
  },
  {
    title: { 'zh-tw': '3. 抽出不重複的名次', en: '3. Draw without repeats' },
    body: {
      'zh-tw': '以 Fisher–Yates 逐個位置交換，每一步都只在還沒被抽走的位置裡等機率取一個，因此同一個項目不可能被抽兩次。',
      en: 'A Fisher–Yates partial shuffle swaps one position at a time, always choosing uniformly among the positions not yet taken, so nothing can be drawn twice.',
    },
  },
  {
    title: { 'zh-tw': '4. 輪盤只負責呈現', en: '4. The wheel only shows it' },
    body: {
      'zh-tw': '結果在動畫開始前就已決定，停止角度是由中選項目反推出來的；跳過動畫或關閉動畫都得到同一個結果。',
      en: 'The result is decided before the animation starts and the stopping angle is derived from it, so skipping or disabling the animation gives the same result.',
    },
  },
]

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
      'zh-tw': '工具用瀏覽器的 crypto.getRandomValues 取得隨機值，再以拒絕取樣把它對應到名單位置：落在尾段不完整區間的隨機值會被丟棄重取，剩下的區間長度剛好是名單長度的整數倍，因此每個位置對應到的隨機值數量完全相同。位置一旦決定，項目文字完全不參與計算。',
      en: 'The tool takes random words from the browser\'s crypto.getRandomValues and maps them onto list positions with rejection sampling: a word in the incomplete tail is discarded and redrawn, so the accepted window is a whole multiple of the list length and every position is backed by exactly the same number of words. The text of an entry never enters the arithmetic.',
    },
  },
  {
    heading: { 'zh-tw': '為什麼不能直接用隨機數除以名單長度取餘數？', en: 'Why not just take a random number modulo the list length?' },
    body: {
      'zh-tw': '因為 2³² 通常不是名單長度的倍數。以 3 個項目為例，2³² 除以 3 餘 1，第一個位置會比另外兩個多分到一個隨機值，形成系統性偏差。差距很小，但它不會因為抽得夠多而消失，所以工具改用拒絕取樣。',
      en: 'Because 2³² is usually not a multiple of the list length. With three entries, 2³² leaves a remainder of one, so the first position is backed by one extra word — a small but systematic bias that never averages out. Rejection sampling removes it.',
    },
  },
  {
    heading: { 'zh-tw': '抽多名時會不會有人被抽到兩次？', en: 'Can the same entry be drawn twice?' },
    body: {
      'zh-tw': '不會。抽多名時使用 Fisher–Yates 部分洗牌，每抽出一個位置就把它移出候選範圍，下一次只在剩下的位置裡取。名單裡有兩筆文字相同的項目時，它們是兩個不同的位置，可能同時中選，這在「保留重複」設定下是預期行為。',
      en: 'No. A Fisher–Yates partial shuffle removes each drawn position from the pool, so the next draw only sees what is left. Two lines with identical text are two different positions and can both be drawn; that is what the keep-repeats setting means.',
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

/**
 * A caveat that only makes sense while a repeated entry really is holding more
 * than one chance appears then; the rest are true of every draw and stay
 * visible whatever the settings are.
 */
export function getRandomPickerCaveats(locale: LocaleCode, sharedDuplicates: boolean) {
  return randomPickerCaveatKeys
    .filter(key => key !== 'duplicates-share-chances' || sharedDuplicates)
    .map(key => ({ key, text: randomPickerCaveats[key][locale] }))
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

export function getRandomPickerMethod(locale: LocaleCode) {
  return randomPickerMethodSteps.map(step => ({ title: step.title[locale], body: step.body[locale] }))
}

function countPhrase(key: keyof typeof summaryCopy, count: number, locale: LocaleCode) {
  return summaryCopy[key][locale].replace('{count}', count.toLocaleString('en-US'))
}

export function validateRandomPickerContent() {
  const issues: string[] = []

  for (const key of randomPickerCopyKeys) {
    if (!hasLocalizedCopy(randomPickerCopy[key])) issues.push(`[copy:${key}] requires both locales`)
  }

  for (const key of randomPickerCaveatKeys) {
    if (!hasLocalizedCopy(randomPickerCaveats[key])) issues.push(`[caveat:${key}] requires both locales`)
  }
  for (const key of Object.keys(randomPickerCaveats)) {
    if (!randomPickerCaveatKeys.includes(key as RandomPickerCaveatKey)) issues.push(`[caveat:${key}] is not a reviewed caveat`)
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
  for (const [index, step] of randomPickerMethodSteps.entries()) {
    if (!hasLocalizedCopy(step.title) || !hasLocalizedCopy(step.body)) issues.push(`[method:${index}] requires both locales`)
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
