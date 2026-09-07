# 合規主圖通路規格與 preset 資料模型決策紀錄

- 對應 ticket：[T20] 研究合規主圖規格與 preset 資料模型（issue #22）
- 後續 ticket：[T21] 實作合規主圖工具（issue #23）
- 相關規格：[docs/specs/002-product-and-technical-specification.md](../specs/002-product-and-technical-specification.md) 12.9 節
- 相關 ADR：[ADR-0001 工具內容留在裝置](../adr/0001-tool-content-stays-on-device.md)、[ADR-0010 工具註冊為深 Module](../adr/0010-register-tools-through-deep-modules.md)、[ADR-0011 穩定英文工具 slug](../adr/0011-use-stable-english-tool-slugs.md)、[ADR-0012 合規主圖與品牌宣傳圖是不同輸出目的](../adr/0012-separate-compliant-and-promotional-product-images.md)
- 研究日期：2026-09-07（所有來源於同日擷取）
- 資料契約版本識別碼：`compliant-product-image-2026-09-07`
- 工具 slug：`compliant-product-image`
- 狀態：已決策；五項已標示的風險（§10）

本紀錄鎖定合規主圖的通路來源、納入與排除門檻、版本化 preset 資料模型、規則層級與可驗證性、
更新與過期策略，以及可直接轉為測試的向量。實作與測試以
`app/features/tools/compliant-product-image/domain/reference.ts`、`preset.ts` 與 `sources.ts`
引用同一份決策。`tests/compliant-product-image-reference.test.ts` 逐列比對本文件與模組的詞彙、
preset、規則、提示 key 與免責文案，`tests/compliant-product-image-preset.test.ts` 則驗證版本、
過期、生效日與輸出檢查的行為；任一方改動而未同步即測試失敗。

本研究只讀取通路自己公開的規格頁，不需要商品圖片，也不需要任何商家帳號或營運資料。

## 1. 決策摘要

| 項目 | 決策 |
| --- | --- |
| 工具 slug | `compliant-product-image`（穩定英文 slug，不隨介面用語改變） |
| 第一版通路 | Google 購物、Amazon、momo 商店、露天市集，共 4 個通路、6 個 preset |
| 排除通路 | 蝦皮購物、eBay、Meta 商品目錄、PChome 商店街、Yahoo 奇摩拍賣、momo 購物網供應商（§3.3） |
| 納入門檻 | 通路自己發布、未登入可讀、程式化請求可重複取得、至少一項可自動驗證的數值限制（§3.1） |
| preset 的識別 | 通路 + 圖片用途 + 地區。同一通路的不同用途是不同 preset，不用旗標合併 |
| 規則的兩個軸 | `authority`（規範／建議／允許）與 `verification`（自動／輔助／人工／不在範圍），兩者都必須標示 |
| 為什麼要兩個軸 | 通路把「規範」與「拍攝建議」寫在同一頁；把建議當規範，就是本 ticket 要避免的誤稱 |
| 缺漏欄位 | 來源未載明就留空，不從其他通路借值，也不猜測（§5.4） |
| 版本與過期 | 每個 preset 帶 `reviewedAt`；90 天到期、再 30 天寬限，逾期後停用而不是沿用舊規格（§5.2、§5.3） |
| 規則生效日 | 規則各自可帶 `effectiveFrom`；未生效的規則列出但不判定（Google 2027-01-31 即為實例） |
| 衝突處理 | 同一通路的兩個來源衝突時取權威層級較高者，並把另一個降為建議；跨來源無法收斂則整個 preset 排除 |
| 位元組換算 | 一律十進位（1 kb = 1,000 bytes、1 MB = 1,000,000 bytes），因為來源以 kb／MB 書寫（§10 風險三） |
| 取得時機 | 全部在研究時人工查核並寫入版本控制；執行期不呼叫任何通路，瀏覽器不連到任何來源 |
| 產品邊界 | 只做輸出規格輔助；不加邊框、Logo、促銷文字或價籤，那屬於品牌宣傳圖（ADR-0012） |

## 2. 為什麼合規主圖需要來源契約

「主圖規格」看起來只是幾個數字，但把它做成工具會同時踩到三個坑。

第一個坑是**把建議當規範**。Amazon 的公開文章在同一頁裡既列出「圖片必須是長邊 500 到 10,000
像素」這種會被系統擋下的規定，也寫著「商品應佔畫面 85% 以上」「背景用純白 RGB 255,255,255」
這種攝影建議。前者是規範，後者是文章作者的建議；把後者標成「Amazon 規格」，就是本 ticket 目標
句所說的「把一般設計提示誤稱為平台官方認證」。

第二個坑是**把可檢查的與不可檢查的混為一談**。尺寸、比例、格式與容量可以從輸出檔案直接讀出來；
「商品需佔圖片 80% 以上」「不可有促銷文字」則需要判斷畫面內容。這個工具沒有去背或物件偵測，
不可能自動判定後者。如果介面用同一個綠色勾勾呈現兩者，使用者會以為工具替他檢查過了。

第三個坑是**規格會在沒有通知的情況下改變**。Google 在本次查核時就掛著一句「自 2027 年 1 月 31 日起，
所有產品的圖片大小都須達到 500 x 500 像素以上」，也就是同一條規則在不同日期有不同效力。沒有
版本與生效日，工具只會在某一天突然開始給錯的答案。

所以 preset 不是一張尺寸表，而是一份帶來源、帶日期、帶層級、帶可驗證性的契約。

## 3. 來源與可查核性

### 3.1 納入門檻

一個通路要進第一版，四個條件全部成立才行：

1. 規格由**通路自己**發布，不是第三方教學、代營運部落格或社群整理。
2. **未登入**即可讀到全文。
3. 以一般程式化請求**可重複取得**，且該路徑未被該站 `robots.txt` 或使用條款禁止自動存取——維護契約
   要求每 90 天重新查核一次，做不到重複查核就等於沒有來源。
4. 至少提供一項**可自動驗證**的數值限制（尺寸、比例、格式或容量其中之一）。

第 3 條會刷掉一些內容其實看得到的通路。這是刻意的：本站不以繞過前端渲染或人機驗證的方式取得規格，
issue #22 的非目標也寫明「不爬取需要登入或禁止自動存取的內容」。

### 3.2 已納入來源

| id | 發布者 | 標題 | 網址 | 層級 | 可取得性 | 查核日期 |
| --- | --- | --- | --- | --- | --- | --- |
| `google-merchant-image-link` | Google | 產品資料規格：圖片連結 [image_link] | https://support.google.com/merchants/answer/6324350 | `policy` | `static-html` | `2026-09-07` |
| `amazon-product-photos` | Amazon | 6 tips for taking product photos in 2025（2024-12-04 發佈） | https://sell.amazon.com/blog/product-photos | `editorial` | `static-html` | `2026-09-07` |
| `momo-store-publish-rules` | 富邦媒體科技 | momo 商店規則中心：如何在 momo 發布商品 | https://rules.momo.com.tw/goods/00021/ | `help` | `static-html` | `2026-09-07` |
| `ruten-store-faq` | 露天市集 | 幫助中心：賣場經營相關問題 | https://www.ruten.com.tw/help/seller/2883/ | `help` | `static-html` | `2026-09-07` |

四個來源都在查核當日以一般 HTTP 請求取得完整靜態 HTML，且都不在各站 `robots.txt` 的 `Disallow`
路徑內。`ruten.com.tw` 的 `robots.txt` 只封鎖 `/item/`、`/search/` 等交易頁，`/help/` 未被封鎖；
`rules.momo.com.tw` 的 `robots.txt` 為 `Disallow:`（空值，全站允許）；`support.google.com` 只封鎖
`/*/search` 與 API 路徑；`sell.amazon.com` 只封鎖 `/search`、`/feedback` 等。

Amazon 這一列是第一版唯一的 `editorial` 來源。它的權威層級低於其他三個，因為真正的規範頁
（Seller Central「Product image guide」G1881）需要賣家登入才看得到內容。處理方式見 §6.1 的
`amazon-main`：只把該文章 FAQ「All images must be…」清單裡的項目與「至少一張圖」當成規範，
文章正文的攝影建議（85% 佔比、純白背景、建議六張、建議每邊 1,000 像素）一律降為建議。

### 3.3 已排除通路

| 通路 id | 名稱 | 排除原因 | 證據 | 重新評估 |
| --- | --- | --- | --- | --- |
| `shopee-tw` | 蝦皮購物（台灣） | `requires-javascript` | https://seller.shopee.tw/edu/article/258 | `2026-12-07` |
| `ebay` | eBay | `automated-access-restricted` | https://www.ebay.com/robots.txt | `2026-12-07` |
| `meta-commerce` | Meta 商品目錄 | `automated-access-restricted` | https://developers.facebook.com/robots.txt | `2026-12-07` |
| `pchome-store` | PChome 商店街 | `no-public-specification` | https://boss.pcstore.com.tw/onlineshop.htm | `2026-12-07` |
| `yahoo-tw` | Yahoo 奇摩拍賣 | `requires-javascript` | https://tw.help.yahoo.com/kb/auctions | `2026-12-07` |
| `momo-supplier` | momo 購物網供應商 | `requires-sign-in` | https://corp.momo.com.tw/stakeholder/supplier | `2026-12-07` |

每一列的判定依據：

- **蝦皮購物**：賣家教育中心的文章頁在未登入時回傳一份 13 KB 的前端殼，內文由 JavaScript
  取得，靜態 HTML 內沒有任何規格文字。不以繞過前端的方式取得。
- **eBay**：`robots.txt` 開頭明文寫著未經 eBay 許可的自動存取一律禁止；以一般程式化請求讀取
  圖片政策頁時，回應是人機驗證頁而不是政策內容。內容雖然在瀏覽器裡讀得到，但無法建立可重複的
  90 天重查流程，因此不納入第一版。
- **Meta 商品目錄**：`robots.txt` 開頭同樣載明未經書面許可禁止以自動方式蒐集資料；權威的圖片規格
  頁（Meta 企業商家使用說明）另需 JavaScript 才能取得內文。
- **PChome 商店街**：查核當日找不到任何由 PChome 發布、未登入可讀且含數值的商品圖規格頁；
  搜尋結果中的數字全部來自第三方代營運文章，不符合門檻第 1 條。
- **Yahoo 奇摩拍賣**：說明中心頁面在未啟用 JavaScript 時只回傳導覽骨架。
- **momo 購物網供應商**：與 `momo-store` 是不同的上架體系。供應商規格透過招商流程與後台提供，
  未公開；`momo-store` 的規則中心不適用於供應商商品。

排除是可逆的：每一列都帶重新評估日期，屆時重跑同一份門檻。排除期間介面不得出現該通路名稱的
preset，也不得以「即將支援」暗示規格已知。

### 3.4 來源層級

| key | 意義 | 為什麼要分 |
| --- | --- | --- |
| `policy` | 通路明文的規範或政策頁，違反會被系統或審核擋下 | 這是唯一可以整頁當成規範的層級 |
| `help` | 通路的操作說明頁，通常混合限制與提示 | 需要逐條判斷是規範還是建議 |
| `developer-doc` | 通路的開發者文件或欄位規格 | 數值精確但通常不含畫面內容規則 |
| `editorial` | 通路自營的教學或部落格文章 | 只能採用其中明確標示為規定的句子 |

`developer-doc` 在第一版沒有對應來源；它留在詞彙裡，因為排除名單中的 Meta 一旦改變存取條件就會
以這個層級進來。

### 3.5 可取得性

| key | 意義 | 是否可納入 |
| --- | --- | --- |
| `static-html` | 未登入的一般請求即可取得完整內文 | 可 |
| `requires-javascript` | 內文由前端渲染，靜態回應沒有規格文字 | 否 |
| `requires-sign-in` | 需要帳號才能讀到內文 | 否 |
| `automated-access-restricted` | 站方明文禁止自動存取，或以人機驗證阻擋 | 否 |

### 3.6 授權與使用方式

四個來源都不是開放授權的資料集，著作權分屬各通路。這一版因此不轉載、不鏡像、不快取任何通路頁面：
每個 preset 只保留可驗證的數值、§6.7 的單句原文，以及一個外連到原頁的連結，使用基礎統一記為
`quotation-and-outbound-link`。這也是本站不把通路規格當成「資料集」發佈的原因。

| 來源 | 授權狀態 | 條款頁 |
| --- | --- | --- |
| `google-merchant-image-link` | 著作權為 Google 所有，非開放授權 | https://policies.google.com/terms |
| `amazon-product-photos` | 著作權為 Amazon 所有，非開放授權 | https://www.amazon.com/gp/help/customer/display.html?nodeId=508088 |
| `momo-store-publish-rules` | 著作權為富邦媒體科技所有，非開放授權 | 未另設公開條款頁；頁尾載明保留所有權利 |
| `ruten-store-faq` | 著作權為露天市集國際資訊所有，非開放授權 | https://www.ruten.com.tw/help/category/member/policy/ |

與 ADR-0001 的關係：這些是**本站**取得公開規格的邊界，與使用者的商品圖無關。使用者的圖片、裁切
參數與輸出仍然完全留在裝置上，工具不會為了套用 preset 而連到任何通路。

## 4. Preset 資料模型

### 4.1 通路

| key | 名稱 | 地區 | 來源 |
| --- | --- | --- | --- |
| `google-merchant-center` | Google 購物（Merchant Center 產品資料） | `global` | `google-merchant-image-link` |
| `amazon` | Amazon 商品頁圖片 | `global` | `amazon-product-photos` |
| `momo-store` | momo 商店（賣家自行上架） | `tw` | `momo-store-publish-rules` |
| `ruten` | 露天市集 | `tw` | `ruten-store-faq` |

### 4.2 圖片用途

| key | 意義 | 為什麼是獨立 preset |
| --- | --- | --- |
| `main` | 商品頁的主要商品圖 | 各通路對它的要求最嚴，也是本工具的預設對象 |
| `ad` | 通路自己的廣告與推薦版位用圖 | momo 對它的禁止項目比主圖多，合併會放寬主圖或收緊廣告圖 |
| `variant` | 商品規格（款式）選項圖 | momo 對它的同一批要求是「建議」而不是「規範」 |

同一個通路的兩個用途可以互相矛盾：momo 主圖明文允許在左下或右下放浮水印，廣告用圖則要求無浮水印。
用途因此是 preset 身分的一部分，不是 preset 上的一個旗標。

### 4.3 規則層級

| key | 意義 | 介面待遇 |
| --- | --- | --- |
| `requirement` | 通路明文的規定，違反會被擋下或退件 | 未通過時輸出視為不符合 |
| `recommendation` | 通路的建議或最佳做法 | 未達成只顯示提醒，永遠不會讓輸出判定為不符合 |
| `permission` | 通路明文允許、但本工具不提供的行為 | 只作說明，並指向品牌宣傳圖 |

### 4.4 可驗證性

| key | 意義 | 例子 |
| --- | --- | --- |
| `automatic` | 可以從一個輸出檔案的像素與位元組直接判定 | 尺寸、比例、格式、容量、百萬像素、JPEG 色度模型 |
| `assisted` | 工具能提供輔助（安全區疊層、佔比格線），但不判定 | 商品佔比、背景是否純色 |
| `manual` | 只能提示使用者自行確認 | 促銷文字、浮水印、邊框、圖片張數 |
| `out-of-scope` | 本工具根本不做這件事，因此不宣稱檢查 | 浮水印與 Logo 的擺放位置 |

一條規則的可驗證性由它的限制種類決定，不由撰寫者心情決定：§4.5 的表把每個種類綁死在一個
可驗證性上，測試會逐條檢查兩者一致。

### 4.5 限制種類

| key | 值的形狀 | 可驗證性 |
| --- | --- | --- |
| `dimension-exact` | `{ width, height }` | `automatic` |
| `dimension-range` | `{ minWidth?, minHeight?, maxWidth?, maxHeight? }` | `automatic` |
| `longest-side-range` | `{ min?, max? }` | `automatic` |
| `aspect-ratio-exact` | `{ ratio }` | `automatic` |
| `aspect-ratio-range` | `{ min?, max? }` | `automatic` |
| `megapixel-max` | `{ max }` | `automatic` |
| `byte-range` | `{ min?, max? }` | `automatic` |
| `format-set` | `{ formats }` | `automatic` |
| `chroma-model` | `{ model }` | `assisted` |
| `count-range` | `{ min?, max? }` | `manual` |
| `occupancy-min` | `{ ratio }` | `assisted` |
| `safe-area-inset` | `{ top, right, bottom, left }` | `assisted` |
| `overlay-area-max` | `{ ratio }` | `manual` |
| `background` | `{ mode, rgb? }` | `assisted` |
| `metadata-preservation` | `{ tags }` | `manual` |
| `placement-allowance` | `{ positions }` | `out-of-scope` |
| `prohibition` | `{}` | `manual` |

`count-range` 說的是一則商品要有幾張圖，不是這一張輸出的性質，所以它是 `manual`：工具送出的是一張
圖，張數只有使用者在通路後台看得到。

`chroma-model` 一度被當成 `automatic`，理由是「JPEG 就是 YCbCr」。這是錯的：JPEG 也可以是灰階或
4:4:4，甚至以 RGB 編碼，而輸出的寬、高、格式與位元組不足以判斷色度取樣。工具能做的是預設輸出
JPEG 並說明這件事，所以它是 `assisted`。把它報成已驗證的 momo 規範，正是本 ticket 目標句要避免的
誤稱。

`safe-area-inset` 是安全區：四邊各自的留白比例。第一版四個來源都沒有公布安全區——momo 與 Amazon
以「商品佔比」表達同一件事——所以沒有任何 preset 帶這個限制。它留在模型裡，是因為驗收條件要求
preset 必須「可表達」安全區，而且下一個公布留白規範的通路不應該被迫改寫成佔比。

### 4.6 來源涵蓋度

| key | 意義 |
| --- | --- |
| `full` | 來源同時載明尺寸、容量與格式，輸出的三個主要面向都有依據 |
| `partial` | 來源缺少其中至少一項，缺的部分留空，介面必須說明「此通路未公開」 |

第一版只有 `google-merchant-center-main` 是 `full`。這不是資料填得不夠勤，而是通路本來就沒有全部公開。

### 4.7 Preset 狀態

| key | 意義 | 是否可用來判定輸出 |
| --- | --- | --- |
| `active` | 在查核效期內 | 可 |
| `review-due` | 已過查核效期但仍在寬限期內 | 可，但必須同時顯示待重查提示 |
| `expired` | 已過寬限期 | 否，停用 |
| `retired` | 已明確停止維護（通路收攤、來源撤下或門檻不再成立） | 否，停用 |

### 4.8 規則生效狀態

| key | 意義 |
| --- | --- |
| `in-force` | 已生效，納入判定 |
| `scheduled` | 通路已公告但尚未生效，列出但不判定 |

## 5. 版本、更新與過期

### 5.1 版本識別碼

資料契約的版本識別碼是 `compliant-product-image-` 加上查核日期。所有來源必須在同一天查核，
所以版本識別碼與每個 preset 的 `reviewedAt` 一致；模組會以測試強制這件事，避免出現「一半新一半舊」
的 preset 集合。

### 5.2 查核週期

- 查核效期：**90 天**。通路規格會在沒有通知的情況下改變，一季一次是可以維持的節奏。
- 寬限期：再 **30 天**。寬限期內 preset 仍可用，但必須顯示待重查提示。
- 逾期後：preset 停用。停用不是刪除——介面仍顯示通路名稱、最後查核日期與停用原因，只是不再拿它判定輸出。

重查的動作是：重新取得 §3.2 的每一個網址，逐條比對 §6.7 的來源原文。原文一字不差就只更新
`checkedAt`；原文改變就必須重新判斷該條規則的層級與數值，並更新版本識別碼。

### 5.3 狀態判定

`resolvePresetStatus(preset, today)` 依序判斷，第一個成立的就是結果：

1. `retiredAt` 存在且不晚於 `today` → `retired`
2. `today` 晚於 `reviewedAt` + 90 天 + 30 天 → `expired`
3. `today` 晚於 `reviewedAt` + 90 天 → `review-due`
4. 其餘 → `active`

停用優先於任何日期推導的狀態：一個已停止維護的 preset，即使昨天才查核過也不能用。

`expired` 與 `retired` 的 preset 不進行輸出判定，`checkOutputAgainstPreset` 直接回傳
`unavailable` 與對應提示，而不是「用舊規格判定一次再加註」。§7.1 的 `expired-preset-disabled`
說的就是這件事。

### 5.4 排除原因

| key | 意義 | 第一版是否使用 |
| --- | --- | --- |
| `requires-javascript` | 規格頁的內文由前端渲染 | 是 |
| `requires-sign-in` | 規格需要帳號才看得到 | 是 |
| `automated-access-restricted` | 站方明文禁止自動存取，或以人機驗證阻擋 | 是 |
| `no-public-specification` | 找不到通路自己發布且含數值的公開規格 | 是 |
| `conflicting-sources` | 通路自己的兩份公開文件互相矛盾，且無法以層級收斂 | 否 |
| `source-withdrawn` | 原本引用的頁面被撤下或改寫到失去數值 | 否 |

衝突的處理順序是：**先看層級，再看用途，最後才排除**。

1. 同一通路的兩份來源對同一條規則給不同數值時，取層級較高者（`policy` > `help` > `developer-doc` >
   `editorial`），另一份降為 `recommendation` 並保留原文，好讓下次重查看得出差異。
2. 層級相同但用途不同時，兩者都保留，各自成為自己用途的 preset 規則——momo 主圖與廣告用圖對浮水印
   的相反規定就是這樣處理的，不取交集也不取聯集。
3. 層級與用途都相同而數值仍矛盾時，該通路以 `conflicting-sources` 整個排除。不取較嚴格的一方：
   猜錯的代價是使用者被通路退件，而工具卻顯示通過。

第 1 條的降級會產生一個第一版還沒有的情況：一個 preset 的規則來自兩份來源。目前每個 preset 只有
一個 `sourceId`，因為六個 preset 各自只讀一份頁面；真的發生降級時，`sourceId` 必須先擴充成來源
清單，規則才有可追溯的出處。這是刻意留下的限制，不是疏漏——現在就加一個永遠等於 preset 來源的
欄位到 46 條規則上，只會是沒有讀者的重複資料。§10 風險五記錄了這件事。

### 5.5 重查錯誤

維護者重新查核時用的錯誤 key，依檢查順序排列。它們不會出現在使用者介面，因為任何一個成立時，
該 preset 就不會被更新成新版本。

| key | 何時發生 |
| --- | --- |
| `source-unreachable` | 網址無法取得或回傳非 2xx |
| `source-requires-javascript` | 取得到回應，但靜態內文已不含規格文字 |
| `source-requires-sign-in` | 被導向登入頁 |
| `automated-access-restricted` | 被人機驗證或站方政策阻擋 |
| `specification-text-changed` | §6.7 的來源原文與頁面不再一字不差 |
| `unit-ambiguous` | 來源改寫後的容量或尺寸單位無法確定（例如同時出現 MB 與 MiB） |
| `conflicting-rules` | 同通路同用途的兩份來源給出矛盾數值 |
| `unknown-constraint-kind` | 來源新增了 §4.5 沒有對應形狀的限制 |

### 5.6 檢視提示

依檢查順序排列：先確認 preset 存在，再確認它還在維護，再確認效期，最後才談規則。

| key | 何時出現 | 繁體中文 | English |
| --- | --- | --- | --- |
| `preset-unknown` | 網址或選單指向不存在的 preset | 找不到這個通路規格。 | This channel preset does not exist. |
| `preset-retired` | preset 已停止維護 | 這個通路規格已停止維護，不再用來檢查輸出。 | This channel preset is no longer maintained and is not used to check output. |
| `preset-expired` | 已過查核效期與寬限期 | 這個通路規格已超過查核效期，暫時停用；請直接查看通路的最新公告。 | This channel preset is past its review deadline and is disabled; check the channel announcement instead. |
| `preset-review-due` | 在寬限期內 | 這個通路規格已到重新查核時間，內容可能落後於通路公告。 | This channel preset is due for review and may lag behind the channel announcement. |
| `rule-not-in-force` | 規則有未來的生效日 | 這條規則自指定日期起才生效，目前不列入檢查。 | This rule only takes effect on the stated date and is not checked yet. |
| `rules-need-your-check` | preset 含 `assisted`、`manual` 或 `out-of-scope` 規則 | 有些規則要靠你自己確認，工具沒有替你檢查。 | Some rules are yours to confirm; the tool has not checked them for you. |

## 6. Preset 與規則

### 6.1 Preset 清單

| preset id | 通路 | 用途 | 地區 | 來源 | 涵蓋度 | 查核日期 |
| --- | --- | --- | --- | --- | --- | --- |
| `google-merchant-center-main` | `google-merchant-center` | `main` | `global` | `google-merchant-image-link` | `full` | `2026-09-07` |
| `amazon-main` | `amazon` | `main` | `global` | `amazon-product-photos` | `partial` | `2026-09-07` |
| `momo-store-main` | `momo-store` | `main` | `tw` | `momo-store-publish-rules` | `partial` | `2026-09-07` |
| `momo-store-ad` | `momo-store` | `ad` | `tw` | `momo-store-publish-rules` | `partial` | `2026-09-07` |
| `momo-store-variant` | `momo-store` | `variant` | `tw` | `momo-store-publish-rules` | `partial` | `2026-09-07` |
| `ruten-main` | `ruten` | `main` | `tw` | `ruten-store-faq` | `partial` | `2026-09-07` |

`amazon-main` 的涵蓋度是 `partial`，因為公開來源沒有容量上限；`momo-store-*` 是 `partial`，因為
momo 的商品主圖段落沒有載明可接受的檔案格式（同一頁提到的 `jpg` 屬於認證字號附件，不是商品圖）；
`ruten-main` 是 `partial`，因為露天沒有公開最小尺寸。缺的欄位一律留空，不從別的通路借。

### 6.2 規則向量

| preset | 規則 | 種類 | 層級 | 可驗證性 | 值 | 生效日 |
| --- | --- | --- | --- | --- | --- | --- |
| `google-merchant-center-main` | `min-dimensions` | `dimension-range` | `requirement` | `automatic` | `{"minWidth":500,"minHeight":500}` | `2027-01-31` |
| `google-merchant-center-main` | `recommended-dimensions` | `dimension-range` | `recommendation` | `automatic` | `{"minWidth":1500,"minHeight":1500}` | `null` |
| `google-merchant-center-main` | `max-megapixels` | `megapixel-max` | `requirement` | `automatic` | `{"max":64}` | `null` |
| `google-merchant-center-main` | `file-size-range` | `byte-range` | `requirement` | `automatic` | `{"max":16000000}` | `null` |
| `google-merchant-center-main` | `allowed-formats` | `format-set` | `requirement` | `automatic` | `{"formats":["jpeg","webp","png","gif","bmp","tiff"]}` | `null` |
| `google-merchant-center-main` | `no-border` | `prohibition` | `requirement` | `manual` | `{}` | `null` |
| `google-merchant-center-main` | `no-promotional-overlay` | `prohibition` | `requirement` | `manual` | `{}` | `null` |
| `google-merchant-center-main` | `no-placeholder` | `prohibition` | `requirement` | `manual` | `{}` | `null` |
| `google-merchant-center-main` | `preserve-ai-metadata` | `metadata-preservation` | `requirement` | `manual` | `{"tags":["IPTC DigitalSourceType"]}` | `null` |
| `amazon-main` | `longest-side-range` | `longest-side-range` | `requirement` | `automatic` | `{"min":500,"max":10000}` | `null` |
| `amazon-main` | `allowed-formats` | `format-set` | `requirement` | `automatic` | `{"formats":["jpeg","tiff","png","gif"]}` | `null` |
| `amazon-main` | `recommended-dimensions` | `dimension-range` | `recommendation` | `automatic` | `{"minWidth":1000,"minHeight":1000}` | `null` |
| `amazon-main` | `image-clarity` | `prohibition` | `requirement` | `manual` | `{}` | `null` |
| `amazon-main` | `image-count` | `count-range` | `requirement` | `manual` | `{"min":1}` | `null` |
| `amazon-main` | `recommended-image-count` | `count-range` | `recommendation` | `manual` | `{"min":6}` | `null` |
| `amazon-main` | `product-occupancy` | `occupancy-min` | `recommendation` | `assisted` | `{"ratio":0.85}` | `null` |
| `amazon-main` | `background` | `background` | `recommendation` | `assisted` | `{"mode":"pure-white","rgb":[255,255,255]}` | `null` |
| `momo-store-main` | `exact-dimensions` | `dimension-exact` | `requirement` | `automatic` | `{"width":1000,"height":1000}` | `null` |
| `momo-store-main` | `file-size-range` | `byte-range` | `requirement` | `automatic` | `{"min":50000,"max":1000000}` | `null` |
| `momo-store-main` | `chroma-model` | `chroma-model` | `requirement` | `assisted` | `{"model":"YCbCr"}` | `null` |
| `momo-store-main` | `image-count` | `count-range` | `requirement` | `manual` | `{"min":1,"max":6}` | `null` |
| `momo-store-main` | `product-occupancy` | `occupancy-min` | `requirement` | `assisted` | `{"ratio":0.8}` | `null` |
| `momo-store-main` | `overlay-area-max` | `overlay-area-max` | `requirement` | `manual` | `{"ratio":0.2}` | `null` |
| `momo-store-main` | `no-packaging-cover` | `prohibition` | `requirement` | `manual` | `{}` | `null` |
| `momo-store-main` | `watermark-placement` | `placement-allowance` | `permission` | `out-of-scope` | `{"positions":["bottom-left","bottom-right"]}` | `null` |
| `momo-store-main` | `logo-placement` | `placement-allowance` | `permission` | `out-of-scope` | `{"positions":["empty-area"]}` | `null` |
| `momo-store-ad` | `exact-dimensions` | `dimension-exact` | `requirement` | `automatic` | `{"width":1000,"height":1000}` | `null` |
| `momo-store-ad` | `file-size-range` | `byte-range` | `requirement` | `automatic` | `{"min":50000,"max":1000000}` | `null` |
| `momo-store-ad` | `exact-aspect-ratio` | `aspect-ratio-exact` | `requirement` | `automatic` | `{"ratio":1}` | `null` |
| `momo-store-ad` | `chroma-model` | `chroma-model` | `requirement` | `assisted` | `{"model":"YCbCr"}` | `null` |
| `momo-store-ad` | `background` | `background` | `requirement` | `assisted` | `{"mode":"solid"}` | `null` |
| `momo-store-ad` | `product-occupancy` | `occupancy-min` | `requirement` | `assisted` | `{"ratio":0.8}` | `null` |
| `momo-store-ad` | `no-border` | `prohibition` | `requirement` | `manual` | `{}` | `null` |
| `momo-store-ad` | `no-watermark` | `prohibition` | `requirement` | `manual` | `{}` | `null` |
| `momo-store-ad` | `no-promotional-overlay` | `prohibition` | `requirement` | `manual` | `{}` | `null` |
| `momo-store-ad` | `no-white-or-black-edge` | `prohibition` | `requirement` | `manual` | `{}` | `null` |
| `momo-store-variant` | `exact-dimensions` | `dimension-exact` | `requirement` | `automatic` | `{"width":1000,"height":1000}` | `null` |
| `momo-store-variant` | `file-size-range` | `byte-range` | `requirement` | `automatic` | `{"min":50000,"max":1000000}` | `null` |
| `momo-store-variant` | `exact-aspect-ratio` | `aspect-ratio-exact` | `recommendation` | `automatic` | `{"ratio":1}` | `null` |
| `momo-store-variant` | `background` | `background` | `recommendation` | `assisted` | `{"mode":"solid"}` | `null` |
| `momo-store-variant` | `product-occupancy` | `occupancy-min` | `recommendation` | `assisted` | `{"ratio":0.8}` | `null` |
| `momo-store-variant` | `no-white-or-black-edge` | `prohibition` | `recommendation` | `manual` | `{}` | `null` |
| `ruten-main` | `allowed-formats` | `format-set` | `requirement` | `automatic` | `{"formats":["jpeg","png"]}` | `null` |
| `ruten-main` | `file-size-range` | `byte-range` | `requirement` | `automatic` | `{"max":5000000}` | `null` |
| `ruten-main` | `aspect-ratio-range` | `aspect-ratio-range` | `requirement` | `automatic` | `{"min":0.2,"max":5}` | `null` |
| `ruten-main` | `image-count` | `count-range` | `requirement` | `manual` | `{"max":9}` | `null` |

### 6.3 Preset 狀態向量

`retiredAt` 一欄是判定的輸入，不是 §6.1 的既有值：第一版沒有任何 preset 被停用，帶值的列是為了
釘住停用優先於日期推導這條規則。

| preset | `retiredAt` | 日期 | 狀態 |
| --- | --- | --- | --- |
| `google-merchant-center-main` | `null` | `2026-09-07` | `active` |
| `google-merchant-center-main` | `null` | `2026-12-06` | `active` |
| `google-merchant-center-main` | `null` | `2026-12-07` | `review-due` |
| `google-merchant-center-main` | `null` | `2027-01-05` | `review-due` |
| `google-merchant-center-main` | `null` | `2027-01-06` | `expired` |
| `google-merchant-center-main` | `2026-10-01` | `2026-09-30` | `active` |
| `google-merchant-center-main` | `2026-10-01` | `2026-10-01` | `retired` |
| `momo-store-main` | `2026-10-01` | `2027-06-01` | `retired` |
| `ruten-main` | `null` | `2027-01-06` | `expired` |

### 6.4 規則生效向量

| preset | 規則 | 日期 | 狀態 |
| --- | --- | --- | --- |
| `google-merchant-center-main` | `min-dimensions` | `2026-09-07` | `scheduled` |
| `google-merchant-center-main` | `min-dimensions` | `2027-01-30` | `scheduled` |
| `google-merchant-center-main` | `min-dimensions` | `2027-01-31` | `in-force` |
| `google-merchant-center-main` | `max-megapixels` | `2026-09-07` | `in-force` |
| `momo-store-main` | `exact-dimensions` | `2026-09-07` | `in-force` |

### 6.5 輸出檢查向量

候選輸出是一張已經產生的圖：寬、高、格式與位元組。`result` 只由 `requirement` 且
`in-force` 且 `automatic` 的規則決定；建議未達成不會讓結果變成 `fail`。

| preset | 日期 | 候選輸出 | 結果 | 未通過規則 |
| --- | --- | --- | --- | --- |
| `google-merchant-center-main` | `2026-09-07` | `{"width":1500,"height":1500,"format":"jpeg","bytes":800000}` | `pass` | `[]` |
| `google-merchant-center-main` | `2026-09-07` | `{"width":9000,"height":9000,"format":"png","bytes":20000000}` | `fail` | `["max-megapixels","file-size-range"]` |
| `amazon-main` | `2026-09-07` | `{"width":1600,"height":1600,"format":"jpeg","bytes":900000}` | `pass` | `[]` |
| `amazon-main` | `2026-09-07` | `{"width":400,"height":400,"format":"webp","bytes":100000}` | `fail` | `["longest-side-range","allowed-formats"]` |
| `momo-store-main` | `2026-09-07` | `{"width":1000,"height":1000,"format":"jpeg","bytes":400000}` | `pass` | `[]` |
| `momo-store-main` | `2026-09-07` | `{"width":1200,"height":1000,"format":"png","bytes":30000}` | `fail` | `["exact-dimensions","file-size-range"]` |
| `momo-store-ad` | `2026-09-07` | `{"width":1000,"height":1000,"format":"jpeg","bytes":400000}` | `pass` | `[]` |
| `momo-store-ad` | `2026-09-07` | `{"width":1200,"height":800,"format":"jpeg","bytes":1500000}` | `fail` | `["exact-dimensions","exact-aspect-ratio","file-size-range"]` |
| `momo-store-variant` | `2026-09-07` | `{"width":1000,"height":1000,"format":"png","bytes":200000}` | `pass` | `[]` |
| `ruten-main` | `2026-09-07` | `{"width":1200,"height":900,"format":"jpeg","bytes":900000}` | `pass` | `[]` |
| `ruten-main` | `2026-09-07` | `{"width":3000,"height":400,"format":"webp","bytes":6000000}` | `fail` | `["allowed-formats","aspect-ratio-range","file-size-range"]` |

`momo-store-variant` 的那一列是刻意的：那張 PNG 通過，因為 momo 的規格圖段落沒有寫任何格式限制，
工具就不能替它補一個。同一張圖如果送到 `ruten-main` 也會通過，送到 `amazon-main` 則會因為
`allowed-formats` 而失敗——三種結果來自三份來源各自寫了什麼，不是來自一套共用的預設值。

### 6.6 適用範圍與缺少的欄位

`適用範圍` 是這個 preset 管到哪裡；把它寫出來，才不會讓「momo」這三個字被讀成整個 momo 生態系。
`缺少欄位` 是來源沒有載明、因此 preset 留空的限制種類，介面必須照著說，而不是留白。

| preset | 缺少欄位 | 適用範圍（繁體中文） | Scope (English) |
| --- | --- | --- | --- |
| `google-merchant-center-main` | `[]` | Merchant Center 產品資料的主要商品圖片 [image_link]，用於購物廣告與免費產品資訊；不涵蓋 additional_image_link 或其他 Google 版位。 | The main product image [image_link] in Merchant Center product data, used for shopping ads and free listings; not additional_image_link or other Google surfaces. |
| `amazon-main` | `["byte-range"]` | Amazon 商品頁圖片的公開說明範圍；不涵蓋 Handmade、A+ 內容或個別類別的額外規定。 | What Amazon states publicly about product page images; not Handmade, A+ content, or category-specific extras. |
| `momo-store-main` | `["format-set"]` | momo 商店由賣家自行上架的商品主圖；不適用 momo 購物網自營供應商。 | The main product image a seller uploads to a momo store; not the momo shopping supplier programme. |
| `momo-store-ad` | `["format-set"]` | momo 站外廣告、站內推薦版位與分類頁列表使用的廣告用圖；不適用商品頁主圖。 | The ad image momo uses for off-site ads, on-site recommendation slots and category listings; not the product page main image. |
| `momo-store-variant` | `["format-set"]` | momo 商店的商品規格（款式）選項圖；不適用主圖或廣告用圖。 | The variant option image in a momo store; not the main or ad image. |
| `ruten-main` | `["dimension-range"]` | 露天市集刊登單品時上傳的商品圖片；來源未區分主圖與其他圖片。 | Product images uploaded when listing a single item on Ruten; the source does not separate a main image from the rest. |

`缺少欄位` 為空與 `coverage` 是 `full` 是同一件事，模組以測試綁住兩者，避免只改一邊。

### 6.7 規則來源原文

重查時逐字比對這一欄。原文改變即觸發 `specification-text-changed`。

| preset | 規則 | 來源原文 |
| --- | --- | --- |
| `google-merchant-center-main` | `min-dimensions` | At least 500 x 500 pixels |
| `google-merchant-center-main` | `recommended-dimensions` | we recommend that you provide images around 1500x1500 pixels or above |
| `google-merchant-center-main` | `max-megapixels` | No image larger than 64 megapixels |
| `google-merchant-center-main` | `file-size-range` | No image file larger than 16MB |
| `google-merchant-center-main` | `allowed-formats` | JPEG (.jpg/.jpeg), WebP (.webp), PNG (.png), GIF (.gif), BMP (.bmp), and TIFF (.tif/.tiff) |
| `google-merchant-center-main` | `no-border` | use an image with a border |
| `google-merchant-center-main` | `no-promotional-overlay` | an image that contains promotional elements or content that covers the product |
| `google-merchant-center-main` | `no-placeholder` | use a placeholder or an image that |
| `google-merchant-center-main` | `preserve-ai-metadata` | All images created using generative AI must contain meta data indicating that the image was AI-generated |
| `amazon-main` | `longest-side-range` | 500 to 10,000 pixels on their longest side |
| `amazon-main` | `allowed-formats` | In JPEG, TIFF, PNG, or non-animated GIF file formats |
| `amazon-main` | `recommended-dimensions` | 1,000 pixels on each side to allow for zoom |
| `amazon-main` | `image-clarity` | Clear, unpixellated, and have no jagged edges |
| `amazon-main` | `image-count` | Every product on Amazon must have at least one image |
| `amazon-main` | `recommended-image-count` | we recommend having at least six |
| `amazon-main` | `product-occupancy` | Have the product fill 85% or more of the frame |
| `amazon-main` | `background` | product shots should be taken against a white background (RGB color values: 255, 255, 255) |
| `momo-store-main` | `exact-dimensions` | 圖檔尺寸：1000 px * 1000 px |
| `momo-store-main` | `file-size-range` | 大小：50 kb - 1000 kb |
| `momo-store-main` | `chroma-model` | 主圖需調整為YCbCr type並檢核 |
| `momo-store-main` | `image-count` | 主圖最少需上傳 1 張圖片，最多 6 張 |
| `momo-store-main` | `product-occupancy` | 販售商品需佔圖片 80 % 以上 |
| `momo-store-main` | `overlay-area-max` | 「插圖」、「配件」、「文字」不可佔圖片 20 % 以上 |
| `momo-store-main` | `no-packaging-cover` | 產品不可被包裝包覆 |
| `momo-store-main` | `watermark-placement` | 「浮水印」蓋在左下 or 右下，但不可重複及大面積覆蓋商品 |
| `momo-store-main` | `logo-placement` | 「店家 logo / 品牌 logo」可放置空白處 |
| `momo-store-ad` | `exact-dimensions` | 尺寸 1000 px * 1000 px |
| `momo-store-ad` | `file-size-range` | 大小 50 kb ~ 1000 kb |
| `momo-store-ad` | `exact-aspect-ratio` | 正方形圖片，不可有白/黑邊 |
| `momo-store-ad` | `chroma-model` | 廣告用圖需調整為YCbCr type並檢核 |
| `momo-store-ad` | `background` | 需為純色背景 |
| `momo-store-ad` | `product-occupancy` | 販售商品需佔圖片 80 % 以上 |
| `momo-store-ad` | `no-border` | 請上傳無壓標、無壓框、無浮水印的商品圖 |
| `momo-store-ad` | `no-watermark` | 請上傳無壓標、無壓框、無浮水印的商品圖 |
| `momo-store-ad` | `no-promotional-overlay` | 請上傳無壓標、無壓框、無浮水印的商品圖 |
| `momo-store-ad` | `no-white-or-black-edge` | 正方形圖片，不可有白/黑邊 |
| `momo-store-variant` | `exact-dimensions` | 規格圖尺寸 : 1000 px * 1000 px |
| `momo-store-variant` | `file-size-range` | 大小 : 50 kb - 1000 kb |
| `momo-store-variant` | `exact-aspect-ratio` | 請上傳正方形圖片，不可有白/黑邊 |
| `momo-store-variant` | `background` | 圖片需為純色背景 |
| `momo-store-variant` | `product-occupancy` | 販售商品需佔圖片 80 % 以上 |
| `momo-store-variant` | `no-white-or-black-edge` | 請上傳正方形圖片，不可有白/黑邊 |
| `ruten-main` | `allowed-formats` | 檔案格式限 jpg、jpeg、png |
| `ruten-main` | `file-size-range` | 檔案大小限 5MB 以內 |
| `ruten-main` | `aspect-ratio-range` | 長寬比不得超過 5:1 或 1:5 |
| `ruten-main` | `image-count` | 每項商品最多可上傳9張圖片 |

momo 規格圖的三條「建議您」開頭的項目（正方形、純色背景、商品佔 80%）在來源裡明確寫成建議，
所以 `momo-store-variant` 的對應規則層級是 `recommendation`；同一頁的主圖與廣告用圖段落沒有這個
前綴，因此是 `requirement`。這是同一份來源內部的層級差異，不是我們的詮釋。

## 7. 呈現與免責

### 7.1 必須同時呈現的免責內容

每一句都必須在 preset 被選取時同時可見，兩種語言都要。

| key | 繁體中文 | English |
| --- | --- | --- |
| `no-approval-guarantee` | 規格輔助，不保證通路審核通過。 | Specification guidance, not a guarantee of channel approval. |
| `not-official-partner` | toolsliang 與各通路沒有合作或授權關係，preset 只整理通路自己公開的規格。 | toolsliang has no partnership or endorsement from any channel; presets only restate each channel's own published specification. |
| `source-and-review-date` | 每個 preset 都標示來源網址與查核日期，實際規定以通路當下的公告為準。 | Every preset shows its source URL and review date; the channel's current announcement always governs. |
| `channel-may-change` | 通路可能在沒有通知的情況下改變規格，查核日期之後的變動不會自動反映。 | Channels can change specifications without notice, and changes after the review date are not reflected automatically. |
| `manual-rules-not-checked` | 背景、商品佔比、文字與浮水印等規則工具無法自動判定，只會列出來提醒你。 | Background, product occupancy, text and watermark rules cannot be judged automatically and are listed as reminders only. |
| `unspecified-fields-not-inferred` | 通路沒有公開的欄位維持空白，不會套用其他通路的數值。 | Fields a channel does not publish stay empty and never borrow a value from another channel. |
| `expired-preset-disabled` | 超過查核效期的 preset 會停用，不會拿舊規格繼續判定輸出。 | A preset past its review deadline is disabled rather than used with stale rules. |
| `local-processing` | 商品圖片、裁切參數、預覽與輸出只在這台裝置上處理。 | Product images, crop settings, previews and outputs are processed only on this device. |

### 7.2 來源顯名

每個 preset 旁邊必須看得到：通路名稱、來源標題、可點擊的來源網址、查核日期、目前狀態與涵蓋度。
來源網址是外連，開新分頁；本站不代為擷取或轉載通路頁面內容，只引用可驗證數值與 §6.7 的原文片段。

`partial` 涵蓋度必須寫出缺哪一項。文案不必手寫：§6.6 的 `缺少欄位` 就是那份清單，例如
`ruten-main` 的 `dimension-range` 對應「露天市集未公開最小尺寸」。留白讓人以為沒有限制。

每個 preset 的適用範圍（§6.6）也必須看得見，否則「momo」會被讀成整個 momo 生態系，而規則其實
只涵蓋賣家自行上架的商店商品。

### 7.3 禁止用語

介面、SEO 文案與結構化資料都不得出現：官方認證、平台認證、保證過審、審核保證、通過保證、
official certification、guaranteed approval、platform approved、compliance guarantee 等對應說法。
「合規主圖」是這個輸出目的的名稱（CONTEXT.md 已定義），不是對審核結果的宣稱；文案裡出現它時，
必須與 `no-approval-guarantee` 同時可見。

### 7.4 AEO 問答依據

可見 FAQ 與 FAQPage 結構化資料只能用這些問題，答案只能引用第三欄指到的段落。

| 繁體中文 | English | 依據 |
| --- | --- | --- |
| 合規主圖工具會保證商品圖被通路接受嗎？ | Does the compliant product image tool guarantee that a channel will accept my image? | §7.1 |
| preset 的規格是從哪裡來的？ | Where do the preset specifications come from? | §3.2 |
| 為什麼有些台灣通路沒有 preset？ | Why do some Taiwan channels have no preset? | §3.3 |
| preset 過期的時候會怎麼樣？ | What happens when a preset passes its review deadline? | §5.3 |
| 哪些規則工具沒辦法自動判定？ | Which rules can the tool not judge automatically? | §4.4 |
| 我的商品圖片會被傳到伺服器嗎？ | Is my product image sent to a server? | ADR-0001 |

## 8. 交付給 T21

T21 可以直接使用而不需要重新研究的東西：

- `compliantImagePresets`：6 個 preset 與 46 條規則，每條都帶層級、可驗證性與來源原文，
  外加每個 preset 的適用範圍與缺少欄位（§6.6）。
- `resolvePresetStatus`、`resolveRuleState` 與 `presetReviewDeadlines`：版本、過期與生效日的判定，
  含 §6.3、§6.4 的向量；`presetReviewDeadlines` 讓介面可以直接顯示「有效到哪一天」。
- `checkOutputAgainstPreset`：把一張輸出分成 `ruleDispositions` 的七類——通過、未通過、建議、輔助、
  人工、不在範圍與未生效——並在 preset 停用時回傳 `unavailable` 而不是判定結果。它放在這裡而不是
  留給 T21，是因為「preset 可表達什麼」只有在有人能把它算出來時才是可驗證的主張；它不碰像素，
  只讀寬、高、格式與位元組。
- `compliantImageViewNoticeCodes` 與 §5.6 的雙語句子：介面提示的唯一來源。
- `compliantImageCaveatKeys` 與 §7.1 的雙語句子：免責文案的唯一來源。
- `compliantImageExcludedChannels`：排除名單與重新評估日期，讓介面能誠實回答「為什麼沒有蝦皮」。
- `compliantImageContentReview`：可直接填進 Tool Definition 的 `contentReview`。

- `compliantImageSources`：每個來源的層級、可取得性、授權狀態與條款頁（§3.6），供來源顯名使用。

T21 仍要自己決定的事：裁切與縮放的互動、佔比與安全區疊層的畫法、Worker 的進度與取消、輸出編碼
參數，以及 `assisted` 規則要用什麼視覺輔助。本紀錄只保證那些輔助不會被描述成自動檢查；第一版沒有
任何通路公布留白式安全區，所以疊層只能以 `occupancy-min` 為依據，並標明它是佔比而不是留白。

## 9. 已收斂問題

- **要不要納入 eBay。** eBay 的圖片政策與說明頁內容在瀏覽器裡讀得到，數值也完整（長邊至少 500 像素、
  建議 1600×1600、單檔 12 MB、最多 24 張、不可加邊框與浮水印）。但 `robots.txt` 明文禁止未經許可的
  自動存取，程式化請求會拿到人機驗證頁。維護契約要求可重複的 90 天重查，所以改為排除。若日後取得
  eBay 的明確許可或官方 API，這是第一個要補回來的通路。
- **eBay 兩份文件的數值不同。** 政策頁寫「至少一張長邊 500 像素」，說明頁寫「最小解析度 500 x 500」。
  這正好示範了 §5.4 的第 1 條：政策頁層級較高，說明頁的 500×500 會降為建議。這條規則已寫進排除策略，
  即使 eBay 這次沒有納入。
- **Amazon 的 85% 與純白背景要不要當規範。** 不當。它們出現在文章的拍攝建議段落，而不是該頁 FAQ
  的 requirements 清單；真正的規範頁需要登入。兩條都以 `recommendation` 納入。
- **momo 主圖允許浮水印與 Logo，和 ADR-0012 是否衝突。** 不衝突。ADR-0012 說的是**本工具不加**邊框、
  Logo 與促銷文字，不是通路禁止。這兩條因此以 `permission` + `out-of-scope` 納入，介面上說明「momo
  允許，但本工具不提供；需要的話請用品牌宣傳圖」。
- **momo 那句「圖檔格式以 jpg 為主」要不要當成主圖格式規範。** 不要。它在來源頁裡屬於「相關認證字號」
  的附件上傳說明，不在商品主圖段落。momo 的商品圖格式因此留空。

## 10. 風險

1. **Amazon 的來源層級偏低。** 唯一公開可讀的頁面是一篇標題帶年份的文章（發佈於 2024-12-04），
   隨時可能被改寫或下架。重查時若它消失，`amazon-main` 直接轉為 `retired`，不改用第三方整理。
2. **台灣主要通路的覆蓋率不足。** 第一版只有 momo 商店與露天市集兩個台灣通路，蝦皮這個最大的通路
   不在其中。介面必須主動說明原因（§3.3），否則使用者會以為工具不完整或規格被遺漏。
3. **容量單位是詮釋而不是原文。** 來源寫 `16MB`、`1000 kb`、`5MB`，沒有指明十進位或二進位。本契約
   一律以十進位換算，對上限而言是較嚴格的一邊，對 momo 的 50 kb 下限而言則是較寬鬆的一邊。若日後
   有使用者回報 momo 退件在 50–51.2 kb 之間，這裡就是要改的地方。
4. **同一個 preset 若引用兩個來源，目前無法逐條追溯出處。** §5.4 第 1 條的降級策略一旦真的觸發，
   `sourceId` 要先擴充成來源清單；在那之前，規則的出處靠 §6.7 的原文辨識。第一版沒有這種 preset。
5. **Google 要求保留 AI 生成圖的 IPTC 中繼資料，與圖片壓縮工具的中繼資料清除相反。** 規格
   12.7 節要求圖片壓縮移除中繼資料。同一張圖先壓縮再送 Google 購物，可能因此失去
   `DigitalSourceType` 標記。這條以 `manual` 納入並在介面提醒；跨工具的一致處理留給商品圖工作台
   （T25）決定，不在本 ticket 內解。
