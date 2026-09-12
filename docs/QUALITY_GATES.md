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

圖片去背的候選評估同樣不在執行期或 CI 進行：`node scripts/evaluate-background-removal.mjs` 由維運者執行，把釘選 commit 的模型與 onnxruntime-web 下載到已忽略版本控制的 `artifacts/`、逐檔比對 SHA-256，再開一個可見的 Chromium 視窗量測。它需要可見視窗：headless Chromium 只提供 SwiftShader 介面卡，也不回答 `measureUserAgentSpecificMemory`，量到的會是軟體算圖的時間與空白的記憶體。測試圖片全部由程式繪製，結果寫入 `docs/research/data/007-background-removal-measurements.json` 並隨版本控制提交；CI 只讀這份 JSON，不下載模型也不執行推論。

三個瀏覽器量測腳本共用的下載、完整性比對、解壓、localhost 供應與 Playwright 驅動放在 `scripts/support/measurement-harness.mjs`；`evaluate-pdf-engine.mjs` 與 `evaluate-word-to-pdf.mjs` 都從那裡取用。`evaluate-background-removal.mjs` 仍保有自己的一份：它下載的是模型權重而不是 npm tarball，也需要有視窗的 GPU Chromium，遷移它必須以重跑推論驗證，不能靠重播快取。

PDF 引擎的候選評估同樣不在執行期或 CI 進行：`node scripts/evaluate-pdf-engine.mjs` 由維運者執行，把釘選版本的 npm tarball 下載到已忽略版本控制的 `artifacts/`、以 registry 發布的 `sha512` integrity 逐檔比對，只解出 harness 會載入的檔案，再依序在 Chromium、Firefox 與 WebKit 量測。Chromium 以有視窗的模式啟動，因為 `performance.measureUserAgentSpecificMemory()` 只有它提供，而且需要跨來源隔離與可見分頁才會取樣。測試 PDF 全部由 `scripts/pdf-engine/fixtures.mjs` 依 ISO 32000-1 以程式產生，包含多頁大檔、旋轉頁、偏移頁框、交叉參考串流、兩種標準安全處理器加密檔、一份只設擁有者密碼的權限受限檔、一份宣告指令碼與各種動作的檔案，以及兩種損毀檔；沒有任何真實 PDF。量測期間伺服器記錄每一個被請求的路徑，任何預期以外的路徑都會寫進結果，這是「文件裡的動作沒有被跟隨」的證據來源。結果寫入 `docs/research/data/009-pdf-engine-measurements.json` 並隨版本控制提交，CI 只讀這份 JSON。

Word 轉 PDF 的可行性驗證同樣不在執行期或 CI 進行：`node scripts/evaluate-word-to-pdf.mjs` 由維運者執行，把釘選版本的 npm tarball 下載到已忽略版本控制的 `artifacts/`、以 registry 發布的 `sha512` integrity 逐檔比對，只解出 harness 會載入的檔案，再依序在 Chromium、Firefox 與 WebKit 量測四條轉換管線。Chromium 以有視窗的模式啟動，因為 `performance.measureUserAgentSpecificMemory()` 只有它提供；該 API 在下一次垃圾回收才回覆，因此只在六份代表性文件上取樣。測試用的四十二份 DOCX 全部由 `scripts/word-to-pdf/fixtures.mjs` 依 ECMA-376 以程式產生，涵蓋文字、表格、清單、圖片、頁首頁尾、註腳、方程式、追蹤修訂、分節與分頁，以及必須被拒絕的巨集、加密、舊版二進位與損毀檔；沒有任何真實 Word 文件。其中一份文件指向一個不存在的位址，量測期間記錄瀏覽器發出的每一個請求，任何預期以外的位址都會寫進結果；另有一份文件指定一個不可能存在的字型家族，用來讓「字型被安靜替代」成為量得到的事實。結果寫入 `docs/research/data/011-word-to-pdf-measurements.json` 並隨版本控制提交，CI 只讀這份 JSON。這次驗證的判定是 no-go（ADR-0017），因此 `word-to-pdf` 只以未發布狀態保留 slug，`tests/word-to-pdf-reference.test.ts` 與既有的未發布工具測試一起確保它不會出現在任何公開面上。

PDF 手寫簽名的輸出驗證同樣不在執行期或 CI 進行：`node scripts/verify-pdf-signature-output.mjs` 由維運者執行，以專案自己的 esbuild 打包工具實際出貨的 Worker，對 `scripts/pdf-engine/fixtures.mjs` 產生的合成文件跑完開檔、預覽與匯出，再用一份獨立的 pdf.js 把輸出讀回並逐像素比對：簽名是否落在放置的矩形內、矩形外有沒有任何像素改變、透明度是否還在、沒有簽名的頁面是否一個像素都沒動。它同時記錄每一次執行的主控台錯誤、Worker 崩潰與被請求的位址。結果寫入 `docs/research/data/010-pdf-signature-verification.json` 並隨版本控制提交，CI 只讀這份 JSON。

Service Worker 由 production build 產出到 `/sw.js`，`nuxt dev` 不註冊也不快取；離線與更新行為只能在 `npm run preview` 或 e2e 產出的 production build 上驗證。安裝圖示由 `node scripts/generate-app-icons.mjs` 從 Design System token 產生並提交到版本控制。

瀏覽器失敗時，截圖、trace 與 HTML report 會寫入已忽略版本控制的 `artifacts/`。

## 自動檢查內容

- 隱私：攔截瀏覽器請求與 WebSocket frame，任何未列入允許來源的 request，或 URL、header、body 內含各流程工具輸入、輸出、檔名 canary 時立即失敗。訊息只指出內容類別，不回印工具內容。
- 隱私（同源）：本站沒有任何接受工具內容的端點；`sitemap.xml` 與雙語 manifest 雖然由 Nitro route 產生，但都在建置時預渲染成靜態檔案，執行期不接受請求主體。因此同源請求只允許 GET 與 HEAD。瀏覽器不會把 `sendBeacon` 的 Blob 或其他二進位 payload 交給檢查器，`postData()` 與 `postDataBuffer()` 都會回 null，所以改以請求方法本身把關，避免讀不到的 payload 夾帶工具內容溜過閘門。
- 核心流程：透過公開工具頁完成輸入、結果顯示與鍵盤操作，並檢查 console 與未捕捉例外。
- 工具狀態標籤：以假時鐘把裝置日期移到 NEW 效期之外與之內，各載入一次預先產生的工具頁與工具目錄，確認標籤依訪客裝置的日期出現或消失；同時直接取回未執行 JavaScript 的 HTML，確認裡面沒有任何由日期推導的標籤。NEW 若在建置時就決定，hydration 會與訪客裝置的日期不一致，主控台的 mismatch 由既有的 console 檢查判定失敗。標籤是掛載後才出現的元素，因此同一頁另比對標籤出現前後，標題列、說明、工具契約、側邊欄分組與工具卡的位置與高度必須完全相同，證明版面已預留它的位置而不是被它推開。效期判定規則、伺服器端不輸出 NEW，以及「只有一個元件求值狀態效期」的不變式由單元測試負責。
- 無障礙：light／dark 模式執行 axe WCAG 2.2 AA 規則，另驗證可見 focus 與至少 44 × 44 CSS px 的核心操作及行動導覽目標。
- 響應式：在 375、768、1024 與 1440 CSS px 檢查無橫向跑版及正確的手機／桌面導覽。
- 動態與效能：驗證 `prefers-reduced-motion`、工具頁載入 smoke budget，以及新臺幣轉換須於 50ms 內完成。
- 瀏覽器：相同核心 suite 必須在 Chromium、Firefox 與 WebKit 通過。
- PWA：驗證雙語 manifest、圖示可下載、離線說明頁 noindex 且通過 axe，以及安裝捷徑只指向已可離線使用的工具。Service Worker 生命週期（首次載入後離線啟動、未快取頁面的離線說明、等待中新版本的通知與確認）只在 Chromium 執行，因為 Playwright 的 Firefox 與 WebKit 版本沒有可驗證的 Service Worker 生命週期；跨瀏覽器共用的快取政策由單元測試覆蓋。
- BMI 計算：以公制與英制代表案例驗證計算結果與分級文字、逾範圍與格式錯誤的可修正訊息、尚未填寫時不觸發 alert、結果由 `aria-live` 宣告且不移動焦點，並確認公式、成人分級表、六則使用限制、雙語 FAQ 與來源連結都可見。中英文頁各驗證一次錯誤訊息語言。
- 新臺幣國字大寫：以工具自己的 spec 驗證三種用途對同一筆金額的寫法差異、國庫用途的四捨五入前後對照、支票拒絕角分與超出上限時寫出該用途上限、複製成功與失敗都由 `role="status"` 宣告，以及規則版本識別碼與來源連結出現在結果附近。中英文頁各驗證一次錯誤訊息語言。這個工具同時是品質閘門的 tracer bullet，頁面層級的鍵盤、無障礙、響應式與效能檢查只在 `quality-gates.spec.ts` 執行一次，不重複。
- 本機抽選與抽籤輪盤：以工具自己的 spec 驗證名單解析摘要（空白行、合併重複）、重複項目策略切換時的機會說明、多名抽選不重複中選、抽出人數超出名單時寫出可抽筆數、輪盤只在抽 1 名且名單 2–48 筆時提供並說明替代呈現、動畫進行中 `aria-busy` 為 true 且不先宣告結果、跳過動畫不改變已決定的結果，以及 `prefers-reduced-motion` 下直接顯示同一個結果。輪盤與進度是這個工具特有的圖形與 widget，因此另在此頁跑 light／dark 的 axe 檢查、375px 觸控目標與鍵盤流程；等機率本身由單元測試的取樣不變式與統計煙霧測試負責，不在瀏覽器重複驗證。中英文頁各驗證一次錯誤訊息語言。
- 台灣行事曆：以工具自己的 spec 驗證 T13 代表性日期（農曆除夕落在十二月廿九、春節為正月初一、民族掃墓節等於當年清明節氣）、跨年翻月不重新起算星期、已修正年度顯示採用的版本、尚未公告年度不畫空白月曆而是說明尚未公告、補班日與補假在格子內有文字而非只有顏色、手機以標示清單呈現同一份資訊、方向鍵移動焦點且網格只保留一個 Tab 停留點，以及授權要求的資料提供機關、資料集、版本與授權連結都出現在年曆附近。月曆是這個工具特有的網格 widget，因此另在此頁跑 375px light／dark 的 axe 檢查與觸控目標量測；曆法換算、資料契約不變式與烘焙資料是否符合 T13 向量由單元測試負責，不在瀏覽器重複驗證。中英文頁各驗證一次。
- 自訂行事曆：以工具自己的 spec 驗證新增、編輯、刪除與確認流程；官方日別與自訂項目分成兩層且差異寫成文字；被拒絕的輸入逐項說明且不寫入裝置；匯出檔名只帶日期、清除後可由匯入還原；讀不到的匯入檔不改變裝置上的項目；重新載入與離線重新啟動後已保存的項目仍在，離線也能新增與刪除。編輯表單與月曆是這個工具特有的介面，因此另在此頁跑 375px light／dark 的 axe 檢查、觸控目標量測與純鍵盤流程，並列舉 Cache Storage、`localStorage` 與 `sessionStorage`，證明自訂項目不在網路請求、快取或偏好命名空間出現。項目驗證規則、文件版本升級、損毀資料、匯出入格式、配額與規格要求的 5,000 筆 500ms 開啟預算由單元測試負責。規格 §12.6 要求的匯入取消與逐筆進度不適用：整份自訂行事曆是單一文件的一次原子寫入，沒有可中途取消的逐筆交易，rollback 由全有全無的解析保證。規格提到的 logout independence 目前沒有登入流程可驗證，以「自訂項目不進入偏好命名空間」的檢查涵蓋同一個不變式。離線重新啟動同樣只在 Chromium 驗證，理由與 Service Worker 生命週期相同。中英文頁各驗證一次。
- 常用工具：驗證未收藏前不寫入本機儲存、重新載入與離線後仍保留、鍵盤與觸控可完成加入、排序與移除、操作目標至少 44 × 44 CSS px、下架與未知工具會被清除、舊版紀錄可升級，以及中英文切換後指向同一個工具。常用工具檢視在 375px 下另跑 light／dark 的 axe 檢查。離線重新啟動同樣只在 Chromium 驗證，理由與 Service Worker 生命週期相同。
- 本機資產：以雙語 `/storage/` 頁驗證匯入、更名、逐筆刪除、全部清除與匯出都由使用者確認並在重新載入後保留；讀不到與較新版本的紀錄可辨識且可刪除；讀取失敗的匯入檔不改變裝置上的資產。另列舉 Cache Storage 項目、`localStorage` 與 `sessionStorage`，證明資產名稱與內容不在網路請求、Service Worker 快取或偏好命名空間出現。375px 另跑 light／dark 的 axe 檢查、觸控目標與鍵盤更名流程；資料庫結構遷移、配額保留、損毀與版本錯誤、匯出入格式與 rollback 由單元測試負責。離線重新啟動同樣只在 Chromium 驗證，理由與 Service Worker 生命週期相同。
- 規格工具 slug：`tests/tool-spec-routes.test.ts` 在執行時讀取 `docs/specs/002-product-and-technical-specification.md`，檢查 §12 每個宣告具體 slug 的工具小節與 `app/features/tools/catalog.ts` 一致：宣告的 stable slug 必須是註冊表裡真的有的工具（含未發布），同一條 bullet 寫出的 `/{locale}/tools/…/` 路徑也必須用同一個 slug。ADR-0011 把 slug 視為穩定 URL 契約，只改規格或只改註冊表的更名會讓這個閘門失敗。未保留 slug 的小節（例如 HEIC 範圍）不宣告也不受檢。
- 去背決策紀錄：`tests/image-background-remover-reference.test.ts` 檢查 `docs/research/007-image-background-removal-model-evaluation.md`、`app/features/tools/image-background-remover/domain/reference.ts` 與量測 JSON 三者一致：候選、排除原因與原因分類、能力層級、失敗代碼、模型 commit 與 SHA-256 都必須逐字相同，文件裡的每個數字都必須等於量測檔中的值，選定方案的授權必須落在可自行散布的清單內，模型下載網址只能指向釘選 commit 的允許來源，且文件必須寫明像素不離開裝置。`tests/image-background-remover-model.test.ts` 再往下一層：版本一實際採用的權重必須就是紀錄推薦的那一個、範圍必須是人像、前處理與授權逐字沿用紀錄，而且 `public/` 裡真正提交的模型與 runtime 檔案要逐一雜湊，位元組數與 SHA-256 都必須等於註冊表宣告的值。
- PDF 引擎決策紀錄：`tests/pdf-signature-reference.test.ts` 檢查 `docs/research/009-pdf-local-editing-engine-and-safety-boundary.md`、`app/features/tools/pdf-signature/domain/reference.ts` 與量測 JSON 三者一致：候選、版本、授權與是否可自行散布、排除原因與原因分類、代表性文件的頁數／位元組／SHA-256、48 格相容性矩陣與 12 格保護檔矩陣的每一個判定、效能與記憶體的每一個數字、讀回保真的每一個比例都必須逐一相符；選定的兩個引擎必須落在可自行散布的清單內，宣告授權與實際散布內容不符的候選不得入選；上限必須低於實測可處理的規模，預算必須在三個瀏覽器的實測值之上；文件裡的每個網址只能指向套件與規格來源。同一份測試另以四個旋轉角度、偏移頁框與越界矩形固定座標換算的來回不變式，逐案比對 harness 與 domain 模組兩份實作是否一致，並要求量測中每一頁讀回的越界像素與未簽頁變動像素為 0、每一次執行都沒有文件指令碼被執行、也沒有預期以外的請求。禁止用語清單由文件 §10.2 提供，雙語文案不得出現其中任何一個。
- Word 轉 PDF 可行性紀錄：`tests/word-to-pdf-reference.test.ts` 檢查 `docs/research/011-word-to-pdf-local-conversion-feasibility.md`、`app/features/tools/word-to-pdf/domain/reference.ts` 與量測 JSON 三者一致：函式庫、版本、授權與是否可自行散布、管線組成與傳輸大小、排除原因與原因分類、四十二份測試文件的類別／宣告頁數／位元組／SHA-256、每一格開啟判定、每一列分頁數、每一項保真判定、每一個時間與阻塞數字、每一份輸出檔的頁數與文字項目數都必須逐一相符。同一份測試另要求測試集達到規格 §12.13 的規模與涵蓋範圍、每一次執行的預期外請求為 0、文件裡的外部連結探針從未被請求、五個規格階段各自對應到承擔它的管線階段（`font-resolution` 對應到「無」），以及三個瀏覽器在成敗、頁數與文字項目數上得到相同結果——那是 §4.3 只印一組數字的前提。字型解析是唯一三個瀏覽器不一致的量測，因此 §4.4 逐一瀏覽器列出。閘門有 fail 時判定必須是 no-go，而 no-go 期間 `word-to-pdf` 必須註冊為未發布、不出現在公開 route、sitemap、搜尋結果或工具目錄。禁止用語清單由文件 §10 提供。
- PDF 手寫簽名：以工具自己的 spec 驗證多頁與旋轉文件的開啟、放置、換頁與輸出，並把下載到的檔案讀回 Node 檢查結構——未加密文件的輸出必須以原始位元組開頭（增量更新，未簽頁保留原本的位元組），加密文件則不得以原始位元組開頭且輸出不再帶有 `/Encrypt`。另驗證純鍵盤完成定位（輸入文字的簽名、數值欄位、方向鍵與 Shift 粗調、加減號縮放、Delete 刪除、復原）、錯誤密碼與正確密碼的差別、權限不允許修改／損毀／超過頁數上限／非 PDF 的說明都可理解且可恢復、不透明的簽名圖片會被擋下、保存的簽名重新載入後仍在且不進入偏好命名空間、雙語 canonical 與 hreflang，以及 375px 的觸控目標與亮暗模式 axe。代表性 20 頁 20 MiB 文件只在 chromium 跑一次煙霧量測，界線刻意寬鬆（20 秒）：這條流程量到的時間包含把 20 MiB 交給瀏覽器的驅動端傳檔，那是測試架構而不是工具。規格 §12.12 的 3 秒預覽與 15 秒匯出以瀏覽器內的量測值判定，由 `tests/pdf-signature-output.test.ts` 讀取維運者的量測檔把關。像素層級的保真（簽名落點、透出比例、未簽頁）由 `tests/pdf-signature-output.test.ts` 讀取維運者的量測檔負責，不在瀏覽器重複驗證。
- 合規主圖：以工具自己的 spec 驗證六個 preset 各自產生的輸出，逐一把下載到的檔案解碼回來，確認寬、高、格式與容量都落在該通路載明的範圍內；並驗證來源標題、網址、查核日期、有效日期、涵蓋度與未公開欄位都看得見，通路頁面只外連而不由本站代取，被排除的通路與原因固定顯示。另驗證輔助框與各類規則結果都有文字而不只有顏色、不可能的輸出尺寸在開始前就說明且可修正、超過本機上限的輸入可恢復且不遺失原檔，以及 12 MP 商品圖在 10 秒預算內完成且主執行緒不被卡住。preset 效期判定依訪客裝置的日期，因此在單元測試以假時鐘跨過寬限期驗證停用行為，瀏覽器只驗證判定所依據的日期與停用政策在上傳前就看得見。
- 商品圖工作台：以工具自己的 spec 驗證跨引擎的批次作業。三瀏覽器驗證合規主圖批次（兩張圖走完流程、每張產生 1000 × 1000 JPEG、容量落在通路範圍內、規則核對結果與免責同時可見、逐項下載與封存檔名皆不帶來源檔名，並讀回封存檔的中央目錄確認內容）、品牌宣傳圖分支（版型結果再疊上 Logo，讀回像素確認圖層順序，再由壓縮步驟決定容量）、混合批次（超過本機像素上限的那一張在開始前就標成不能處理、不提供無效的重試、其餘項目照常完成，移除該列後焦點落在接手的那一列）、逐項取消與全部取消都只交還未完成的工作、去背引擎不可用時只停用該步驟、純鍵盤切換步驟與操作佇列時焦點與進度隨之移動、未完成工作會攔截離開，以及清空工作台會撤銷輸出的 Blob URL。中英文頁各驗證一次 canonical／hreflang、上限說明、被拒絕輸入的訊息語言、320–1440px reflow 與亮暗模式 axe。蓋住張數上限的批次（收下 20 張、退回多出來的 2 張、中途全部取消後再接續跑完並打包）連同併發上限與封存的主執行緒佔用，只在 Chromium 量測一次（`longtask` 只有該瀏覽器提供）；全部取消放在這裡，是因為只有真正跑到一半的批次才看得出「已完成的項目保留成果、其餘交還」。壓縮步驟適用與否由通路規格是否公開規定容量決定，因此三瀏覽器流程會切換到未規定容量的通路規格驗證這一步會回到可用。完整代表性流程（下載模型、本機去背、接續版型與下載）也只在 Chromium 執行一次，理由與人像去背相同。工作階段狀態機、作業佇列排序、封存容器格式、每步驟錯誤字彙與場景組裝由單元測試負責，不在瀏覽器重複驗證。12 MP 的效能預算由合規主圖與圖片壓縮的 spec 量測，工作台沿用同一組引擎，不重複量測。
- 預載資產：每個工具頁宣告的 `preload` 與 `modulepreload` 都必須回 200。client 與 server 各自打包一次 Worker，只有純由應用程式碼組成的 Worker 兩邊才會產出相同的雜湊檔名；這個檢查擋下由 SSR 算出、實際不存在的資產網址，因為它同時是主控台錯誤與離線快取的破口。
- PWA 快取邊界：列舉所有 Cache Storage 名稱與項目，證明只有 `toolsliang-` 前綴的版本化應用資產、沒有查詢字串，也不含任何工具內容 canary。

離線測試會刻意中斷連線，瀏覽器因此回報無法送出的請求。只有這類網路不可用訊息在明確標記的離線測試中被容許，應用層錯誤仍然是失敗。

新增流程或檔案型工具時，測試必須把每條流程實際使用的輸入、fixture 檔名、具辨識度的內容片段與輸出片段加入 canary 清單。不得改用真實使用者檔案，也不得把工具內容加入錯誤訊息、報告或 trace 標題。

E2E 每次自行啟動並關閉 production preview，不重用既有伺服器，避免 fresh build 後誤接到持有舊 manifest 的程序。

## CI

Pull Request 與 `develop` 更新會執行 `.github/workflows/quality.yml`。流程只進行 lint、strict typecheck、單元測試、production build 與三瀏覽器測試，不部署任何環境，也不連接分析或外部處理服務。

### 執行策略

閘門拆成四個平行 job：`lint、型別與單元測試` 一個，`e2e：chromium`、`e2e：firefox`、`e2e：webkit` 各一。三個瀏覽器各自安裝、各自建置、各自啟動 preview，並各自以 `workers: 1` 依序跑完自己的 project。wall-clock 因此是最慢的那一個瀏覽器，不再是三者相加；每新增一個工具，成長的是單一瀏覽器的那一段，不是它的三倍。

`workers: 1` 與 CI 的 `retries` 都維持原樣。效能預算（12 MP 處理時間、主執行緒長工作、單次更新 16ms）量的是一台機器上依序執行時的表現，提高 worker 數會讓這些數字變成在量 runner 還剩多少 CPU。拆成不同 job 之後每個瀏覽器仍獨佔一台 runner，量測條件與拆分前相同。

覆蓋範圍沒有任何增減：同一組 spec、同樣三個瀏覽器、同樣的 skip 條件，只是換一種排程方式。

失敗仍可定位到單一 spec 與瀏覽器：每個 job 的 log 只有一個瀏覽器，不會交錯；`fail-fast` 關閉，一個瀏覽器失敗時其餘兩個仍會跑完，才分得出這是共通的問題還是引擎差異。失敗診斷（截圖、trace、HTML report）依瀏覽器分開上傳為 `playwright-failure-<瀏覽器>-<run id>`。

代價是同一份依賴與 build 會做三次，帳單上的 job 分鐘數約從 31 分鐘增為 35 分鐘，換到 wall-clock 從約 31 分鐘降為約 11 分鐘。另一種作法是先 build 一次再把 `.output` 當 artifact 傳給三個 job，但上傳與下載的時間與省下的 build 時間相當，還會把三個 job 串在一個前置 job 之後，反而拉長 wall-clock，因此不採用。

`timeout-minutes` 依下方的觀測值設定，理由寫在 workflow 的註解裡：靜態檢查 10 分鐘、每個瀏覽器 22 分鐘。

### 時間分布

以下為 2026-09-10 `develop` 上 run 34443059971 的觀測值——拆分前的最後一次完整執行，job 全長 30m43s，其中 e2e 佔 26m32s：

| 步驟 | 時間 |
| --- | --- |
| npm ci | 15.7s |
| lint | 9.5s |
| strict typecheck | 10.0s |
| 單元測試 | 93.1s |
| 安裝三個瀏覽器（apt 依賴 36s＋三份下載 25s） | 61.4s |
| production build | 41.3s |
| e2e 測試本身（453 題執行、42 skipped） | 1525s |

e2e 的 1525 秒依瀏覽器分為 chromium 474s（165 題）、firefox 536s（144 題）、webkit 514s（144 題）。三者相近，是依 project 平行化幾乎剛好把時間除以三的原因；chromium 題數較多是因為 Service Worker 生命週期、離線重啟與長工作量測只在該瀏覽器執行。

依 spec 的分布（秒）：

| spec | chromium | firefox | webkit | 合計 | 題數 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `image-background-remover` | 46.0 | 131.7 | 56.6 | 234.3 | 25 |
| `product-image-workbench` | 67.5 | 57.0 | 52.3 | 176.8 | 29 |
| `compliant-product-image` | 75.6 | 49.2 | 46.6 | 171.4 | 37 |
| `image-compressor` | 39.6 | 35.8 | 49.9 | 125.3 | 34 |
| `custom-calendar` | 40.4 | 28.2 | 37.7 | 106.3 | 31 |
| `brand-promo-image` | 27.9 | 29.4 | 34.4 | 91.7 | 25 |
| `app-shell` | 23.4 | 26.3 | 37.1 | 86.8 | 27 |
| `random-picker` | 19.3 | 22.8 | 25.5 | 67.6 | 27 |
| `quality-gates` | 17.8 | 22.9 | 26.3 | 67.0 | 36 |
| `taiwan-calendar` | 18.2 | 19.2 | 25.0 | 62.4 | 21 |
| `device-time` | 17.2 | 20.0 | 23.5 | 60.7 | 28 |
| `bmi-calculator` | 15.2 | 20.1 | 22.0 | 57.3 | 30 |
| `local-assets` | 14.6 | 16.4 | 18.4 | 49.4 | 22 |
| `saved-tools` | 13.8 | 17.4 | 17.9 | 49.1 | 19 |
| `landing` | 11.6 | 15.8 | 19.3 | 46.7 | 30 |
| `pwa` | 17.1 | 7.7 | 8.4 | 33.2 | 17 |
| `ntd-uppercase` | 7.5 | 9.2 | 11.0 | 27.7 | 15 |

五個影像類 spec（去背、工作台、合規主圖、壓縮、宣傳圖）合計 799.5s，佔 53%，與它們實際處理像素的工作量相稱。唯一與其他瀏覽器不成比例的是 Firefox 的人像去背：131.7s，是 Chromium 的 2.9 倍，其中最慢的五題各佔 24.1 至 26.5 秒，全部是實際執行推論的流程。下一次還需要壓縮時間時，這裡是唯一有明顯落差、值得先看的地方；其餘 spec 的三瀏覽器差距都在合理範圍內，減下去就是減覆蓋範圍。

拆分後的第一次執行（run 34459243506）：整體 wall-clock 11m02s，其中 `lint、型別與單元測試` 2m30s、`e2e：chromium` 9m31s、`e2e：webkit` 10m52s、`e2e：firefox` 10m58s。最慢的一個離 22 分鐘的上限有兩倍餘裕，靜態檢查離 10 分鐘有四倍。

重新量測：`gh run view <run id> --log` 保留 list reporter 的每題耗時，格式為 `✓ 12 [chromium] › tests/e2e/x.spec.ts:3:1 › 標題 (1.2s)`，依 project 與 spec 加總即可重建同一張表。拆分後每個瀏覽器的 job 時間，以及建置與測試各自的步驟時間，都直接出現在 Actions 頁面上。

## 人工驗證邊界

裝置時間專屬驗證位於 `tests/device-time.test.ts`、`tests/device-time-page.test.ts` 與 `tests/e2e/device-time.spec.ts`。以注入時間驗證跨年、閏日、DST、非整點 UTC offset 與 Intl 降級；透過雙語公開工具頁驗證秒／分鐘邊界更新、背景暫停、前景校正、剪貼簿拒絕與重試、可聚焦的等待狀態、SSR FAQ 與 metadata、無工具讀值傳輸或保存。三瀏覽器另檢查 320／375／768／1024／1440px、文字間距覆寫、200% CSS zoom、light／dark 的 axe 與單次更新 16ms 預算；離線重啟與快取無讀值的 Service Worker 驗證僅在 Chromium 執行。

axe 與 headless 瀏覽器不能取代螢幕閱讀器、完整鍵盤、200% zoom、文字間距與實機觸控檢查；release candidate 仍須完成規格中的人工 checklist。本機效能 smoke budget 也不等於正式環境的 p75 Web Vitals。

圖片壓縮專屬驗證位於 `tests/image-compressor-engine.test.ts`、`tests/image-compressor-workspace.test.ts`、`tests/image-compressor-privacy.test.ts` 與 `tests/e2e/image-compressor.spec.ts`。驗證解碼前 HEIC／HEIF 排除、可用編碼格式、PNG 透明像素、JPEG EXIF 方向與中繼資料清理、WebP 轉換、品質極值、容器大小與工作記憶體限制、逐階段取消、能力及編碼錯誤後重試、Blob URL 與 Worker 釋放。三瀏覽器覆蓋雙語頁、320–1440px、200% zoom、文字間距、light/dark axe、鍵盤及 12 MP 桌面／手機版面效能量測；手機版面量測仍使用本機桌面硬體，不代替參考手機實測。Chromium 另停用 HTTP 快取並延後 Service Worker，確認公開 Worker 程式由 PWA 快取、離線重啟可重新處理，且圖片與檔名不在快取／偏好儲存中。合成素材與限制記錄於 `docs/research/006-image-compressor-engine.md`。主執行緒回應預算依引擎分開：Chromium 與 WebKit 維持 250ms，Firefox 為 600ms。原因不在這個工具——Firefox 在 Worker 解碼大圖時，會在內容行程的主執行緒上做與圖片大小成正比的工作。以 12 MP JPEG 對同一條流程量測：工具自己的主執行緒呼叫合計約 3ms（`blob.slice` 0ms、4 KiB `arrayBuffer` 1ms、取得 Worker 程式 1ms，`new Worker`、`postMessage` 與 `createObjectURL` 各 0ms），但約 120ms 內沒有任何 task 能執行。該停滯是真的主執行緒被餓死而非計時器節流（`MessageChannel` 與 `requestAnimationFrame` 與 `setInterval` 同時停滯），與圖片大小成正比（80 × 40 的來源完全沒有停滯），在 Chromium 與 WebKit 不出現，且在更早的建置上量到相同數值。CPU 受限的 runner 上同一段會放大到約 300ms，因此在 Firefox 用 250ms 判定等於在量 runner 還剩多少 CPU；放寬後的界線仍足以在處理搬回主執行緒時失敗。

合規主圖專屬驗證位於 `tests/compliant-product-image-render.test.ts`、`-content.test.ts`、`-engine.test.ts`、`-workspace.test.ts`、`-privacy.test.ts` 與 `tests/e2e/compliant-product-image.spec.ts`，並與 T20 既有的 `-reference.test.ts`、`-preset.test.ts` 一起構成這個工具的契約。單元測試驗證 preset 只以「規範」收斂輸出範圍、建議永遠不會擋下輸出、尚未生效的規則不列入判定、通路未公開的欄位不借用其他通路數值、免責與提示逐字沿用決策紀錄 §7.1 與 §5.6，以及 §7.3 的禁止用語不出現在任何可見文案、SEO metadata 與結構化資料中。工作區測試以假時鐘跨過查核效期，確認停用的 preset 不能產生輸出也不進行判定。容量落在通路範圍內由 Worker 的品質搜尋達成；達不到下限時如實回報未通過，不以無中生有的細節填補。合成素材全部由程式繪製，不使用真實商品照。

人像去背專屬驗證位於 `tests/image-background-remover-model.test.ts`、`-content.test.ts`、`-engine.test.ts`、`-workspace.test.ts`、`-privacy.test.ts`、`tests/offline-asset-download.test.ts` 與 `tests/e2e/image-background-remover.spec.ts`。單元測試驗證選定方案與紀錄一致、提交的資產指紋相符、下載在寫入快取前比對 SHA-256 且不符時回報驗證失敗、同一份資產的多個使用者共用一次下載、解碼與載入模型前的 HEIC／HEIF 拒絕、規格 §12.8 的各階段進度、失敗代碼可恢復，以及取消後不交付部分結果。三瀏覽器驗證首次下載、本機推論、透明輸出的實際像素（角落透明、人物不透明）、取消後重試、雙語文案、375px 觸控目標與 axe WCAG 2.2 AA；離線重新啟動後從快取重跑、以及列舉 Cache Storage 證明只有公開資產進入快取，只在 Chromium 執行，理由與 Service Worker 生命週期相同。模型與 runtime 隨版本控制提交，CI 不下載任何權重。合成素材、已知限制與未驗證項目記錄於 `docs/research/008-portrait-background-removal-implementation.md`。

品牌宣傳圖專屬驗證位於 `tests/brand-promo-*.test.ts` 與 `tests/e2e/brand-promo-image.spec.ts`。場景只序列化資產識別碼與正規化變換，驗證排序、位置、縮放、顯示與復原分支。瀏覽器使用程式繪製的紅／藍素材，讀回 PNG 的尺寸及像素，驗證圖層順序、鍵盤復原／重做、明確保存後重新載入重用框版與 Logo、容量不足、損毀圖片、HEIC、大圖、取消及編碼失敗復原；每個流程套用共用工具內容網路邊界。雙語頁驗證 canonical／hreflang、320–1440px reflow 及亮暗模式 axe。12 MP 輸出測試的 10 秒門檻為本機桌面 smoke budget，不代表實機手機效能或色彩準確度。

商品圖工作台專屬驗證位於 `tests/product-image-workbench-session.test.ts`、`-queue.test.ts`、`-pipeline.test.ts`、`-archive.test.ts`、`-engine.test.ts`、`-content.test.ts`、`-workspace.test.ts`、`-privacy.test.ts`、`tests/unload-guard.test.ts` 與 `tests/e2e/product-image-workbench.spec.ts`。工作台只新增一個引擎——把完成的輸出打包成封存檔——其餘步驟組合人像去背、合規主圖、品牌宣傳圖與圖片壓縮四個既有引擎，因此像素層級的正確性仍由那四個工具自己的 spec 負責。這裡驗證的是組合本身：工作階段狀態機保證重新執行某一步會作廢它之後的成果、失敗與取消只落在該項目的該步驟、不適用與能力不足的步驟不阻擋後續步驟，且工作階段與佇列文件只有批次的形狀，不含檔名、Blob 或像素；作業佇列驗證上限在收件時就說明、被裝置能力下修的數字就是使用者看到的數字、同時進行的數量不超過通道上限、彙總狀態不會把失敗藏在成功後面；封存驗證由測試自己讀回中央目錄，判斷的是檔案而不是寫入程式，並確認不寫入裝置時鐘；封存引擎沿用其他引擎的契約測試寫法，驗證空批次、超出單一封存檔容量、無法建立 Worker 與釋放後不可重啟這四種情形都在讀取任何位元組之前就有結論；場景組裝驗證版型結果在品牌步驟不被二次縮放，且合規分支不會帶著通路容量規則跑到宣傳輸出上。取消需要一個還在進行中的步驟。延遲引擎自己的 Worker 程式回應無法製造這個狀態——Service Worker 與瀏覽器快取都會直接回應那次請求，攔截不到——因此改以真正繁重的工作製造：5.8 MP 來源寫入工具允許的最大畫布，並以 `dispatchEvent` 送出取消，不等按鈕在重排中靜止。封存的主執行緒量測以「沒有超過 500 ms 的長工作」為界，遠寬於 §12.11 的 50 ms 預算：在頁面上讀取並校驗整批輸出會產生以秒計的長工作，寬鬆的界線足以分辨兩者，也不會在共用的 CI 機器上變成偽陽性。合成素材全部由程式繪製，不使用真實商品照或人像照；除了取消那一題刻意用大圖製造可取消的時間窗，其餘一律共用同一張較小的素材，因為單一 worker 依序跑完一個瀏覽器所花的時間，就是那個瀏覽器 job 的長度，也是整條品質閘門 wall-clock 的下限。

PDF 手寫簽名專屬驗證位於 `tests/pdf-signature-placement.test.ts`、`-signature.test.ts`、`-engine.test.ts`、`-workspace.test.ts`、`-content.test.ts`、`-privacy.test.ts`、`-output.test.ts` 與 `tests/e2e/pdf-signature.spec.ts`，並與 T24 既有的 `-reference.test.ts` 一起構成這個工具的契約。單元測試驗證座標換算與放置狀態機（含四分之一轉頁面、偏移頁框、貼齊邊緣與復原）、三種簽名形式的點陣化規則、工作階段的能力宣告與取消交還、十三個失敗代碼的雙語文案，以及執行期模組不含第三方位址也不碰本機儲存。簽名的實際點陣化不在單元測試進行：這個環境沒有 canvas，`getContext('2d')` 回 null，因此手寫、輸入文字與匯入圖片的產出由瀏覽器 spec 負責。像素層級的輸出保真由維運者執行的 `scripts/verify-pdf-signature-output.mjs` 量測後寫入 JSON，CI 只讀它；讀回用的 pdf.js 與工具內部是同一個程式庫，能證明幾何與透明度符合預期，不能證明其他閱讀器的顯示結果。合成文件全部由 `scripts/pdf-engine/fixtures.mjs` 產生，不使用任何真實 PDF。已知限制與刻意縮小的範圍（未打包標準字型、沒有縮圖列、表單欄位與 XFA 不在範圍）記錄於 `docs/research/010-pdf-signature-implementation.md`。
