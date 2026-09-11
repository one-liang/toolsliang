# PDF 本機編輯引擎與安全邊界

Issue：#26（T24）。版本識別碼：`pdf-signature-2026-09-11`。這份紀錄選定 PDF 手寫簽名要使用的瀏覽器端引擎，並把密碼、損毀檔、座標、保真與資源上限寫成 T25（#27）與 T26（#28）可以直接引用的契約。

## 1. 範圍與方法

比較可在瀏覽器本機解析、預覽、寫入與輸出 PDF 的函式庫，界定授權、維護、供應鏈與檔案能力邊界，並定義簽名影像、座標、縮放、輸出保真、記憶體、進度、取消與錯誤契約。這裡不實作正式簽名工具，也不提供憑證式數位簽章。

依 ADR-0001，PDF 位元組、頁面預覽、簽名筆跡、密碼與輸出結果都不離開使用者裝置；任何要求上傳檔案或回傳處理結果的候選都不列入評估。量測本身遵守同一條界線：測試文件全部由 `scripts/pdf-engine/fixtures.mjs` 以程式產生，沒有任何真實 PDF，唯一的對外請求是釘選版本的套件下載。

量測由維運者執行：

```bash
node scripts/evaluate-pdf-engine.mjs [--browsers=chromium,firefox,webkit] [--candidates=…]
```

它把釘選版本的 npm tarball 下載到已忽略版本控制的 `artifacts/`、以 registry 發布的 `sha512` integrity 逐檔比對，只解出 harness 會載入的檔案，從 localhost 提供，再以 Playwright 依序驅動 Chromium、Firefox 與 WebKit。每個「引擎 × 文件 × 變體」都在自己的分頁執行，量完即寫檔；結果寫入 `docs/research/data/009-pdf-engine-measurements.json` 並隨版本控制提交。CI 只讀這份 JSON，不下載套件也不開瀏覽器。

`tests/pdf-signature-reference.test.ts` 讓這份文件、量測 JSON 與 `app/features/tools/pdf-signature/domain/reference.ts` 三者一致：文件裡的每個判定與數字都必須等於量測檔中的值，模組裡的候選、授權、角色、失敗代碼、上限、記憶體係數與文案都必須逐字等於文件。座標換算在 harness 與 domain 模組各有一份實作（一份是瀏覽器模組，一份是帶型別的應用程式模組），同一份測試以多組頁框、旋轉角度與矩形逐案比對兩者，因此 §6.3 的證據屬於 T25 會引用的那些函式，而不是 harness 裡的複本。

## 2. 候選與授權

### 2.1 量測候選

| 引擎 | 套件 | 版本 | 角色 | 授權 | 可自行散布 | 授權頁面 |
| --- | --- | --- | --- | --- | --- | --- |
| `pdfjs-dist` | pdfjs-dist | 6.3.289 | 解析、預覽、密碼 | Apache-2.0 | 是 | <https://github.com/mozilla/pdf.js/blob/master/LICENSE> |
| `hyzyla-pdfium` | @hyzyla/pdfium | 2.1.13 | 解析、預覽、密碼 | MIT | 否 | <https://github.com/hyzyla/pdfium/blob/main/LICENSE.md> |
| `pdf-lib` | pdf-lib | 1.17.1 | 解析、寫入 | MIT | 是 | <https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md> |
| `cantoo-pdf-lib` | @cantoo/pdf-lib | 2.9.2 | 解析、寫入、密碼 | MIT | 是 | <https://github.com/cantoo-scribe/pdf-lib/blob/master/LICENSE.md> |

沒有任何一個候選同時具備四種角色。能算圖的不會寫檔，能寫檔的不會算圖，這是這次選型的基本形狀。

傳輸大小（未壓縮／brotli 品質 5）：`pdfjs-dist` 1,684 KiB／460 KiB，`hyzyla-pdfium` 4,154 KiB／1,862 KiB，`pdf-lib` 513 KiB／173 KiB，`cantoo-pdf-lib` 619 KiB／236 KiB。每個檔案的 SHA-256 記在量測檔的 `candidates[].assets`。

### 2.2 量測前排除

| 引擎 | 套件 | 原因 | 依據 |
| --- | --- | --- | --- |
| `mupdf` | mupdf@1.28.1 | `copyleft-licence` | AGPL-3.0-or-later，或向 Artifex 另購商業授權；本站原始碼不以 AGPL 釋出。 |
| `jspdf` | jspdf@4.2.1 | `creation-only` | 只能產生新文件，無法開啟使用者既有的 PDF。 |
| `muhammara` | muhammara@6.0.6 | `no-browser-build` | node-pre-gyp 原生模組，安裝時取平台二進位檔，沒有瀏覽器進入點。 |
| `nutrient-viewer` | @nutrient-sdk/viewer@1.21.0 | `proprietary-licence` | 授權欄位指向商業訂閱合約，執行期需要授權金鑰。 |
| `pdftron-webviewer` | @pdftron/webviewer@12.1.0 | `proprietary-licence` | 套件沒有授權欄位，產品以商業授權與部署金鑰散布。 |
| `pdf-annotate-js` | pdf-annotate.js@1.0.0 | `unmaintained` | 最後一次發布在 2016 年；使用者無法自行複驗的檔案不該交給沒有維護的解析器。 |

### 2.3 供應鏈註記

`hyzyla-pdfium` 是唯一在授權上不通過的量測候選，而且它的能力沒有問題：三個瀏覽器都開得起全部可開啟的文件，也支援密碼。問題在它散布什麼、宣告什麼。套件 manifest 與 `LICENSE.md` 都寫 MIT，但那份 `LICENSE.md` 是 git 附的 MIT 樣板，著作權人是別人；同一個 `dist/` 裡有 4 MiB 的 `pdfium.wasm`，那是 PDFium 的建置產物，屬於 BSD-3-Clause 並帶有 Google 與 Foxit 的著作權聲明，套件裡沒有這些聲明。宣告的授權沒有涵蓋實際散布的位元組，因此列為不可自行散布，不進入選型。這不是對該專案的品質判斷，只是本站不能替它承擔授權責任。

其餘三個候選的授權檔與實際散布內容一致。`pdfjs-dist` 另外附帶 Liberation 字型與 Foxit、JBIG2、OpenJPEG、QCMS 的授權檔，各自對應它 `standard_fonts/` 與 `wasm/` 目錄裡的內容；T25 若不需要那些目錄就不要一併打包。

版本以 registry 的 `sha512` integrity 釘選，執行期不從任何 CDN 取用，套件與其資產都由本站自己的建置產物提供。

## 3. 代表性文件

| 文件 | 結構 | 預期 | 加密 | 頁數 | 位元組 | SHA-256 |
| --- | --- | --- | --- | ---: | ---: | --- |
| `reference-20-page` | `classic-xref` | `open` | 否 | 20 | 21,611,328 | `11b6be8a3ce3f024a4a2540759e9b40a1af308d279f6c844f9904b6c962abe00` |
| `rotated-pages` | `page-rotation` | `open` | 否 | 4 | 1,592 | `c0198820c5ae89ece72bd3817af716b240a795eeaa4b39ebdf042db6d95a9408` |
| `offset-crop-box` | `offset-boxes` | `open` | 否 | 2 | 980 | `7b5eb39f336bb50be9fab08420c619def42a6346262fb5f3db670dc41e4e8372` |
| `object-stream` | `xref-stream` | `open` | 否 | 3 | 996 | `531daaaa780bd3a80de61de4ef14c71a98310786d6ce6ab552679992d64513c4` |
| `large-56-page` | `classic-xref` | `open` | 否 | 56 | 60,511,308 | `76e6e84b766bcf68ab410b9129ff2f2459fbf4ecff4b3105f811adace66e88f4` |
| `page-cap-120` | `classic-xref` | `open` | 否 | 120 | 39,114 | `69d52ae9cb35fffe50fec4fce4533d6c06ccba55f8fe1191d1c5461bf260c668` |
| `encrypted-rc4-128` | `standard-security-r3` | `password` | 是 | 2 | 1,190 | `f4aeef35b2c9abb9b39d1c02a2227f2330acaeb783f02ee7c2337668b6c9f5a9` |
| `encrypted-aes-128` | `standard-security-r4` | `password` | 是 | 2 | 1,339 | `8b8c3a85901a6fb47a334ff6aea71dc5ca77807da47bafc273b7fed87073293e` |
| `owner-password-restricted` | `standard-security-r4` | `open` | 是 | 2 | 1,340 | `acd460dd76210745f00143baf285289af83bcc1f993835d21149d8ced9f078f3` |
| `active-content` | `active-content` | `open` | 否 | 1 | 1,400 | `413a4d51b242c35621618c16d6f1b016199937d586022b8665769e349ad83939` |
| `broken-xref` | `damaged-startxref` | `recover-or-reject` | 否 | 2 | 952 | `13e9b1b24738e8aef97517e4ce9153c709a9dc90f8e97941d8bd38cc4b485223` |
| `truncated` | `damaged-truncated` | `reject` | 否 | 0 | 12,966,796 | `d80f9850b719ececd562d06599db65057df4db8aa9084007a8d8c25b5b2fc2a2` |

`reference-20-page` 就是規格 §12.12 拿來訂預算的那份文件：20 頁、約 20 MiB。頁面圖像用種子亂數產生因而不可壓縮，位元組數才是真的要被讀過去的量；每頁各有自己的圖像物件，否則 20 頁會和 1 頁一樣重。`large-56-page` 與 `page-cap-120` 分別跨過位元組與頁數上限，讓上限落在量過的地方而不是猜的地方。

`encrypted-rc4-128` 與 `encrypted-aes-128` 由 fixtures 依 ISO 32000-1 §7.6.3 的演算法 2 至 5 自行加密（RC4 128 bit／修訂 3、AES-128 CBC／修訂 4），使用者密碼為 `toolsliang-t24`。三個瀏覽器上的 `pdfjs-dist` 在沒有密碼時回報缺少密碼、給了密碼就開得起來，這同時證明加密實作正確。

`owner-password-restricted` 用同一組演算法加密，但使用者密碼是空字串、擁有者密碼另設，權限位元允許列印與複製、不允許修改內容與標註。它在檢視器裡不會要求任何輸入，是「看起來沒有保護、實際上不允許被改」的那一類。

`active-content` 宣告了文件層 JavaScript、`/OpenAction`、頁面 `/AA`、URI 連結與 Launch 動作。它的 URI 指向一個不存在的本機位址，量測期間伺服器收到的每一個路徑都被記錄下來，因此「有沒有人跟隨了那個動作」是可以查的，不是靠信任。

`broken-xref` 的物件完整、只有 `startxref` 指向檔案結尾之外，這是最常見的損毀形態；`truncated` 是 `reference-20-page` 截到 60%，交叉參考表、trailer 與後段物件都不存在。

## 4. 相容性矩陣

判定用語：`opened` 表示函式庫開啟成功；`password-required` 表示函式庫明確指出缺少密碼；`rejected` 表示函式庫拒絕開啟，包含「偵測到加密但不支援」在內；`timed-out` 表示超過 180 秒。

### 4.1 預設開啟

| 引擎 | 文件 | chromium | firefox | webkit |
| --- | --- | --- | --- | --- |
| `pdfjs-dist` | `reference-20-page` | opened | opened | opened |
| `pdfjs-dist` | `rotated-pages` | opened | opened | opened |
| `pdfjs-dist` | `offset-crop-box` | opened | opened | opened |
| `pdfjs-dist` | `object-stream` | opened | opened | opened |
| `pdfjs-dist` | `large-56-page` | opened | opened | opened |
| `pdfjs-dist` | `page-cap-120` | opened | opened | opened |
| `pdfjs-dist` | `encrypted-rc4-128` | password-required | password-required | password-required |
| `pdfjs-dist` | `encrypted-aes-128` | password-required | password-required | password-required |
| `pdfjs-dist` | `owner-password-restricted` | opened | opened | opened |
| `pdfjs-dist` | `active-content` | opened | opened | opened |
| `pdfjs-dist` | `broken-xref` | opened | opened | opened |
| `pdfjs-dist` | `truncated` | rejected | rejected | rejected |
| `hyzyla-pdfium` | `reference-20-page` | opened | opened | opened |
| `hyzyla-pdfium` | `rotated-pages` | opened | opened | opened |
| `hyzyla-pdfium` | `offset-crop-box` | opened | opened | opened |
| `hyzyla-pdfium` | `object-stream` | opened | opened | opened |
| `hyzyla-pdfium` | `large-56-page` | opened | opened | opened |
| `hyzyla-pdfium` | `page-cap-120` | opened | opened | opened |
| `hyzyla-pdfium` | `encrypted-rc4-128` | password-required | password-required | password-required |
| `hyzyla-pdfium` | `encrypted-aes-128` | password-required | password-required | password-required |
| `hyzyla-pdfium` | `owner-password-restricted` | opened | opened | opened |
| `hyzyla-pdfium` | `active-content` | opened | opened | opened |
| `hyzyla-pdfium` | `broken-xref` | opened | opened | opened |
| `hyzyla-pdfium` | `truncated` | rejected | rejected | rejected |
| `pdf-lib` | `reference-20-page` | opened | opened | opened |
| `pdf-lib` | `rotated-pages` | opened | opened | opened |
| `pdf-lib` | `offset-crop-box` | opened | opened | opened |
| `pdf-lib` | `object-stream` | opened | opened | opened |
| `pdf-lib` | `large-56-page` | opened | opened | opened |
| `pdf-lib` | `page-cap-120` | opened | opened | opened |
| `pdf-lib` | `encrypted-rc4-128` | rejected | rejected | rejected |
| `pdf-lib` | `encrypted-aes-128` | rejected | rejected | rejected |
| `pdf-lib` | `owner-password-restricted` | rejected | rejected | rejected |
| `pdf-lib` | `active-content` | opened | opened | opened |
| `pdf-lib` | `broken-xref` | opened | opened | opened |
| `pdf-lib` | `truncated` | rejected | rejected | rejected |
| `cantoo-pdf-lib` | `reference-20-page` | opened | opened | opened |
| `cantoo-pdf-lib` | `rotated-pages` | opened | opened | opened |
| `cantoo-pdf-lib` | `offset-crop-box` | opened | opened | opened |
| `cantoo-pdf-lib` | `object-stream` | opened | opened | opened |
| `cantoo-pdf-lib` | `large-56-page` | opened | opened | opened |
| `cantoo-pdf-lib` | `page-cap-120` | opened | opened | opened |
| `cantoo-pdf-lib` | `encrypted-rc4-128` | rejected | rejected | rejected |
| `cantoo-pdf-lib` | `encrypted-aes-128` | rejected | rejected | rejected |
| `cantoo-pdf-lib` | `owner-password-restricted` | rejected | rejected | rejected |
| `cantoo-pdf-lib` | `active-content` | opened | opened | opened |
| `cantoo-pdf-lib` | `broken-xref` | opened | opened | opened |
| `cantoo-pdf-lib` | `truncated` | opened | opened | opened |

### 4.2 密碼與權限保護檔

同樣的文件，這次帶著正確的使用者密碼開啟。

| 引擎 | 文件 | chromium | firefox | webkit |
| --- | --- | --- | --- | --- |
| `pdfjs-dist` | `encrypted-rc4-128` | opened | opened | opened |
| `pdfjs-dist` | `encrypted-aes-128` | opened | opened | opened |
| `pdfjs-dist` | `owner-password-restricted` | opened | opened | opened |
| `hyzyla-pdfium` | `encrypted-rc4-128` | opened | opened | opened |
| `hyzyla-pdfium` | `encrypted-aes-128` | opened | opened | opened |
| `hyzyla-pdfium` | `owner-password-restricted` | opened | opened | opened |
| `pdf-lib` | `encrypted-rc4-128` | rejected | rejected | rejected |
| `pdf-lib` | `encrypted-aes-128` | rejected | rejected | rejected |
| `pdf-lib` | `owner-password-restricted` | rejected | rejected | rejected |
| `cantoo-pdf-lib` | `encrypted-rc4-128` | opened | opened | opened |
| `cantoo-pdf-lib` | `encrypted-aes-128` | opened | opened | opened |
| `cantoo-pdf-lib` | `owner-password-restricted` | opened | opened | opened |

### 4.3 觀察

三個瀏覽器的判定完全一致：沒有任何一格因為瀏覽器不同而不同。差異全部落在函式庫之間。

`pdf-lib@1.17.1` 沒有 `password` 載入選項，帶著密碼與不帶密碼得到同一個錯誤，因此對它而言加密檔就是開不起來。`@cantoo/pdf-lib` 是同一份程式碼的維護分支，多了密碼、增量更新與較新的修正，也是唯一同時能寫入又能解密的候選。

`owner-password-restricted` 是最容易被實作誤判的一格：它的使用者密碼是空字串，兩個算圖引擎直接開啟，兩個寫入引擎卻回報「文件已加密」。使用者眼中那是一份沒有密碼的檔案，所以寫入引擎必須被明確餵一個空密碼，見 §7.2。

`active-content` 在四個候選、三個瀏覽器都以普通文件開啟，沒有任何一次執行文件裡的指令碼，見 §7.3。

唯一一格「多開了不該開的檔案」是 `cantoo-pdf-lib` 對 `truncated` 的 `opened`：它從殘缺的位元組重建出 12 頁（原檔 20 頁），而且匯出成功。§7.4 說明後續處理。

## 5. 效能與記憶體

在 `reference-20-page`（20 頁、20 MiB）與 `large-56-page`（56 頁、58 MiB）上量測。記憶體為 `performance.measureUserAgentSpecificMemory()` 在該工作完成後的取樣，只有 Chromium 提供這個 API，其餘兩個瀏覽器沒有可量的等價值。

| 引擎 | 文件 | 瀏覽器 | 開啟 ms | 首頁預覽 ms | 匯出 ms | 記憶體 MiB |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `pdfjs-dist` | `reference-20-page` | chromium | 40 | 25 | - | 53 |
| `pdfjs-dist` | `reference-20-page` | firefox | 52 | 3 | - | - |
| `pdfjs-dist` | `reference-20-page` | webkit | 43 | 22 | - | - |
| `pdfjs-dist` | `large-56-page` | chromium | 34 | 10 | - | 127 |
| `pdfjs-dist` | `large-56-page` | firefox | 56 | 5 | - | - |
| `pdfjs-dist` | `large-56-page` | webkit | 37 | 14 | - | - |
| `hyzyla-pdfium` | `reference-20-page` | chromium | 5 | 22 | - | 66 |
| `hyzyla-pdfium` | `reference-20-page` | firefox | 5 | 74 | - | - |
| `hyzyla-pdfium` | `reference-20-page` | webkit | 5 | 20 | - | - |
| `hyzyla-pdfium` | `large-56-page` | chromium | 10 | 20 | - | 136 |
| `hyzyla-pdfium` | `large-56-page` | firefox | 15 | 73 | - | - |
| `hyzyla-pdfium` | `large-56-page` | webkit | 11 | 20 | - | - |
| `pdf-lib` | `reference-20-page` | chromium | 6 | - | 29 | 66 |
| `pdf-lib` | `reference-20-page` | firefox | 9 | - | 29 | - |
| `pdf-lib` | `reference-20-page` | webkit | 7 | - | 24 | - |
| `pdf-lib` | `large-56-page` | chromium | 13 | - | 66 | 177 |
| `pdf-lib` | `large-56-page` | firefox | 16 | - | 79 | - |
| `pdf-lib` | `large-56-page` | webkit | 14 | - | 47 | - |
| `cantoo-pdf-lib` | `reference-20-page` | chromium | 6 | - | 28 | 66 |
| `cantoo-pdf-lib` | `reference-20-page` | firefox | 10 | - | 29 | - |
| `cantoo-pdf-lib` | `reference-20-page` | webkit | 8 | - | 24 | - |
| `cantoo-pdf-lib` | `large-56-page` | chromium | 13 | - | 65 | 178 |
| `cantoo-pdf-lib` | `large-56-page` | firefox | 15 | - | 82 | - |
| `cantoo-pdf-lib` | `large-56-page` | webkit | 15 | - | 47 | - |

規格 §12.12 給的桌面預算是首頁預覽 3 秒、匯出 15 秒。實測值全部低兩個數量級，預算不是這個工具的難處。真正決定體感的是別的東西：

- **開啟時間不代表解析完成。** `pdf-lib` 家族的 `load` 只建索引，工作留到 `save`；`pdfjs-dist` 的開啟時間裡大半是 worker 啟動，之後每頁預覽只花幾十毫秒。兩者都不會在開啟階段就把 20 MiB 走過一遍。上表是唯一的數字來源，這裡不另外轉述。
- **記憶體隨檔案大小走。** 數量級是「檔案位元組的幾倍」：原始 buffer、解析後的物件、以及匯出時的輸出 buffer 同時在場。實際數字見上表，§9.2 把它寫成估算式，並把兩個引擎同時持有文件的情形算進去。
- **增量更新省下的是匯出。** 差距隨檔案變大而拉開，因為重寫要重新序列化每一個物件，增量更新只寫新增的那幾個；數字見下面的「匯出方式比較」。
- **Firefox 的 PDFium 算圖明顯慢於另兩個瀏覽器**，倍數見上表；`pdfjs-dist` 在 Firefox 沒有這個落差。這是不選 PDFium 的第二個理由，雖然不是決定性的那個。

#### 匯出方式比較

| 文件 | 瀏覽器 | 完整重寫 ms | 增量更新 ms |
| --- | --- | ---: | ---: |
| `reference-20-page` | chromium | 28 | 10 |
| `reference-20-page` | firefox | 29 | 11 |
| `reference-20-page` | webkit | 24 | 11 |
| `large-56-page` | chromium | 65 | 14 |
| `large-56-page` | firefox | 82 | 17 |
| `large-56-page` | webkit | 47 | 15 |

## 6. 保真與座標契約

### 6.1 顯示空間

使用者能指的只有畫面上那一頁，所以所有座標都以「顯示空間」表示：以頁面的可見框（有 `/CropBox` 時用它，否則用 `/MediaBox`）為界，套用該頁自己的 `/Rotate` 之後，左上角為原點、向右向下為正。四分之一轉的頁面長寬互換。

簽名位置以「顯示空間中的正規化矩形」保存：`x`、`y`、`width`、`height` 都是對應邊長的比例。這樣同一份放置在任何縮放倍率下都成立，也不會因為換算成點而在來回編輯中漂移。

`app/features/tools/pdf-signature/domain/reference.ts` 匯出這組換算：`pdfDisplayBox`、`pdfDisplayPointToUserSpace`、`pdfUserSpaceToDisplayPoint`、`clampNormalizedRect` 與 `pdfSignaturePlacement`。T25 直接引用，不要重寫。

### 6.2 放置與匯出規則

- 影像以自己的左下角為錨點放置，旋轉角度等於該頁的 `/Rotate`，繞錨點旋轉。顯示空間的矩形左下角換算成使用者空間，就是錨點。
- 寬高直接取自正規化矩形乘上顯示邊長，不做等比修正。簽名影像的比例由使用者在預覽上決定，工具不替他改。
- 矩形超出頁面時保留使用者選的尺寸、把位置移回頁內；只有比整頁還大的矩形才縮尺寸。
- 簽名影像是帶 alpha 的 PNG，透明區必須維持透明，不得先合成到白底再貼上。
- 未加密文件的匯出採增量更新：原始位元組原封不動保留，只在檔尾追加新增的物件與新的交叉參考。沒有簽名的頁面因此仍是原製作端寫出來的位元組。加密文件不適用，理由見 §7.1。
- 頁面尺寸、`/Rotate`、`/CropBox` 與頁數在匯出前後必須相同；工具不「順手」正規化任何一項。

### 6.3 讀回結果

每次匯出都用 `pdfjs-dist` 重新開啟並算圖，與原檔同一頁的算圖逐像素比較。第一頁與最後一頁都簽，下表列第一頁。各欄的定義：

- **覆蓋率**：放置矩形內被簽名墨色覆蓋的像素比例。矩形四邊各內縮 5% 才開始算，因為圓頭筆畫本來就不會碰到角落。
- **透出率**：矩形內與原頁完全相同的像素比例。透明區真的透出來時這個數字才會高；把簽名壓平到不透明底色上會讓它趨近 0。
- **越界墨點**：矩形外變化成簽名墨色的像素數。
- **越界變動像素**：矩形外任何有變化的像素數。這裡的「外」從矩形邊界再往外 4 pt 起算——簽名自己的邊緣在算圖時會反鋸齒地跨出邊界不到一個像素，那不是位置錯誤。這個容差隨每一次量測寫進 JSON 的 `placementMarginPt`。
- **未簽頁變動像素**：沒有被簽名的那一頁（第 2 頁）整頁的變化量。

| 文件 | 匯出方式 | 瀏覽器 | 覆蓋率 | 透出率 | 越界墨點 | 越界變動像素 | 未簽頁變動像素 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| `reference-20-page` | 增量更新 | chromium | 0.141 | 0.839 | 0 | 0 | 0 |
| `reference-20-page` | 增量更新 | firefox | 0.141 | 0.839 | 0 | 0 | 0 |
| `reference-20-page` | 增量更新 | webkit | 0.142 | 0.839 | 0 | 0 | 0 |
| `rotated-pages` | 增量更新 | chromium | 0.141 | 0.839 | 0 | 0 | 0 |
| `rotated-pages` | 增量更新 | firefox | 0.141 | 0.839 | 0 | 0 | 0 |
| `rotated-pages` | 增量更新 | webkit | 0.142 | 0.839 | 0 | 0 | 0 |
| `offset-crop-box` | 增量更新 | chromium | 0.137 | 0.844 | 0 | 0 | 0 |
| `offset-crop-box` | 增量更新 | firefox | 0.137 | 0.843 | 0 | 0 | 0 |
| `offset-crop-box` | 增量更新 | webkit | 0.138 | 0.844 | 0 | 0 | 0 |
| `object-stream` | 增量更新 | chromium | 0.141 | 0.839 | 0 | 0 | 0 |
| `object-stream` | 增量更新 | firefox | 0.141 | 0.839 | 0 | 0 | 0 |
| `object-stream` | 增量更新 | webkit | 0.142 | 0.839 | 0 | 0 | 0 |
| `large-56-page` | 增量更新 | chromium | 0.141 | 0.839 | 0 | 0 | 0 |
| `large-56-page` | 增量更新 | firefox | 0.141 | 0.839 | 0 | 0 | 0 |
| `large-56-page` | 增量更新 | webkit | 0.142 | 0.839 | 0 | 0 | 0 |
| `page-cap-120` | 增量更新 | chromium | 0.141 | 0.839 | 0 | 0 | 0 |
| `page-cap-120` | 增量更新 | firefox | 0.141 | 0.839 | 0 | 0 | 0 |
| `page-cap-120` | 增量更新 | webkit | 0.142 | 0.839 | 0 | 0 | 0 |
| `encrypted-rc4-128` | 完整重寫 | chromium | 0.141 | 0.839 | 0 | 0 | 0 |
| `encrypted-rc4-128` | 完整重寫 | firefox | 0.141 | 0.839 | 0 | 0 | 0 |
| `encrypted-rc4-128` | 完整重寫 | webkit | 0.142 | 0.839 | 0 | 0 | 0 |
| `encrypted-aes-128` | 完整重寫 | chromium | 0.141 | 0.839 | 0 | 0 | 0 |
| `encrypted-aes-128` | 完整重寫 | firefox | 0.141 | 0.839 | 0 | 0 | 0 |
| `encrypted-aes-128` | 完整重寫 | webkit | 0.142 | 0.839 | 0 | 0 | 0 |
| `owner-password-restricted` | 完整重寫 | chromium | 0.141 | 0.839 | 0 | 0 | 0 |
| `owner-password-restricted` | 完整重寫 | firefox | 0.141 | 0.839 | 0 | 0 | 0 |
| `owner-password-restricted` | 完整重寫 | webkit | 0.142 | 0.839 | 0 | 0 | 0 |
| `active-content` | 增量更新 | chromium | 0.141 | 0.839 | 0 | 0 | 0 |
| `active-content` | 增量更新 | firefox | 0.141 | 0.839 | 0 | 0 | 0 |
| `active-content` | 增量更新 | webkit | 0.142 | 0.839 | 0 | 0 | 0 |

每份文件都用 §7.1 指定的匯出方式：未加密用增量更新，加密用完整重寫。三個瀏覽器、九份文件、七種結構，含 `/Rotate 270` 的最後一頁與帶偏移 `/CropBox` 的頁面，越界像素一律為 0，未簽頁面一像素未動。透出率 0.84 表示矩形裡有 84% 的像素和原頁一模一樣，透明度沒有被壓平。覆蓋率在 0.137 至 0.142 之間的差異來自各瀏覽器算圖時的反鋸齒，不是位置差異。

用錯匯出方式的樣子在 §7.1：同樣這幾份加密文件改用增量更新，透出率掉到 0.40，越界變動像素從 0 變成 77,161。

### 6.4 為什麼是內容串流而不是標註

規格 §12.12 的用語是 applies normalized annotations。這一版把簽名畫進頁面的內容串流，不建立 Stamp 標註，理由是結果的穩定性：標註在任何檢視器裡都可以被選取、隱藏、移動或刪除，同一份檔案在不同人手上會長得不一樣；畫進內容串流之後，簽名和頁面上其他圖形一樣，看到什麼就是什麼。

代價是不可逆：使用者只能在下載前調整，下載後要改就得重簽。規格用語中的 normalized 由 §6.1 的正規化矩形滿足——保存下來的是比例，不是某一次縮放下的點座標。

若之後需要可移除的簽名（例如審閱流程中的暫時標記），那是另一種產品行為，需要重新評估標註的相容性與檢視器差異，不能直接沿用這裡的結論。

### 6.5 簽名影像契約

手繪、輸入文字與匯入透明圖三種形式，在嵌入之前一律先轉成帶 alpha 通道的 PNG，文件裡只會出現影像物件。這條規則同時解掉規格 §12.12 列為風險的字型嵌入：版本一不把任何字型寫進使用者的文件，也就沒有字型授權、子集化與缺字的問題。

- 格式 `image/png`，必須帶 alpha 通道；不得先合成白底再嵌入。
- 以放置尺寸（點）的兩倍算圖，讓 2× 顯示器上的簽名不糊。
- 單邊上限 2,000 像素；超過只會增加檔案大小，不會增加看得見的細節。
- 影像的長寬比由使用者在預覽上決定，工具不代為修正。

規格 §12.12 另外提到縮寫與日期。它們不是別的機制，是同一條路徑上的不同內容：一樣先轉成帶 alpha 的 PNG，一樣用 §6.1 的正規化矩形定位。日期的值由使用者自己輸入或選擇，工具不自動填入裝置時間——那會讓人以為時間經過驗證，而 CONTEXT.md 的「裝置時間」本來就只是裝置時鐘。

## 7. 密碼、權限、主動內容與損毀檔策略

### 7.1 密碼與匯出方式

密碼是獨立宣告的能力：工具在開檔前就知道自己能不能處理加密檔，使用者輸入的密碼只在本機用來解檔，不進入任何請求、記錄或保存。這一版不重新加密輸出，也不嘗試破解任何密碼。

加密文件不能用增量更新匯出。增量更新把變更接在原始位元組後面，原本的 `/Encrypt` 留在較舊的 trailer 裡，而新加的物件是明文寫入的（在 Node 上重現同一條路徑，追加段落裡的影像串流開頭是 `789c`，也就是未加密的 zlib 標頭）；讀取端如何看待這一段取決於它怎麼解析 trailer 鏈。

實測的結果是簽名有畫上去，但頁面不再從它的透明區透出來，而且損壞不只發生在簽名上：整頁有 77,161 個像素（約 6.8%）在放置矩形之外也變了。三個瀏覽器、三份加密文件，數字完全一致。

| 文件 | 瀏覽器 | 匯出方式 | 覆蓋率 | 透出率 | 越界變動像素 |
| --- | --- | --- | ---: | ---: | ---: |
| `encrypted-rc4-128` | chromium | 完整重寫 | 0.141 | 0.839 | 0 |
| `encrypted-rc4-128` | chromium | 增量更新 | 0.14 | 0.401 | 77161 |
| `encrypted-rc4-128` | firefox | 完整重寫 | 0.141 | 0.839 | 0 |
| `encrypted-rc4-128` | firefox | 增量更新 | 0.14 | 0.401 | 77161 |
| `encrypted-rc4-128` | webkit | 完整重寫 | 0.142 | 0.839 | 0 |
| `encrypted-rc4-128` | webkit | 增量更新 | 0.141 | 0.402 | 77161 |
| `encrypted-aes-128` | chromium | 完整重寫 | 0.141 | 0.839 | 0 |
| `encrypted-aes-128` | chromium | 增量更新 | 0.14 | 0.401 | 77161 |
| `encrypted-aes-128` | firefox | 完整重寫 | 0.141 | 0.839 | 0 |
| `encrypted-aes-128` | firefox | 增量更新 | 0.14 | 0.401 | 77161 |
| `encrypted-aes-128` | webkit | 完整重寫 | 0.142 | 0.839 | 0 |
| `encrypted-aes-128` | webkit | 增量更新 | 0.141 | 0.402 | 77161 |
| `owner-password-restricted` | chromium | 完整重寫 | 0.141 | 0.839 | 0 |
| `owner-password-restricted` | chromium | 增量更新 | 0.14 | 0.401 | 77161 |
| `owner-password-restricted` | firefox | 完整重寫 | 0.141 | 0.839 | 0 |
| `owner-password-restricted` | firefox | 增量更新 | 0.14 | 0.401 | 77161 |
| `owner-password-restricted` | webkit | 完整重寫 | 0.142 | 0.839 | 0 |
| `owner-password-restricted` | webkit | 增量更新 | 0.141 | 0.402 | 77161 |

因此：**未加密文件用增量更新，加密文件用完整重寫。** 完整重寫產生的是一份未加密文件，這改變了原檔的保護狀態，必須在下載前用 §10.1 的 `decrypted-export` 說清楚。

### 7.2 權限

`owner-password-restricted` 的使用者密碼是空字串、擁有者密碼另外設定，權限位元允許列印與複製、不允許修改內容與修改標註。這種檔案在任何檢視器裡都直接打開，不會要求輸入任何東西。

這份文件在 §4 與 §6.3 是「開得起來、簽得上去、讀得回來」，在這裡卻是「必須拒絕」。兩者不衝突：矩陣量的是引擎做不做得到，這一節寫的是產品要不要做。量測必須先證明做得到，否則「選擇不做」只是掩蓋做不到。

預覽引擎讀得到權限位元（`pdfjs-dist` 的 `getPermissions()` 在三個瀏覽器都回報允許 4、不含 8 與 32），因此工具在開檔後就知道作者不允許修改，並以 `modification_not_permitted` 說明並停止。

這是產品決定，不是技術限制：PDF 的權限位元對任何持有檔案的程式都只是宣告，繞過它不需要任何技巧。工具選擇尊重它，因為使用者拿到的是別人給的檔案，作者已經明說不希望它被改。

寫入引擎的行為不同：`pdf-lib` 家族對任何帶 `/Encrypt` 的文件都拒絕開啟，即使使用者密碼是空的。要開這種檔案必須明確傳入空密碼。這一步不能省略，否則一份「使用者眼中沒有密碼」的檔案會被回報成無法處理。

### 7.3 主動內容

PDF 可以在文件層、頁面層與標註上宣告動作：JavaScript、`/OpenAction`、`/AA`、URI 連結與 Launch。簽名工具一個都不執行，也不代替文件發出任何請求。

`active-content` 這份文件同時宣告了以上五種。四個候選在三個瀏覽器都把它當成普通的一頁文件開啟，每一次執行都明確回報文件裡的指令碼沒有被執行，也沒有任何一次發出預期以外的請求。

「沒有發出請求」是從瀏覽器自己的 request 事件（context 層，含 worker、任何來源）逐筆記錄的，不是從量測伺服器的存取記錄推出來的——那份記錄只看得到它被要求提供的路徑，而文件裡的連結動作指向另一個 origin，伺服器永遠不會知道。兩份清單互相對照：伺服器提供過的每一個路徑都必須同時出現在瀏覽器的事件裡，否則就表示事件漏看了東西，上面那句話也就沒有根據。唯一對不上的是 `/favicon.ico`——Chromium 與 Firefox 會在頁面的請求流程之外自己去要它。這一筆照實記錄而不是過濾掉，因為過濾會把「還有第二種漏看」一起掩蓋；測試因此要求每次執行對不上的只能是它。

實作上這由 `pdfSignatureParserPolicy` 固定：不執行指令碼、不跟隨文件動作、不取用外部資源、不啟用 scripting、不使用 `eval` 快徑、不查詢本機字型、不算圖 XFA。

### 7.4 損毀檔

損毀檔可能被寫入端接受。`@cantoo/pdf-lib` 從截斷的 `truncated` 重建出 12 頁並匯出 12.4 MiB，而 `pdfjs-dist`、`pdf-lib` 與 PDFium 都判定該檔無效；那份輸出用 `pdfjs-dist` 讀回時是 `InvalidPDFException`。因此：預覽引擎的判定優先，預覽引擎開不起來的文件不進入工作區；而且每一次匯出在成為下載之前，都要用預覽引擎重新開啟一次，讀不回來就以 `export_unreadable` 回報並丟棄結果。

`broken-xref` 是可以救的那一類：四個候選都從物件重建出正確的 2 頁。這種檔案照常處理，不需要特別提示。

繞過加密會靜默丟失簽名。`pdf-lib` 對加密檔的官方建議是 `ignoreEncryption: true`。實測三個瀏覽器都「成功」匯出，但用密碼讀回時頁面上沒有簽名（覆蓋率 0、頁面與原檔完全相同）：新寫入的物件是明文，讀取端卻仍依 `/Encrypt` 解密它們。使用者會拿到一份看起來正常、實際沒簽到的檔案。`ignoreEncryption` 因此不得使用。

### 7.5 失敗詞彙

`recoverable` 表示同一份輸入在使用者採取建議動作後仍有機會成功。

| 代碼 | 觸發 | 可恢復 | 建議動作 |
| --- | --- | --- | --- |
| `unsupported_browser` | 瀏覽器缺少 WebAssembly、Worker 或必要的 Canvas 能力 | 否 | `use-supported-browser` |
| `not_a_pdf` | 位元組開頭不是 PDF 標頭，或副檔名與內容不符 | 是 | `change-input` |
| `damaged_pdf` | 預覽引擎判定結構無效，包含 `truncated` 這一類截斷檔 | 是 | `change-input` |
| `password_required` | 文件有標準安全處理器，尚未輸入密碼 | 是 | `enter-password` |
| `password_rejected` | 輸入的密碼無法解開文件 | 是 | `enter-password` |
| `unsupported_encryption` | 加密方式不在支援範圍，例如 AES-256／修訂 6 | 是 | `change-input` |
| `modification_not_permitted` | 權限位元不允許修改內容或修改標註 | 是 | `change-input` |
| `too_many_pages` | 頁數超過 `maxPages` | 是 | `change-input` |
| `too_large` | 位元組數超過 `maxBytes` | 是 | `change-input` |
| `insufficient_memory` | 依 §9.2 的估算式，工作集超出裝置可用記憶體 | 是 | `change-input` |
| `export_failed` | 寫入或序列化過程失敗 | 是 | `retry` |
| `export_unreadable` | 匯出結果無法以預覽引擎重新開啟 | 是 | `change-input` |
| `cancelled` | 使用者在 `read`、`parse`、`preview`、`apply` 或 `write` 任一階段取消 | 是 | `retry` |

階段名稱沿用規格 §12.12 的 `read`、`parse`、`preview`、`apply`、`write`。解析、預覽與匯出都必須可取消；取消後不交付部分輸出，也不保留半份匯出。進度以階段加上「第幾頁／共幾頁」回報，永遠不帶檔名或頁面內容。

`enter-password` 是共用的 `EngineError.suggestedAction` 新增的選項，這是這個 ticket 唯一動到的平台檔案。既有的三個選項沒有一個說得通：使用者不是要重試（`retry`），也不是要換一個檔案（`change-input`），而是手上就有工具需要的東西。這個聯集是加上去的，沒有任何既有分支是窮盡比對，因此不影響其他工具；但它確實是一個平台層面的決定，列在這裡以便 review。

## 8. Go／No-Go 判定

| 條件 | 判定 | 依據 |
| --- | --- | --- |
| `licence` | pass | 選定的兩個引擎皆為 MIT 或 Apache-2.0，授權檔與散布內容一致（§2.1、§2.3）。 |
| `supply-chain` | pass | 版本以 registry integrity 釘選，執行期不連 CDN；授權不相符的候選已排除（§2.3）。 |
| `maintenance` | pass | `pdfjs-dist` 與 `@cantoo/pdf-lib` 都在 2026 年持續發布；停更的 `pdf-lib@1.17.1` 未入選（§2.1）。 |
| `browser-support` | pass | 48 格開啟矩陣與 12 格保護檔矩陣在三個瀏覽器判定完全一致（§4.1、§4.2）。 |
| `structure-coverage` | pass | 傳統交叉參考表、交叉參考串流、頁面旋轉、偏移頁框、兩種加密與帶動作的文件都能開啟、簽名並讀回（§4.1、§6.3）。 |
| `password-handling` | pass | 兩種標準安全處理器在三個瀏覽器都能以密碼開啟並正確匯出，權限位元讀得到（§4.2、§7.1、§7.2）。 |
| `active-content` | pass | 宣告了指令碼、文件動作、頁面動作、URI 連結與 Launch 的文件被當成普通文件開啟；沒有一次執行，也沒有一次多發請求（§7.3）。 |
| `damaged-input` | conditional | 寫入端會接受截斷檔並產生讀不回來的輸出；必須以預覽引擎把關並在下載前讀回（§7.4）。 |
| `output-fidelity` | pass | 依 §7.1 的匯出方式，越界像素與未簽頁變動像素在三個瀏覽器皆為 0，頁數、尺寸與旋轉保持不變（§6.3）。 |
| `performance` | pass | 首頁預覽與匯出都低於 §9.2 的 3 秒與 15 秒預算兩個數量級，數字見 §5 的表。 |
| `memory-headroom` | conditional | 只有 Chromium 提供記憶體 API，行動裝置未實測；工作集估算式見 §9.2（§5、§12）。 |
| `privacy` | pass | 引擎全部在本機執行，不需要任何伺服器端點；測試素材與量測皆不含使用者檔案（§1、§12）。 |

沒有任何一項 fail，結論為 **go**：PDF 手寫簽名可以在瀏覽器本機實作。兩項 conditional 不是對選型的保留，而是對做法的要求，已寫入 §9 的交接清單。

## 9. 選定方案與交接

### 9.1 選定

**預覽引擎：`pdfjs-dist@6.3.289`。** 它是四個候選裡唯一由瀏覽器廠商維護、授權完全乾淨、又能同時算圖與判斷加密狀態的。體積比 PDFium 小 4 倍，Firefox 上也沒有算圖落差。它同時是把關者：文件能不能進工作區、匯出能不能下載，都以它的判定為準。

**寫入引擎：`@cantoo/pdf-lib@2.9.2`。** 它是唯一能寫入又能以密碼開啟加密檔的候選，並且提供增量更新，讓沒有簽名的頁面維持原始位元組。它的上游 `pdf-lib@1.17.1` 自 2021 年未再發布，且沒有密碼支援，因此只作為對照組。

**匯出方式依文件是否加密而不同。** 未加密文件用增量更新：原始位元組保留，變更追加在檔尾。加密文件用完整重寫，因為增量更新會留下明文物件配上舊 trailer 的 `/Encrypt`，讀回時簽名的透明度會消失（§7.1）。完整重寫的輸出是未加密文件，必須在下載前說明。

**下載前必須讀回。** 每一份匯出都用預覽引擎重新開啟，失敗即 `export_unreadable`，不交付檔案。

兩個引擎都是 route-lazy 與 worker-lazy：Landing Page 與輕量工具不得載入其中任何一個。合計 brotli 傳輸約 696 KiB。

### 9.2 上限與預算

| 參數 | 值 | 說明 |
| --- | ---: | --- |
| `maxPages` | 100 | 規格 §12.12 的預設安全上限；`page-cap-120` 證明超過此數的文件本身仍可處理，上限是為了記憶體與可用性，不是能力邊界。 |
| `maxBytes` | 52428800 | 50 MiB。依下列估算式對應約 366 MiB 工作集，接近圖片工具採用的 384 MiB 預算。 |
| `previewScale` | 1.5 | 頁面預覽的算圖倍率，也是矩陣量測時使用的倍率。 |
| `firstPagePreviewMs` | 3000 | 規格 §12.12 的桌面首頁預覽預算；實測最慢 27 毫秒。 |
| `exportMs` | 15000 | 規格 §12.12 的桌面匯出預算；實測最慢 84 毫秒。 |
| `baseBytes` | 16777216 | 16 MiB：兩個引擎自己的程式與執行期，取 Chromium 上小文件的量測值相加（`pdfjs-dist` 約 11 MiB、`cantoo-pdf-lib` 約 5 MiB）。 |
| `bytesPerInputByte` | 3.5 | 每一位元組輸入的工作集係數。係數疊在 `baseBytes` 之上，對應的實測值是「（量到的記憶體 − `baseBytes`）÷ 檔案位元組」；選定兩個引擎在 Chromium 上這個值落在 1.25 至 2.81 之間，取寬裕的上界。 |
| `maxSignatureEdgePixels` | 2000 | 簽名影像的單邊像素上限（§6.5）。 |

工作集估算式為 `baseBytes + 檔案位元組 × bytesPerInputByte × 2`，乘以 2 是因為放置簽名時預覽引擎與寫入引擎同時持有同一份文件。`estimatePdfWorkingSetBytes()` 由 domain 模組匯出，供 `insufficient_memory` 在解析前判斷。

裝置能力較低時只能下修，不能上修；下修後的數字就是使用者看到的數字。

### 9.3 T25 交接清單

1. 從 `reference.ts` 取用 `pdfSignatureSelection`、`pdfSignatureLimits`、`pdfSignatureBudgets`、`pdfSignatureFailureCodes` 與 `pdfSignatureError`，不要另訂一套。
2. 座標一律用 `pdfSignaturePlacement` 與兩個方向的換算函式；正規化矩形是唯一被保存的位置格式。
3. 兩個引擎都放在 Worker，主執行緒不解析也不算圖；`AbortSignal`、`cancel` 與 `dispose` 冪等，取消即終止 Worker。
4. 開檔順序：位元組上限、頁數上限與 `estimatePdfWorkingSetBytes()` → 預覽引擎開啟（判斷加密、權限與結構）→ 需要密碼時取得密碼 → 寫入引擎開啟，加密文件必須明確傳入密碼，使用者密碼為空時傳空字串。
5. 匯出順序：套用 → 依 `pdfSignatureExportMode()` 選增量更新或完整重寫 → 預覽引擎讀回 → 才產生 Blob URL 與下載。
6. 錯誤、記錄與進度都不得帶入檔名、頁面內容或密碼。
7. 解密後匯出的檔案不再有原本的密碼保護，介面必須在下載前說明。
8. 使用者主動保存的簽名是本機資產（ADR-0007），不進入雲端偏好。規格 §12.12 要求的明確保存、刪除、可安全的匯出入與儲存用量，由既有的 `app/features/shell/local-assets/` 提供（`repository.ts` 的配額與用量、`transfer.ts` 的匯出入），不要另建一套。
9. 三種簽名形式在嵌入前都轉成帶 alpha 的 PNG（§6.5）；不要為了「輸入文字」而嵌入字型。
10. 權限位元不允許修改時以 `modification_not_permitted` 停止，不要當成損毀檔（§7.2）。
11. 解析器行為沿用 `pdfSignatureParserPolicy`，七個開關都必須維持關閉（§7.3）。

### 9.4 T26 可沿用的部分

Word to PDF 的可行性驗證（#28）可以直接沿用這裡的：授權與供應鏈判準（§2）、以程式產生測試素材並以 SHA-256 釘選的作法（§3）、三瀏覽器矩陣與判定用語（§4）、`performance.measureUserAgentSpecificMemory()` 只在 Chromium 可用的限制（§5），以及「輸出必須被獨立讀回才算成功」這條規則（§7）。若 T26 的產出也是 PDF，讀回同樣用 `pdfjs-dist`。

## 10. 產品文案

### 10.1 產品文案

| 用途 | 繁體中文 | English |
| --- | --- | --- |
| `not-a-digital-signature` | 這個工具把你的手寫簽名放到 PDF 頁面上，它不是憑證式數位簽章，也不保證任何法律效力。 | This tool places your handwriting onto a PDF page. It is not a certificate-based digital signature, and it guarantees no legal effect. |
| `no-identity-verification` | 工具不會驗證簽署人身分，也不會留下任何可供第三方查核的紀錄。 | The tool does not check who signed, and it leaves no record a third party could audit. |
| `local-processing` | PDF、頁面預覽、簽名筆跡與輸出檔都只在你的裝置上處理，不會送到伺服器或第三方。 | The PDF, its page previews, your signature strokes and the exported file are handled only on your device, never sent to a server or a third party. |
| `saved-signature-is-local` | 只有在你主動保存時，簽名才會留在這台裝置上；它屬於工具內容，不會跟著帳號同步。 | A signature stays on this device only when you choose to save it; it is tool content and never syncs with an account. |
| `password-stays-on-device` | 開啟密碼保護的 PDF 時，密碼只在這台裝置上用來解開檔案，不會被傳送或保存。 | To open a password-protected PDF, the password is used on this device only to unlock the file; it is never sent or stored. |
| `decrypted-export` | 為密碼保護的 PDF 加上簽名後，下載到的檔案不再帶有原本的開啟密碼，請自行決定要不要重新保護。 | Once a password-protected PDF is signed, the file you download no longer carries its original open password; protecting it again is your call. |
| `original-pages-untouched` | 輸出會保留原本的頁面尺寸、旋轉與你沒有簽名的頁面內容，簽名只加在你放置的位置上。 | The export keeps the original page size, rotation and every page you did not sign; the signature is added only where you placed it. |
| `damaged-file-refused` | 檔案結構損壞時，工具會直接說明無法處理，不會輸出一份打不開的 PDF。 | When a file's structure is damaged, the tool says so instead of exporting a PDF that nothing can open. |

這八句在工具頁、SEO 描述與說明區塊之間可以重新排列，但不得改寫。前兩句必須在使用者開始放置簽名之前就看得見，不能只放在頁尾；`decrypted-export` 必須在下載加密文件的簽名結果之前出現。

### 10.2 禁止用語

工具頁、metadata、結構化資料與任何說明文字中不得出現：具法律效力、法律效力保證、等同數位簽章、電子簽章認證、身分已驗證、經過公證、legally binding、legally valid、certified signature、verified identity。

這些詞會把「把圖蓋上去」說成「這份文件因此生效」，那是這個工具做不到也不該暗示的事。CONTEXT.md 也把「PDF 數位簽章」「電子簽章」「線上簽署」列為避免用語。

## 11. 一手來源

查閱日期：2026-09-10。

- [ISO 32000-1:2008（Adobe 提供的免費版本）](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)：交叉參考表與串流（§7.5.8）、物件串流、頁框與 `/Rotate`、動作與 `/OpenAction`（§12.6），以及標準安全處理器的演算法 2 至 5 與權限位元表 22（§7.6.3），是 fixtures 的依據。
- [ISO 32000-2](https://www.iso.org/standard/75839.html)：PDF 2.0 的現行版本，AES-256／修訂 6 定義於此；這一版未實作。
- [pdf.js](https://github.com/mozilla/pdf.js)：預覽引擎的原始碼與授權。
- [@cantoo/pdf-lib](https://github.com/cantoo-scribe/pdf-lib)：寫入引擎的原始碼、授權與增量更新介面。
- [pdf-lib](https://github.com/Hopding/pdf-lib)：上游版本與 `ignoreEncryption` 的行為來源。
- [@hyzyla/pdfium](https://github.com/hyzyla/pdfium)：授權宣告與 `dist/pdfium.wasm` 的來源。
- [MDN：measureUserAgentSpecificMemory](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory)：記憶體取樣的可用範圍與跨來源隔離要求。

## 12. 驗證範圍與限制

測試素材全部由程式合成，沒有任何真實 PDF、簽名或使用者檔案。合成文件涵蓋的是結構，不是內容多樣性：沒有內嵌字型的文字頁、沒有表單欄位、沒有既有註解、沒有標籤結構，也沒有 PDF/A 中繼資料。這些在 T25 實作時仍可能出現在使用者的檔案裡，需要各自補上測試。

加密只涵蓋 RC4 128 bit／修訂 3 與 AES-128／修訂 4，也就是 ISO 32000-1 定義的範圍。ISO 32000-2 的 AES-256／修訂 6 沒有實作也沒有量測，因此它在失敗詞彙裡對應 `unsupported_encryption`，而不是一個已知可行的路徑。

主動內容只驗證了文件實際宣告的五種：文件層 JavaScript、`/OpenAction`、頁面 `/AA`、URI 連結與 Launch。嵌入檔案、多媒體、3D 與表單計算指令碼沒有涵蓋。「沒有執行」這件事由頁面上的旗標與伺服器收到的路徑清單共同判定，不是由閱讀函式庫原始碼得出。

權限位元的處理是產品選擇。PDF 的權限對任何持有檔案的程式都只是宣告，本身沒有強制力；工具尊重它，不代表別的工具會。

量測在一台 macOS arm64（10 核）上進行，Chromium 151、Firefox 153、WebKit 26.5。桌面數字不能代替參考手機；行動裝置的記憶體上限與算圖速度尚未實測，`maxBytes` 對應的估算工作集在低階手機上有風險。記憶體只有 Chromium 可量，另外兩個瀏覽器的欄位是「沒有值」而不是「沒有用到記憶體」。

§7.1 的結論建立在可觀察的行為上：追加段落裡的物件是明文寫入的（位元組可查），讀回的頁面確實壞了（像素可查）。至於讀取端到底在哪一步做錯，沒有追進 `pdfjs-dist` 或 `@cantoo/pdf-lib` 的內部；那不影響「不要在加密文件上用增量更新」這條規則，但也表示這裡沒有可以回報給上游的診斷。

保真判定以算圖後的像素比較為準，不是位元組比較。它能證明簽名落在該落的地方、頁面其餘部分沒有變化，但不能證明兩份檔案的內部結構完全等價。§6.3 的「越界」不含緊貼矩形邊界的 4 pt，理由與量法都寫在該節。

這份紀錄不授權發布任何工具。T25 仍須完成自己的功能、無障礙、跨瀏覽器、效能與網路邊界驗收。

## 13. TDD 紀錄

1. `tests/pdf-signature-reference.test.ts` 先因 `app/features/tools/pdf-signature/domain/reference.ts` 不存在而整份失敗，之後才建立模組。
2. 合成加密檔先以 `pdfjs-dist` 在 Node 驗證：沒有密碼時得到 `PasswordException`、給了密碼可開啟並取得正確頁數，確認演算法 2 至 5 的實作正確，才進入瀏覽器矩陣。
3. 第一版 harness 的越界墨點在 `reference-20-page` 上是 14,458 個假陽性——頁面的亂數像素本來就有接近洋紅的顏色。改成「必須同時是變化過的像素」之後歸零。
4. 第一版的「透出率」以固定的頁面底色判斷，`offset-crop-box` 因此得到 0：那份文件的色帶被 `/CropBox` 裁掉了。改成「與原頁相同的像素比例」後對任何底色都成立。
5. 旋轉頁的驗證原本只簽第一頁，而 `rotated-pages` 的第一頁 `/Rotate` 是 0，等於沒驗到。改成同時簽第一頁與最後一頁（`/Rotate 270`）後才真正覆蓋。
6. `pdf-lib` 的 `ignoreEncryption` 一開始只驗證「讀不回來」，換成帶密碼讀回之後才看見真正的行為：讀得回來，但簽名不見了。
7. 座標換算先在單元測試以四個旋轉角度的來回轉換與偏移頁框固定，再由瀏覽器讀回結果證實。
8. 第一版只在未加密文件上量了增量更新，卻同時宣告「匯出採增量更新」與「加密檔匯出後未加密」——兩者不可能同時成立。補量加密檔的增量更新後，數字指出透出率從 0.84 掉到 0.40，才有了 §7.1 依加密與否分流的規則。
9. 座標換算原本在 harness 裡另有一份複本，量到的證據嚴格說只屬於那份複本。抽成共用模組並加上兩份實作逐案比對的測試之後，§6.3 的證據才真的屬於 T25 會引用的函式。
10. 交叉參考串流的免費項目原本以 `/W [1 4 1]` 寫入，世代編號 65535 被截成 255。改成 `/W [1 4 2]` 後才符合 ISO 32000-1 §7.5.8.3。

## 14. Standards／Spec 審查

固定點為 `develop` 上的 `3241231`。Standards 與 Spec 兩軸由獨立審查者檢查，結果與後續修正記於 Pull Request。
