# 前端品質閘門

本品質閘門以已發布的「新臺幣國字大寫」工具作為 tracer bullet，從公開 locale route 驗證所有後續工具都必須維持的產品邊界。

## 本機執行

第一次執行先安裝 Playwright 的 Chromium、Firefox 與 WebKit：

```bash
npx playwright install chromium firefox webkit
```

完整驗證：

```bash
npm run quality
```

開發時可縮小回饋範圍：

```bash
npm run test:unit
npm run test:e2e -- --project=chromium
```

Service Worker 由 production build 產出到 `/sw.js`，`nuxt dev` 不註冊也不快取；離線與更新行為只能在 `npm run preview` 或 e2e 產出的 production build 上驗證。安裝圖示由 `node scripts/generate-app-icons.mjs` 從 Design System token 產生並提交到版本控制。

瀏覽器失敗時，截圖、trace 與 HTML report 會寫入已忽略版本控制的 `artifacts/`。

## 自動檢查內容

- 隱私：攔截瀏覽器請求與 WebSocket frame，任何未列入允許來源的 request，或 URL、header、body 內含各流程工具輸入、輸出、檔名 canary 時立即失敗。訊息只指出內容類別，不回印工具內容。
- 隱私（同源）：本站是無 API route 的預渲染靜態站台，因此同源請求只允許 GET 與 HEAD。瀏覽器不會把 `sendBeacon` 的 Blob 或其他二進位 payload 交給檢查器，`postData()` 與 `postDataBuffer()` 都會回 null，所以改以請求方法本身把關，避免讀不到的 payload 夾帶工具內容溜過閘門。
- 核心流程：透過公開工具頁完成輸入、結果顯示與鍵盤操作，並檢查 console 與未捕捉例外。
- 無障礙：light／dark 模式執行 axe WCAG 2.2 AA 規則，另驗證可見 focus 與至少 44 × 44 CSS px 的核心操作及行動導覽目標。
- 響應式：在 375、768、1024 與 1440 CSS px 檢查無橫向跑版及正確的手機／桌面導覽。
- 動態與效能：驗證 `prefers-reduced-motion`、工具頁載入 smoke budget，以及新臺幣轉換須於 50ms 內完成。
- 瀏覽器：相同核心 suite 必須在 Chromium、Firefox 與 WebKit 通過。
- PWA：驗證雙語 manifest、圖示可下載、離線說明頁 noindex 且通過 axe，以及安裝捷徑只指向已可離線使用的工具。Service Worker 生命週期（首次載入後離線啟動、未快取頁面的離線說明、等待中新版本的通知與確認）只在 Chromium 執行，因為 Playwright 的 Firefox 與 WebKit 版本沒有可驗證的 Service Worker 生命週期；跨瀏覽器共用的快取政策由單元測試覆蓋。
- PWA 快取邊界：列舉所有 Cache Storage 名稱與項目，證明只有 `toolsliang-` 前綴的版本化應用資產、沒有查詢字串，也不含任何工具內容 canary。

離線測試會刻意中斷連線，瀏覽器因此回報無法送出的請求。只有這類網路不可用訊息在明確標記的離線測試中被容許，應用層錯誤仍然是失敗。

新增流程或檔案型工具時，測試必須把每條流程實際使用的輸入、fixture 檔名、具辨識度的內容片段與輸出片段加入 canary 清單。不得改用真實使用者檔案，也不得把工具內容加入錯誤訊息、報告或 trace 標題。

E2E 每次自行啟動並關閉 production preview，不重用既有伺服器，避免 fresh build 後誤接到持有舊 manifest 的程序。

## CI

Pull Request 與 `develop` 更新會執行 `.github/workflows/quality.yml`。流程只進行 lint、strict typecheck、單元測試、production build 與三瀏覽器測試，不部署任何環境，也不連接分析或外部處理服務。

## 人工驗證邊界

axe 與 headless 瀏覽器不能取代螢幕閱讀器、完整鍵盤、200% zoom、文字間距與實機觸控檢查；release candidate 仍須完成規格中的人工 checklist。本機效能 smoke budget 也不等於正式環境的 p75 Web Vitals。
