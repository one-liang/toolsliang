# Word to PDF 本機轉換可行性驗證

Issue：#28（T26）。版本識別碼：`word-to-pdf-2026-09-12`。這份紀錄判斷 DOCX 能不能在瀏覽器本機可靠轉成 PDF，結論是 **no-go**，決策寫在 ADR-0017。

## 1. 範圍與方法

規格 §12.13 要求在允許規劃公開工具之前，先用一組至少三十份、涵蓋純文字、表格、圖片、頁首頁尾、分頁、清單、中英文字型、方程式、註腳、追蹤修訂與不支援巨集的文件，在 Chromium、Firefox 與 WebKit 上量出可重複的結果。這份紀錄就是那次量測：四十二份程式產生的文件、四條轉換管線、三個瀏覽器，共 330 次執行。

依 ADR-0001，DOCX、內嵌圖片、字型資訊與 PDF 結果都不離開使用者裝置；任何要求上傳文件或在伺服器轉檔的候選都不列入評估。量測本身遵守同一條界線：測試文件全部由 `scripts/word-to-pdf/fixtures.mjs` 依 ECMA-376 以程式產生，沒有任何真實 Word 文件，唯一的對外請求是釘選版本的套件下載。

量測由維運者執行：

```bash
node scripts/evaluate-word-to-pdf.mjs [--browsers=chromium,firefox,webkit] [--pipelines=…] [--fixtures=…]
```

它把釘選版本的 npm tarball 下載到已忽略版本控制的 `artifacts/`、以 registry 發布的 `sha512` integrity 逐檔比對，只解出 harness 會載入的檔案，從 localhost 提供，再以 Playwright 依序驅動三個瀏覽器。每一次「管線 × 文件」都在自己的分頁執行，量完即寫檔；結果寫入 `docs/research/data/011-word-to-pdf-measurements.json` 並隨版本控制提交。CI 只讀這份 JSON，不下載套件也不開瀏覽器。

被量測的單位是**管線**而不是函式庫。npm 上沒有任何一個套件能自己讀 DOCX 又寫 PDF，所以每個候選都是一條鏈：有東西負責解開套件，有東西決定文字落在哪裡，有東西產生檔案。鏈在哪裡斷掉，就是這次的發現。

判定的依據只有兩種：文件自己宣告的內容，以及一個獨立閱讀器在輸出檔裡找到的東西。這份測試集能證明「這句話還在不在」「這張表還是幾列幾欄」「這份 PDF 有沒有文字」，**不能**證明「這一頁長得跟 Word 一樣」——沒有任何一份文件和 Word 的實際排版比對過，紀錄裡也沒有這種宣稱。

`tests/word-to-pdf-reference.test.ts` 讓這份文件、量測 JSON 與 `app/features/tools/word-to-pdf/domain/reference.ts` 三者一致：文件裡的每個判定與數字都必須等於量測檔中的值，模組裡的候選、授權、閘門、禁止面與禁止用語都必須逐字等於文件。

## 2. 候選與授權

### 2.1 量測候選

| 函式庫 | 套件 | 版本 | 階段 | 授權 | 可自行散布 | 授權頁面 |
| --- | --- | --- | --- | --- | --- | --- |
| `jszip` | jszip | 3.10.1 | unzip | MIT | 是 | <https://github.com/Stuk/jszip/blob/main/LICENSE.markdown> |
| `docx-preview` | docx-preview | 0.4.0 | parse、layout、paginate | Apache-2.0 | 是 | <https://github.com/VolodymyrBaydalka/docxjs/blob/master/LICENSE> |
| `mammoth` | mammoth | 1.12.3 | parse | BSD-2-Clause | 是 | <https://github.com/mwilliamson/mammoth.js/blob/master/LICENSE> |
| `html2canvas` | html2canvas | 1.4.1 | rasterise | MIT | 是 | <https://github.com/niklasvh/html2canvas/blob/master/LICENSE> |
| `jspdf` | jspdf | 4.2.1 | write-pdf | MIT | 是 | <https://github.com/parallax/jsPDF/blob/master/LICENSE> |
| `pdfjs-dist` | pdfjs-dist | 6.3.289 | read-pdf | Apache-2.0 | 是 | <https://github.com/mozilla/pdf.js/blob/master/LICENSE> |

沒有任何一個候選同時具備解析、排版、分頁與寫出 PDF 四種能力。能算版面的不會寫檔，能寫檔的不懂 Word，這是這次選型的基本形狀，也是最後判定的來源。

傳輸大小（未壓縮／brotli 品質 5）：`jszip` 95 KiB／27 KiB，`docx-preview` 74 KiB／20 KiB，`mammoth` 622 KiB／126 KiB，`html2canvas` 194 KiB／42 KiB，`jspdf` 410 KiB／121 KiB，`pdfjs-dist` 1,684 KiB／460 KiB。每個檔案的 SHA-256 記在量測檔的 `libraries[].assets`。`pdfjs-dist` 只作為輸出檔的獨立閱讀器，不屬於任何一條會出貨的管線。

### 2.2 量測管線

| 管線 | 輸出 | 組成 | brotli KiB |
| --- | --- | --- | ---: |
| `docx-preview` | `dom` | `jszip` + `docx-preview` | 46 |
| `mammoth` | `dom` | `mammoth` | 126 |
| `docx-preview-raster-pdf` | `pdf` | `jszip` + `docx-preview` + `html2canvas` + `jspdf` | 209 |
| `mammoth-raster-pdf` | `pdf` | `mammoth` + `html2canvas` + `jspdf` | 289 |

兩條 `dom` 管線量的是「文件變成什麼」，那是能逐項檢查保真的地方；兩條 `pdf` 管線量的是「使用者會下載到什麼」。兩條 `pdf` 管線都以同一個點陣化器結尾，因為在不要求使用者自己操作列印對話框的前提下，那是量到的唯一一條可自行散布的路徑。這件事本身就是一項發現，不是實作上的偷懶。

### 2.3 量測前排除

| 候選 | 套件 | 排除理由 | 依據 |
| --- | --- | --- | --- |
| `zetajs` | zetajs@1.2.0 | `runtime-not-redistributed` | npm 上的是 61 KiB 的 JavaScript 繫結，裡面沒有任何 WebAssembly。它驅動的 LibreOffice 建置由 allotropia 另外提供，體積以百 MB 計，授權為 LGPL-3.0 與 MPL-2.0；ADR-0001 要求執行期資產由本站自有來源提供，這個組合做不到。 |
| `pandoc-wasm` | pandoc-wasm@1.1.0 | `copyleft-licence` | GPL-2.0-or-later；本站原始碼不以 GPL 釋出。 |
| `nativedocuments-docx-wasm` | @nativedocuments/docx-wasm@2.2.13-1561490777 | `proprietary-licence` | 套件內附「NATIVE DOCUMENTS SOFTWARE LICENSE AGREEMENT」，明文寫著未取得廠商核發的金鑰即不具任何權利；README 要求 `ND_DEV_ID` 與 `ND_DEV_SECRET`。最後發布於 2019 年。 |
| `onlyoffice-document-editor` | @onlyoffice/document-editor-react@2.2.0 | `requires-server` | 授權是 Apache-2.0，但它是 ONLYOFFICE Document Server 的前端：轉檔在伺服器上發生，那正是 ADR-0001 不允許跨過的界線。 |
| `docx2pdf` | docx2pdf@0.0.4 | `no-browser-build` | 相依 puppeteer-core 與 chrome-aws-lambda，用 Node 驅動無頭瀏覽器轉檔，沒有瀏覽器進入點。 |
| `js-preview-docx` | @js-preview/docx@1.6.4 | `wraps-a-candidate` | 包在 docx-preview 外面的檢視元件。量它等於把 docx-preview 量兩次，再把結果算到包裝層頭上。 |
| `docx` | docx@9.7.1 | `creation-only` | 產生新的 DOCX。它打不開使用者的文件，而那是這個工具的整個輸入端。 |
| `pdfmake` | pdfmake@0.3.11 | `creation-only` | 以自有的文件定義產生 PDF，沒有 DOCX 輸入；它只能當一條鏈的最後一環，而缺的正是前面那一環。 |

### 2.4 供應鏈註記

六個函式庫的授權檔與實際散布內容一致，沒有 T24 在 `@hyzyla/pdfium` 上遇到的那種「宣告的授權沒有涵蓋散布的位元組」的情況。

`jszip` 是雙授權：套件宣告 `(MIT OR GPL-3.0-or-later)`，由使用者自行選擇。本站採用 MIT 那一份，從不主張 GPL 那一份。這件事必須寫下來而不是留在 manifest 裡，因為 manifest 只說了有哪些選項，沒說我們用的是哪一個。

`mammoth` 的授權是 BSD-2-Clause，不在 T24 的允許清單上。它與 BSD-3-Clause 是同一種「只要求標示著作權」的形狀，少的是禁止背書條款，沒有任何一條會妨礙本站從自有來源提供這個檔案，因此把 BSD-2-Clause 加入允許清單。

`html2canvas@1.4.1` 最後發布於 2022-01-22，距離這次量測四年七個月。它是量到的唯一一個可自行散布的點陣化器，也就是說，這條路上唯一沒有人在維護的環節，正好是承重的那一環。T24 曾以 `unmaintained` 為由排除 2016 年停更的 `pdf-annotate.js`；這裡不採同樣的處置，因為 html2canvas 讀的是本站自己產生的 DOM，不是使用者無法複驗的檔案，風險的形狀不同。但它仍是一項保留，記在 §8 的 `maintenance` 閘門上。

版本以 registry 的 `sha512` integrity 釘選，執行期不從任何 CDN 取用。

## 3. 測試集

四十二份文件，全部由 `scripts/word-to-pdf/fixtures.mjs` 依 ECMA-376 Part 1 第五版以程式產生：OPC 容器由 `scripts/word-to-pdf/zip.mjs` 寫出，WordprocessingML 各部件由 `scripts/word-to-pdf/ooxml.mjs` 組出，內嵌的 PNG 也是程式畫的。沒有任何真實文件，因此 `artifacts/` 裡不會有屬於任何人的東西。

「宣告頁數」是文件用自己的標記要求的頁數——明確分頁符號、分節符號、或 Word 存檔時留下的 `w:lastRenderedPageBreak`——不是 Word 排出來的頁數。自然流動決定頁數的文件（`two-column-section`、`keep-together`）不宣告頁數。

| 文件 | 類別 | 預期 | 宣告頁數 | 位元組 | SHA-256 |
| --- | --- | --- | ---: | ---: | --- |
| `plain-paragraphs` | `text` | `convert` | 1 | 3,437 | `2ac9c2cce9b10edb72f25a7aa98b25c7bfcffcb02f0d4b77dd69ea7ad50b9d33` |
| `latin-typography` | `text` | `convert` | 1 | 3,346 | `53686e3608d658af210ef7e4bdc69217286ef7df39d4b6362981a5851054ce31` |
| `cjk-latin-mixed` | `text` | `convert` | 1 | 3,517 | `5b755b21d2947d52e6172c2ac6d8a9a1c88d20d23c867f913df354f58c248a3a` |
| `cjk-missing-font` | `text` | `convert` | 1 | 3,290 | `9557b98561351b845e93dce1f30860b9a19d592a8b9ce667908dd52393e3a20b` |
| `paragraph-layout` | `text` | `convert` | 1 | 3,547 | `64cf4ca77a6ae276154d82ffc972c43f9f9f2f6b16691bf9b5ce08b661015063` |
| `tab-stops` | `text` | `convert` | 1 | 3,212 | `fcf0aa8b275d8b56cd9ad6b7ef601edca4582ec12fbf05135f901f7fb95fd868` |
| `simple-table` | `table` | `convert` | 1 | 3,426 | `26f15d5bcdf8c645aa94f73680bed95d5da19f0a30d6bd938a3f08af44a62957` |
| `merged-table` | `table` | `convert` | 1 | 3,447 | `a578be6d95b64248258ddf03377ff50941476644eca6d187ac189b3d939468ad` |
| `nested-table` | `table` | `convert` | 1 | 3,371 | `6ad2c03e5219b660529b9159c618d8be8374a40e25e912475d96aa4dcba7ddfd` |
| `wide-table` | `table` | `convert` | 1 | 3,555 | `c1f1a176b03fb215afacd7e0d9c105be33c8ef02095f4a2db71bceda36543e90` |
| `long-table-repeat-header` | `table` | `convert` | - | 4,062 | `275f42beac952629a6dd19b0ba04a4a134a1bc871741c972751601bcfef163e1` |
| `lists-bullet-and-numbered` | `list` | `convert` | 1 | 3,883 | `d9f512d9e8a68b4fb6506507cbf98a76202d1755b34c8945d8d73668f96592d0` |
| `explicit-page-breaks` | `pagination` | `convert` | 5 | 3,334 | `95cf1d57e8caf9bc675ab8c7e11f1fd2fc1acde977bafaece6339f2f5b96ce52` |
| `word-cached-page-breaks` | `pagination` | `convert` | 3 | 3,554 | `6d87cefbb46ed4f67dfdb4c71eb5c0ba734cef66961e54ea75e9d2b0830f1543` |
| `flowing-overflow-no-breaks` | `pagination` | `convert` | 3 | 3,535 | `2adbf4fa61be19a670e5be0f9b3c3eb108acd797e8f507a9d121238054759843` |
| `section-breaks-next-page` | `pagination` | `convert` | 3 | 3,428 | `9bf4df180c156e9daf98d76eb8da0baf32ce607b97687073b558cb0f60e72d89` |
| `two-column-section` | `pagination` | `convert` | - | 3,504 | `71f7c193f4acab5838b28fd89ecb2f751a37dbc3a5a832942a6e325c6e54b258` |
| `orientation-mixed` | `pagination` | `convert` | 3 | 3,459 | `d42dda0207e3acddd597dab2c77ea0776b5f70fca3d7b93ee6a6294c5353a8bc` |
| `page-size-mixed` | `pagination` | `convert` | 2 | 3,427 | `cf13cbed5d9c0fe7a6c5ee75e64e2f1738366dfdb8e1fc6867df946789f60d22` |
| `keep-together` | `pagination` | `convert` | - | 3,539 | `8a1e51ecaf0cfca0549d5b341557543537054ddef3228b1683e3cea27e19d916` |
| `headers-and-footers` | `furniture` | `convert` | 3 | 4,456 | `4859bcf5a91cbd6b7584796c2db749b9b18e6f8afa09adf99285aacfb60265e5` |
| `header-first-even-odd` | `furniture` | `convert` | 4 | 4,855 | `af5b28180d11c3774295718656f2609981235d1cfc30651a0cbe2d479f1665cb` |
| `footnotes` | `furniture` | `convert` | 1 | 3,871 | `f669e2c4e88a018d20daab4c826071f5003c0ccd1579968feb2c183e361f03d0` |
| `endnotes` | `furniture` | `convert` | 1 | 3,844 | `5d39d6faf820e05d4bfc086d91b1ea2f006fe98e9d011c933ec139f60af18c1f` |
| `fields-and-toc` | `furniture` | `convert` | - | 3,494 | `e0c0cf98d56409f12c232ecbff5a691d343f3e715a2feb9fe42d351f100d9ca0` |
| `inline-image` | `media` | `convert` | 1 | 80,780 | `ce608e2c9a4d1249f07b92127a5c912ac64a8b82de00d6cafb936ef05fe8657e` |
| `floating-image-wrap` | `media` | `convert` | 1 | 80,702 | `9f32aa56a07e4d6c6e84b8b401e97bbc8cc0430a083fdfba6a4f8a5672075c61` |
| `image-gallery` | `media` | `convert` | - | 80,422 | `220941894c306fa7ad04af6c7de30086b9fd62481aedc454a602b84f5a36d5a6` |
| `equation-omml` | `hard` | `convert` | 1 | 3,223 | `b984c54b632729a8d4a64de206cdd8618b4ba0a3557cd3bac179ff44c28791df` |
| `tracked-changes` | `hard` | `convert` | 1 | 3,284 | `06eacd0f08668edaa0d0720434501ab74a8103882b4abca4e3645cdc39fa1278` |
| `comments` | `hard` | `convert` | 1 | 3,788 | `18f226696354d2c1e4a873b820bb957525d3ea00b03ee0731e6be9fa3d2ce6bf` |
| `content-controls` | `hard` | `convert` | 1 | 3,215 | `7e65cb791bfef7a686c2bda948f15b6898dd6b9e31c71fe79bf34e955808d13c` |
| `text-box` | `hard` | `convert` | 1 | 3,523 | `907f803d052202c082974c5ea1d747c44d8ea25aad4307435e9f8852013d5ca1` |
| `external-hyperlinks` | `hard` | `convert` | 1 | 3,239 | `400da960e03060f3fae6e80ccb994d34de157ce69e6450a09b352635bab5cbca` |
| `mixed-complex` | `hard` | `convert` | 3 | 83,088 | `cacc8779e7131ad2e6e4fdbb7e6ea4580d65be2099d69ae4bc8039734276136d` |
| `reference-20-page` | `scale` | `convert` | 20 | 82,774 | `6da35fad1a9e5e39671f61addeaeeac6ca2f9b6b7f6934ed97fc069a40be5bfa` |
| `large-120-page` | `scale` | `convert` | 120 | 6,049 | `2541b70e8f1556a005c3cbad56e34eb8b773dbb461ab525e4b00baf8d75a80c4` |
| `macro-enabled` | `refuse` | `refuse` | - | 3,863 | `fe4fa96af6586cfa1ece6f5ad48701bce5acc906c153c3a490e87249b80400b8` |
| `legacy-binary-doc` | `refuse` | `refuse` | - | 1,612 | `db95032ca01a258237bab279eef89c7da3cf9b58538975d989310eb4ae910347` |
| `encrypted-docx` | `refuse` | `refuse` | - | 1,613 | `a1fac844d43c8b8f3065685c0a1d4dc036f284aca931d4fbced11ef4025f61b6` |
| `truncated-package` | `refuse` | `refuse` | - | 2,065 | `1c7abd11ab20f4ac07587be3a70df77d7cbe76eee65550f54d43e227f0d7de4d` |
| `not-a-package` | `refuse` | `refuse` | - | 4,096 | `aee13599e64c17bdea874bb8d27a938f4704174b54770e5de51626aa12d1bc1d` |

`refuse` 表示「轉換成功才是失敗」：巨集文件、Word 97-2003 的二進位格式、被 CFB 容器包起來的加密 OOXML，以及兩種壞掉的檔案。後三者是容器層的問題，`macro-enabled` 是一份結構完全正常、只是宣告了 VBA 專案的 .docm，裡面沒有可執行的巨集程式碼。

三份文件是特地成對設計的：`explicit-page-breaks` 帶明確分頁符號，`word-cached-page-breaks` 是同樣的文字流過三頁、只在 Word 會留下標記的地方放 `w:lastRenderedPageBreak`，`flowing-overflow-no-breaks` 是同樣長度的文字但兩種標記都沒有——那是 Google 文件、LibreOffice 或任何非 Word 產生器常見的樣子。§4.2 的結論建立在這三份的差異上。

## 4. 相容性與保真矩陣

三個瀏覽器在這次量測中**每一格判定都相同**：330 次執行的成敗、算出的頁數、輸出的頁數、輸出檔的文字項目數與每一項保真判定，Chromium、Firefox 與 WebKit 完全一致。因此 §4.3 的表只印一組數字，而那是三個瀏覽器共同的結果，不是其中一個的。

相同的是判定，不是像素。字型度量不同，同一份文件算出的頁框高度就不同——`flowing-overflow-no-breaks` 那一頁在 Chromium 與 WebKit 上高 1,536 px，在 Firefox 上高 1,316 px。這不影響任何一項判定，但也表示這份紀錄不曾宣稱三個瀏覽器畫出一樣的版面。

### 4.1 開啟判定

| 管線 | 文件 | chromium | firefox | webkit |
| --- | --- | --- | --- | --- |
| `docx-preview` | `plain-paragraphs` | converted | converted | converted |
| `docx-preview` | `latin-typography` | converted | converted | converted |
| `docx-preview` | `cjk-latin-mixed` | converted | converted | converted |
| `docx-preview` | `cjk-missing-font` | converted | converted | converted |
| `docx-preview` | `paragraph-layout` | converted | converted | converted |
| `docx-preview` | `tab-stops` | converted | converted | converted |
| `docx-preview` | `simple-table` | converted | converted | converted |
| `docx-preview` | `merged-table` | converted | converted | converted |
| `docx-preview` | `nested-table` | converted | converted | converted |
| `docx-preview` | `wide-table` | converted | converted | converted |
| `docx-preview` | `long-table-repeat-header` | converted | converted | converted |
| `docx-preview` | `lists-bullet-and-numbered` | converted | converted | converted |
| `docx-preview` | `explicit-page-breaks` | converted | converted | converted |
| `docx-preview` | `word-cached-page-breaks` | converted | converted | converted |
| `docx-preview` | `flowing-overflow-no-breaks` | converted | converted | converted |
| `docx-preview` | `section-breaks-next-page` | converted | converted | converted |
| `docx-preview` | `two-column-section` | converted | converted | converted |
| `docx-preview` | `orientation-mixed` | converted | converted | converted |
| `docx-preview` | `page-size-mixed` | converted | converted | converted |
| `docx-preview` | `keep-together` | converted | converted | converted |
| `docx-preview` | `headers-and-footers` | converted | converted | converted |
| `docx-preview` | `header-first-even-odd` | converted | converted | converted |
| `docx-preview` | `footnotes` | converted | converted | converted |
| `docx-preview` | `endnotes` | converted | converted | converted |
| `docx-preview` | `fields-and-toc` | converted | converted | converted |
| `docx-preview` | `inline-image` | converted | converted | converted |
| `docx-preview` | `floating-image-wrap` | converted | converted | converted |
| `docx-preview` | `image-gallery` | converted | converted | converted |
| `docx-preview` | `equation-omml` | converted | converted | converted |
| `docx-preview` | `tracked-changes` | converted | converted | converted |
| `docx-preview` | `comments` | converted | converted | converted |
| `docx-preview` | `content-controls` | converted | converted | converted |
| `docx-preview` | `text-box` | converted | converted | converted |
| `docx-preview` | `external-hyperlinks` | converted | converted | converted |
| `docx-preview` | `mixed-complex` | converted | converted | converted |
| `docx-preview` | `reference-20-page` | converted | converted | converted |
| `docx-preview` | `large-120-page` | converted | converted | converted |
| `docx-preview` | `macro-enabled` | converted | converted | converted |
| `docx-preview` | `legacy-binary-doc` | rejected | rejected | rejected |
| `docx-preview` | `encrypted-docx` | rejected | rejected | rejected |
| `docx-preview` | `truncated-package` | rejected | rejected | rejected |
| `docx-preview` | `not-a-package` | rejected | rejected | rejected |
| `mammoth` | `plain-paragraphs` | converted | converted | converted |
| `mammoth` | `latin-typography` | converted | converted | converted |
| `mammoth` | `cjk-latin-mixed` | converted | converted | converted |
| `mammoth` | `cjk-missing-font` | converted | converted | converted |
| `mammoth` | `paragraph-layout` | converted | converted | converted |
| `mammoth` | `tab-stops` | converted | converted | converted |
| `mammoth` | `simple-table` | converted | converted | converted |
| `mammoth` | `merged-table` | converted | converted | converted |
| `mammoth` | `nested-table` | converted | converted | converted |
| `mammoth` | `wide-table` | converted | converted | converted |
| `mammoth` | `long-table-repeat-header` | converted | converted | converted |
| `mammoth` | `lists-bullet-and-numbered` | converted | converted | converted |
| `mammoth` | `explicit-page-breaks` | converted | converted | converted |
| `mammoth` | `word-cached-page-breaks` | converted | converted | converted |
| `mammoth` | `flowing-overflow-no-breaks` | converted | converted | converted |
| `mammoth` | `section-breaks-next-page` | converted | converted | converted |
| `mammoth` | `two-column-section` | converted | converted | converted |
| `mammoth` | `orientation-mixed` | converted | converted | converted |
| `mammoth` | `page-size-mixed` | converted | converted | converted |
| `mammoth` | `keep-together` | converted | converted | converted |
| `mammoth` | `headers-and-footers` | converted | converted | converted |
| `mammoth` | `header-first-even-odd` | converted | converted | converted |
| `mammoth` | `footnotes` | converted | converted | converted |
| `mammoth` | `endnotes` | converted | converted | converted |
| `mammoth` | `fields-and-toc` | converted | converted | converted |
| `mammoth` | `inline-image` | converted | converted | converted |
| `mammoth` | `floating-image-wrap` | converted | converted | converted |
| `mammoth` | `image-gallery` | converted | converted | converted |
| `mammoth` | `equation-omml` | converted | converted | converted |
| `mammoth` | `tracked-changes` | converted | converted | converted |
| `mammoth` | `comments` | converted | converted | converted |
| `mammoth` | `content-controls` | converted | converted | converted |
| `mammoth` | `text-box` | converted | converted | converted |
| `mammoth` | `external-hyperlinks` | converted | converted | converted |
| `mammoth` | `mixed-complex` | converted | converted | converted |
| `mammoth` | `reference-20-page` | converted | converted | converted |
| `mammoth` | `large-120-page` | converted | converted | converted |
| `mammoth` | `macro-enabled` | converted | converted | converted |
| `mammoth` | `legacy-binary-doc` | rejected | rejected | rejected |
| `mammoth` | `encrypted-docx` | rejected | rejected | rejected |
| `mammoth` | `truncated-package` | rejected | rejected | rejected |
| `mammoth` | `not-a-package` | rejected | rejected | rejected |
| `docx-preview-raster-pdf` | `plain-paragraphs` | converted | converted | converted |
| `docx-preview-raster-pdf` | `cjk-latin-mixed` | converted | converted | converted |
| `docx-preview-raster-pdf` | `simple-table` | converted | converted | converted |
| `docx-preview-raster-pdf` | `lists-bullet-and-numbered` | converted | converted | converted |
| `docx-preview-raster-pdf` | `explicit-page-breaks` | converted | converted | converted |
| `docx-preview-raster-pdf` | `word-cached-page-breaks` | converted | converted | converted |
| `docx-preview-raster-pdf` | `flowing-overflow-no-breaks` | converted | converted | converted |
| `docx-preview-raster-pdf` | `orientation-mixed` | converted | converted | converted |
| `docx-preview-raster-pdf` | `headers-and-footers` | converted | converted | converted |
| `docx-preview-raster-pdf` | `footnotes` | converted | converted | converted |
| `docx-preview-raster-pdf` | `inline-image` | converted | converted | converted |
| `docx-preview-raster-pdf` | `tracked-changes` | converted | converted | converted |
| `docx-preview-raster-pdf` | `reference-20-page` | converted | converted | converted |
| `mammoth-raster-pdf` | `plain-paragraphs` | converted | converted | converted |
| `mammoth-raster-pdf` | `cjk-latin-mixed` | converted | converted | converted |
| `mammoth-raster-pdf` | `simple-table` | converted | converted | converted |
| `mammoth-raster-pdf` | `lists-bullet-and-numbered` | converted | converted | converted |
| `mammoth-raster-pdf` | `explicit-page-breaks` | converted | converted | converted |
| `mammoth-raster-pdf` | `word-cached-page-breaks` | converted | converted | converted |
| `mammoth-raster-pdf` | `flowing-overflow-no-breaks` | converted | converted | converted |
| `mammoth-raster-pdf` | `orientation-mixed` | converted | converted | converted |
| `mammoth-raster-pdf` | `headers-and-footers` | converted | converted | converted |
| `mammoth-raster-pdf` | `footnotes` | converted | converted | converted |
| `mammoth-raster-pdf` | `inline-image` | converted | converted | converted |
| `mammoth-raster-pdf` | `tracked-changes` | converted | converted | converted |
| `mammoth-raster-pdf` | `reference-20-page` | converted | converted | converted |

兩條管線對五份必須拒絕的文件給出完全相同的判定，而且都不是我們要的判定。

`macro-enabled` 在兩條管線、三個瀏覽器上都**轉換成功**。這是合理的：一份 .docm 就是一份多了 `word/vbaProject.bin` 的 OOXML 套件，解析器沒有理由停下來。但它意味著「辨識並拒絕巨集文件」這件事沒有任何候選會替我們做，必須由呼叫端在解析前自己判斷內容類型與部件清單。巨集程式碼本身沒有被執行，也沒有被印進版面——`CORPUS PLACEHOLDER` 這串文字在任何一次輸出裡都找不到。

另外四份的拒絕來自同一個地方，而且給出同一句話。`legacy-binary-doc`、`encrypted-docx` 與 `not-a-package` 都得到 `Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/…`，`truncated-package` 得到 `Corrupted zip: can't find end of central directory`。四個完全不同的問題——這是舊版 Word 檔、這份檔案被加密了、這根本不是文件、這份檔案壞了——被壓成兩句無法分辨的訊息，而且其中一句還帶著第三方文件網址。規格 §12.13 要求工具能說出「加密」「巨集」「不支援的功能」，這些訊息一句都做不到；失敗詞彙必須由呼叫端在把位元組交給函式庫之前自己建立。

### 4.2 分頁

| 文件 | 宣告頁數 | chromium | firefox | webkit |
| --- | ---: | ---: | ---: | ---: |
| `plain-paragraphs` | 1 | 1 | 1 | 1 |
| `latin-typography` | 1 | 1 | 1 | 1 |
| `cjk-latin-mixed` | 1 | 1 | 1 | 1 |
| `cjk-missing-font` | 1 | 1 | 1 | 1 |
| `paragraph-layout` | 1 | 1 | 1 | 1 |
| `tab-stops` | 1 | 1 | 1 | 1 |
| `simple-table` | 1 | 1 | 1 | 1 |
| `merged-table` | 1 | 1 | 1 | 1 |
| `nested-table` | 1 | 1 | 1 | 1 |
| `wide-table` | 1 | 1 | 1 | 1 |
| `lists-bullet-and-numbered` | 1 | 1 | 1 | 1 |
| `explicit-page-breaks` | 5 | 5 | 5 | 5 |
| `word-cached-page-breaks` | 3 | 3 | 3 | 3 |
| `flowing-overflow-no-breaks` | 3 | 1 | 1 | 1 |
| `section-breaks-next-page` | 3 | 1 | 1 | 1 |
| `orientation-mixed` | 3 | 2 | 2 | 2 |
| `page-size-mixed` | 2 | 1 | 1 | 1 |
| `headers-and-footers` | 3 | 3 | 3 | 3 |
| `header-first-even-odd` | 4 | 4 | 4 | 4 |
| `footnotes` | 1 | 1 | 1 | 1 |
| `endnotes` | 1 | 1 | 1 | 1 |
| `inline-image` | 1 | 1 | 1 | 1 |
| `floating-image-wrap` | 1 | 1 | 1 | 1 |
| `equation-omml` | 1 | 1 | 1 | 1 |
| `tracked-changes` | 1 | 1 | 1 | 1 |
| `comments` | 1 | 1 | 1 | 1 |
| `content-controls` | 1 | 1 | 1 | 1 |
| `text-box` | 1 | 1 | 1 | 1 |
| `external-hyperlinks` | 1 | 1 | 1 | 1 |
| `mixed-complex` | 3 | 3 | 3 | 3 |
| `reference-20-page` | 20 | 20 | 20 | 20 |
| `large-120-page` | 120 | 120 | 120 | 120 |

這張表是這次判定的核心。

`docx-preview` 不計算分頁。從原始碼與量測都看得到同一件事：它在明確的 `w:br w:type="page"`、Word 快取的 `w:lastRenderedPageBreak`，以及頁面尺寸或方向改變的分節處切頁，其他時候文字有多長，頁面就有多長。`explicit-page-breaks` 得到正確的五頁，`word-cached-page-breaks` 得到正確的三頁，而內容完全等長、只是拿掉標記的 `flowing-overflow-no-breaks` 得到**一頁**——頁面高度 1,536 px（Firefox 上 1,316 px），裝在一個 1,123 px 的 A4 頁框裡。同一份文字，帶著 Word 存檔時留下的痕跡就是三頁，沒有痕跡就是一張超長的紙。

這不是可以靠參數修好的事。使用者手上的 DOCX 裡有沒有 `lastRenderedPageBreak`，取決於這份文件最後一次是被誰存檔的，而工具沒有任何辦法在轉換前知道，也沒有辦法在轉換後告訴使用者「你這份剛好可以」。

分節符號的處理另有兩個明確的缺陷。`w:type="nextPage"` 完全不生效：`section-breaks-next-page` 宣告三節、每節從新頁開始，得到一頁。頁面尺寸或方向改變時確實會切頁，但**晚一節才切**：`page-size-mixed` 的 A4 與 Letter 兩節被併在同一頁，以 A4 畫出；`orientation-mixed` 的直、橫、直三節得到兩頁，而且兩頁都是 794 × 1,123 的直向——那一節橫向頁面從輸出裡消失了。原因在 `groupByPageBreaks`：它先把目前這一節推進當前頁，才判斷要不要換頁，所以造成換頁的那一節自己落在前一頁上，用的是前一節的頁面設定。

`long-table-repeat-header` 的六十列表格得到一頁、高 2,026 至 2,057 px，標題列沒有重複——`w:tblHeader` 只有在真的分頁時才有意義。`keep-together` 的 `keepNext` 同理：沒有分頁，就沒有「標題被留在前一頁底部」這個問題可以避免，也沒有被避免。

`mammoth` 在這張表上沒有欄位，因為它產出的 HTML 裡沒有頁的概念——這是它的設計，不是它的缺陷。330 次執行中它的 `renderedPages` 永遠是 0。

### 4.3 內容保真

判定用四個詞：`kept` 表示文件宣告的內容全部出現，`lost` 表示一項都沒出現，`altered` 表示出現了一部分，`leaked` 表示出現了不該出現的東西。最後一個保留給「顯示出來才是失敗」的面向——作者刪掉的文字、審閱者的註解——所以它永遠不會和 `kept` 混在一起。

| 文件 | 面向 | `docx-preview` | `mammoth` |
| --- | --- | --- | --- |
| `plain-paragraphs` | `body-text` | kept | kept |
| `latin-typography` | `body-text` | kept | kept |
| `cjk-latin-mixed` | `body-text` | kept | kept |
| `cjk-missing-font` | `body-text` | kept | kept |
| `paragraph-layout` | `body-text` | kept | kept |
| `tab-stops` | `body-text` | kept | kept |
| `simple-table` | `body-text` | kept | kept |
| `simple-table` | `tables` | kept | kept |
| `merged-table` | `body-text` | kept | kept |
| `merged-table` | `tables` | kept | kept |
| `nested-table` | `body-text` | kept | kept |
| `nested-table` | `tables` | kept | kept |
| `wide-table` | `body-text` | kept | kept |
| `wide-table` | `tables` | kept | kept |
| `long-table-repeat-header` | `body-text` | kept | kept |
| `long-table-repeat-header` | `tables` | kept | kept |
| `lists-bullet-and-numbered` | `body-text` | kept | kept |
| `lists-bullet-and-numbered` | `list-markers` | kept | kept |
| `explicit-page-breaks` | `body-text` | kept | kept |
| `word-cached-page-breaks` | `body-text` | kept | kept |
| `flowing-overflow-no-breaks` | `body-text` | kept | kept |
| `section-breaks-next-page` | `body-text` | kept | kept |
| `two-column-section` | `body-text` | kept | kept |
| `orientation-mixed` | `body-text` | kept | kept |
| `page-size-mixed` | `body-text` | kept | kept |
| `keep-together` | `body-text` | kept | kept |
| `headers-and-footers` | `body-text` | kept | kept |
| `headers-and-footers` | `headers` | kept | lost |
| `headers-and-footers` | `footers` | kept | kept |
| `header-first-even-odd` | `body-text` | kept | kept |
| `header-first-even-odd` | `headers` | kept | lost |
| `footnotes` | `body-text` | kept | kept |
| `footnotes` | `footnotes` | kept | kept |
| `endnotes` | `body-text` | kept | kept |
| `endnotes` | `endnotes` | kept | kept |
| `fields-and-toc` | `body-text` | kept | kept |
| `inline-image` | `body-text` | kept | kept |
| `inline-image` | `images` | kept | kept |
| `floating-image-wrap` | `body-text` | kept | kept |
| `floating-image-wrap` | `images` | kept | kept |
| `image-gallery` | `body-text` | kept | kept |
| `image-gallery` | `images` | kept | kept |
| `equation-omml` | `body-text` | kept | kept |
| `equation-omml` | `equations` | kept | lost |
| `tracked-changes` | `body-text` | kept | kept |
| `tracked-changes` | `deleted-text` | kept | kept |
| `comments` | `body-text` | kept | kept |
| `comments` | `comments` | kept | kept |
| `content-controls` | `body-text` | kept | kept |
| `text-box` | `body-text` | kept | kept |
| `external-hyperlinks` | `body-text` | kept | kept |
| `mixed-complex` | `body-text` | kept | kept |
| `mixed-complex` | `headers` | kept | lost |
| `mixed-complex` | `footers` | kept | lost |
| `mixed-complex` | `footnotes` | kept | kept |
| `mixed-complex` | `tables` | kept | kept |
| `mixed-complex` | `images` | kept | kept |
| `mixed-complex` | `list-markers` | kept | kept |
| `reference-20-page` | `body-text` | kept | kept |
| `reference-20-page` | `headers` | kept | lost |
| `reference-20-page` | `footers` | kept | lost |
| `reference-20-page` | `tables` | kept | kept |
| `reference-20-page` | `images` | kept | kept |
| `large-120-page` | `body-text` | kept | kept |

`docx-preview` 在元素層級沒有掉任何東西：正文、表格（含合併、巢狀與超寬）、圖片（含透明與浮動）、頁首（含首頁與奇偶頁三種）、頁尾、註腳、章節附註、清單標記、方程式、內容控制項、文字方塊、雙欄版面全部保留，`two-column-section` 量到的 `column-count` 是 `2`。`mammoth` 掉了頁首、頁尾與方程式——這同樣是它的設計，它做的是語意轉換，頁首頁尾不是語意。

兩條管線都**沒有洩漏**追蹤修訂刪掉的文字，也沒有把註解印進版面。`docx-preview` 的 `renderChanges` 與 `renderComments` 在這次量測中都關閉；如果打開，刪除的文字就會出現在輸出裡。這是一個必須明確設定的選項，不是預設安全的行為。

保真判定到此為止都是在 DOM 上量的。它說的是「內容有沒有進到版面裡」，不是「這一頁長得對不對」，後者在 §4.2，而這兩者在 `docx-preview` 上的答案剛好相反。

## 5. 效能、記憶體與主執行緒

記憶體只有 chromium 回答得了：`performance.measureUserAgentSpecificMemory()` 在 Firefox 與 WebKit 上都不存在，那兩欄是「沒有值」，不是「沒有用到記憶體」。這個 API 在下一次垃圾回收時才回覆，每次呼叫要花數十秒，因此只在六份具代表性的文件上取樣。

| 管線 | 文件 | 瀏覽器 | 首個可觀察階段 ms | 轉換 ms | 最長阻塞 ms | 記憶體 MiB |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `docx-preview` | `plain-paragraphs` | chromium | 14 | 71 | 44 | 2 |
| `docx-preview` | `plain-paragraphs` | firefox | 4 | 32 | 10 | - |
| `docx-preview` | `plain-paragraphs` | webkit | 13 | 25 | 5 | - |
| `docx-preview` | `inline-image` | chromium | 17 | 55 | 21 | 2 |
| `docx-preview` | `inline-image` | firefox | 5 | 28 | 8 | - |
| `docx-preview` | `inline-image` | webkit | 7 | 25 | 6 | - |
| `docx-preview` | `image-gallery` | chromium | 18 | 55 | 32 | 2 |
| `docx-preview` | `image-gallery` | firefox | 5 | 36 | 11 | - |
| `docx-preview` | `image-gallery` | webkit | 8 | 24 | 4 | - |
| `docx-preview` | `long-table-repeat-header` | chromium | 24 | 54 | 31 | 2 |
| `docx-preview` | `long-table-repeat-header` | firefox | 8 | 26 | 9 | - |
| `docx-preview` | `long-table-repeat-header` | webkit | 10 | 26 | 3 | - |
| `docx-preview` | `reference-20-page` | chromium | 25 | 57 | 20 | 3 |
| `docx-preview` | `reference-20-page` | firefox | 9 | 42 | 8 | - |
| `docx-preview` | `reference-20-page` | webkit | 10 | 34 | 4 | - |
| `docx-preview` | `large-120-page` | chromium | 27 | 63 | 20 | 3 |
| `docx-preview` | `large-120-page` | firefox | 10 | 51 | 19 | - |
| `docx-preview` | `large-120-page` | webkit | 12 | 42 | 13 | - |
| `mammoth` | `plain-paragraphs` | chromium | 106 | 126 | 23 | 4 |
| `mammoth` | `plain-paragraphs` | firefox | 101 | 108 | 9 | - |
| `mammoth` | `plain-paragraphs` | webkit | 94 | 103 | 13 | - |
| `mammoth` | `inline-image` | chromium | 175 | 240 | 65 | 4 |
| `mammoth` | `inline-image` | firefox | 178 | 193 | 9 | - |
| `mammoth` | `inline-image` | webkit | 187 | 202 | 15 | - |
| `mammoth` | `image-gallery` | chromium | 628 | 652 | 27 | 4 |
| `mammoth` | `image-gallery` | firefox | 683 | 713 | 41 | - |
| `mammoth` | `image-gallery` | webkit | 887 | 919 | 26 | - |
| `mammoth` | `long-table-repeat-header` | chromium | 124 | 142 | 34 | 4 |
| `mammoth` | `long-table-repeat-header` | firefox | 116 | 126 | 26 | - |
| `mammoth` | `long-table-repeat-header` | webkit | 95 | 105 | 16 | - |
| `mammoth` | `reference-20-page` | chromium | 346 | 424 | 79 | 4 |
| `mammoth` | `reference-20-page` | firefox | 349 | 379 | 37 | - |
| `mammoth` | `reference-20-page` | webkit | 421 | 461 | 23 | - |
| `mammoth` | `large-120-page` | chromium | 121 | 142 | 28 | 4 |
| `mammoth` | `large-120-page` | firefox | 123 | 140 | 38 | - |
| `mammoth` | `large-120-page` | webkit | 104 | 122 | 19 | - |
| `docx-preview-raster-pdf` | `plain-paragraphs` | chromium | 15 | 199 | 43 | 8 |
| `docx-preview-raster-pdf` | `plain-paragraphs` | firefox | 4 | 188 | 24 | - |
| `docx-preview-raster-pdf` | `plain-paragraphs` | webkit | 6 | 171 | 45 | - |
| `docx-preview-raster-pdf` | `inline-image` | chromium | 13 | 342 | 200 | 7 |
| `docx-preview-raster-pdf` | `inline-image` | firefox | 4 | 177 | 11 | - |
| `docx-preview-raster-pdf` | `inline-image` | webkit | 7 | 155 | 16 | - |
| `docx-preview-raster-pdf` | `reference-20-page` | chromium | 25 | 1756 | 198 | 14 |
| `docx-preview-raster-pdf` | `reference-20-page` | firefox | 9 | 1902 | 127 | - |
| `docx-preview-raster-pdf` | `reference-20-page` | webkit | 10 | 1773 | 190 | - |
| `mammoth-raster-pdf` | `plain-paragraphs` | chromium | 95 | 281 | 51 | 9 |
| `mammoth-raster-pdf` | `plain-paragraphs` | firefox | 93 | 250 | 20 | - |
| `mammoth-raster-pdf` | `plain-paragraphs` | webkit | 90 | 238 | 43 | - |
| `mammoth-raster-pdf` | `inline-image` | chromium | 172 | 335 | 35 | 9 |
| `mammoth-raster-pdf` | `inline-image` | firefox | 175 | 348 | 18 | - |
| `mammoth-raster-pdf` | `inline-image` | webkit | 190 | 365 | 31 | - |
| `mammoth-raster-pdf` | `reference-20-page` | chromium | 343 | 702 | 214 | 14 |
| `mammoth-raster-pdf` | `reference-20-page` | firefox | 357 | 697 | 77 | - |
| `mammoth-raster-pdf` | `reference-20-page` | webkit | 429 | 867 | 158 | - |

規格 §12.13 的三個預算：首次進度 250 毫秒、二十頁文件三十秒、主執行緒單一工作 50 毫秒。

**時間預算通過。** `docx-preview` 對 `reference-20-page` 的轉換是 34 至 57 毫秒，加上點陣化與寫檔的完整管線是 1,756 至 1,902 毫秒，比三十秒的預算低一個數量級以上。`docx-preview` 全部 126 次執行中，第一個可觀察階段最慢 43 毫秒。`mammoth` 比較慢，`image-gallery` 在 WebKit 上要 887 毫秒才有第一個可觀察階段，超過 250 毫秒的預算。

**但「首次進度」這個預算在這裡量不到它想量的東西。** 沒有任何一個候選提供進度回呼：`docx-preview.parseAsync()` 與 `mammoth.convertToHtml()` 都是一個 Promise，中間不說話。表裡的「首個可觀察階段」是第一個階段**結束**的時間，也就是主機最早能誠實地告訴使用者「有事情發生了」的時刻，而不是一個進度事件。取消同理：兩者都不接受 `AbortSignal`，也沒有 cancel 方法。規格 §12.13 要求「所有長階段都可取消」，而可取消的長階段數量是零。

**主執行緒預算失敗。** 330 次執行中有 21 次量到超過 50 毫秒的阻塞。單次最久的一段是 214 毫秒（`mammoth-raster-pdf` 對 `reference-20-page`），`docx-preview-raster-pdf` 對同一份文件是 198 毫秒；單次執行累積的阻塞時間最多 273 毫秒。這不是可以靠最佳化解決的：`docx-preview` 把文件渲染成 DOM，`html2canvas` 讀的是版面計算後的 DOM，兩者都需要 `document`，所以沒有一條管線能放進 Web Worker。ADR-0010 要求 PDF、圖片與模型這類重型 module 透過 Tool Engine 在 Worker 執行；這條路連進入那個介面的資格都沒有。

記憶體數字（chromium 峰值 2 至 14 MiB）低到必須加註：`measureUserAgentSpecificMemory()` 量的是 JavaScript 堆與 DOM，`html2canvas` 產生的畫布記憶體大部分不在裡面。這些數字可以用來比較管線之間的相對大小，不能用來推算行動裝置上的工作集。

## 6. PDF 輸出

### 6.1 產出與讀回

每一份產出的 PDF 都用 `pdfjs-dist@6.3.289` 重新開啟一次——沿用 T24 的規則：輸出必須被一個獨立的閱讀器讀回來，才算存在。表中的「文字項目」是 `getTextContent()` 在整份文件所有頁面上回傳的項目總數。

| 管線 | 文件 | 瀏覽器 | 宣告頁數 | 輸出頁數 | 文字項目 | 可讀回 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `docx-preview-raster-pdf` | `plain-paragraphs` | chromium | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `plain-paragraphs` | firefox | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `plain-paragraphs` | webkit | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `cjk-latin-mixed` | chromium | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `cjk-latin-mixed` | firefox | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `cjk-latin-mixed` | webkit | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `simple-table` | chromium | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `simple-table` | firefox | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `simple-table` | webkit | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `lists-bullet-and-numbered` | chromium | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `lists-bullet-and-numbered` | firefox | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `lists-bullet-and-numbered` | webkit | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `explicit-page-breaks` | chromium | 5 | 5 | 0 | 是 |
| `docx-preview-raster-pdf` | `explicit-page-breaks` | firefox | 5 | 5 | 0 | 是 |
| `docx-preview-raster-pdf` | `explicit-page-breaks` | webkit | 5 | 5 | 0 | 是 |
| `docx-preview-raster-pdf` | `word-cached-page-breaks` | chromium | 3 | 3 | 0 | 是 |
| `docx-preview-raster-pdf` | `word-cached-page-breaks` | firefox | 3 | 3 | 0 | 是 |
| `docx-preview-raster-pdf` | `word-cached-page-breaks` | webkit | 3 | 3 | 0 | 是 |
| `docx-preview-raster-pdf` | `flowing-overflow-no-breaks` | chromium | 3 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `flowing-overflow-no-breaks` | firefox | 3 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `flowing-overflow-no-breaks` | webkit | 3 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `orientation-mixed` | chromium | 3 | 2 | 0 | 是 |
| `docx-preview-raster-pdf` | `orientation-mixed` | firefox | 3 | 2 | 0 | 是 |
| `docx-preview-raster-pdf` | `orientation-mixed` | webkit | 3 | 2 | 0 | 是 |
| `docx-preview-raster-pdf` | `headers-and-footers` | chromium | 3 | 3 | 0 | 是 |
| `docx-preview-raster-pdf` | `headers-and-footers` | firefox | 3 | 3 | 0 | 是 |
| `docx-preview-raster-pdf` | `headers-and-footers` | webkit | 3 | 3 | 0 | 是 |
| `docx-preview-raster-pdf` | `footnotes` | chromium | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `footnotes` | firefox | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `footnotes` | webkit | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `inline-image` | chromium | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `inline-image` | firefox | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `inline-image` | webkit | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `tracked-changes` | chromium | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `tracked-changes` | firefox | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `tracked-changes` | webkit | 1 | 1 | 0 | 是 |
| `docx-preview-raster-pdf` | `reference-20-page` | chromium | 20 | 20 | 0 | 是 |
| `docx-preview-raster-pdf` | `reference-20-page` | firefox | 20 | 20 | 0 | 是 |
| `docx-preview-raster-pdf` | `reference-20-page` | webkit | 20 | 20 | 0 | 是 |
| `mammoth-raster-pdf` | `plain-paragraphs` | chromium | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `plain-paragraphs` | firefox | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `plain-paragraphs` | webkit | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `cjk-latin-mixed` | chromium | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `cjk-latin-mixed` | firefox | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `cjk-latin-mixed` | webkit | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `simple-table` | chromium | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `simple-table` | firefox | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `simple-table` | webkit | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `lists-bullet-and-numbered` | chromium | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `lists-bullet-and-numbered` | firefox | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `lists-bullet-and-numbered` | webkit | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `explicit-page-breaks` | chromium | 5 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `explicit-page-breaks` | firefox | 5 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `explicit-page-breaks` | webkit | 5 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `word-cached-page-breaks` | chromium | 3 | 2 | 0 | 是 |
| `mammoth-raster-pdf` | `word-cached-page-breaks` | firefox | 3 | 2 | 0 | 是 |
| `mammoth-raster-pdf` | `word-cached-page-breaks` | webkit | 3 | 2 | 0 | 是 |
| `mammoth-raster-pdf` | `flowing-overflow-no-breaks` | chromium | 3 | 2 | 0 | 是 |
| `mammoth-raster-pdf` | `flowing-overflow-no-breaks` | firefox | 3 | 2 | 0 | 是 |
| `mammoth-raster-pdf` | `flowing-overflow-no-breaks` | webkit | 3 | 2 | 0 | 是 |
| `mammoth-raster-pdf` | `orientation-mixed` | chromium | 3 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `orientation-mixed` | firefox | 3 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `orientation-mixed` | webkit | 3 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `headers-and-footers` | chromium | 3 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `headers-and-footers` | firefox | 3 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `headers-and-footers` | webkit | 3 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `footnotes` | chromium | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `footnotes` | firefox | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `footnotes` | webkit | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `inline-image` | chromium | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `inline-image` | firefox | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `inline-image` | webkit | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `tracked-changes` | chromium | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `tracked-changes` | firefox | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `tracked-changes` | webkit | 1 | 1 | 0 | 是 |
| `mammoth-raster-pdf` | `reference-20-page` | chromium | 20 | 7 | 0 | 是 |
| `mammoth-raster-pdf` | `reference-20-page` | firefox | 20 | 7 | 0 | 是 |
| `mammoth-raster-pdf` | `reference-20-page` | webkit | 20 | 7 | 0 | 是 |

### 6.2 觀察

**78 份輸出檔全部可以讀回，全部有 0 個文字項目。**

這是這次判定裡最沒有轉圜餘地的一行。點陣化的路徑把每一頁拍成一張 JPEG 再貼進 PDF，所以產出的是一份可以開啟、可以列印、看起來正確的檔案，裡面一個字都沒有。使用者不能選取、不能複製、不能搜尋，螢幕閱讀器讀不出任何內容，PDF 也沒有任何連結標註——`external-hyperlinks` 那份文件在 DOM 裡是一個 `<a href>`，在輸出的 PDF 裡是一塊藍色的像素。這違反 WCAG 2.2 AA 對非文字內容的要求，而工具頁本身無論做得多好都補不了輸出檔的這個洞。

頁數的落差在輸出端更明顯。`docx-preview-raster-pdf` 忠實地把每一個頁框拍成一頁，所以它的輸出頁數等於 §4.2 的頁數，包括錯的那些：`flowing-overflow-no-breaks` 宣告三頁、輸出一頁，而且那一頁是 595 × 1,152 pt（Firefox 上 595 × 987 pt），不是 A4。`mammoth-raster-pdf` 沒有頁框可拍，只能把整份文件拍成一張長圖再按 A4 高度切開，於是 `reference-20-page` 宣告二十頁、輸出七頁，`headers-and-footers` 宣告三頁、輸出一頁——切點落在哪裡完全由影像高度決定，可以切在一行字的中間。

186 頁輸出的著墨比例都記在量測檔的 `pdf.inkRatios`，最小值 0.0039，沒有任何一頁是空白的。輸出檔確實畫了東西，問題不在點陣化器失敗，而在點陣化這件事本身。

## 7. 隱私與外部內容

330 次執行、每一次都在分頁層級記錄瀏覽器發出的每一個請求，包含 Worker 發出的與任何來源的。**預期以外的請求總數是 0。**

`external-hyperlinks` 那份文件指向 `https://word-to-pdf-probe.invalid/corpus-link`。沒有任何一次執行請求過這個位址：連結被渲染成一個 `<a href>`，但沒有被跟隨。伺服器端另外記錄了每一個被請求的路徑，兩份紀錄唯一的差異是 `/favicon.ico`——Chromium 與 Firefox 在頁面的請求管線之外抓它。這一項沒有被過濾掉，保留在 `unservedMismatch` 裡，所以如果出現第二種盲點，它會顯示出來而不是被掃掉。

三個瀏覽器都沒有產生任何未捕捉的頁面錯誤。

沒有任何候選需要伺服器端點，也沒有任何候選在執行期下載字型或資源。就隱私而言這條路是乾淨的；問題從來不在這裡。

## 8. Go／No-Go 判定

| 條件 | 判定 | 依據 |
| --- | --- | --- |
| `licence` | pass | 六個函式庫全部是 MIT、Apache-2.0 或 BSD-2-Clause，授權檔與散布內容一致（§2.1、§2.4）。 |
| `supply-chain` | pass | 版本以 registry integrity 釘選，執行期不連 CDN；需要伺服器、金鑰或無法散布的執行期的候選已排除（§2.3、§2.4）。 |
| `maintenance` | conditional | 唯一可散布的點陣化器 `html2canvas@1.4.1` 停更於 2022-01-22，而它正是承重的一環（§2.4）。 |
| `browser-support` | pass | 330 次執行的每一項判定在 Chromium、Firefox 與 WebKit 上完全一致（§4）。 |
| `pagination` | fail | 沒有候選會計算分頁。沒有 Word 快取分頁點的文件變成一頁超長版面，`nextPage` 分節無效，換尺寸與換方向的分節晚一節才斷，橫向頁消失（§4.2）。 |
| `content-fidelity` | pass | `docx-preview` 在元素層級保留了測試集宣告的每一項內容，也沒有洩漏刪除文字或註解（§4.3）。 |
| `output-text` | fail | 78 份輸出檔全部可讀回，全部 0 個文字項目：產出的是文字的照片，無法選取、搜尋或被輔助技術讀出（§6）。 |
| `unsupported-input` | fail | 沒有候選辨識或拒絕巨集文件；四種不同的容器問題被壓成兩句無法分辨、且帶著第三方網址的訊息（§4.1）。 |
| `progress-and-cancellation` | fail | 沒有候選提供進度回呼或取消介面，可取消的長階段數量是零（§5）。 |
| `main-thread` | fail | 21 次執行超過 50 毫秒預算，單次最久一段 214 毫秒；兩條管線都需要 DOM，無法放進 Web Worker，不符合 ADR-0010（§5）。 |
| `performance` | pass | `docx-preview` 對二十頁文件的完整管線是 1.8 至 1.9 秒，預算是三十秒；第一個可觀察階段最慢 43 毫秒（§5）。 |
| `memory-headroom` | conditional | 只有 Chromium 提供記憶體 API，畫布記憶體多半不在計數內，行動裝置未實測（§5、§12）。 |
| `privacy` | pass | 全部在本機執行，不需要任何伺服器端點；330 次執行的預期外請求總數為 0（§7）。 |

五項 fail，結論為 **no-go**：Word 轉 PDF 不能在瀏覽器本機可靠完成，本站不發布這個工具。

值得說清楚的是失敗的形狀。`licence`、`privacy`、`performance`、`content-fidelity` 與 `browser-support` 都通過了——這條路不是慢、不是髒、也不是吃字。它失敗在兩件沒有人做的事：把 Word 文件排到紙上，以及把那張紙寫成文字而不是照片。這兩件事都不是任何一個候選的缺陷，它們沒有一個宣稱自己做得到。

## 9. 結論與禁止事項

### 9.1 判定

不發布 Word 轉 PDF，不建立公開 route，不規劃後續實作 ticket。決策記於 ADR-0017。

不採用雲端轉檔作為替代。這不是沒有選項，而是選項的代價不對：把使用者的合約、履歷或尚未公開的財報送到別人的機器上，違反 ADR-0001 這條產品承諾。「我們做不到」是一個可以接受的答案，在小字裡改用伺服器不是。

### 9.2 禁止的公開面

判定為 no-go 期間，`word-to-pdf` 這個 slug 依 ADR-0011 保留，並以未發布狀態註冊在工具註冊表中，不得出現在下列任何一處：

| 面向 | 說明 |
| --- | --- |
| `public-route` | 任何 locale 的 `/tools/word-to-pdf/` 或等價路徑。 |
| `navigation-entry` | App Shell 側欄、底部導覽與工具分類抽屜。 |
| `tool-catalog-entry` | 工具目錄頁與任何工具集合。 |
| `search-index-entry` | 本機搜尋索引，包含別名與關鍵字。 |
| `sitemap-entry` | sitemap.xml 的任何項目。 |
| `structured-data` | 任何結構化資料的 `@id` 或 `itemListElement`。 |
| `seo-page` | 任何以這個工具為主題的著陸頁或說明頁。 |
| `offline-asset` | 漸進式離線策略中的任何資產。 |

介面也不得以「即將推出」「敬請期待」或等價說法預告它。沒有通過閘門的工具不是還沒做完的工具。

### 9.3 重新評估條件

下列條件至少成立一項，才值得重新量測。這些是對外界的條件，不是這個專案可以靠努力達成的事項：

| 條件 | 說明 |
| --- | --- |
| `redistributable-layout-engine` | 出現授權可自行散布、可在瀏覽器執行、並且自己計算分頁的 Word 排版引擎。 |
| `text-bearing-output` | 出現能把版面寫成帶文字的 PDF 而不是點陣圖的可散布路徑。 |
| `worker-safe-conversion` | 轉換能完全在 Web Worker 中執行，不需要 `document`。 |
| `progress-and-cancellation-api` | 候選提供進度回呼與取消介面，使長階段可取消。 |
| `maintained-rasteriser` | 若仍需點陣化，出現有人維護的可散布替代品。 |

重新量測時仍須沿用規格 §12.13 的測試集規模與門檻；涵蓋範圍小於這份紀錄的量測，不是對同一個問題的重新量測。

### 9.4 量測時採用的預算

| 參數 | 值 | 說明 |
| --- | ---: | --- |
| `firstProgressMs` | 250 | 規格 §12.13 的首次進度預算。沒有候選提供進度介面，因此實際比對的是第一個階段結束的時間。 |
| `referenceConversionMs` | 30,000 | 規格 §12.13 對二十頁代表性文件的桌面預算；實測最慢 1,902 毫秒。 |
| `mainThreadTaskMs` | 50 | 規格 §12.13 的主執行緒單一工作上限；330 次執行中有 21 次超過，單次最久一段 214 毫秒。 |

## 10. 禁止用語

工具頁、metadata、結構化資料與任何說明文字中不得出現：與 Word 相同、完美轉檔、版面完全保留、支援所有 Word 功能、可搜尋的 PDF、identical to Word、pixel-perfect、preserves your layout、supports every Word feature、searchable PDF。

這些詞被禁止不是因為它們太強，而是因為量測說它們會是假的：一份把三頁變成一頁、把橫向頁畫成直向、輸出零個文字項目的轉換，不能被描述成保留版面或可搜尋。這份清單在判定改變之前都有效，判定改變之後也要重新量過才能刪除其中任何一項。

## 11. 一手來源

查閱日期：2026-09-12。

- [ECMA-376 Part 1（第五版）](https://ecma-international.org/publications-and-standards/standards/ecma-376/)：WordprocessingML 的部件、`w:sectPr`、`w:lastRenderedPageBreak`、DrawingML 內嵌圖片、OMML 與標記相容性，是測試集的依據。
- [ISO/IEC 29500-1](https://www.iso.org/standard/71691.html)：同一份標準的 ISO 版本。
- [docx-preview](https://github.com/VolodymyrBaydalka/docxjs)：分頁與分節行為的原始碼與授權。
- [mammoth.js](https://github.com/mwilliamson/mammoth.js)：語意轉換的範圍與授權。
- [JSZip](https://github.com/Stuk/jszip)：OPC 容器的解壓與雙授權宣告。
- [html2canvas](https://github.com/niklasvh/html2canvas)：點陣化器的原始碼、授權與最後發布時間。
- [jsPDF](https://github.com/parallax/jsPDF)：PDF 寫出端的原始碼與授權。
- [pdf.js](https://github.com/mozilla/pdf.js)：讀回輸出檔的獨立閱讀器。
- [MDN：measureUserAgentSpecificMemory](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory)：記憶體取樣的可用範圍與跨來源隔離要求。

## 12. 驗證範圍與限制

測試素材全部由程式合成，沒有任何真實 DOCX。這帶來一個必須講清楚的限制：**這份紀錄沒有和 Word 的排版比對過任何一頁。** 它能說「這句話還在」「這張表還是三列三欄」「這份 PDF 有零個文字項目」，不能說「這一頁和 Word 畫的一樣」。§4.2 的判定不依賴這種比對——它比的是文件自己用標記宣告的頁數和實際產生的頁數——但任何關於視覺相似度的問題，這份紀錄都沒有答案。

合成文件涵蓋的是結構，不是內容多樣性：沒有內嵌字型、沒有表單欄位、沒有 SmartArt、沒有圖表、沒有嵌入物件、沒有標籤結構，也沒有 PDF/A 中繼資料。真實文件裡這些都會出現。

`encrypted-docx` 與 `legacy-binary-doc` 是形狀正確的 CFB 容器：512 位元組的檔頭、一個 FAT 磁區與一份含有正確串流名稱的目錄，但沒有完整的 OLE 樹，也沒有真的密文。它們足以測出「解析器在拿到非 ZIP 容器時怎麼反應」，不足以測出「解密流程」——後者根本沒有候選提供。

`macro-enabled` 的 `word/vbaProject.bin` 是一段說明文字加上 CFB 檔頭，不是編譯過的巨集。它測的是「文件宣告了巨集會不會被辨識」，不是「巨集會不會被執行」；後者這條路上沒有任何一個候選具備執行 VBA 的能力。

主執行緒阻塞是用 4 毫秒間隔的計時器量的，記的是「事件迴圈多久沒有回來」。它會把瀏覽器自己的排版與繪製也算進去，所以小文件上量到的十幾毫秒不全是函式庫造成的。超過 50 毫秒的那 21 次落差夠大，但這個方法量不出 5 毫秒等級的差異。`PerformanceObserver` 的 `longtask` 只有 Chromium 提供，因此沒有採用。

記憶體只有 Chromium 可量，另外兩個瀏覽器的欄位是「沒有值」而不是「沒有用到記憶體」；而且 `measureUserAgentSpecificMemory()` 不計入畫布配置的大部分記憶體，數字只能用於管線之間的相對比較。

量測在一台 macOS arm64（10 核）上進行。桌面數字不能代替參考手機；行動裝置的記憶體上限與算圖速度尚未實測。

「沒有跟隨外部連結」這件事，是由瀏覽器層級的請求事件與伺服器的路徑紀錄共同判定的，不是由閱讀函式庫原始碼得出。

這份紀錄不授權發布任何工具，也不宣稱這個問題永遠無解。它宣稱的是：在 2026-09-12，以當時可取得的可散布候選，這件事做不到。

## 13. TDD 紀錄

1. `tests/word-to-pdf-reference.test.ts` 先因 `app/features/tools/word-to-pdf/domain/reference.ts` 不存在而整份失敗，之後才建立模組與這份紀錄。
2. 測試集先以 ZIP 完整性與 XML 良構性驗證：243 個 XML 部件全部通過，才進入瀏覽器矩陣。
3. 第一版的 `sectionBreak()` 把 `w:sectPr` 的內容直接放進 `w:pPr`，沒有 `w:sectPr` 這層元素。所有分節文件因此被當成單節，`page-size-mixed` 甚至以最後一節的 Letter 尺寸畫出整份文件。補上包裹元素之後，`orientation-mixed` 從一頁變成兩頁，才看得見「晚一節才斷開」這個真正的行為。
4. 第一版的 `cachedPageBreak()` 把 `w:lastRenderedPageBreak` 放在段落之間。`docx-preview` 只在 run 裡尋找分頁元素，因此完全沒看到它，量到的是「快取分頁點無效」。改成 Word 實際的寫法——新頁第一段的第一個 run——之後得到正確的三頁，§4.2 的對照組才成立。
5. 保真探針一開始只回報「這句話有沒有出現在游標之後」，把順序和存在混為一談。`wide-table` 與 `mixed-complex` 因此被記成掉字，實際上只是我把宣告的順序寫錯了。拆成 `present` 與 `inOrder` 兩個值之後，兩份文件都回到 `kept`。
6. PDF 讀回第一版呼叫 `PDFDocumentProxy.destroy()`，那個方法不存在，78 份輸出檔全部記成「讀不回來」。改用 loading task 的 `destroy()` 之後才看見真正的結果：全部讀得回來，全部零個文字項目——比讀不回來嚴重得多。
7. 第一版在每一次執行的前後都呼叫 `performance.measureUserAgentSpecificMemory()`。它在下一次垃圾回收才回覆，每次三十秒左右，整個矩陣會跑上四小時。改成只在六份代表性文件上取樣，總時間降到約一小時，記憶體證據沒有減少。
8. 點陣化的著墨比例是後來才加的。在那之前「輸出檔可以讀回」和「輸出檔有內容」是同一個判斷，而點陣化器產生空白頁時兩者會分開；加上之後確認了 78 份輸出沒有一頁是空白的，所以 §6.2 的問題確實在點陣化本身，不在點陣化失敗。

## 14. Standards／Spec 審查

固定點為 `develop` 上的 `23a7c65`。Standards 與 Spec 兩軸由獨立審查者檢查，結果與後續修正記於 Pull Request。
