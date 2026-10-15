# Landing Page overrides

- 使用獨立 Landing layout（`app/layouts/landing.vue` 與 `app/assets/css/landing.css`），不顯示 App Shell 側邊欄、手機 App 底部導覽或工具工作區。
- 區段順序：首屏、工具一覽（五個分類區塊）、常見問題、收尾區塊。不使用 eyebrow，標題直接說話。
- 首屏：左 7 欄為兩行 H1（第二行黃色標記）、一行副標、64px 本機搜尋與「瀏覽全部工具」黑色膠囊；右 5 欄為三張傾斜的範例卡片（支票國字大寫、2026 年 2 月連假、BMI），數值都由各工具的 domain 模組計算（`app/features/landing/demos.ts`）。首屏在桌面填滿第一個畫面。
- 工具一覽以分類平塗色區塊呈現，每塊一個實際輸出的示範（去背對照、簽名表單、裝置時鐘、BMI 分級、輪盤），下方列出該分類全部工具；每個已發布工具只出現一次，一句話介紹由 `landingToolTaglines` 提供。
- 隱私邊界、費用與手機支援只在常見問題各回答一次，首頁上半部不重複。常見問題用 `details`，只有可見的問答才進入 `FAQPage` structured data；最後一題自動列出全部已發布工具。
- 本機搜尋不得宣告 `SearchAction` 或任何 `potentialAction`。
- 動畫由 `useLandingMotion` 以 GSAP 延遲載入，在 `gsap.matchMedia` 的 no-preference 條件內建立、每段只播放一次；範例卡片在腳本逾時或失敗時以 CSS 備援顯示。
- 首頁必須在 `/zh-tw/` 與 `/en/` 預先產生，確保 canonical、hreflang、OG 與 structured data 在 server HTML 內可驗證。
