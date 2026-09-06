import type { PublishedToolDefinition } from '@/features/tools/catalog'

/**
 * The custom calendar registers as an ordinary published tool, and everything
 * unusual about it is said in its own copy: it is the first tool that keeps
 * what a visitor typed after the tab closes. `showLocalProcessingStatement`
 * therefore stays on — a tool that saves has to say where it saves before the
 * first entry is written.
 */
export const customCalendarDefinition: PublishedToolDefinition = {
  slug: 'custom-calendar', category: 'time-calendar', icon: 'calendar-plus',
  availability: { state: 'published', publishedAt: '2026-09-07' },
  status: { kind: 'new', startsAt: '2026-09-07', endsAt: '2026-10-07' },
  name: { 'zh-tw': '自訂行事曆', en: 'Custom Calendar' },
  description: {
    'zh-tw': '在台灣行事曆上加註自己的放假、上班與備註，只存這台裝置。',
    en: 'Add your own days off, working days, and notes on the Taiwan calendar, kept on this device.',
  },
  aliases: {
    'zh-tw': ['公司行事曆', '排班表', '自訂假日'],
    en: ['company calendar', 'shift planner', 'custom holidays'],
  },
  keywords: {
    'zh-tw': ['公司假', '排班', '備註', '本機保存'],
    en: ['company day off', 'shift', 'note', 'saved locally'],
  },
  processingClass: 'instant',
  routeComponentKey: 'CustomCalendarWorkspace',
  offlineMode: 'ready',
  capabilities: ['javascript'],
  acceptedInput: {
    'zh-tw': '你自己輸入的自訂項目：名稱、日期或期間、算成放假或上班，以及選填備註',
    en: 'The entries you type: a name, a date or span, whether the day counts as off or working, and an optional note',
  },
  localProcessingStatement: {
    'zh-tw': '自訂項目只保存在這台裝置的瀏覽器資料庫，不會上傳，也不會隨雲端偏好同步。',
    en: 'Your entries are kept in this browser\'s database on this device. They are never uploaded and never sync as cloud preferences.',
  },
  pagePresentation: {
    showHeadingIcon: false,
    showLocalProcessingStatement: true,
  },
  seo: {
    contentKey: 'custom-calendar',
    title: { 'zh-tw': '自訂行事曆', en: 'Custom Calendar' },
    description: {
      'zh-tw': '在台灣行事曆上加入公司假、學校日、排班與備註，內容只保存在這台裝置的瀏覽器，可自行匯出備份，也能離線使用。',
      en: 'Layer company days off, school days, shifts, and notes on the Taiwan calendar. Everything stays in this browser on this device, exports as your own backup file, and works offline.',
    },
    answer: {
      'zh-tw': '自訂項目寫進這台裝置的瀏覽器資料庫，疊在辦公日曆表之上但不會改寫它；清除瀏覽器資料、無痕視窗或更換裝置都會讓它消失，需要保留請自行匯出備份檔。',
      en: 'Entries are written to this browser\'s database on this device and sit on top of the office calendar without rewriting it. Clearing browser data, private browsing, or moving device removes them, so export your own backup file to keep them.',
    },
  },
  contentReview: {
    reviewedAt: '2026-09-07', sourceEffectiveAt: '2026-09-07',
    sourceEdition: {
      'zh-tw': 'IndexedDB API 3.0 與 Storage 現行規格（2026-09-07 查閱版本）；對照的官方行事曆沿用台灣行事曆工具採用的辦公日曆表版本',
      en: 'IndexedDB API 3.0 and the Storage living standard (accessed 7 September 2026); the official calendar shown alongside is the office calendar edition used by the Taiwan calendar tool',
    },
    sources: [
      {
        title: { 'zh-tw': 'W3C：IndexedDB API 3.0', en: 'W3C: Indexed Database API 3.0' },
        url: 'https://www.w3.org/TR/IndexedDB/',
      },
      {
        title: { 'zh-tw': 'WHATWG：Storage 標準（儲存空間回收與持久化）', en: 'WHATWG: Storage Standard (eviction and persistence)' },
        url: 'https://storage.spec.whatwg.org/',
      },
      {
        title: {
          'zh-tw': '政府資料開放平臺：中華民國政府行政機關辦公日曆表',
          en: 'data.gov.tw: Government agency office calendar of the Republic of China',
        },
        url: 'https://data.gov.tw/dataset/14718',
      },
    ],
  },
}
