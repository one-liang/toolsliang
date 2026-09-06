import type { LocaleCode } from '@/features/tools/catalog'
import type { LocalAssetErrorCode } from './repository'
import type { LocalAssetKind } from './schema'

/**
 * Everything the asset manager says, in both languages. The wording is the
 * product boundary made visible: where the assets live, what can remove them,
 * and what each failure leaves the visitor able to do next.
 */
export interface LocalAssetErrorMessage {
  title: string
  recovery: string
}

const kindLabels: Record<LocalAssetKind, Record<LocaleCode, string>> = {
  calendar: { 'zh-tw': '自訂行事曆', en: 'Custom calendars' },
  background: { 'zh-tw': '背景', en: 'Backgrounds' },
  frame: { 'zh-tw': '框版', en: 'Frames' },
  logo: { 'zh-tw': 'Logo', en: 'Logos' },
  signature: { 'zh-tw': '簽名', en: 'Signatures' },
}

export function localAssetKindLabel(kind: LocalAssetKind, locale: LocaleCode): string {
  return kindLabels[kind][locale]
}

const errorMessages: Record<LocalAssetErrorCode, Record<LocaleCode, LocalAssetErrorMessage>> = {
  unsupported: {
    'zh-tw': {
      title: '這個瀏覽器沒有可用的本機資料庫',
      recovery: '工具仍可正常使用，只是無法在這台裝置保存資產。改用其他瀏覽器或關閉無痕模式後再試一次。',
    },
    en: {
      title: 'This browser has no local database available',
      recovery: 'Tools still work; assets just cannot be kept on this device. Try another browser or leave private browsing, then reload.',
    },
  },
  blocked: {
    'zh-tw': {
      title: '瀏覽器暫時擋住了本機資產',
      recovery: '可能是無痕模式、網站資料設定，或另一個分頁正在使用同一個資料庫。關閉其他分頁後重新整理再試一次。',
    },
    en: {
      title: 'The browser is blocking local assets right now',
      recovery: 'Private browsing, a site-data setting, or another tab using the same database can cause this. Close other tabs, reload, and try again.',
    },
  },
  'quota-exceeded': {
    'zh-tw': {
      title: '裝置儲存空間不足，這次沒有寫入任何資料',
      recovery: '先刪除不再需要的本機資產，或匯出後再清除，就能空出空間。原本已保存的資產都還在。',
    },
    en: {
      title: 'Not enough room on this device, so nothing was written',
      recovery: 'Delete assets you no longer need, or export them first and then clear. Everything already saved is untouched.',
    },
  },
  'unsupported-version': {
    'zh-tw': {
      title: '這台裝置上的資料由較新版本建立',
      recovery: '為了不覆蓋較新的資料，這個版本不會改寫它。重新整理取得最新版本後再開啟這一頁。',
    },
    en: {
      title: 'This device holds data written by a newer release',
      recovery: 'This version will not overwrite it. Reload to pick up the newest release, then open this page again.',
    },
  },
  'invalid-bundle': {
    'zh-tw': {
      title: '這個檔案不是可讀的本機資產匯出檔',
      recovery: '請選擇本站匯出的 JSON 檔案。這次沒有匯入任何資料，裝置上的資產維持原狀。',
    },
    en: {
      title: 'That file is not a readable local asset export',
      recovery: 'Choose a JSON file exported from this site. Nothing was imported, and the assets on this device are unchanged.',
    },
  },
  'empty-bundle': {
    'zh-tw': {
      title: '沒有可處理的本機資產',
      recovery: '先在工具中保存框版、Logo、簽名或自訂行事曆，或選擇一個含有資產的匯出檔。',
    },
    en: {
      title: 'There are no local assets to work with',
      recovery: 'Save a frame, Logo, signature, or custom calendar in a tool first, or choose an export file that contains assets.',
    },
  },
  unknown: {
    'zh-tw': {
      title: '本機資產這次沒有讀寫成功',
      recovery: '重新整理後再試一次。裝置上原本的資產不會因為這次失敗而被刪除。',
    },
    en: {
      title: 'That local asset operation did not complete',
      recovery: 'Reload and try again. Nothing already on this device is deleted because of this failure.',
    },
  },
}

export function localAssetErrorMessage(code: LocalAssetErrorCode, locale: LocaleCode): LocalAssetErrorMessage {
  return errorMessages[code][locale]
}

export interface LocalAssetCopy {
  eyebrow: string
  title: string
  intro: string
  boundary: string
  usageTitle: string
  usageTotal: string
  usageQuota: (used: string, quota: string) => string
  usageNoEstimate: string
  listTitle: string
  empty: string
  emptyHint: string
  sizeLabel: string
  updatedLabel: string
  renameLabel: (name: string) => string
  nameFieldLabel: string
  renameSave: string
  deleteLabel: (name: string) => string
  deletePrompt: (name: string) => string
  deleteConfirm: string
  deleteCancel: string
  clearAll: string
  clearAllPrompt: string
  clearAllConfirm: string
  exportAction: string
  exportHint: string
  importAction: string
  importHint: string
  unreadableTitle: string
  unreadableCorrupt: string
  unreadableVersion: string
  statusRenamed: (name: string) => string
  statusDeleted: (name: string) => string
  statusCleared: string
  statusExported: (fileName: string) => string
  statusImported: (added: number, replaced: number) => string
}

const zhTw: LocalAssetCopy = {
  eyebrow: '裝置儲存',
  title: '本機資產',
  intro: '你在工具中主動保存的框版、Logo、簽名與自訂行事曆都列在這裡，可以逐筆檢視、匯出或刪除。',
  boundary: '本機資產只保存在這台裝置的瀏覽器資料庫，不會上傳、不會進入離線快取，也不會隨雲端偏好同步。清除瀏覽器資料、使用無痕視窗、瀏覽器回收儲存空間或更換裝置時，這些資產會消失；需要保留就自行匯出備份。',
  usageTitle: '儲存用量',
  usageTotal: '本機資產合計',
  usageQuota: (used, quota) => `這個網站在瀏覽器的估計用量 ${used}／可用上限 ${quota}`,
  usageNoEstimate: '這個瀏覽器沒有提供儲存空間估計值。',
  listTitle: '已保存的資產',
  empty: '這台裝置還沒有本機資產。',
  emptyHint: '在支援的工具中保存框版、Logo、簽名或自訂行事曆後，就會出現在這裡。',
  sizeLabel: '大小',
  updatedLabel: '更新時間',
  renameLabel: name => `重新命名「${name}」`,
  nameFieldLabel: '資產名稱',
  renameSave: '儲存名稱',
  deleteLabel: name => `刪除「${name}」`,
  deletePrompt: name => `確定要刪除「${name}」嗎？刪除後無法復原。`,
  deleteConfirm: '確認刪除',
  deleteCancel: '取消',
  clearAll: '清除全部本機資產',
  clearAllPrompt: '確定要清除這台裝置上的全部本機資產嗎？刪除後無法復原，建議先匯出備份。',
  clearAllConfirm: '確認全部清除',
  exportAction: '匯出備份檔',
  exportHint: '匯出會在這台裝置產生一個 JSON 檔案，由你自己決定存放位置，不會傳送到任何伺服器。',
  importAction: '匯入備份檔',
  importHint: '選擇本站匯出的 JSON 檔案；檔案只在瀏覽器讀取。相同識別碼的資產會被覆蓋，讀取失敗則整份不匯入。',
  unreadableTitle: '無法讀取的資料',
  unreadableCorrupt: '這筆資料已損毀，無法顯示內容，但可以刪除。',
  unreadableVersion: '這筆資料由較新版本建立，這個版本不會改寫它。',
  statusRenamed: name => `已更名為「${name}」。`,
  statusDeleted: name => `已刪除「${name}」。`,
  statusCleared: '已清除這台裝置上的全部本機資產。',
  statusExported: fileName => `已在這台裝置產生備份檔 ${fileName}。`,
  statusImported: (added, replaced) => `已匯入 ${added} 筆新資產，覆蓋 ${replaced} 筆同識別碼的資產。`,
}

const en: LocalAssetCopy = {
  eyebrow: 'Device storage',
  title: 'Local assets',
  intro: 'Frames, Logos, signatures, and custom calendars you chose to save in a tool are listed here, ready to review, export, or delete.',
  boundary: 'Local assets stay in this browser\'s database on this device. They are never uploaded, never enter the offline cache, and never sync as cloud preferences. Clearing browser data, private browsing, storage reclaimed by the browser, or moving to another device removes them, so export a backup if you need to keep them.',
  usageTitle: 'Storage in use',
  usageTotal: 'Local assets total',
  usageQuota: (used, quota) => `Browser estimate for this site: ${used} used of ${quota} available`,
  usageNoEstimate: 'This browser does not report a storage estimate.',
  listTitle: 'Saved assets',
  empty: 'No local assets are saved on this device yet.',
  emptyHint: 'Save a frame, Logo, signature, or custom calendar in a supported tool and it will appear here.',
  sizeLabel: 'Size',
  updatedLabel: 'Updated',
  renameLabel: name => `Rename “${name}”`,
  nameFieldLabel: 'Asset name',
  renameSave: 'Save name',
  deleteLabel: name => `Delete “${name}”`,
  deletePrompt: name => `Delete “${name}”? This cannot be undone.`,
  deleteConfirm: 'Confirm delete',
  deleteCancel: 'Cancel',
  clearAll: 'Clear all local assets',
  clearAllPrompt: 'Clear every local asset on this device? This cannot be undone, so export a backup first if you may want them later.',
  clearAllConfirm: 'Confirm clear all',
  exportAction: 'Export a backup file',
  exportHint: 'Exporting writes a JSON file on this device that you decide where to keep. Nothing is sent to a server.',
  importAction: 'Import a backup file',
  importHint: 'Choose a JSON file exported from this site; it is read in the browser only. Assets with the same id are replaced, and an unreadable file imports nothing at all.',
  unreadableTitle: 'Data that cannot be read',
  unreadableCorrupt: 'This record is damaged, so its content cannot be shown. You can still delete it.',
  unreadableVersion: 'This record was written by a newer release, and this version will not overwrite it.',
  statusRenamed: name => `Renamed to “${name}”.`,
  statusDeleted: name => `Deleted “${name}”.`,
  statusCleared: 'Cleared every local asset on this device.',
  statusExported: fileName => `Backup file ${fileName} was created on this device.`,
  statusImported: (added, replaced) => `Imported ${added} new assets and replaced ${replaced} with the same id.`,
}

export function localAssetCopy(locale: LocaleCode): LocalAssetCopy {
  return locale === 'en' ? en : zhTw
}
