import type { ToolFaqEntry } from '../faq'

export const deviceTimeFaq: ToolFaqEntry[] = [
    {
      heading: { 'zh-tw': '為什麼裝置時間可能不準確？', en: 'Why can device time be wrong?' },
      body: { 'zh-tw': '時間來自裝置時鐘；手動設定、錯誤時區或過期的時區資料都可能影響顯示。請檢查作業系統的日期與時間設定。本工具不向時間伺服器校時，也不提供時間證明。', en: 'Time comes from your device clock. Manual settings, the wrong time zone, or outdated time zone data can affect the display. Check your operating system’s date and time settings. This tool does not contact time servers or provide proof of time.' },
    },
    {
      heading: { 'zh-tw': 'UTC 時差和時區名稱有什麼不同？', en: 'How does UTC offset differ from a time zone name?' },
      body: { 'zh-tw': '時區名稱（例如 Asia/Taipei）代表瀏覽器使用的時區規則。UTC 時差表示此刻與 UTC 相差幾小時幾分鐘，可能隨夏令時間改變；規則與讀值都以此裝置提供的資料為準。', en: 'A time zone name such as Asia/Taipei identifies the rules used by your browser. The UTC offset is the difference in hours and minutes at this instant and may change with daylight saving time. Both follow the data available on this device.' },
    },
    {
      heading: { 'zh-tw': '切換到其他分頁後，時間還會更新嗎？', en: 'Does the clock update in a background tab?' },
      body: { 'zh-tw': '頁面隱藏時暫停更新，回到前景立即重新讀取裝置時間。關閉秒數後只在分鐘邊界更新；不會逐秒向螢幕閱讀器宣告時間，也不提供鬧鐘或排程。', en: 'Updates pause while the page is hidden and refresh immediately when it becomes visible. With seconds off, updates occur at minute boundaries. The clock does not announce every tick to screen readers and does not offer alarms or scheduling.' },
    },
    {
      heading: { 'zh-tw': '時間、時區與顯示設定會被保存或傳送嗎？', en: 'Are time readings, the time zone, or display settings saved or sent?' },
      body: { 'zh-tw': '不會。讀值只在此頁面的記憶體中顯示，不傳送至平台或第三方。秒數顯示設定也不會保存。只有按下複製時，顯示中的時間資訊才會寫入裝置剪貼簿。', en: 'No. Readings stay in this page’s memory and are not sent to the platform or third parties. Seconds display is not saved. Only pressing Copy writes the displayed time information to your device clipboard.' },
    },
  ]
