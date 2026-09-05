# 本機抽選等機率規則與來源決策紀錄

- 對應 ticket：[T12] 實作等機率本機抽選與抽籤輪盤（issue #14）
- 相關規格：[docs/specs/002-product-and-technical-specification.md](../specs/002-product-and-technical-specification.md) 12.4 節
- 相關 ADR：[ADR-0001 工具內容留在裝置](../adr/0001-tool-content-stays-on-device.md)、[ADR-0010 工具註冊為深 Module](../adr/0010-register-tools-through-deep-modules.md)、[ADR-0011 穩定英文工具 slug](../adr/0011-use-stable-english-tool-slugs.md)
- 研究日期：2026-09-05（所有來源於同日擷取）
- 規則版本識別碼：`random-picker-2026-09-05`
- 狀態：已決策；仍有兩項已標示的風險（§10）

本紀錄鎖定本機抽選工具的隨機來源、無偏差取樣演算法、名單解析規則、抽選設定、錯誤策略、
免責文字與來源標示。實作與測試以 `app/features/tools/random-picker/domain/reference.ts`
與 `sources.ts` 引用同一份決策。`tests/random-picker-reference.test.ts` 會逐列比對本文件與模組的
測試向量、錯誤 key、免責 key 與上限值，並驗證每一條取樣不變式；任一方改動而未同步即測試失敗。

本研究只使用合成名單，不涉及任何真實個人資料，也不需要任何使用者輸入。

## 1. 決策摘要

| 項目 | 決策 |
| --- | --- |
| 工具 slug | `random-picker`（穩定英文 slug，不隨介面用語改變） |
| 隨機來源 | `crypto.getRandomValues` 取得的 32 位元無號整數；來源以參數注入，模組本身不讀取瀏覽器 |
| 取值範圍 | 拒絕取樣（rejection sampling）去除模數偏差，不使用 `% n`，也不使用 `Math.random()` |
| 不重複抽選 | Fisher–Yates 部分洗牌，抽出的位置一旦用過就不再參與 |
| 名單分隔 | 只以換行分隔；逗號、頓號與空格都是項目文字的一部分 |
| 空白處理 | 每行前後空白（含全形空格）去除；去除後為空的行直接略過並計數 |
| 重複項目 | 由使用者明選「保留重複」或「合併重複」，預設保留；比對為去空白後的完全相同字串，區分大小寫 |
| 名單上限 | 10,000 筆；單筆最長 120 字 |
| 輪盤 | 只是呈現方式；結果在動畫開始前就已決定，停止角度由結果反推 |
| 輪盤適用條件 | 抽 1 名且有效項目 2–48 筆；其餘情況自動改用名單呈現並說明原因 |
| 動畫 | 非必要；`prefers-reduced-motion: reduce` 直接顯示結果，且任何時候都可跳過 |
| 保存 | 名單、設定與結果都不寫入本機儲存、不寫入網址、不保存歷史 |
| 產品邊界 | 不是公證、不可稽核、無法向他人證明結果未經重抽 |

## 2. 為什麼「等機率」需要被證明

抽選工具的唯一價值主張是「每個人機會一樣」。這個主張無法從畫面上看出來，只能由演算法保證，
因此本文件把它拆成三個可以逐條測試的性質：

1. **隨機來源本身是均勻的。** 使用瀏覽器提供的密碼學隨機來源，而不是 `Math.random()`。
2. **把隨機數對應到名單位置時不引入偏差。** 這是最容易出錯的一步，見 §3.2。
3. **抽多名時，已中選的項目不會再被抽到，其餘項目仍然彼此等機率。** 見 §3.3。

這三點成立仍然**不代表**結果可以向第三方證明：本機抽選沒有見證者，任何人都可以重抽到滿意為止。
這個界線寫在 §7.1 的免責裡，不能只放在頁尾。

## 3. 隨機來源與取樣演算法

### 3.1 隨機來源

W3C Web Cryptography API 對 `getRandomValues` 的要求是提供密碼學強度的隨機值：

> This method... must generate cryptographically random values.

實作以 `(count: number) => Uint32Array` 的函式型別注入隨機來源，理由有二：

- 測試可以注入固定序列，證明「同一組隨機位元 + 同一份名單 ⇒ 同一個結果」，
  也才能逐一驗證拒絕取樣的邊界。
- 領域模組不讀取 `globalThis`，因此不可能在模組內部偷偷取得瀏覽器狀態或送出任何東西。

瀏覽器沒有 `crypto.getRandomValues` 時，工具**不退回** `Math.random()`，而是停止抽選並說明原因
（錯誤 key `randomness-unavailable`）。退回一個非密碼學來源會讓等機率的主張變成無法驗證的宣稱。

### 3.2 無偏差整數取樣

要從 `[0, n)` 取一個等機率的位置，直覺寫法是 `word % n`。當 `2^32` 不是 `n` 的倍數時，
前面幾個餘數會多分到一個 word，這就是模數偏差。以 `n = 3` 為例，`2^32 = 3 × 1431655765 + 1`，
餘數 0 比餘數 1、2 各多一個 word，機率差約 2.3 × 10⁻¹⁰——小到看不出來，但它是系統性的偏誤，
而且名單越長偏差越大。

本工具改用拒絕取樣：

```text
limit = 2^32 − (2^32 mod n)      // 最大的 n 的倍數
重複取 word ∈ [0, 2^32)
  若 word ≥ limit 則丟棄，重取
回傳 word mod n
```

因為 `limit` 是 `n` 的整數倍，`[0, limit)` 內每個餘數對應的 word 數完全相同，
所以回傳值嚴格等機率。丟棄的機率是 `(2^32 mod n) / 2^32`，在名單上限 10,000 筆時小於
2.4 × 10⁻⁶，因此不需要迴圈上限以外的保護；實作仍設 `maxRejectionRounds = 64` 作為
「隨機來源壞掉」的偵測，連續 64 次落在丟棄區間的機率小於 10⁻³⁰⁰，只可能是來源異常。

`n = 1` 時 `limit = 2^32`，不會丟棄任何 word，回傳恆為 0。

### 3.3 不重複抽選

抽 `k` 名採 Fisher–Yates 部分洗牌（Durstenfeld 版本）：

```text
對 i 從 0 到 k−1：
  j = i + randomIndexBelow(n − i)
  交換 a[i] 與 a[j]
取 a[0..k)
```

每一步都在「尚未被抽走的區間」內等機率取一個位置，因此：

- 同一個位置不可能被抽兩次（acceptance：多人抽選不會重複中選）。
- `k = n` 時退化成完整洗牌，結果是一個均勻隨機排列。
- 名單中兩筆文字相同但屬於不同位置的項目（「保留重複」策略）各自佔一個機會，
  這是使用者選擇保留重複時的預期行為，並寫在 §7.1 的免責裡。

演算法只交換位置，不比較內容，所以項目文字不影響任何一筆的中選機率。

## 4. 名單解析規則

### 4.1 接受的輸入

- 一行一個項目；使用者可以整段貼上，也可以用單行欄位逐項新增。
- 分隔符號**只有換行**（`\n`、`\r\n`、`\r`）。逗號、頓號、分號與空格都被視為項目文字的一部分，
  因為姓名、品項與地址本來就可能含有這些字元；用它們當分隔會把一個項目切成兩個。

### 4.2 正規化

| 規則 | 說明 |
| --- | --- |
| 去除前後空白 | 含半形空白、Tab 與全形空格 U+3000 |
| 略過空行 | 去除空白後為空的行不成為項目，並計入 `blankLines` |
| 末尾換行 | 文字結尾的單一換行不算一行，貼上時常見的結尾換行不會被回報成「略過 1 行空白」 |
| 不改寫內容 | 大小寫、全形半形與內部空白一律保留原樣 |

### 4.3 重複項目策略

| 策略 key | 行為 | 何時使用 |
| --- | --- | --- |
| `keep` | 相同文字的項目各自保留，各佔一個機會（預設） | 名單本來就有同名的人或同一品項多份 |
| `merge` | 相同文字只保留第一次出現，並計入 `mergedDuplicates` | 名單是複製貼上時不小心重複的 |

比對對象是**去除前後空白後的完全相同字串**，區分大小寫與全形半形：`Amy` 與 `amy` 是兩個項目。
自動判斷大小寫或相似字會替使用者改動名單內容，不在第一版範圍內。

### 4.4 規模上限

| 上限 | 值 | 理由 |
| --- | --- | --- |
| `maxEntries` | 10,000 | 規格 12.4 節的效能預算以 10,000 筆短項目為基準 |
| `maxEntryLength` | 120 | 單筆超過 120 字通常是貼錯內容；也避免單一項目撐爆版面與輪盤標籤 |
| `wheelMinEntries` | 2 | 只有一個項目時輪盤沒有意義 |
| `wheelMaxEntries` | 48 | 超過 48 片扇形在 375px 寬度下無法辨識，改用名單呈現 |

超過上限時停止抽選並說明可以怎麼改，不自動截斷名單：替使用者刪掉項目會直接改變每個人的機會。

## 5. 抽選設定與錯誤策略

### 5.1 設定

| 設定 | 值域 | 預設 |
| --- | --- | --- |
| 重複項目策略 | `keep` / `merge` | `keep` |
| 抽出人數 | 1 至有效項目數的整數 | 1 |
| 呈現方式 | `list` / `wheel` | `list` |

### 5.2 錯誤情境

表中的中英文句子可直接採用；調整語氣時必須保留同一個主張，並且兩種語言都要說出「怎麼改才會過」。
`{limit}`、`{count}`、`{entries}` 由實作以數字填入，永遠不填入任何項目文字。

| 錯誤 key | 觸發條件 | 繁體中文 | English |
| --- | --- | --- | --- |
| `randomness-unavailable` | 瀏覽器沒有 `crypto.getRandomValues` | 這個瀏覽器沒有提供安全隨機來源，無法保證等機率抽選；請改用最新版瀏覽器或其他裝置。 | This browser provides no secure random source, so an equal-probability draw cannot be guaranteed; use an up-to-date browser or another device. |
| `empty` | 名單欄位完全沒有內容 | 請先貼上或逐項輸入候選名單，一行一個。 | Paste or add your candidates first, one per line. |
| `no-entries` | 有輸入內容，但每一行去除空白後都是空的 | 名單裡沒有可抽選的項目，請確認每一行都有文字。 | The list has no entry to draw from; make sure each line has text. |
| `entry-too-long` | 有項目超過長度上限 | 有 {count} 個項目超過 {limit} 個字，請縮短後再抽。 | {count} entries are longer than {limit} characters; shorten them before drawing. |
| `too-many-entries` | 有效項目數超過上限 | 名單最多 {limit} 筆，目前有 {count} 筆。 | The list holds at most {limit} entries; it currently has {count}. |
| `draw-count-invalid` | 抽出人數不是大於 0 的整數 | 抽出人數請填 1 以上的整數。 | Enter a whole number of at least 1 for how many to draw. |
| `draw-count-exceeds-entries` | 抽出人數大於有效項目數 | 要抽 {count} 名，但名單只有 {entries} 筆可抽。 | You asked for {count} but the list only has {entries} to draw from. |

### 5.3 檢查順序

上表的列序**就是**檢查順序，第一個不通過的就是回報的錯誤，不合併回報多個錯誤：

- **隨機來源先於一切。** 沒有安全隨機來源時，任何名單都不該抽；先說清楚，使用者才不會白填名單。
- **空欄位先於空名單。** 還沒輸入任何東西是「請先輸入」，不是錯誤；輸入了卻只有空白才需要指出
  「每一行都要有文字」。前者在介面上以提示呈現，不觸發 alert。
- **名單先於抽出人數。** 抽出人數的上限就是有效項目數，名單還沒成立時談人數沒有意義。
- **單筆長度先於名單筆數。** 貼錯整份文件時，兩者會同時超標；「有項目太長」才是使用者真正貼錯的線索。

### 5.4 取消與進度

- 輪盤動畫執行中必須可以跳過。跳過與取消都**不重抽**：結果在動畫開始前就已決定。
- 動畫執行中結果區維持 `aria-busy="true"`，結束後才宣告結果，避免輔助科技讀到未完成的畫面。
- `prefers-reduced-motion: reduce` 時不播放動畫，直接顯示同一個結果。

## 6. 測試向量

### 6.1 名單解析向量

輸入與項目以 JSON 字串書寫，空白與換行才不會在 Markdown 表格裡消失。

| 輸入 | 策略 | 有效項目 | 空白行 | 合併重複 |
| --- | --- | --- | --- | --- |
| `"Amy\nBob\nCindy"` | `keep` | `["Amy","Bob","Cindy"]` | 0 | 0 |
| `"Amy\r\nBob\rCindy"` | `keep` | `["Amy","Bob","Cindy"]` | 0 | 0 |
| `"  Amy  \n\tBob\t"` | `keep` | `["Amy","Bob"]` | 0 | 0 |
| `"　王小明　\n李小美"` | `keep` | `["王小明","李小美"]` | 0 | 0 |
| `"Amy\n\n  \nBob"` | `keep` | `["Amy","Bob"]` | 2 | 0 |
| `"Amy\nBob\n"` | `keep` | `["Amy","Bob"]` | 0 | 0 |
| `"\n\n"` | `keep` | `[]` | 2 | 0 |
| `""` | `keep` | `[]` | 0 | 0 |
| `"   "` | `keep` | `[]` | 1 | 0 |
| `"A, B\nC"` | `keep` | `["A, B","C"]` | 0 | 0 |
| `"Amy\nAmy\nBob"` | `keep` | `["Amy","Amy","Bob"]` | 0 | 0 |
| `"Amy\nAmy\nBob\nAmy"` | `merge` | `["Amy","Bob"]` | 0 | 2 |
| `"Amy\namy"` | `merge` | `["Amy","amy"]` | 0 | 0 |
| `" Amy\nAmy "` | `merge` | `["Amy"]` | 0 | 1 |

### 6.2 拒絕向量

`entries` 欄是為了讓向量可讀而寫的名單產生方式；`code` 是唯一被斷言的結果。

| 名單 | 抽出人數 | 隨機來源 | 錯誤 key |
| --- | --- | --- | --- |
| `"Amy\nBob"` | 1 | 無 | `randomness-unavailable` |
| `""` | 1 | 有 | `empty` |
| `"   \n  "` | 1 | 有 | `no-entries` |
| `121 字的單一項目` | 1 | 有 | `entry-too-long` |
| `10001 筆項目` | 1 | 有 | `too-many-entries` |
| `"Amy\nBob"` | 0 | 有 | `draw-count-invalid` |
| `"Amy\nBob"` | 1.5 | 有 | `draw-count-invalid` |
| `"Amy\nBob"` | 3 | 有 | `draw-count-exceeds-entries` |
| `121 字項目 × 10001 筆` | 1 | 有 | `entry-too-long` |

### 6.3 不變式

以下性質對每一次抽選都成立，測試逐條驗證，實作不得以特例繞過：

1. 抽出的每一筆都對應名單中的一個位置，且位置不重複。
2. 抽出的筆數等於要求的筆數。
3. 同一份名單搭配同一段隨機位元，結果完全相同；領域模組不讀取任何全域狀態。
4. `randomIndexBelow(n)` 的回傳值恆在 `[0, n)`。
5. 對每個 `n`，丟棄門檻 `limit` 滿足 `limit mod n === 0`，因此 `[0, limit)` 內每個結果對應相同數量的 word。
6. 落在 `[limit, 2^32)` 的 word 一律被丟棄，不會被 `mod` 折回任何結果。
7. `k = n` 時，抽選結果是名單的一個排列（每個項目恰好出現一次）。
8. 輪盤停止角度必定把中選扇形的中心對準指標：`(扇形中心角 + 停止角度) mod 360 === 0`。
9. 名單順序被打亂不改變任何一筆的中選機率——以固定隨機序列對調換後的名單重跑，
   中選的**項目集合**由隨機序列決定，與項目文字無關。

第 5 與第 6 條是等機率的**證明**，不是統計觀察：它們直接檢查取樣區間的整除性質，
不受樣本數影響。統計檢定（§6.4）只是煙霧測試，用來抓明顯的實作錯誤，不能取代這兩條。

### 6.4 統計煙霧測試

以真實 `crypto.getRandomValues` 對 6 筆名單抽 60,000 次，每個項目的出現次數必須落在
期望值 10,000 的 ±5%（9,500–10,500）以內。這個範圍在等機率下的失敗機率遠低於 10⁻⁶，
足以抓到「少一個項目」「偏向第一個」這類錯誤，但抓不到微小偏差；微小偏差由 §6.3 第 5、6 條負責。

## 7. 免責、來源標示與用語規則

### 7.1 必須同時呈現的免責內容

實作必須在結果附近（不是只在頁尾）呈現以下每一則，中英文皆完整。
`duplicates-share-chances` 只在選擇「保留重複」且名單真的有重複時出現，其餘五則恆常呈現。

| 免責 key | 繁體中文 | English |
| --- | --- | --- |
| `equal-probability-scope` | 每個有效項目的中選機率相同；機率由取樣演算法保證，不受項目順序或文字影響。 | Every valid entry has the same chance of being drawn; that comes from the sampling algorithm, not from the order or the text of the entries. |
| `no-audit` | 抽選只在這台裝置執行，沒有伺服器見證，也沒有第三方稽核，無法向別人證明結果沒有被重抽。 | The draw runs on this device only, with no server witness and no third-party audit, so you cannot prove to anyone else that a result was not re-rolled. |
| `not-a-lottery` | 這不是可稽核的抽獎系統，不適用需要主管機關核准、公證或紀錄留存的活動。 | This is not an auditable prize-draw system and is not suitable for events that require regulatory approval, notarisation, or a retained record. |
| `duplicates-share-chances` | 名單裡有重複的項目，目前設定讓它們各佔一個機會；要讓同一個名字只有一次機會，請改選合併重複。 | The list contains repeated entries and the current setting gives each of them its own chance; switch to merging duplicates to give a repeated name a single chance. |
| `wheel-is-presentation` | 輪盤只是呈現方式，結果在動畫開始前就已經決定；跳過或取消動畫都不會改變結果。 | The wheel is presentation only: the result is decided before the animation starts, and skipping or cancelling it changes nothing. |
| `local-processing` | 名單與結果只在你的瀏覽器處理，不會送出、不會保存，關閉分頁後就消失。 | The list and the result are processed in your browser only; nothing is sent or stored, and both are gone when you close the tab. |

### 7.2 來源標示

- 結果區塊旁必須顯示等機率的作法摘要（§3）、規則版本識別碼與可點擊來源連結。
- 規則版本識別碼 `random-picker-2026-09-05` 對應本次查核日期；任一來源改版或演算法決策改變時，
  必須重新查核、更新識別碼與 `reviewedAt`，並同步本文件與測試。工具 slug `random-picker` 不隨之改變。
- 中英文頁面都必須列出來源；英文頁不得只寫「a browser API」而不指名。

### 7.3 禁止用語

不得出現：公平抽獎、公證抽獎、線上抽獎、防作弊、保證公平、絕對公平，以及 online lottery、
certified fair、provably fair、tamper-proof、guaranteed fair 等對應說法。
不得暗示結果可被第三方驗證、經過認證或具備法律效力。

### 7.4 AEO 問答依據

以下問答同時作為可見 FAQ 與 `FAQPage` structured data 的唯一來源，中英文各一份。

| 問題（中） | 問題（英） | 答案依據 |
| --- | --- | --- |
| 這個工具怎麼做到每個人機會一樣？ | How does every entry get the same chance? | §3.1、§3.2 |
| 為什麼不能直接用隨機數除以名單長度取餘數？ | Why not just take a random number modulo the list length? | §3.2 模數偏差 |
| 抽多名時會不會有人被抽到兩次？ | Can the same entry be drawn twice? | §3.3 Fisher–Yates |
| 名單裡有重複的名字怎麼辦？ | What happens to duplicate names? | §4.3 |
| 輪盤的動畫會影響抽選結果嗎？ | Does the wheel animation change the result? | §5.4、§6.3 第 8 條 |
| 這個結果可以拿來公證或事後稽核嗎？ | Can this result be notarised or audited afterwards? | §7.1 `no-audit`、`not-a-lottery` |
| 名單最多可以放幾筆？ | How many entries can the list hold? | §4.4 |
| 關掉分頁以後還找得到結果嗎？ | Is the result still there after I close the tab? | §7.1 `local-processing` |
| 我的名單會被上傳嗎？ | Is my list uploaded? | ADR-0001：工具內容留在裝置 |

## 8. 來源清單

「頁面呈現」標記為「是」的來源會登錄到工具註冊的 `contentReview.sources`，在中英文工具頁上可點擊。

| 來源 | 版本／日期 | 用途 | 頁面呈現 | 連結 |
| --- | --- | --- | --- | --- |
| W3C Web Cryptography API | W3C Recommendation，2017-01-26 | `crypto.getRandomValues` 的密碼學強度要求 | 是 | <https://www.w3.org/TR/WebCryptoAPI/> |
| MDN Web Docs：Crypto.getRandomValues() | 2026-09-05 擷取 | 瀏覽器支援度與 `Uint32Array` 用法 | 是 | <https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues> |
| R. Durstenfeld, Algorithm 235: Random permutation, CACM 7(7) | 1964-07 | Fisher–Yates 部分洗牌的原始演算法 | 是 | <https://dl.acm.org/doi/10.1145/364520.364540> |

## 9. 已收斂的問題

- **要不要支援權重？** 不支援。規格 12.4 節明確把權重排除在第一版之外，
  而且權重與「等機率」的主張互相衝突，需要另一套說明與測試。
- **要不要保存抽選歷史？** 不保存。歷史會讓人以為結果可以事後查證，與 §7.1 的免責矛盾。
- **要不要用 canvas 畫輪盤？** 不用。以 SVG 繪製，扇形與標籤都是可讀的 DOM 節點，
  螢幕閱讀器與自動化測試都能取得候選名單，不需要額外維護一份等價文字。

## 10. 已知風險

1. **使用者可能重抽到滿意為止。** 這是本機抽選的本質限制，工具無法偵測，也不宣稱能防止。
   §7.1 的 `no-audit` 必須恆常呈現，不能只在說明頁出現。
2. **「保留重複」容易被誤解成不公平。** 同名兩筆各佔一個機會在數學上仍然等機率，
   但使用者可能認為「同一個人被算兩次」。因此名單真的出現重複時，介面必須主動說明目前策略，
   並指出切換方式（`duplicates-share-chances`）。

## 11. 交付給實作的引用點

| 決策 | 模組 |
| --- | --- |
| 上限、策略、錯誤 key、測試向量 | `app/features/tools/random-picker/domain/reference.ts` |
| 規則版本、免責 key、來源清單 | `app/features/tools/random-picker/domain/sources.ts` |
| 名單解析（§4） | `app/features/tools/random-picker/domain/list.ts` |
| 取樣與抽選（§3、§5.2、§5.3） | `app/features/tools/random-picker/domain/draw.ts` |
| 輪盤幾何（§6.3 第 8 條） | `app/features/tools/random-picker/domain/wheel.ts` |
| 介面文案、免責、FAQ（§5.2、§7） | `app/features/tools/random-picker/content.ts` |
