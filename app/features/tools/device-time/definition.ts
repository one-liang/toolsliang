import type { PublishedToolDefinition } from '@/features/tools/catalog'

export const deviceTimeDefinition: PublishedToolDefinition = {
  slug: 'device-time', category: 'time-calendar', icon: 'clock',
  availability: { state: 'published', publishedAt: '2026-09-05' },
  name: { 'zh-tw': '裝置時間', en: 'Device Time' },
  description: { 'zh-tw': '查看此裝置的日期、時間、時區與 UTC 時差。', en: 'View this device’s date, time, time zone, and UTC offset.' },
  aliases: { 'zh-tw': ['本機時間', '時鐘'], en: ['local clock', 'device clock'] },
  keywords: { 'zh-tw': ['日期', '秒數', '時區', '時差', '全螢幕', '12 小時制', '24 小時制'], en: ['date', 'seconds', 'time zone', 'UTC offset', 'full screen', '12-hour', '24-hour'] },
  processingClass: 'instant', routeComponentKey: 'DeviceTimeWorkspace',
  offlineMode: 'ready', capabilities: ['javascript'],
  acceptedInput: { 'zh-tw': '不需輸入；讀取此裝置的時鐘與時區設定。', en: 'No input needed; reads this device’s clock and time zone settings.' },
  localProcessingStatement: { 'zh-tw': '時間與時區只在此裝置讀取，不傳送或保存讀值。', en: 'Time and time zone are read only on this device. Readings are never sent or saved.' },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true },
  seo: {
    contentKey: 'device-time',
    title: { 'zh-tw': '裝置時間：本機日期、時區與 UTC 時差', en: 'Device Time: local date, time zone, and UTC offset' },
    description: { 'zh-tw': '查看瀏覽器提供的裝置日期、時間、時區與 UTC 時差，可切換秒數並複製時間資訊。讀值不離開裝置，並非網路校時。', en: 'View your device date, time, time zone, and UTC offset. Toggle seconds and copy time information locally. This clock is not network-corrected.' },
    answer: { 'zh-tw': '裝置時間依據此裝置的時鐘與時區設定，可能因設定錯誤而不準確；它不是網路校正的國家標準時間，也不能作為時間證明。', en: 'Device time follows this device’s clock and time zone settings, which may be incorrect. It is not network-corrected official time or proof of time.' },
  },
}
