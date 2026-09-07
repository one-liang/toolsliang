import { taiwanCalendarPublishableYears } from '../taiwan-calendar/domain/sources'
import {
  customCalendarFileErrorCodes,
  type CustomCalendarFileErrorCode,
} from './domain/document'
import {
  CUSTOM_CALENDAR_ENTRY_LIMIT,
  CUSTOM_ENTRY_NOTE_MAX,
  CUSTOM_ENTRY_RANGE_MAX_DAYS,
  CUSTOM_ENTRY_TITLE_MAX,
  customEntryIssueCodes,
  customEntryMarks,
  type CustomCalendarEntry,
  type CustomEntryIssue,
  type CustomEntryIssueCode,
  type CustomEntryMark,
} from './domain/entries'
import type { ToolFaqEntry } from '../faq'
import { hasLocalizedCopy, type LocaleCode, type LocalizedCopy } from '../catalog'

/**
 * Everything the custom calendar says out loud. The wording is where the product
 * boundary becomes visible: what a saved entry is, where it lives, what can make
 * it disappear, and what it is explicitly not — a company, school or statutory
 * schedule. Those sentences are reviewed content, so they live beside the domain
 * rather than inside a component.
 *
 * The words for the official layer are not restated here. A day's ROC year,
 * lunar date, solar term and office-calendar kind are the Taiwan calendar's
 * reviewed wording, and this tool renders the same facts, so it reads them from
 * that module instead of keeping a second copy that could drift.
 */

const { firstYear, lastYear } = taiwanCalendarPublishableYears

const customCalendarCopyEntries = {
  boundaryNote: {
    'zh-tw': '你加的項目只疊在辦公日曆表之上，不會改寫官方公告的日別，也只保存在這台裝置。',
    en: 'Your entries sit on top of the office calendar without rewriting what it announces, and they stay on this device.',
  },
  /** The name this device's document carries in the local assets list. */
  assetName: { 'zh-tw': '自訂行事曆', en: 'Custom calendar' },
  officialLayerLabel: { 'zh-tw': '辦公日曆表', en: 'Office calendar' },
  customLayerLabel: { 'zh-tw': '我的自訂', en: 'My entries' },
  changedLabel: { 'zh-tw': '與辦公日曆表不同', en: 'Differs from the office calendar' },
  conflictLabel: {
    'zh-tw': '同一天有相反的自訂設定，畫面以最後編輯的那一筆為準。',
    en: 'Two entries claim the opposite about this day; the one edited last is shown.',
  },
  dayPanelLabel: { 'zh-tw': '這一天', en: 'This day' },
  dayEntriesLabel: { 'zh-tw': '這一天的自訂項目', en: 'Your entries on this day' },
  dayEntriesEmpty: { 'zh-tw': '這一天還沒有自訂項目。', en: 'Nothing saved on this day yet.' },
  daySelectPrompt: {
    'zh-tw': '先在月曆選一個日期，就可以在這裡新增或修改自訂項目。',
    en: 'Pick a day in the grid to add or change an entry here.',
  },
  monthEntriesLabel: { 'zh-tw': '本月自訂項目', en: 'Your entries this month' },
  monthEntriesEmpty: { 'zh-tw': '這個月還沒有自訂項目。', en: 'Nothing saved this month yet.' },
  addEntry: { 'zh-tw': '新增自訂項目', en: 'Add an entry' },
  editEntry: { 'zh-tw': '編輯', en: 'Edit' },
  deleteEntry: { 'zh-tw': '刪除', en: 'Delete' },
  deleteEntryPrompt: {
    'zh-tw': '確定要刪除這筆自訂項目嗎？刪除後無法復原。',
    en: 'Delete this entry? This cannot be undone.',
  },
  deleteConfirm: { 'zh-tw': '確認刪除', en: 'Confirm delete' },
  deleteCancel: { 'zh-tw': '取消', en: 'Cancel' },
  formNewLegend: { 'zh-tw': '新增自訂項目', en: 'New entry' },
  formEditLegend: { 'zh-tw': '編輯自訂項目', en: 'Edit entry' },
  formTitleLabel: { 'zh-tw': '項目名稱', en: 'Entry name' },
  formTitleHint: {
    'zh-tw': `最多 ${CUSTOM_ENTRY_TITLE_MAX} 個字，例如「公司特休」或「輪班 A」。`,
    en: `At most ${CUSTOM_ENTRY_TITLE_MAX} characters, for example “Company day off” or “Shift A”.`,
  },
  formMarkLabel: { 'zh-tw': '這一天算什麼', en: 'What this day counts as' },
  formMarkHint: {
    'zh-tw': '只有你自己的紀錄會改變；辦公日曆表原本的日別仍然照原樣顯示。',
    en: 'Only your own record changes; the office calendar keeps showing what it says.',
  },
  formStartLabel: { 'zh-tw': '開始日期', en: 'Start date' },
  formEndLabel: { 'zh-tw': '結束日期', en: 'End date' },
  formDatesHint: {
    'zh-tw': `可以是同一天，也可以是連續期間，一筆最多 ${CUSTOM_ENTRY_RANGE_MAX_DAYS} 天；目前可加在 ${firstYear}–${lastYear} 年。`,
    en: `One day or a continuous span of at most ${CUSTOM_ENTRY_RANGE_MAX_DAYS} days, in the years ${firstYear}–${lastYear}.`,
  },
  formNoteLabel: { 'zh-tw': '備註（選填）', en: 'Note (optional)' },
  formNoteHint: {
    'zh-tw': `最多 ${CUSTOM_ENTRY_NOTE_MAX} 個字，只會留在這台裝置。`,
    en: `At most ${CUSTOM_ENTRY_NOTE_MAX} characters, kept on this device only.`,
  },
  formSave: { 'zh-tw': '儲存到這台裝置', en: 'Save on this device' },
  formCancel: { 'zh-tw': '取消', en: 'Cancel' },
  formErrorTitle: { 'zh-tw': '還不能儲存', en: 'Not ready to save' },
  storageTitle: { 'zh-tw': '本機保存', en: 'Saved on this device' },
  storageNoEstimate: { 'zh-tw': '這個瀏覽器沒有提供儲存空間估計值。', en: 'This browser does not report a storage estimate.' },
  storageEmpty: { 'zh-tw': '這台裝置還沒有自訂行事曆內容。', en: 'This device holds no custom calendar yet.' },
  exportAction: { 'zh-tw': '匯出備份檔', en: 'Export a backup file' },
  exportHint: {
    'zh-tw': '匯出會在這台裝置產生一個 JSON 檔，內容就是你看到的自訂項目，不含官方行事曆資料，也不會傳送到任何伺服器。',
    en: 'Exporting writes a JSON file on this device holding exactly the entries you see — no official calendar data — and sends nothing anywhere.',
  },
  importAction: { 'zh-tw': '匯入備份檔', en: 'Import a backup file' },
  importHint: {
    'zh-tw': '選擇本工具匯出的 JSON 檔；檔案只在瀏覽器讀取。相同識別碼的項目會被覆蓋，讀取失敗則整份不匯入。',
    en: 'Choose a JSON file this tool exported; it is read in the browser only. Entries with the same id are replaced, and an unreadable file imports nothing at all.',
  },
  clearAction: { 'zh-tw': '清除全部自訂項目', en: 'Clear every entry' },
  clearPrompt: {
    'zh-tw': '確定要清除這台裝置上的全部自訂項目嗎？刪除後無法復原，建議先匯出備份。',
    en: 'Clear every entry on this device? This cannot be undone, so export a backup first if you may want them later.',
  },
  clearConfirm: { 'zh-tw': '確認全部清除', en: 'Confirm clear all' },
  rebuildAction: { 'zh-tw': '重建自訂行事曆', en: 'Start a new calendar' },
  rebuildPrompt: {
    'zh-tw': '重建會刪除這台裝置上讀不出來的那份資料，並從空白開始。建議先下載原始檔留存。',
    en: 'Starting again deletes the unreadable data on this device and begins from empty. Download the raw file first if you may want it.',
  },
  rebuildConfirm: { 'zh-tw': '確認重建', en: 'Confirm and start again' },
  downloadRaw: { 'zh-tw': '下載原始檔', en: 'Download the raw file' },
  caveatsTitle: { 'zh-tw': '保存前要知道', en: 'Before you rely on this' },
  sizeLabel: { 'zh-tw': '佔用空間', en: 'Size on this device' },
  updatedLabel: { 'zh-tw': '最後儲存', en: 'Last saved' },
} satisfies Record<string, LocalizedCopy>

export type CustomCalendarCopyKey = keyof typeof customCalendarCopyEntries
export const customCalendarCopyKeys = Object.keys(customCalendarCopyEntries) as CustomCalendarCopyKey[]
export const customCalendarCopy: Record<CustomCalendarCopyKey, LocalizedCopy> = customCalendarCopyEntries

/** The three things an entry can say about a day, and the short mark a cell shows. */
export const customEntryMarkLabels: Record<CustomEntryMark, LocalizedCopy> = {
  note: { 'zh-tw': '自訂備註', en: 'Custom note' },
  'day-off': { 'zh-tw': '自訂放假', en: 'Custom day off' },
  workday: { 'zh-tw': '自訂上班', en: 'Custom working day' },
}

export const customEntryMarkHints: Record<CustomEntryMark, LocalizedCopy> = {
  note: { 'zh-tw': '不改變上班或放假，只在這一天留下紀錄。', en: 'Leaves the day as it is and records something on it.' },
  'day-off': { 'zh-tw': '你自己把這一天算成放假。', en: 'You count this day as time off.' },
  workday: { 'zh-tw': '你自己把這一天算成上班。', en: 'You count this day as a working day.' },
}

export const customCalendarCaveatKeys = [
  'device-only',
  'may-disappear',
  'official-layer-untouched',
  'not-an-official-schedule',
  'no-recurrence-or-reminder',
] as const

export type CustomCalendarCaveatKey = typeof customCalendarCaveatKeys[number]

export const customCalendarCaveats: Record<CustomCalendarCaveatKey, LocalizedCopy> = {
  'device-only': {
    'zh-tw': '自訂項目只保存在這台裝置的瀏覽器資料庫；不會上傳、不會進入離線快取，也不會隨雲端偏好同步或與其他人共用。',
    en: 'Entries are kept in this browser\'s database on this device. They are never uploaded, never enter the offline cache, never sync as cloud preferences, and are not shared with anyone.',
  },
  'may-disappear': {
    'zh-tw': '清除瀏覽器資料、使用無痕視窗、瀏覽器回收儲存空間或更換裝置時，這些項目會消失；需要保留就自己匯出備份檔。',
    en: 'Clearing browser data, private browsing, storage reclaimed by the browser, or moving to another device removes them, so export a backup file if you need to keep them.',
  },
  'official-layer-untouched': {
    'zh-tw': '自訂項目只疊在辦公日曆表之上，不會改寫官方公告的日別；畫面上兩層永遠分開標示。',
    en: 'Entries sit on top of the office calendar and never rewrite the announced day kind; the two layers stay separately labelled on screen.',
  },
  'not-an-official-schedule': {
    'zh-tw': '這裡的自訂放假與自訂上班只是你自己的紀錄，不代表公司、學校或法令的正式規定，也不能作為出勤或請假的依據。',
    en: 'A day you mark off or working is your own record. It does not represent what an employer, a school, or the law says, and it is not evidence of attendance or leave.',
  },
  'no-recurrence-or-reminder': {
    'zh-tw': '目前只支援單一日期或連續期間，不支援每週或每月重複，也不會發出提醒或通知。',
    en: 'Only a single day or a continuous span is supported for now: there is no weekly or monthly repeat, and no reminder or notification is ever sent.',
  },
}

const customEntryIssueCopy: Record<CustomEntryIssueCode, LocalizedCopy> = {
  'title-required': { 'zh-tw': '請先填寫項目名稱。', en: 'Enter a name for this entry.' },
  'title-too-long': {
    'zh-tw': `項目名稱最多 ${CUSTOM_ENTRY_TITLE_MAX} 個字。`,
    en: `An entry name can hold at most ${CUSTOM_ENTRY_TITLE_MAX} characters.`,
  },
  'note-too-long': {
    'zh-tw': `備註最多 ${CUSTOM_ENTRY_NOTE_MAX} 個字。`,
    en: `A note can hold at most ${CUSTOM_ENTRY_NOTE_MAX} characters.`,
  },
  'invalid-date': { 'zh-tw': '請選擇存在的日期，例如 2026-09-18。', en: 'Pick a date that exists, for example 2026-09-18.' },
  'end-before-start': { 'zh-tw': '結束日期不能早於開始日期。', en: 'The end date cannot be earlier than the start date.' },
  'range-too-long': {
    'zh-tw': `一筆項目最多 ${CUSTOM_ENTRY_RANGE_MAX_DAYS} 天，更長的期間請分成幾筆。`,
    en: `One entry covers at most ${CUSTOM_ENTRY_RANGE_MAX_DAYS} days; split a longer span into several.`,
  },
  'date-out-of-range': {
    'zh-tw': `目前只能加在 ${firstYear}–${lastYear} 年，因為這個工具只有這幾年的辦公日曆表可以對照。`,
    en: `Entries can only be added in ${firstYear}–${lastYear}, because those are the years this tool has an office calendar to show them against.`,
  },
  'entry-limit-reached': {
    'zh-tw': `這台裝置已經保存 ${CUSTOM_CALENDAR_ENTRY_LIMIT} 筆自訂項目，先刪除一些再新增。`,
    en: `This device already holds ${CUSTOM_CALENDAR_ENTRY_LIMIT} entries; delete some before adding another.`,
  },
}

export interface CustomCalendarMessage {
  title: string
  recovery: string
}

const customCalendarFileErrorCopy: Record<CustomCalendarFileErrorCode, Record<LocaleCode, CustomCalendarMessage>> = {
  'invalid-file': {
    'zh-tw': {
      title: '這個檔案不是可讀的自訂行事曆備份檔',
      recovery: '請選擇本工具匯出的 JSON 檔。這次沒有匯入任何項目，裝置上原有的內容完全沒有變動。',
    },
    en: {
      title: 'That file is not a readable custom calendar backup',
      recovery: 'Choose a JSON file this tool exported. Nothing was imported, and what this device already held is untouched.',
    },
  },
  'unsupported-file-version': {
    'zh-tw': {
      title: '這個備份檔由較新版本建立',
      recovery: '這個版本讀不懂它，也不會勉強匯入。重新整理取得最新版本後再試一次。',
    },
    en: {
      title: 'That backup file was written by a newer release',
      recovery: 'This version cannot read it and will not guess. Reload to pick up the newest release, then try again.',
    },
  },
  'empty-file': {
    'zh-tw': {
      title: '這個備份檔沒有任何自訂項目',
      recovery: '換一個含有項目的備份檔再試一次；這次沒有變動裝置上的內容。',
    },
    en: {
      title: 'That backup file holds no entries',
      recovery: 'Try a backup file that has entries in it. Nothing on this device changed.',
    },
  },
  'refused-entry': {
    'zh-tw': {
      title: '備份檔裡有不符合目前規則的項目',
      recovery: `整份都沒有匯入。項目必須落在 ${firstYear}–${lastYear} 年、名稱最多 ${CUSTOM_ENTRY_TITLE_MAX} 個字、備註最多 ${CUSTOM_ENTRY_NOTE_MAX} 個字，單筆最多 ${CUSTOM_ENTRY_RANGE_MAX_DAYS} 天。`,
    },
    en: {
      title: 'That backup file holds entries this version cannot accept',
      recovery: `Nothing was imported. An entry has to fall in ${firstYear}–${lastYear}, with a name of at most ${CUSTOM_ENTRY_TITLE_MAX} characters, a note of at most ${CUSTOM_ENTRY_NOTE_MAX}, and a span of at most ${CUSTOM_ENTRY_RANGE_MAX_DAYS} days.`,
    },
  },
  'too-many-entries': {
    'zh-tw': {
      title: `匯入後會超過 ${CUSTOM_CALENDAR_ENTRY_LIMIT} 筆的上限`,
      recovery: '這次沒有匯入任何項目。先刪除一些現有項目，或改用較小的備份檔再試一次。',
    },
    en: {
      title: `Importing this file would pass the limit of ${CUSTOM_CALENDAR_ENTRY_LIMIT} entries`,
      recovery: 'Nothing was imported. Delete some entries you no longer need, or use a smaller backup file.',
    },
  },
}

export type CustomCalendarDocumentState = 'corrupt' | 'unsupported-version'

const customCalendarStateCopy: Record<CustomCalendarDocumentState, Record<LocaleCode, CustomCalendarMessage>> = {
  corrupt: {
    'zh-tw': {
      title: '這台裝置上的自訂行事曆讀不出來',
      recovery: '為了不蓋掉可能還救得回來的內容，這一頁不會自動覆寫它。可以先下載原始檔留存，再選擇重建一份空白的自訂行事曆。',
    },
    en: {
      title: 'The custom calendar on this device cannot be read',
      recovery: 'Nothing is overwritten automatically, in case the content can still be recovered. Download the raw file to keep it, then start a new calendar if you want to carry on.',
    },
  },
  'unsupported-version': {
    'zh-tw': {
      title: '這台裝置上的自訂行事曆由較新版本建立',
      recovery: '為了不覆蓋較新的資料，這個版本不會改寫它。重新整理取得最新版本後再開啟這個工具。',
    },
    en: {
      title: 'The custom calendar on this device was written by a newer release',
      recovery: 'This version will not overwrite it. Reload to pick up the newest release, then open this tool again.',
    },
  },
}

interface CustomCalendarStatusCopy {
  saved: (title: string) => string
  updated: (title: string) => string
  deleted: (title: string) => string
  cleared: string
  exported: (fileName: string) => string
  imported: (added: number, replaced: number) => string
  entriesSummary: (count: number) => string
}

const statusTemplates = {
  saved: { 'zh-tw': '已在這台裝置保存「{title}」。', en: 'Saved “{title}” on this device.' },
  updated: { 'zh-tw': '已更新「{title}」。', en: 'Updated “{title}”.' },
  deleted: { 'zh-tw': '已刪除「{title}」。', en: 'Deleted “{title}”.' },
  cleared: { 'zh-tw': '已清除這台裝置上的全部自訂項目。', en: 'Cleared every entry on this device.' },
  exported: { 'zh-tw': '已在這台裝置產生備份檔 {fileName}。', en: 'Wrote the backup file {fileName} on this device.' },
  imported: {
    'zh-tw': '已匯入 {added} 筆新項目，覆蓋 {replaced} 筆同識別碼的項目。',
    en: 'Imported {added} new entries and replaced {replaced} with the same id.',
  },
  entriesSummary: { 'zh-tw': '共 {count} 筆自訂項目', en: '{count} entries saved' },
} satisfies Record<keyof CustomCalendarStatusCopy, LocalizedCopy>

export function getCustomCalendarCopy(locale: LocaleCode): Record<CustomCalendarCopyKey, string> {
  return Object.fromEntries(
    customCalendarCopyKeys.map(key => [key, customCalendarCopy[key][locale]]),
  ) as Record<CustomCalendarCopyKey, string>
}

export function getCustomCalendarCaveats(locale: LocaleCode) {
  return customCalendarCaveatKeys.map(key => ({ key, text: customCalendarCaveats[key][locale] }))
}

export function customEntryIssueMessage(issue: CustomEntryIssue, locale: LocaleCode): string {
  return customEntryIssueCopy[issue.code][locale]
}

export function customCalendarFileErrorMessage(
  code: CustomCalendarFileErrorCode,
  locale: LocaleCode,
): CustomCalendarMessage {
  return customCalendarFileErrorCopy[code][locale]
}

export function customCalendarStateMessage(
  state: CustomCalendarDocumentState,
  locale: LocaleCode,
): CustomCalendarMessage {
  return customCalendarStateCopy[state][locale]
}

export function customCalendarStatus(locale: LocaleCode): CustomCalendarStatusCopy {
  const line = (key: keyof CustomCalendarStatusCopy, values: Record<string, string | number> = {}) =>
    Object.entries(values).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      statusTemplates[key][locale],
    )

  return {
    saved: title => line('saved', { title }),
    updated: title => line('updated', { title }),
    deleted: title => line('deleted', { title }),
    cleared: line('cleared'),
    exported: fileName => line('exported', { fileName }),
    imported: (added, replaced) => line('imported', { added, replaced }),
    entriesSummary: count => line('entriesSummary', { count }),
  }
}

/** One day, or the span it covers, written the way each language writes a date. */
export function describeEntryDates(entry: CustomCalendarEntry, locale: LocaleCode): string {
  const start = writeDate(entry.startDate, locale)
  if (entry.startDate === entry.endDate) return start

  return locale === 'en'
    ? `${start} – ${writeDate(entry.endDate, locale)}`
    : `${start}－${writeDate(entry.endDate, locale)}`
}

/** What one entry is, in one line: the name, what it counts as, and when. */
export function describeEntry(entry: CustomCalendarEntry, locale: LocaleCode): string {
  const parts = [entry.title, customEntryMarkLabels[entry.mark][locale], describeEntryDates(entry, locale)]
  return parts.join(locale === 'en' ? ', ' : '，')
}

function writeDate(date: string, locale: LocaleCode): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]

  return locale === 'en'
    ? new Date(Date.UTC(year, month - 1, day))
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : `${year} 年 ${month} 月 ${day} 日`
}

/** Section 12.6 of the product specification: what a visitor asks before trusting a local save. */
export const customCalendarFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': '我加的項目存在哪裡？', en: 'Where are my entries kept?' },
    body: {
      'zh-tw': '存在這台裝置的瀏覽器資料庫（IndexedDB）裡，和你在「本機資產」頁看到的其他自訂內容放在一起。它不會上傳、不會進入離線快取，也不會隨帳號或雲端偏好同步；換一台裝置或換一個瀏覽器就看不到，需要帶走請自己匯出備份檔。',
      en: 'In this browser\'s database (IndexedDB) on this device, alongside the other saved content listed on the local assets page. Nothing is uploaded, nothing enters the offline cache, and nothing syncs with an account or cloud preferences: another device or another browser will not see them, so export a backup file to carry them.',
    },
  },
  {
    heading: { 'zh-tw': '什麼情況下會不見？', en: 'What can make them disappear?' },
    body: {
      'zh-tw': '清除瀏覽器資料或網站資料、使用無痕視窗、瀏覽器在空間不足時回收這個網站的儲存空間，以及重灌或更換裝置，都會讓本機保存的內容消失。這個工具會顯示目前佔用的空間與瀏覽器回報的可用上限，但無法阻止瀏覽器回收；真的重要就先匯出備份檔。',
      en: 'Clearing browser or site data, private browsing, the browser reclaiming this site\'s storage when space runs low, and reinstalling or replacing the device all remove locally saved content. The tool shows how much space it uses and what the browser reports as available, but it cannot stop the browser from reclaiming it — export a backup file for anything that matters.',
    },
  },
  {
    heading: { 'zh-tw': '自訂放假會不會改掉官方的行事曆？', en: 'Does marking a day off change the official calendar?' },
    body: {
      'zh-tw': '不會。官方的辦公日曆表是唯讀的一層，自訂項目只疊在上面。日期詳情會同時列出「辦公日曆表」怎麼說與「我的自訂」怎麼說，兩者不同時會另外標示，所以你隨時看得出來哪一個是官方公告、哪一個是自己加的。',
      en: 'No. The office calendar is a read-only layer and your entries sit on top of it. The day panel shows what the office calendar says and what you said, side by side, and marks the days where the two differ — so it is always clear which is the announcement and which is yours.',
    },
  },
  {
    heading: { 'zh-tw': '可以當成公司或學校的出勤依據嗎？', en: 'Can I use this as my company or school schedule?' },
    body: {
      'zh-tw': '不行。自訂放假與自訂上班只是你自己在這台裝置上的紀錄，不代表公司、學校或法令的規定，也不會被任何人看到或核可。實際的上班、上課、請假與加班仍以所屬單位的公告與相關法規為準。',
      en: 'No. A day you mark off or working is only your own record on this device. It does not represent an employer, a school, or the law, and nobody else can see or approve it. Your actual work, classes, leave, and overtime follow the announcements of your own organisation and the relevant regulations.',
    },
  },
  {
    heading: { 'zh-tw': '支援每週或每月重複嗎？', en: 'Is there a weekly or monthly repeat?' },
    body: {
      'zh-tw': '目前沒有。一筆項目可以是同一天，也可以是一段連續期間（最多 366 天）。重複規則牽涉到例外、調整與時區，先做成看得懂、改得動的單筆項目比較不會誤導；需要固定輪班可以先分批建立，之後版本再評估。',
      en: 'Not yet. One entry covers a single day or a continuous span of up to 366 days. Repeat rules bring exceptions, adjustments, and time zones with them, and a plain entry you can read and edit is less likely to mislead; create the days you need for now, and repeats will be reconsidered in a later version.',
    },
  },
  {
    heading: { 'zh-tw': '匯出的檔案裡有什麼？', en: 'What is inside the exported file?' },
    body: {
      'zh-tw': '只有你自己加的項目：識別碼、名稱、備註、日期範圍、算成放假或上班，以及最後儲存時間。裡面沒有官方行事曆資料、沒有帳號資訊，也沒有裝置識別。檔名只帶日期，不含任何項目名稱，因為下載清單本身也可能被別人看到。',
      en: 'Only the entries you added: id, name, note, date range, whether the day counts as off or working, and when it was last saved. There is no official calendar data, no account information, and no device identifier. The file name carries only a date and never an entry name, because a download shelf is visible too.',
    },
  },
  {
    heading: { 'zh-tw': '離線的時候還能用嗎？', en: 'Does it work offline?' },
    body: {
      'zh-tw': '可以。行事曆資料在建置時就打包進網站，自訂項目本來就在這台裝置上，所以離線時新增、修改、刪除與匯出都照常運作；重新連線後也不會有任何內容被送出。',
      en: 'Yes. The calendar data ships with the site and your entries are already on this device, so adding, editing, deleting, and exporting all work offline. Nothing is sent when the connection comes back either.',
    },
  },
]

const customCalendarContentIssues = validateCustomCalendarContent()
if (customCalendarContentIssues.length) {
  throw new Error(`Invalid custom calendar content:\n${customCalendarContentIssues.join('\n')}`)
}

export function validateCustomCalendarContent() {
  const issues: string[] = []

  for (const key of customCalendarCopyKeys) {
    if (!hasLocalizedCopy(customCalendarCopy[key])) issues.push(`[copy:${key}] requires both locales`)
  }
  for (const mark of customEntryMarks) {
    if (!hasLocalizedCopy(customEntryMarkLabels[mark])) issues.push(`[mark:${mark}] requires both locales`)
    if (!hasLocalizedCopy(customEntryMarkHints[mark])) issues.push(`[mark-hint:${mark}] requires both locales`)
  }
  for (const key of customCalendarCaveatKeys) {
    if (!hasLocalizedCopy(customCalendarCaveats[key])) issues.push(`[caveat:${key}] requires both locales`)
  }
  for (const code of customEntryIssueCodes) {
    if (!hasLocalizedCopy(customEntryIssueCopy[code])) issues.push(`[issue:${code}] requires both locales`)
  }
  for (const code of customCalendarFileErrorCodes) {
    for (const locale of ['zh-tw', 'en'] as const) {
      const message = customCalendarFileErrorCopy[code][locale]
      if (!message.title.trim() || !message.recovery.trim()) issues.push(`[file-error:${code}:${locale}] requires a title and a recovery`)
    }
  }
  for (const state of ['corrupt', 'unsupported-version'] as const) {
    for (const locale of ['zh-tw', 'en'] as const) {
      const message = customCalendarStateCopy[state][locale]
      if (!message.title.trim() || !message.recovery.trim()) issues.push(`[state:${state}:${locale}] requires a title and a recovery`)
    }
  }
  for (const [key, template] of Object.entries(statusTemplates)) {
    if (!hasLocalizedCopy(template)) issues.push(`[status:${key}] requires both locales`)
  }

  const questions = new Set<string>()
  for (const [index, entry] of customCalendarFaq.entries()) {
    if (!hasLocalizedCopy(entry.heading) || !hasLocalizedCopy(entry.body)) issues.push(`[faq:${index}] requires both locales`)
    if (questions.has(entry.heading['zh-tw'])) issues.push(`[faq:${index}] duplicate question`)
    questions.add(entry.heading['zh-tw'])
  }

  return issues
}
