# 人像去背工具的實作決策

Issue：#21（T19）。前置：#20（T18）的評估紀錄 [`007-image-background-removal-model-evaluation.md`](./007-image-background-removal-model-evaluation.md)。

007 的結論是 **no-go**：沒有任何授權可自行散布、能在瀏覽器執行、又落在傳輸預算內的**一般用途**去背模型。它同時列出三條可走的路，並要求產品負責人先做決定。這份紀錄記下實際採用的路、它對規格 §12.8 的影響，以及實作期間發現而必須一併修正的平台問題。

## 1. 採用的路

採用 007 §1 的第一條路：**只做人像去背**，以 `modnet-fp16` 交付。

- 授權：Apache-2.0，發布者、上游權重頁與上游程式庫三方一致，可由 toolsliang 自有網域再散布。
- 適用範圍：`portrait`。工具名稱、描述、SEO 文案與頁面第一段都寫明只處理人像，不宣稱能處理商品圖。
- 沒有採用第二條路（釐清 ISNet 授權並申請約 81 MiB 的傳輸例外）與第三條路（自行匯出 BiRefNet）。兩者都需要新的授權或匯出工作，不在這個 issue 的範圍內。

工具的穩定 slug 仍是規格 §12.8 指定的 `image-background-remover`；改變的是它宣告的能力，不是它的網址。中文名稱採用「人像去背」而不是「圖片去背」，因為名稱本身就是這個工具最重要的限制。

## 2. 版本一交付的範圍

| 項目 | 決定 | 依據 |
| --- | --- | --- |
| 權重 | `modnet-fp16`（12,984,781 bytes） | 007 §5.1、§8 |
| 執行提供者 | 只有 WebAssembly 基準線 | 規格 §12.8 把 WebGPU 列為選用強化；007 §5.5 證實 WASM 在三個瀏覽器都可執行 |
| 輸入 | 單張 JPEG／PNG／WebP，25 MiB、2,400 萬像素、單邊 8,192 像素 | 與圖片壓縮共用同一組上限，HEIC／HEIF 由 §12.14 的共用驗證器拒絕 |
| 輸出 | 透明 PNG，檔名固定為 `background-removed.png` | 不沿用原始檔名，避免輸出檔名帶著使用者的檔名 |
| 遮罩修整 | 不提供 | 規格 §12.8 寫「optional local mask refinement」，版本一不做，因此也不需要它的鍵盤替代操作 |

**WebGPU 不在版本一。** 007 §6 的能力階梯有兩層 WebGPU，量測也顯示 `modnet-fp16` 在 WebGPU 上快得多（12 MP 端到端 159 ms 對 WASM 的 332 ms）。不採用的理由是它需要另一份 27,797,172 bytes 的 `jsep` runtime，還要驗證第二條結果契約，而 WASM 基準線在最慢的瀏覽器上仍然落在規格的 30 秒桌機預算內（見 §7 的量測；Firefox 的餘裕最小）。這是刻意縮小的範圍，不是遺漏；要加上 WebGPU 時，能力階梯與失敗代碼都已經在 `domain/reference.ts` 定義好。

**跨來源隔離也不在版本一。** 沒有 COOP／COEP 就沒有 `SharedArrayBuffer`，onnxruntime-web 因此以單執行緒執行。加上這兩個標頭會影響整個網站的跨來源資源政策，屬於部署層決定，不由一個工具發動。

## 3. 資產與供應鏈

三個檔案由本站自有路徑提供，全部隨版本控制提交，執行期不連任何第三方（ADR-0001、規格 §12.8）：

| 資產 | 路徑 | bytes | SHA-256 |
| --- | --- | --- | --- |
| 人像去背模型 | `/assets/offline/image-background-remover/modnet-fp16-1/portrait-matting.onnx` | 12,984,781 | `25f165da9bfd30830a575f1f0490f1acd995975cb349bc02f3d79332e1fe5cf6` |
| 推論 runtime | `/assets/offline/onnxruntime-web/1.29.0/ort-wasm-simd-threaded.wasm` | 13,961,845 | `ec8580a9d7b9476ceee52e10a7f94124e4dc71a019d666ed6d4726697c109a4d` |
| 推論 runtime 載入器 | `/assets/offline/onnxruntime-web/1.29.0/ort.wasm.bundle.min.mjs` | 72,894 | `7a3913dc5c7a9c3ad1144f5fbfecd402bc5013bcc886bc67664b18d8a15ab298` |

模型的 bytes 與 SHA-256 不在這份紀錄裡另立一份真相：`domain/model.ts` 從 007 的候選清單讀出來，`tests/image-background-remover-model.test.ts` 再把 `public/` 裡真正提交的檔案雜湊一次比對。runtime 的兩個檔案來自 `onnxruntime-web@1.29.0` 的 npm 套件，指紋與 007 §3 釘選的 CDN 檔案逐位元相同。

下載改由 `useOfflineAsset` 在寫入快取**之前**比對 SHA-256，不符就丟棄並回報 `model_digest_mismatch`。因此 `ToolOfflineAsset` 新增必填的 `sha256` 欄位，註冊表也會擋下沒有指紋的資產。

## 4. 取消與資源釋放

依 007 §9 的取消標準實作：

- 下載階段以 `AbortController` 取消，已收到的位元組全部丟棄，不留半個檔案。
- 推論階段以終止 Worker 取消。`session.run()` 進入算子後無法中斷，終止 Worker 是唯一能把 WebAssembly 線性記憶體還給裝置的方法。
- 每一次執行都開一個新的 Worker，因此取消之後不會有殘留的 session；晚到的訊息被忽略，不交付部分結果。
- 已通過指紋驗證的模型不因取消而失效。

共用的 `createWorkerEngine` 因此新增可調的 `timeoutMs`：去背要先建立 session 再合成大圖，圖片壓縮的 60 秒上限對它太短，這個工具用 120 秒。

## 5. 實作期間發現並修正的平台問題

這三項都不是這個工具自己的問題，而是它第一個踩到的既有缺口。

1. **Blob Worker 沒有可解析的基底位址。** 每個 Worker 都由 Blob URL 建立，`caches.match('/assets/…')` 會因為 blob: 沒有路徑基底而丟出 `Failed to parse URL`。改成先由 Blob URL 的來源組出絕對位址再查快取。
2. **相依套件會讓 Worker 的檔名在兩次建置之間不一致。** client 與 server 各自打包一次 Worker；只由應用程式碼組成的 Worker 兩邊產出相同位元組與相同雜湊檔名，一旦打包進 node_modules 的相依套件就不同了。SSR 頁面算出來的預載網址因此指向不存在的檔案，離線時 Worker 也就進不了快取。修法是把推論 runtime 改成自有的版本化資產、由 Worker 動態載入，Worker 本身只留應用程式碼。`tests/e2e/quality-gates.spec.ts` 另外加了一個守門：每個工具頁宣告的預載資產都必須回 200。
3. **需要先下載的工具，頁面本身沒有被預先快取。** App Shell 只預先快取 `offlineMode === 'ready'` 的工具頁，所以即使模型已經在裝置上，離線重新啟動也只會看到離線說明頁。改成預先快取每一個已發布的工具頁；模型與 runtime 仍在自己的快取裡，兩者互不影響。同時修正離線時「下載」按鈕會卡在停用狀態的問題：停用的條件現在是「當下離線」，不是「上一次嘗試時離線」。

## 6. 已知限制（必須寫進工具的可見文案）

- 只處理人像。商品、動物與風景不在訓練範圍，結果通常不可用。工具會在遮罩保留比例過低或過高時額外提醒。
- 半透明區域（玻璃、薄紗、煙霧）的 alpha 不準確。007 §12 量到所有候選的 soft alpha MAE 都落在 0.38–0.60，這是整個候選集合共同的弱點。
- 髮絲與低對比邊緣不保證準確：`modnet-fp16` 的細髮 IoU 0.6955、低對比 IoU 0.6991。
- 同一張圖在不同瀏覽器的邊緣品質不同：人像 IoU 在 Chromium 是 0.9965，在 WebKit 是 0.9487。
- 007 的品質數字全部來自程式繪製的合成素材，不是照片上的準確度。發布前仍需要以真實照片人工檢查。

## 7. 驗證

- 單元測試：`tests/image-background-remover-model.test.ts`（選定方案、資產指紋、預算）、`-content.test.ts`（雙語文案、失敗模式、範圍揭露）、`-engine.test.ts`（HEIC 與格式拒絕、階段、錯誤代碼、取消）、`-workspace.test.ts`（能力不足、未下載、結果與取消）、`-privacy.test.ts`（工具內容邊界、模組不含第三方位址）、`tests/offline-asset-download.test.ts`（指紋驗證、共用下載、取消）。
- 瀏覽器測試：`tests/e2e/image-background-remover.spec.ts` 在 Chromium、Firefox、WebKit 各跑一次完整流程、離線、取消、鍵盤與 375px 響應式、axe WCAG 2.2 AA，並確認輸出的角落透明、人物不透明。離線重新啟動與快取列舉只在 Chromium 執行，理由與其他工具相同。
- 效能：已快取的 12 MP 去背在本機桌機量到 Chromium 2,395 ms、WebKit 1,948 ms、Firefox 22,973 ms，進度都在 250 ms 內出現。三者都在規格 §12.8 的 30 秒桌機預算內，但 **Firefox 幾乎沒有餘裕**：它沒有 WebGPU，又因為沒有跨來源隔離而只能單執行緒執行 WebAssembly。這是之後最需要盯的一項；要拉開餘裕就得加上 COOP／COEP 或 WebGPU，兩者都不在版本一。
- 未驗證：實機手機的 60 秒預算、真實照片的邊緣品質、WebGPU 路徑。

## 8. 一手來源

查閱日期：2026-09-08。

- [MODNet LICENSE](https://github.com/ZHKKKe/MODNet/blob/master/LICENSE)：權重的 Apache-2.0 授權。
- [ONNX Runtime Web 執行提供者](https://onnxruntime.ai/docs/execution-providers/)：WASM 與 WebGPU 兩條路徑的支援範圍。
- [W3C WebAssembly Core 2.0](https://www.w3.org/TR/wasm-core-2/)：線性記憶體只會成長、不會縮小。
- [PNG 圖片格式](https://www.w3.org/TR/png-3/)：透明輸出的容器。
