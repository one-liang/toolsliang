# 圖片壓縮與 Tool Engine 決策紀錄

Issue：#19。測試介面經使用者確認為 Tool Engine、工具工作區與公開瀏覽器流程。

## 本機邊界與相容性

- 只接受 JPEG、PNG、WebP。共用圖片驗證器先檢查副檔名、MIME 與最多 4 KiB 的 ISO BMFF 特徵；HEIC／HEIF 在解碼與進度開始前拒絕。改名不會繞過特徵檢查。
- 圖片 Worker 沒有網路、記錄、分析或儲存介面。原檔以 File 的結構化複製交給 Worker，輸出以可轉移的 ArrayBuffer 回傳；主執行緒將其包成 Blob。
- 平台資產 adapter 只取得建置時產生的同源 Worker 程式，再建立 Blob Worker。程式 URL 與圖片 URL 都明確釋放。Worker URL 以 SSR preload 宣告，納入現有 PWA 公開靜態資產快取。
- 不依賴 HTTP 快取保證 Worker 離線可用；專屬測試停用 HTTP 快取並延後 Service Worker 載入後，驗證 PWA 快取與離線重新處理。
- `prepare` 在 Worker 中實測各格式的 `convertToBlob` 回傳 MIME，只在介面提供可用格式。無法編碼時不靜默換格式，也不退回主執行緒處理大圖。

## 處理與資源限制

- 單張最大 25 MiB、2,400 萬像素，單邊最大 8,192 像素。容器尺寸在解碼前讀取；尺寸不完整、損毀或超過限制時不配置圖片像素。
- 估算工作記憶體：原始像素 × 8 + 輸出像素上界 × 8 + 檔案 bytes × 2 + 800 × 800 × 8。超過 384 MiB 預算時請使用者縮小尺寸。這是保守工作集上限，不能保證裝置一定有足夠記憶體。
- 方向採 `createImageBitmap(..., { imageOrientation: 'from-image' })`；以帶 EXIF orientation 6 的雙色合成 JPEG 驗證方向與像素位置。JPEG 輸出再移除 APP1、APP13 與 COM，避免瀏覽器重新產生 EXIF 區段。
- PNG／WebP 保留透明度，JPEG 明確以白色補透明區。品質 0–100 只適用 JPEG／WebP。尺寸保持比例、不放大；PNG 重新編碼不代表像素尺寸不變。
- 原圖預覽最大 800 × 800，由 Worker 產生；不讓主執行緒直接解碼完整原圖。輸出顯示實際尺寸、bytes 與增減比例，不保證變小。
- 同一 Engine 只執行一項工作。`AbortSignal`、`cancel` 與 `dispose` 冪等；取消立即終止 Worker，忽略晚到訊息，不交付部分輸出。讀取、解碼、處理、編碼、準備下載都可取消。
- 能力檢查與工作分別有 10 秒、60 秒逾時；工作失敗保留原檔。更換輸出設定會使舊輸出失效，清除或離頁會撤銷 Blob URL。
- 不保存工作內容；來源圖片仍在工作區時，PWA 更新視為有未完成工作，不能靜默重新整理。

## TDD 紀錄

1. HEIC／HEIF 檔名、MIME、改名特徵測試先因模組不存在失敗，再通過。
2. 偽裝格式與無效設定先得到錯誤的 cancelled 結果，再補上驗證。
3. 能力、進度與 Blob 契約先因缺少 prepare 失敗，再建立 Worker 生命週期。
4. 公開 PNG 流程先因路由 404 失敗，再完成工作區、註冊、縮放與下載。
5. JPEG 與 WebP 流程各先因容器解析缺少而失敗，再完成尺寸解析。
6. 檔案讀取失敗原先誤報瀏覽器不支援，測試指出差異後修正為 read_failed。
7. HEIC 焦點測試失敗後修正恢復欄位與移動焦點的順序。
8. 停用 HTTP 快取的離線測試失敗後，改用可由 PWA 回應的程式資產 fetch 與 Blob Worker。
9. WebKit 產生 EXIF 的差異由真實輸出測試指出，補上輸出中繼資料清理。
10. 記憶體估算測試先得到解碼失敗，再加入解碼前工作集預算。

## 一手規格

查閱日期：2026-09-07。

- [WHATWG Canvas 與編碼](https://html.spec.whatwg.org/multipage/canvas.html)：OffscreenCanvas 與 MIME 能力檢查的依據。
- [WHATWG ImageBitmap](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html)：解碼方向與 ImageBitmap 生命週期。
- [W3C PNG](https://www.w3.org/TR/png-3/)：簽名、IHDR 與尺寸。
- [RFC 9649 WebP](https://www.rfc-editor.org/rfc/rfc9649.html)：RIFF、VP8、VP8L、VP8X 與尺寸欄位。

## 驗證範圍與限制

測試只使用程式合成素材。三瀏覽器執行格式、方向、像素、品質、錯誤、資源釋放、鍵盤、雙語、響應式與無障礙驗證。Service Worker 生命週期僅在 Chromium 驗證，沿用專案品質閘門。12 MP 效能以本機 headless 瀏覽器記錄；不能等同正式產品參考手機或正式環境 p75 Web Vitals。螢幕閱讀器與實機觸控仍屬 release candidate 的人工 checklist。
