# 圖片去背模型與瀏覽器執行可行性

Issue：#20。這份紀錄回答一件事：有沒有一個授權可自行散布、能在支援瀏覽器本機執行、品質與成本可接受的去背方案，可以直接交給 T19（#21）實作。

量測在維運者自己的機器上進行。測試圖片全部由程式繪製，沒有照片、使用者檔案或第三方素材；模型與 runtime 從公開來源下載，圖片像素、遮罩與結果沒有離開這台裝置，也沒有任何雲端去背 API 參與。

## 1. 決策摘要

結論是 **no-go**：以目前可取得的候選，無法交付規格 §12.8 描述的「一般用途本機去背」。

- 授權可自行散布、能在 WebAssembly 基準線完成推論、又落在 ≤ 40 MiB 壓縮傳輸預算內的候選，只有 MODNet 家族，而 MODNet 是人像去背模型。
- `birefnet-lite` 是唯一授權鏈完整的一般用途家族，但它在三個瀏覽器都無法完成任何一次推論。fp32 在 Chromium、Firefox 與 WebKit 的 WASM 基準線都把 WebAssembly 線性記憶體推到 4.27–4.29 GB（最高 4,294,901,760 bytes）後 `std::bad_alloc`；fp16 在 Chromium 與 WebKit 同樣 `std::bad_alloc`，在 Firefox 則是 15 分鐘內沒有任何結果。WebGPU 在 Chromium 與 WebKit 的兩種精度都無法在 15 分鐘內建立 session。它的 ONNX 輸入固定為 1024 × 1024，連降低解析度這條退路都被 runtime 直接拒絕。
- `isnet-general` 品質最好（人像 0.9989、細髮 0.9788、商品 0.9949、低對比 0.9888），在三個瀏覽器都跑得動，但授權自相矛盾，不能由 toolsliang 自行散布。即使授權釐清，最小的可用檔案壓縮後仍有 81,267,904 bytes，是預算的 1.94 倍。
- 量化不是出路：`modnet-uint8` 壓縮後只有 5,163,599 bytes，但商品與低對比案例的 IoU 直接掉到 0，等於整張圖判成背景。

因此 T19（#21）不應該用現有候選實作一般用途去背。可走的路有三條，每一條都需要產品負責人決定，不是實作細節：

1. **只做人像去背**：以 `modnet-fp16` 交付，壓縮後 11,847,512 bytes、WASM 冷啟 249 ms、Apache-2.0 授權明確涵蓋權重。工具名稱、文案與 SEO 都必須說清楚它只處理人像，不能宣稱處理商品圖。
2. **釐清 ISNet 權重授權並申請傳輸預算例外**：需要取得 imgly 或上游作者對權重再散布的明確授權，再核准約 81 MiB 的壓縮傳輸例外。
3. **自行匯出 BiRefNet**：MIT 允許再散布與修改，可自行匯出動態尺寸或 int8 權重後重新量測。這是新的工作項目，不在 T18 範圍內。

推薦 `modnet-fp16` 時要一起記住兩件事：它在唯一適用的人像案例上，WebKit 的 IoU 是 0.9487，比 Chromium 的 0.9965 低約 4.8 個百分點，所以同一張圖在不同瀏覽器的邊緣品質不一致；而它在合成商品案例的 0.9967 只說明那張合成圖對模型很容易，不能當成它能處理真實商品照的證據。

在做出決定前，`modnet-fp16` 是這份紀錄唯一推薦的候選，且其適用範圍限定為人像。

## 2. 候選與授權

規格 §12.8 與 ADR-0001 都要求模型與 WASM 由 toolsliang 自有的 Cloudflare 網域提供，因此「可不可以自行散布」是第一個關卡，不是最後一個。授權欄位逐字來自「授權出處」那一頁；沒有任何一列是從檔名、Hugging Face 標籤或第三方轉述推得。

### 2.1 候選

| 候選 | 家族 | 適用範圍 | 精度 | 授權 | 可自行散布 | 授權出處 |
| --- | --- | --- | --- | --- | --- | --- |
| `birefnet-lite-fp32` | `birefnet-lite` | `general` | `fp32` | MIT | 是 | <https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE> |
| `birefnet-lite-fp16` | `birefnet-lite` | `general` | `fp16` | MIT | 是 | <https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE> |
| `isnet-general-fp32` | `isnet-general` | `general` | `fp32` | MIT | 否 | <https://huggingface.co/imgly/isnet-general-onnx> |
| `isnet-general-fp16` | `isnet-general` | `general` | `fp16` | MIT | 否 | <https://huggingface.co/imgly/isnet-general-onnx> |
| `modnet-fp32` | `modnet` | `portrait` | `fp32` | Apache-2.0 | 是 | <https://github.com/ZHKKKe/MODNet/blob/master/LICENSE> |
| `modnet-fp16` | `modnet` | `portrait` | `fp16` | Apache-2.0 | 是 | <https://github.com/ZHKKKe/MODNet/blob/master/LICENSE> |
| `modnet-uint8` | `modnet` | `portrait` | `uint8` | Apache-2.0 | 是 | <https://github.com/ZHKKKe/MODNet/blob/master/LICENSE> |

`birefnet-lite` 的來源鏈是三份文件互相指認的：ONNX 匯出宣告 `base_model: ZhengPeng7/BiRefNet_lite` 與 `repo_url`，上游權重頁宣告 MIT，上游程式庫的 LICENSE 檔就是 MIT 全文。`modnet` 的上游 README 明確寫下「程式、模型與 demo 以 Apache License 2.0 釋出」，把權重包含在授權範圍內。

「可自行散布」欄位問的不是「有沒有標授權」，而是「發布者、上游權重頁與上游程式庫是不是說同一件事」。只有這一欄是 `是` 的候選，才可能依 ADR-0001 由 toolsliang 自有網域提供。

`isnet-general` 是反例，也是這次評估最重要的供應鏈發現。imgly 的權重頁只有一行 `license: mit`，沒有說明、沒有上游指認、沒有著作權人；同一套 IS-Net 架構在 `onnx-community/ISNet-ONNX` 被標成 AGPL-3.0；上游 DIS 程式庫的 README 只說「我們的程式與評估指標採用 Apache License 2.0」，權重不在句子裡，資料集另有一份使用條款。三個說法互相衝突，因此它可以量測、可以當比較基準，但不能由 toolsliang 自行散布。

### 2.2 排除的候選

| 候選 | 排除原因 | 說明 |
| --- | --- | --- |
| `rmbg-1.4` | `non-commercial-licence` | 模型頁寫明只供非商業使用；頁面標示的授權連結在查閱日已回 404，連條款本身都無法重新讀取。 |
| `rmbg-2.0` | `non-commercial-licence` | 同一家發布者的後續版本，授權型態相同。 |
| `isnet-agpl` | `copyleft-licence` | 同一套權重被標成 AGPL-3.0；即使可散布，授權傳染範圍也超出這個產品願意承擔的範圍。 |
| `ormbg` | `humans-only-scope` | Apache-2.0 沒有問題，但訓練目標只有人物，無法服務商品圖這個主要使用情境。 |

### 2.3 模型檔案指紋

下載一律指向 commit，不指向 `main`，且下載後比對 SHA-256；任何一個位元不同就中止。

| 候選 | 儲存庫 | commit | 檔案 | bytes | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `birefnet-lite-fp32` | `onnx-community/BiRefNet_lite-ONNX` | `de15b22ba131738a16dff04aab8bdf8dc32e3ac1` | `onnx/model.onnx` | 224,005,088 | `5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333` |
| `birefnet-lite-fp16` | `onnx-community/BiRefNet_lite-ONNX` | `de15b22ba131738a16dff04aab8bdf8dc32e3ac1` | `onnx/model_fp16.onnx` | 114,538,221 | `d39b897ceb16ae654c1731f3dba0cf9b368d9cae74b5a57459b455cc8bfec402` |
| `isnet-general-fp32` | `imgly/isnet-general-onnx` | `440dea96dd4a3b06bbbf5abec3e26569dd7ec49f` | `onnx/model.onnx` | 176,149,806 | `cc2c9f5c1751b9737cb81e708ff0c5e9542c2205daed22418a4fd2ab5d4c481a` |
| `isnet-general-fp16` | `imgly/isnet-general-onnx` | `440dea96dd4a3b06bbbf5abec3e26569dd7ec49f` | `onnx/model_fp16.onnx` | 88,152,708 | `2eb4b5dda7ec41c617e59706e5aafa1f978c9a5f983d2518d9f0ae4d6eb04f20` |
| `modnet-fp32` | `Xenova/modnet` | `fa2fa546052fba4c08921230a26cc69a333fca12` | `onnx/model.onnx` | 25,888,640 | `07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9` |
| `modnet-fp16` | `Xenova/modnet` | `fa2fa546052fba4c08921230a26cc69a333fca12` | `onnx/model_fp16.onnx` | 12,984,781 | `25f165da9bfd30830a575f1f0490f1acd995975cb349bc02f3d79332e1fe5cf6` |
| `modnet-uint8` | `Xenova/modnet` | `fa2fa546052fba4c08921230a26cc69a333fca12` | `onnx/model_quantized.onnx` | 6,632,188 | `92e49898c3e05a6d7a944fc67a8cb87c4aad754ffb6ebd949528c7d1105fee3a` |

## 3. 執行環境

量測在維運者的 macOS arm64 桌機（10 核心）上完成，瀏覽器是 Playwright 內建版本。三個瀏覽器都取得跨來源隔離與 4 條 WebAssembly 執行緒。

| 瀏覽器 | 版本 | WebGPU | WebAssembly 執行緒 |
| --- | --- | --- | --- |
| Chromium | 151.0 | Apple `metal-3`，支援 `shader-f16`，緩衝區上限 4,294,967,292 bytes | 4 |
| Firefox | 153.0 | 沒有 `navigator.gpu` adapter | 4 |
| WebKit | Version 26 | Apple adapter，支援 `shader-f16`，緩衝區上限 2,147,483,644 bytes | 4 |

推論 runtime 是 onnxruntime-web 1.29.0（MIT）。它本身也要算進首次下載：WASM 基準線需要 `ort-wasm-simd-threaded.wasm`，壓縮後 2,753,946 bytes；WebGPU 需要 `ort-wasm-simd-threaded.jsep.wasm`，壓縮後 4,783,272 bytes。載入器 `ort.all.min.mjs` 壓縮後 176,632 bytes。這些數字要從模型的傳輸預算裡先扣掉。

記憶體以 WebAssembly 線性記憶體為準：在 onnxruntime-web 載入前接管 `WebAssembly.Memory` 與 `WebAssembly.instantiate`，直接讀取每個記憶體的 `buffer.byteLength`。Chromium 專屬的 `performance.measureUserAgentSpecificMemory()` 在這次量測中沒有在 10 秒內回答（環境欄位記為 `not-answered`），Firefox 與 WebKit 根本沒有這個 API，所以紀錄裡的記憶體數字一律是 WebAssembly 線性記憶體，不是整個分頁的用量。

## 4. 代表性測試集

每個案例都先把前景畫在透明畫布上，透明度就是這個案例的正解遮罩，再合成到背景上成為輸入。因此正解不是人工標註，而是這張圖的定義本身；也因此整套素材不需要任何照片。

| 案例 | 量的是什麼 | 內容 |
| --- | --- | --- |
| `portrait-person` | 人像主體是否被完整保留 | 頭、頸、肩與髮團的人形，背景是有漸層與線條的室內色塊。 |
| `fine-hair` | 細碎邊緣與半透明髮絲 | 同一個人形再加 900 根寬度不到兩像素、透明度隨機的髮絲。 |
| `product-bottle` | 商品主體與淺色棚拍背景的分離 | 有高光漸層與標籤的瓶身，背景是接近白色的漸層。 |
| `semi-transparent-glass` | 半透明區域的 alpha 準確度 | 玻璃杯本體 alpha 0.34、杯緣不透明，背景是暖色漸層。 |
| `low-contrast-box` | 前景與背景亮度接近時的失敗方式 | 灰階盒體與只差幾個階調的灰階背景。 |

另有一張 4000 × 3000（12 MP）的 `product-bottle`，用來量測整條管線在大圖上的時間與記憶體，而不是再看一次品質。

## 5. 量測結果

### 5.1 傳輸與載入
| 候選 | 原始 bytes | brotli bytes | 建立 session ms | session 後 WASM bytes |
| --- | --- | --- | --- | --- |
| `birefnet-lite-fp32` | 224,005,088 | 164,222,662 | 1,901 | 693,567,488 |
| `birefnet-lite-fp16` | 114,538,221 | 81,588,550 | 2,313 | 448,135,168 |
| `isnet-general-fp32` | 176,149,806 | 163,419,214 | 372 | 464,322,560 |
| `isnet-general-fp16` | 88,152,708 | 81,267,904 | 373 | 424,083,456 |
| `modnet-fp32` | 25,888,640 | 23,903,254 | 295 | 90,439,680 |
| `modnet-fp16` | 12,984,781 | 11,847,512 | 329 | 70,647,808 |
| `modnet-uint8` | 6,632,188 | 5,163,599 | 383 | 34,930,688 |

### 5.2 遮罩品質

Chromium 的 WASM 基準線；每一列都是同一個候選在同一組合成素材上的結果。

| 候選 | 人像 IoU | 細髮 IoU | 商品 IoU | 半透明 soft MAE | 低對比 IoU |
| --- | --- | --- | --- | --- | --- |
| `birefnet-lite-fp32` | — | — | — | — | — |
| `birefnet-lite-fp16` | — | — | — | — | — |
| `isnet-general-fp32` | 0.9989 | 0.9788 | 0.9949 | 0.6037 | 0.9888 |
| `isnet-general-fp16` | 0.9989 | 0.9788 | 0.9949 | 0.6037 | 0.9888 |
| `modnet-fp32` | 0.9959 | 0.6947 | 0.9967 | 0.3849 | 0.7129 |
| `modnet-fp16` | 0.9965 | 0.6955 | 0.9967 | 0.3848 | 0.6991 |
| `modnet-uint8` | 0.3239 | 0.6352 | 0 | 0.392 | 0 |

### 5.3 推論成本與記憶體
| 候選 | provider | 冷啟 ms | 熱啟 ms | 12 MP 端到端 ms | 推論時 WASM bytes |
| --- | --- | --- | --- | --- | --- |
| `birefnet-lite-fp32` | `wasm` | — | — | — | 4,294,901,760 |
| `birefnet-lite-fp32` | `webgpu` | — | — | — | — |
| `birefnet-lite-fp16` | `wasm` | — | — | — | 4,294,901,760 |
| `birefnet-lite-fp16` | `webgpu` | — | — | — | — |
| `isnet-general-fp32` | `wasm` | 2,155 | 2,251 | 2,252 | 665,845,760 |
| `isnet-general-fp32` | `webgpu` | 521 | 538 | 631 | 464,322,560 |
| `isnet-general-fp16` | `wasm` | 2,119 | 2,151 | 2,307 | 835,911,680 |
| `isnet-general-fp16` | `webgpu` | 393 | 428 | 577 | 245,366,784 |
| `modnet-fp32` | `wasm` | 249 | 247 | 320 | 156,368,896 |
| `modnet-fp32` | `webgpu` | 142 | 158 | 282 | 90,439,680 |
| `modnet-fp16` | `wasm` | 249 | 271 | 332 | 146,604,032 |
| `modnet-fp16` | `webgpu` | 127 | 149 | 159 | 48,627,712 |
| `modnet-uint8` | `wasm` | 302 | 303 | 358 | 139,591,680 |
| `modnet-uint8` | `webgpu` | 739 | 675 | 778 | 158,990,336 |

### 5.4 失敗的候選

三個瀏覽器的每一次失敗，包含逾時。

| 瀏覽器 | 候選 | provider | 設定 | 輸入邊長 | 失敗 |
| --- | --- | --- | --- | --- | --- |
| chromium | `birefnet-lite-fp32` | `wasm` | `default` | 1024 | failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc |
| chromium | `birefnet-lite-fp32` | `wasm` | `memory-lean` | 1024 | failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc |
| chromium | `birefnet-lite-fp32` | `wasm` | `memory-lean` | 512 | failed to call OrtRun(). ERROR_CODE: 2, ERROR_MESSAGE: Got invalid dimensions for input: input_image for the following i |
| chromium | `birefnet-lite-fp32` | `webgpu` | `default` | 1024 | run_timeout_after_900000ms |
| chromium | `birefnet-lite-fp16` | `wasm` | `default` | 1024 | failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc |
| chromium | `birefnet-lite-fp16` | `wasm` | `memory-lean` | 1024 | failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc |
| chromium | `birefnet-lite-fp16` | `wasm` | `memory-lean` | 512 | failed to call OrtRun(). ERROR_CODE: 2, ERROR_MESSAGE: Got invalid dimensions for input: input_image for the following i |
| chromium | `birefnet-lite-fp16` | `webgpu` | `default` | 1024 | run_timeout_after_900000ms |
| firefox | `birefnet-lite-fp32` | `wasm` | `default` | 1024 | failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc |
| firefox | `birefnet-lite-fp32` | `wasm` | `memory-lean` | 1024 | failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc |
| firefox | `birefnet-lite-fp16` | `wasm` | `default` | 1024 | run_timeout_after_900000ms |
| webkit | `birefnet-lite-fp32` | `wasm` | `default` | 1024 | failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc |
| webkit | `birefnet-lite-fp32` | `wasm` | `memory-lean` | 1024 | failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc |
| webkit | `birefnet-lite-fp32` | `webgpu` | `default` | 1024 | run_timeout_after_900000ms |
| webkit | `birefnet-lite-fp16` | `wasm` | `default` | 1024 | failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc |
| webkit | `birefnet-lite-fp16` | `wasm` | `memory-lean` | 1024 | failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc |
| webkit | `birefnet-lite-fp16` | `webgpu` | `default` | 1024 | run_timeout_after_900000ms |

### 5.5 跨瀏覽器確認

WASM 基準線的兩個確認案例。人像欄位是必要的：被推薦的 `modnet-fp16` 是人像模型，
而它的人像品質在 WebKit 上比 Chromium 低約 5 個百分點。

| 瀏覽器 | 候選 | 冷啟 ms | 人像 IoU | 商品 IoU | 推論時 WASM bytes |
| --- | --- | --- | --- | --- | --- |
| chromium | `birefnet-lite-fp32` | — | — | — | 4,294,901,760 |
| chromium | `birefnet-lite-fp16` | — | — | — | 4,294,901,760 |
| chromium | `isnet-general-fp32` | 2,155 | 0.9989 | 0.9949 | 665,845,760 |
| chromium | `isnet-general-fp16` | 2,119 | 0.9989 | 0.9949 | 835,911,680 |
| chromium | `modnet-fp32` | 249 | 0.9959 | 0.9967 | 156,368,896 |
| chromium | `modnet-fp16` | 249 | 0.9965 | 0.9967 | 146,604,032 |
| chromium | `modnet-uint8` | 302 | 0.3239 | 0 | 139,591,680 |
| firefox | `birefnet-lite-fp32` | — | — | — | 4,275,896,320 |
| firefox | `birefnet-lite-fp16` | — | — | — | — |
| firefox | `isnet-general-fp32` | 56,272 | 0.999 | 0.9949 | 665,845,760 |
| firefox | `isnet-general-fp16` | 55,629 | 0.999 | 0.9949 | 841,940,992 |
| firefox | `modnet-fp32` | 5,984 | 0.9924 | 0.9967 | 156,368,896 |
| firefox | `modnet-fp16` | 6,032 | 0.9932 | 0.9967 | 146,604,032 |
| firefox | `modnet-uint8` | 5,378 | 0.3228 | 0 | 139,591,680 |
| webkit | `birefnet-lite-fp32` | — | — | — | 4,294,901,760 |
| webkit | `birefnet-lite-fp16` | — | — | — | 4,274,978,816 |
| webkit | `isnet-general-fp32` | 2,046 | 0.999 | 0.9954 | 665,845,760 |
| webkit | `isnet-general-fp16` | 2,236 | 0.999 | 0.9954 | 845,479,936 |
| webkit | `modnet-fp32` | 319 | 0.9493 | 0.9959 | 156,368,896 |
| webkit | `modnet-fp16` | 319 | 0.9487 | 0.9959 | 152,174,592 |
| webkit | `modnet-uint8` | 380 | 0.3194 | 0 | 139,591,680 |

## 6. 能力層級與降級

| 層級 | 條件 | 行為 |
| --- | --- | --- |
| `webgpu-fp16` | `navigator.gpu` 取得 adapter 且支援 `shader-f16` | 使用 fp16 權重，傳輸量最小、速度最快。 |
| `webgpu-fp32` | 取得 adapter 但沒有 `shader-f16` | 改用 fp32 權重，傳輸量加倍，結果契約不變。 |
| `wasm-simd-threads` | 沒有 WebGPU，但有 WebAssembly SIMD 與可用執行緒 | fp32、fp16 與量化權重都能執行：fp16 匯出的圖形邊界仍是 float32，權重在載入時還原，因此這一層只是比 WebGPU 慢，不是不能用。 |
| `unsupported` | 以上皆不成立，或記憶體預算不足 | 在下載任何模型之前就說明無法執行，不下載也不開始推論。 |

> **2026-09-08 更正**：這一列原本寫「只走 fp32 或量化權重；fp16 權重在這一層不可用」，那是第一版量測腳本餵 float16 張量造成的誤判。修正後的量測（§5.3、§5.5）顯示 `modnet-fp16` 與 `isnet-general-fp16` 在三個瀏覽器的 WASM 基準線都完成推論，量測檔即為證據。T19（#21）依這份更正以 `modnet-fp16` 交付 WASM 基準線。

判定順序固定：先問能力，再決定要下載哪一個權重檔，最後才開始下載。任何一層失敗都往下一層退，不會在同一層重試到耗盡裝置記憶體。降級到較低解析度輸入是最後手段，會明確標示邊緣品質下降。

## 7. 失敗模式

| 代碼 | 觸發 | 可恢復 | 使用者可以做的事 |
| --- | --- | --- | --- |
| `unsupported_browser` | 能力檢查沒有任何一層通過 | 否 | 換用支援的瀏覽器；不會開始下載。 |
| `model_download_failed` | 模型或 runtime 取得失敗、離線、被中止 | 是 | 重試；已快取的部分保留。 |
| `model_digest_mismatch` | 下載內容與紀錄的 SHA-256 不符 | 是 | 清除快取後重新下載；不得使用不符的位元組。 |
| `insufficient_memory` | 建立 session 或推論時記憶體不足 | 是 | 換較小的圖或較低的層級重試。 |
| `inference_failed` | 執行期例外、算子不支援、輸出形狀不符 | 是 | 重試或改用較低層級；原圖保留。 |
| `cancelled` | 使用者取消 | 是 | 立即結束工作並釋放緩衝區，不交付部分結果。 |

## 8. go/no-go 標準

門檻對應規格 §12.8 與 ADR-0001；「量測」欄位的每個數字都來自 `docs/research/data/007-background-removal-measurements.json`。

| 標準 | 門檻 | 量測 | 結果 |
| --- | --- | --- | --- |
| `licence` | 被推薦候選的權重可由 toolsliang 自有網域再散布 | `modnet` Apache-2.0 授權鏈完整；`birefnet-lite` MIT 亦完整但無法執行；`isnet-general` 三方說法互相衝突，不可散布 | `pass` |
| `general-scope` | 有一個可散布的候選能處理商品等一般物件 | 可散布的一般用途家族只有 `birefnet-lite`，而它無法執行 | `fail` |
| `wasm-baseline` | 可散布的一般用途候選能在 WASM 基準線完成一次推論 | `birefnet-lite` 兩種精度在三個瀏覽器都沒有完成推論：最高到 4,294,901,760 bytes 後 `std::bad_alloc`，Firefox 的 fp16 則是逾時 | `fail` |
| `transfer-budget` | 壓縮傳輸 ≤ 41,943,040 bytes | 能執行的一般用途候選最小為 81,267,904 bytes；`modnet-fp16` 為 11,847,512 bytes | `fail` |
| `desktop-latency` | 已快取的一次結果 ≤ 30,000 ms | 被推薦的 `modnet-fp16` 最慢是 Firefox 的 6,032 ms，12 MP 端到端在 WebGPU 上 159 ms；但 `isnet-general-fp32` 在 Firefox 要 56,272 ms | `conditional` |
| `memory-headroom` | 推論不得耗盡 WebAssembly 位址空間 | `modnet` 家族 ≤ 156,368,896 bytes；`isnet-general` 達 845,479,936 bytes | `conditional` |
| `mask-quality` | 代表性案例的遮罩可用 | 合成素材上 `isnet-general` 0.9788–0.9989、`modnet-fp16` 0.6955–0.9967、`modnet-uint8` 低到 0；`modnet-fp16` 的人像 IoU 在 WebKit 掉到 0.9487 | `conditional` |
| `privacy` | 圖片像素不離開裝置 | 量測期間唯一的對外請求是釘選 commit 的模型與 runtime 下載 | `pass` |

`conditional` 表示這一項在推薦的範圍內成立，但附帶必須寫進 T19 的限制：延遲門檻只有在不採用 `isnet-general` 時成立；記憶體餘裕只有 `modnet` 家族有；品質數字來自合成素材，且同一個模型的人像品質會隨瀏覽器變動，發布前仍要用真實照片在每個支援的瀏覽器上人工檢查。

## 9. 快取、取消、版本與更新

模型以「版本化的公開靜態資產」處理：檔名帶版本、內容以 SHA-256 驗證、快取鍵包含版本，因此新版本不會覆寫舊版本，也不需要相信 HTTP 快取。ADR-0002 要求重型資源在首次需要時才下載並快取，ADR-0001 要求這些資產由 toolsliang 自有網域提供，所以 T19 不能在執行期直接連 Hugging Face 或任何 CDN：權重與 runtime 都要先納入自有靜態資產。

已經不再使用的舊模型版本要在安全時機清除，避免長期占用裝置空間；工具還有未完成工作時不得靜默更新。

快取這一節是**定義的標準，不是量測結果**。這次評估沒有量測 Cache Storage 配額、離線重跑或快取失效；模型資產以本機伺服器提供，沒有經過 Service Worker。T19 必須自己驗證：11,847,512 bytes 的權重能否在目標裝置的配額內長期保留、離線時能否從快取重跑、以及版本更換後舊檔是否真的被清掉。

### 取消

取消同樣是定義的標準。這次量測沒有執行取消路徑，但候選的執行方式決定了可行的契約，因此必須寫下來：

- onnxruntime-web 的 `session.run()` 一旦進入算子就無法中途中斷，`AbortSignal` 不會讓它提早返回。因此唯一可靠的取消手段是終止執行推論的 Worker，這與 `docs/research/006-image-compressor-engine.md` 對圖片 Worker 的做法一致。
- 取消必須在下列每個階段都可用：模型下載、解碼、前處理、推論、遮罩後處理、輸出編碼。下載階段以 `AbortController` 取消；推論階段以終止 Worker 取消。
- 取消後不得交付部分結果，且必須釋放大型緩衝區。以 `modnet-fp16` 為例，推論期間的 WebAssembly 線性記憶體達 146,604,032 bytes；終止 Worker 是唯一能把這塊記憶體還給裝置的方式，因為 WebAssembly 記憶體只會成長、不會縮小。
- 已下載並通過 SHA-256 驗證的模型不因取消而失效；取消一次工作不應該讓使用者重新下載模型。
- T19 的驗收必須實測取消：取消後 Worker 結束、記憶體回落、晚到的訊息被忽略、原圖保留。這份紀錄沒有提供這些證據。

## 10. 隱私邊界

模型檔案與推論 runtime 是公開靜態資產，可以下載；圖片像素、遮罩、預覽與輸出只在裝置上存在，不離開、不上傳、不寫入任何遠端。這條界線在這份評估裡也成立：所有測試圖片由程式產生，量測結果只有數字，沒有任何影像內容被寫進紀錄檔。

推論工作沒有網路、分析或儲存介面。唯一的對外請求是模型與 runtime 的下載，而它們與使用者選了哪張圖無關。

## 11. 一手來源

查閱日期：2026-09-07。

- [BiRefNet LICENSE](https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE)：`birefnet-lite` 權重的 MIT 授權全文。
- [MODNet README 與 LICENSE](https://github.com/ZHKKKe/MODNet/blob/master/README.md)：明確把程式、模型與 demo 一起放進 Apache-2.0。
- [DIS README](https://github.com/xuebinqin/DIS)：IS-Net 上游對授權範圍的原句，以及資料集另有使用條款。
- [BRIA RMBG-1.4 模型頁](https://huggingface.co/briaai/RMBG-1.4)：非商業使用的原文與失效的授權連結。
- [imgly/isnet-general-onnx](https://huggingface.co/imgly/isnet-general-onnx)：只有一行授權標籤的權重頁。
- [onnx-community/ISNet-ONNX](https://huggingface.co/onnx-community/ISNet-ONNX)：同一套架構的 AGPL-3.0 標示。
- [W3C WebGPU](https://www.w3.org/TR/webgpu/)：adapter、`shader-f16` 與緩衝區上限的定義。
- [W3C WebAssembly Core 2.0](https://www.w3.org/TR/wasm-core-2/)：線性記憶體與 32 位元位址空間的上限。
- [WICG performance.measureUserAgentSpecificMemory](https://wicg.github.io/performance-measure-memory/)：記憶體量測的語意與跨來源隔離前提。
- [ONNX Runtime Web 執行提供者](https://onnxruntime.ai/docs/execution-providers/WebGPU-ExecutionProvider.html)：WebGPU 與 WASM 兩條路徑的支援範圍。

## 12. 驗證範圍與限制

量測全部在一台 macOS arm64 桌機上完成，不是參考手機，也不是正式環境的 p75。規格 §12.8 的手機預算（已快取 12 MP ≤ 60 秒）仍需要實機證據；桌機數字不能代替。

測試素材是程式繪製的合成素材，正解遮罩就是繪圖時的透明度，因此沒有使用任何照片、使用者檔案或第三方素材。這也是最大的限制：合成圖不在這些模型的訓練分布內，表中的品質數字只能用來比較候選在同一組邊界情況下的行為，不能當成照片上的準確度。`modnet-fp16` 在合成商品案例拿到 0.9967，這說明的是這張合成圖對模型很容易，不代表人像模型能處理真實商品照。任何候選要進入發布，T19 仍必須用真實照片在裝置上人工檢查邊緣、髮絲與半透明區域。

半透明案例的 soft alpha MAE 全部落在 0.38–0.60，沒有任何候選能正確還原半透明區域的 alpha。這是整個候選集合共同的弱點，不是單一模型的問題，必須寫進工具的可見限制。

Chromium 與 WebKit 的 WebGPU 數字來自可見視窗中的 Apple 介面卡。headless Chromium 只提供 SwiftShader 軟體介面卡，量到的時間會慢一個數量級，兩者不能互相比較。Firefox 在這個版本沒有 WebGPU adapter，所以它的所有數字都是 WASM 基準線；它也是最慢的瀏覽器，同一個模型比 Chromium 慢約 24 倍。

`birefnet-lite` 的 WebGPU 結論是「15 分鐘內沒有完成建立 session」，不是「確定無法執行」。這個上限由量測腳本設定，記錄的是在這個上限內沒有可用結果。

Firefox 與 WebKit 只跑 `portrait-person` 與 `product-bottle` 兩個確認案例；完整的五個案例與 12 MP 案例只在 Chromium 的兩個執行提供者上執行。跨瀏覽器表因此只回答「同一個模型在別的瀏覽器跑不跑得動、慢多少、品質有沒有掉」，不回答細髮、半透明與低對比在別的瀏覽器的表現。

12 MP 的數字是前處理、推論與遮罩後處理的總和，不包含檔案解碼與 PNG 編碼；這兩段由 T19 的輸出管線決定，不屬於模型成本。

## 13. TDD 紀錄

1. `tests/image-background-remover-reference.test.ts` 先因為 `domain/reference.ts` 不存在而無法載入，確認測試真的在檢查東西。
2. 再補上決策紀錄讀取器後，測試因為 `docs/research/007-...md` 不存在而失敗，接著才寫出文件的候選、排除與指紋三張表。
3. 量測檔的欄位由測試定義：候選、指紋、每個數字都要能在 JSON 裡找到相同的值，文件與模組任何一邊改動都會失敗。
4. 第一版量測腳本共用同一個分頁，前一個候選留下的 WebAssembly 記憶體讓下一個候選看起來記憶體不足；改成每次執行都開新分頁、每個候選都開新瀏覽器後，`birefnet-lite` 的失敗才被確認為模型本身的成本。
5. 第一版對 fp16 權重餵 float16 張量，七個候選中的三個因此得到 `Unexpected input data type`。實測發現 fp16 匯出的輸入與輸出仍是 float32，修正後 fp16 候選全部可以執行，結論也跟著改變。
6. 記憶體原本只靠 Chromium 的 `measureUserAgentSpecificMemory()`，它在這台機器上不回答，量到的全是空值；改成接管 `WebAssembly.Memory` 直接讀線性記憶體後，三個瀏覽器都有可比較的數字，也才量到 4 GiB 上限。
7. 降級解析度原本假設所有模型都接受較小的輸入；`birefnet-lite` 以 `Got invalid dimensions for input` 拒絕，證實它的匯出是固定尺寸。

## 14. Standards／Spec 審查

固定點為 `develop`（`dadd85f`）。Standards 與 Spec 由兩個獨立審查者檢查，兩邊的有效問題都已修正並重新驗證。

Standards 指出三個硬性問題：品質閘門文件宣稱逐檔比對 SHA-256，但 runtime 只記錄摘要沒有比對（已把七個 runtime 檔案的 SHA-256 釘進 `scripts/background-removal/candidates.mjs` 並實際比對）；候選清單在腳本與 domain 模組各存一份且已經漂移，`MIT (publisher claim)` 與 `MIT（發布者聲明）` 不一致（已改成「授權識別碼 + 是否經過查證」兩個欄位，兩邊值相同，並由測試比對文件、模組與量測檔）；腳本檔名用 snake_case 與既有 `.mjs` 慣例不符（已改名為 `scripts/evaluate-background-removal.mjs`）。判斷題採納了四項：go/no-go 門檻改為 `as const` 詞彙並約束型別、`selectedCandidateId` 改名為 `recommendedCandidateId`、`MeasuredRun` 補上實際讀取的欄位、移除測試裡沒有任何 URL 使用的允許網域。

Spec 指出這份紀錄漏掉 issue 明確要求的兩項標準：取消完全沒有定義，快取只有政策沒有註明缺少證據（§9 已補上取消契約與快取的證據缺口說明）。它也指出 WebGPU 沒有任何 12 MP 量測，而 WebGPU 正是能力階梯的最高層（已補量，`modnet-fp16` 的 12 MP 端到端為 159 ms）。事實性錯誤修正兩處：§1 原本寫「三個瀏覽器都到 4,294,901,760 bytes 後 `std::bad_alloc`」，實際上 Firefox 的 fp16 是逾時、各瀏覽器的峰值介於 4.27–4.29 GB；§5.4 原本只列 Chromium 的失敗，現在列出三個瀏覽器的每一次失敗。§5.5 原本只顯示商品 IoU，掩蓋了被推薦模型在 WebKit 的人像品質下降，現已加入人像欄位並寫進決策摘要與品質門檻。

審查另外指出 `isnet-general` 仍留在 T19 會匯入的候選陣列中，只靠授權字串不在允許清單而被擋掉。現在改為明確的 `licenceVerified` 欄位與 `redistributableCandidates` 匯出，並由測試確認未經查證的授權永遠不會進入可散布清單。`downloadUrl` 改名為 `provenanceUrl`，型別註解寫明它是評估時的來源，不是執行期位址。

修正過程中另外發現一個審查沒有找到的缺陷：續跑邏輯在跳過已記錄的設定時，連帶跳過了「成功就停止重試」的判斷，導致重新啟動時會開始第一次執行已經排除的重試。已修正為續跑與一次跑完做出相同判斷。
