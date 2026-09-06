# 前端品質閘門

本品質閘門以已發布的「新臺幣國字大寫」工具作為 tracer bullet，從公開 locale route 驗證所有後續工具都必須維持的產品邊界。每個新工具再以自己的 spec 覆蓋該工具特有的流程；工具內容網路邊界的攔截器由 `tests/e2e/support/tool-content-boundary.ts` 共用，各 spec 只需宣告自己流程的 canary 清單。

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

行事曆的年度資料不在執行期擷取：`python3 scripts/ingest_taiwan_calendar.py` 由維運者執行，從人事行政總處、中央氣象署與香港天文台擷取、逐條驗證後寫入 `app/features/tools/taiwan-calendar/data/`，並隨版本控制提交。它需要 Python 3 與 `pdfminer`；擷取失敗時以 `docs/research/004-taiwan-calendar-sources-and-data-contract.md` §5.5 的錯誤 key 中止，不寫出半套年度。CI 與瀏覽器都不會連到任何來源。

Service Worker 由 production build 產出到 `/sw.js`，`nuxt dev` 不註冊也不快取；離線與更新行為只能在 `npm run preview` 或 e2e 產出的 production build 上驗證。安裝圖示由 `node scripts/generate-app-icons.mjs` 從 Design System token 產生並提交到版本控制。

瀏覽器失敗時，截圖、trace 與 HTML report 會寫入已忽略版本控制的 `artifacts/`。

## 自動檢查內容

- 隱私：攔截瀏覽器請求與 WebSocket frame，任何未列入允許來源的 request，或 URL、header、body 內含各流程工具輸入、輸出、檔名 canary 時立即失敗。訊息只指出內容類別，不回印工具內容。
- 隱私（同源）：本站沒有任何接受工具內容的端點；`sitemap.xml` 與雙語 manifest 雖然由 Nitro route 產生，但都在建置時預渲染成靜態檔案，執行期不接受請求主體。因此同源請求只允許 GET 與 HEAD。瀏覽器不會把 `sendBeacon` 的 Blob 或其他二進位 payload 交給檢查器，`postData()` 與 `postDataBuffer()` 都會回 null，所以改以請求方法本身把關，避免讀不到的 payload 夾帶工具內容溜過閘門。
- 核心流程：透過公開工具頁完成輸入、結果顯示與鍵盤操作，並檢查 console 與未捕捉例外。
- 無障礙：light／dark 模式執行 axe WCAG 2.2 AA 規則，另驗證可見 focus 與至少 44 × 44 CSS px 的核心操作及行動導覽目標。
- 響應式：在 375、768、1024 與 1440 CSS px 檢查無橫向跑版及正確的手機／桌面導覽。
- 動態與效能：驗證 `prefers-reduced-motion`、工具頁載入 smoke budget，以及新臺幣轉換須於 50ms 內完成。
- 瀏覽器：相同核心 suite 必須在 Chromium、Firefox 與 WebKit 通過。
- PWA：驗證雙語 manifest、圖示可下載、離線說明頁 noindex 且通過 axe，以及安裝捷徑只指向已可離線使用的工具。Service Worker 生命週期（首次載入後離線啟動、未快取頁面的離線說明、等待中新版本的通知與確認）只在 Chromium 執行，因為 Playwright 的 Firefox 與 WebKit 版本沒有可驗證的 Service Worker 生命週期；跨瀏覽器共用的快取政策由單元測試覆蓋。
- BMI 計算：以公制與英制代表案例驗證計算結果與分級文字、逾範圍與格式錯誤的可修正訊息、尚未填寫時不觸發 alert、結果由 `aria-live` 宣告且不移動焦點，並確認公式、成人分級表、六則使用限制、雙語 FAQ 與來源連結都可見。中英文頁各驗證一次錯誤訊息語言。
- 新臺幣國字大寫：以工具自己的 spec 驗證三種用途對同一筆金額的寫法差異、國庫用途的四捨五入前後對照、支票拒絕角分與超出上限時寫出該用途上限、複製成功與失敗都由 `role="status"` 宣告，以及規則版本識別碼與來源連結出現在結果附近。中英文頁各驗證一次錯誤訊息語言。這個工具同時是品質閘門的 tracer bullet，頁面層級的鍵盤、無障礙、響應式與效能檢查只在 `quality-gates.spec.ts` 執行一次，不重複。
- 本機抽選與抽籤輪盤：以工具自己的 spec 驗證名單解析摘要（空白行、合併重複）、重複項目策略切換時的機會說明、多名抽選不重複中選、抽出人數超出名單時寫出可抽筆數、輪盤只在抽 1 名且名單 2–48 筆時提供並說明替代呈現、動畫進行中 `aria-busy` 為 true 且不先宣告結果、跳過動畫不改變已決定的結果，以及 `prefers-reduced-motion` 下直接顯示同一個結果。輪盤與進度是這個工具特有的圖形與 widget，因此另在此頁跑 light／dark 的 axe 檢查、375px 觸控目標與鍵盤流程；等機率本身由單元測試的取樣不變式與統計煙霧測試負責，不在瀏覽器重複驗證。中英文頁各驗證一次錯誤訊息語言。
- 台灣行事曆：以工具自己的 spec 驗證 T13 代表性日期（農曆除夕落在十二月廿九、春節為正月初一、民族掃墓節等於當年清明節氣）、跨年翻月不重新起算星期、已修正年度顯示採用的版本、尚未公告年度不畫空白月曆而是說明尚未公告、補班日與補假在格子內有文字而非只有顏色、手機以標示清單呈現同一份資訊、方向鍵移動焦點且網格只保留一個 Tab 停留點，以及授權要求的資料提供機關、資料集、版本與授權連結都出現在年曆附近。月曆是這個工具特有的網格 widget，因此另在此頁跑 375px light／dark 的 axe 檢查與觸控目標量測；曆法換算、資料契約不變式與烘焙資料是否符合 T13 向量由單元測試負責，不在瀏覽器重複驗證。中英文頁各驗證一次。
- 常用工具：驗證未收藏前不寫入本機儲存、重新載入與離線後仍保留、鍵盤與觸控可完成加入、排序與移除、操作目標至少 44 × 44 CSS px、下架與未知工具會被清除、舊版紀錄可升級，以及中英文切換後指向同一個工具。常用工具檢視在 375px 下另跑 light／dark 的 axe 檢查。離線重新啟動同樣只在 Chromium 驗證，理由與 Service Worker 生命週期相同。
- PWA 快取邊界：列舉所有 Cache Storage 名稱與項目，證明只有 `toolsliang-` 前綴的版本化應用資產、沒有查詢字串，也不含任何工具內容 canary。

離線測試會刻意中斷連線，瀏覽器因此回報無法送出的請求。只有這類網路不可用訊息在明確標記的離線測試中被容許，應用層錯誤仍然是失敗。

新增流程或檔案型工具時，測試必須把每條流程實際使用的輸入、fixture 檔名、具辨識度的內容片段與輸出片段加入 canary 清單。不得改用真實使用者檔案，也不得把工具內容加入錯誤訊息、報告或 trace 標題。

E2E 每次自行啟動並關閉 production preview，不重用既有伺服器，避免 fresh build 後誤接到持有舊 manifest 的程序。

## CI

Pull Request 與 `develop` 更新會執行 `.github/workflows/quality.yml`。流程只進行 lint、strict typecheck、單元測試、production build 與三瀏覽器測試，不部署任何環境，也不連接分析或外部處理服務。

## 人工驗證邊界

axe 與 headless 瀏覽器不能取代螢幕閱讀器、完整鍵盤、200% zoom、文字間距與實機觸控檢查；release candidate 仍須完成規格中的人工 checklist。本機效能 smoke budget 也不等於正式環境的 p75 Web Vitals。
