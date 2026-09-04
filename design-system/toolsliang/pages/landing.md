# Landing Page overrides

- 使用獨立 Landing layout，不顯示 App Shell 側邊欄、手機 App 底部導覽或工具工作區。
- 區段順序固定為首屏、本機處理承諾、熱門工具、工具分類、常見問題；每個區段以 `.landing-section` 的 `section-heading`（eyebrow + `h2` + 說明）開頭。
- 首屏使用 `display-lg` 標題、`tool-search--large` 大型搜尋，並在搜尋框下方以可見文字說明搜尋只在本機執行。
- 分類網格巢狀於「工具分類」區段之下，分類標題降為 `h3`，維持連續的 heading hierarchy。
- 熱門工具為編輯挑選，不依個人使用紀錄或聚合排行排序；文案必須說明這一點。
- 常見問題以 `dl` 呈現且全部可見；只有可見的問答才可進入 `FAQPage` structured data。
- 內容、熱門清單與 structured data 由 `app/features/landing/content.ts` 提供，不在頁面內硬寫文案。
- 工具項目直接連到 locale-prefixed 工具頁；不在首頁展開操作面板。
- 首頁必須在 `/zh-tw/` 與 `/en/` 預先產生，確保 canonical、hreflang、OG 與 structured data 在 server HTML 內可驗證。
