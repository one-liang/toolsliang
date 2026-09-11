# PDF 手寫簽名工具的實作決策

Issue：#27（T25）。前置：#26（T24）的評估紀錄 [`009-pdf-local-editing-engine-and-safety-boundary.md`](./009-pdf-local-editing-engine-and-safety-boundary.md)，以及 #17（本機資產層）與 #19（第一個 Tool Engine）。

009 的結論是 **go**：`pdfjs-dist` 負責解析、判斷保護狀態與算圖，`@cantoo/pdf-lib` 負責寫入，匯出方式依文件是否加密而不同，而且每一份輸出都要被讀回才算成功。這份紀錄記下把那個結論變成可用工具時所做的決定、實作期間發現的事，以及必須寫進可見文案的限制。

## 1. 版本一交付的範圍

| 項目 | 決定 | 依據 |
| --- | --- | --- |
| 穩定 slug | `pdf-signature`，分類 `document` | 規格 §12.12、ADR-0011 |
| 引擎位置 | 兩個引擎都打包在工具自己的 Worker chunk 裡 | 009 §9.3：主執行緒不解析也不算圖 |
| 頁面預覽 | Worker 以 1.5 倍算圖後輸出 PNG，主執行緒只拿到一個 Blob | 預覽是放置簽名的參考，不需要像素回讀 |
| 頁面導覽 | 頁次選單加上一頁／下一頁，沒有縮圖列 | 見 §5 的取捨 |
| 簽名形式 | 手寫、輸入文字、匯入透明圖片；三者都轉成帶 alpha 的 PNG | 009 §6.5 |
| 簽名字型 | 以裝置既有字型畫成圖片，不在 PDF 內嵌字型 | 009 §6.5：避開字型授權與字形排版 |
| 保存的簽名 | 既有本機資產層的 `signature` 類別，明確保存、可重複使用、可刪除 | ADR-0007、規格 §12.12 |
| 匯出方式 | 未加密用增量更新，加密用完整重寫，下載前一律讀回 | 009 §7.1、§9.1 |
| 輸出檔名 | 固定 `signed.pdf` | 不沿用原始檔名，輸出檔名不帶使用者的檔名 |
| 上限 | 100 頁、50 MiB、工作集估算超過 384 MiB 即停止 | 009 §9.2、與其他本機工具共用的預算 |

## 2. 兩個引擎怎麼進到瀏覽器

`pdfjs-dist@6.3.289`（Apache-2.0）與 `@cantoo/pdf-lib@2.9.2`（MIT）都以 npm 相依套件的形式打包進 `pdf-signature.worker.ts` 的 chunk，不另外提交任何第三方檔案到版本控制。

**pdf.js 在 Worker 裡不再開第二個 Worker。** `pdf.worker.mjs` 被直接 import 進同一個 Worker：它會設定 `globalThis.pdfjsWorker`，pdf.js 因此改用 in-process 的 port 溝通，不需要巢狀 Worker，也不必從 Blob URL 解析第二個腳本位址。代價是那份 bundle 會在同一個 scope 上另外掛一個訊息監聽器；兩邊互不干擾（pdf.js 只回應帶 `targetName` 的訊息，工具只回應帶 request id 的訊息），唯一可見的痕跡是啟動時往頁面送出的一則 `ready` 訊息，工作階段會忽略它。

**這個 Worker 不在 `getToolWorkspaceAssets()` 裡宣告。** client 與 server 各自打包一次 Worker，含相依套件的 Worker 兩邊產不出相同的雜湊檔名，SSR 算出的預載網址會指向不存在的檔案（實測：HTML 宣告 `pdf-signature.worker-B4i-I6FW.js`，實際產出 `pdf-signature.worker-BmGDMP37.js`）。因此改為工作區第一次啟動時才取得，之後由 Service Worker 當成一般建置資產快取。`offlineMode` 仍是 `ready`：這個工具不需要下載引擎或模型，離線承諾與離線說明頁寫的一致——開過的工具離線仍可使用。

**不提交 pdf.js 的 `standard_fonts/`。** 那個目錄裡的 Liberation 字型是 GPLv2 with font exception，屬於 009 §2 排除 `mupdf` 的同一類 copyleft 授權，不在本專案可自行散布的清單（MIT、Apache-2.0、BSD-3-Clause）內。沒有它的後果寫在 §5。

## 3. 為什麼是「工作階段」而不是一次性的 Tool Engine

其他工具的引擎跑完一份輸入就把 Worker 丟掉，因為一張圖進去就是一張圖出來。簽名不是這個形狀：開檔、看頁面、放置、再看、匯出是一段對話，每一步都重新解析一份 50 MiB 的文件既慢也不誠實——那樣工具實際佔用的記憶體會被藏起來。

因此 `createPdfSignatureSession()` 保留一個 Worker，以 request id 對應每一次往返，同時保留 Tool Engine 契約中重要的部分：選檔前先回答能力、逐階段進度、真正停得下來的取消、結構化失敗，以及離開時不留東西。

**取消就是終止 Worker。** 引擎的 `save()` 與 `render()` 一旦開始就無法中斷，終止也是唯一能立刻把文件記憶體還給裝置的方法。放置好的簽名只是頁面上的數字，所以取消後工具會自動以同一份檔案與密碼重新開啟，畫面回到原本那一頁，而狀態列仍然說「已取消」——使用者看到的是自己做的事，不是工具的補救動作。

## 4. 實作期間發現的事

- `PDFDocumentProxy.getPermissions()` 在 pdf.js 6 回傳 `Set<number>`，不是陣列。用陣列方法讀它會丟出 `TypeError`，而那個例外會被歸類成 `damaged_pdf`——三份加密測試檔一度全部被說成「檔案損壞」。修正後 `owner-password-restricted` 正確停在 `modification_not_permitted`。
- pdf.js 的預設 canvas factory 會呼叫 `document.createElement`，Worker 裡沒有 `document`。改以 `OffscreenCanvas` 實作同樣的 `create`／`reset`／`destroy` 介面傳入 `getDocument()`。
- 不指定 `useWorkerFetch: false` 時，pdf.js 會去讀 `document.baseURI` 來決定要不要自行抓取資源；Worker 裡同樣沒有 `document`。
- `page.render()` 的型別要求 DOM 的 canvas 與 context，實際執行時接受 offscreen 的那一對；程式以一次明確的轉型處理，並在註解寫明原因。
- `verbosity` 設為只記錄錯誤。沒有打包標準字型時，每一個非內嵌字型都會產生一則警告，那是在把文件的內容狀況寫進主控台。
- 簽名板上 `setPointerCapture()` 對某些指標會丟出 `InvalidPointerId`。捕捉只是「指標移出畫布時筆畫仍繼續」的便利，因此改成可失敗的動作，筆畫本身不受影響。
- 筆畫是推進既有陣列的，放在 `shallowRef` 裡 Vue 看不到變動，「使用這個簽名」因此一直是停用的。改成另外記錄「板上已經有筆跡」這一個事實。

## 5. 已知限制

1. **沒有打包標準字型。** PDF 使用 Helvetica、Times 這類標準字型而未內嵌時，預覽由 pdf.js 自己的替代字形畫出，字形與間距可能與原本的字型略有差異。實測三個瀏覽器：有沒有提供字型資料，畫出來的深色像素數完全相同（8,356／8,473），也就是文字仍然畫得出來，只是字形是替代的。**這只影響預覽**：未加密文件以增量更新寫出，頁面的內容串流與字型資源原封不動；加密文件的完整重寫也不重畫頁面內容。
2. **沒有縮圖列。** 規格 §12.12 的無障礙段提到「頁面縮圖標示頁碼」，但 100 頁的縮圖列等於 100 次算圖，而且那些像素在放置簽名時沒有人會看。改以標了頁碼的頁次選單加上一頁／下一頁提供同樣的資訊與到達方式，鍵盤與螢幕閱讀器都能操作。這是刻意縮小的範圍，不是遺漏。
3. **表單欄位與 XFA 不在範圍。** 簽名是疊在頁面上的圖片，不填寫既有的表單欄位；XFA 表單依 009 §7.3 的解析器政策不算圖。
4. **已有憑證式簽章的檔案不在範圍。** 在這類文件上追加內容會使原本的簽章失效，工具不做這件事，也不宣稱能做。
5. **無法歸類的解析失敗會被說成 `damaged_pdf`。** 失敗詞彙由 009 §7 固定為十三個代碼，沒有「未知錯誤」這一項。實作因此把無法辨識的例外歸到最接近的那一個，代價是使用者可能被指向檔案而不是工具。讀回檢查會擋下由此產生的壞輸出。
6. **第一次使用需要連線。** 引擎隨工具的 Worker chunk 提供，第一次開啟工具頁時取得，之後離線可用。離線且尚未取得時，工具說的是「本機 PDF 引擎還沒有存到這台裝置上」，不是「瀏覽器不支援」。

## 6. 驗證

| 驗證 | 位置 | 內容 |
| --- | --- | --- |
| 座標與放置狀態機 | `tests/pdf-signature-placement.test.ts` | 預設位置、四分之一轉頁面、偏移頁框、貼齊邊緣、數值定位、縮放保比例、刪除與復原、匯出請求只帶頁碼與正規化矩形 |
| 簽名三種形式 | `tests/pdf-signature-signature.test.ts` | 空白筆跡判定、裁切到筆跡、點陣化尺寸與單邊上限、字級縮放、透明格式把關 |
| 工作階段 | `tests/pdf-signature-engine.test.ts` | 能力與密碼能力、開檔前的三道把關、一個 Worker 服務整段作業、取消交還工作、Worker 消失、釋放後不再回應 |
| 介面 | `tests/pdf-signature-workspace.test.ts` | 兩句必要說明在任何放置之前、能力不足與離線的差異、密碼流程與不寫入本機儲存、取消後的說法、卸載時的釋放 |
| 文案 | `tests/pdf-signature-content.test.ts` | 十三個失敗代碼都有雙語說明且都說明原檔未變更、五個階段、禁止用語不出現在任何可見文案 |
| 邊界 | `tests/pdf-signature-privacy.test.ts` | 執行期模組不含第三方位址、解析器七個開關、不碰本機儲存與快取、不記錄密碼與檔名 |
| 輸出像素 | `tests/pdf-signature-output.test.ts` ＋ `scripts/verify-pdf-signature-output.mjs` | 見下 |
| 實際流程 | `tests/e2e/pdf-signature.spec.ts` | 三瀏覽器走完公開工具頁：多頁與旋轉、純鍵盤定位、密碼、權限與損毀、簽名圖片透明度、保存的簽名、雙語、375px 觸控目標與亮暗 axe、20 頁 20 MiB 的預算 |

`scripts/verify-pdf-signature-output.mjs` 由維運者執行，CI 只讀它寫出的 `docs/research/data/010-pdf-signature-verification.json`。它以專案自己的 esbuild 打包工具實際出貨的 Worker，用 009 的合成文件跑完開檔、預覽與匯出，再以獨立的 pdf.js 把輸出讀回並逐像素比對。2026-09-11 的量測（33 次執行，chromium／firefox／webkit 各 11 份文件）：

- 每一頁簽名都落在矩形內：越界簽名像素 0、矩形外變動像素 0（8 份文件 × 2 頁 × 3 瀏覽器）。
- 透出比例 0.868 至 0.875：簽名的透明度在讀回後仍然存在。
- 頁面寬高與旋轉全部保留；沒有簽名的那一頁變動像素為 0。
- 未加密文件的輸出以原始位元組開頭（增量更新），加密文件則否（完整重寫），且輸出不再帶有原本的保護。
- 代表性 20 頁 20 MiB 文件：首頁預覽最慢 44 毫秒（預算 3,000）、匯出最慢 31 毫秒（預算 15,000）。
- 三個瀏覽器都沒有主控台錯誤、沒有 Worker 崩潰，也沒有任何對外請求。

讀回用的 pdf.js 與工具內部使用的是同一個程式庫，這一點與 009 的矩陣相同：它能證明輸出的幾何與像素符合預期，不能證明其他閱讀器也這樣顯示。

## 7. 一手來源

- ISO 32000-1（PDF 1.7）：<https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf>
- pdf.js 程式庫與 Apache-2.0 授權：<https://github.com/mozilla/pdf.js/blob/master/LICENSE>
- `@cantoo/pdf-lib` 程式庫與 MIT 授權：<https://github.com/cantoo-scribe/pdf-lib/blob/master/LICENSE.md>
- Liberation 字型授權（GPLv2 with font exception）：<https://github.com/mozilla/pdf.js/blob/master/external/standard_fonts/LICENSE_LIBERATION>
