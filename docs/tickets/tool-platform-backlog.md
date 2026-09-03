# 工具平台下一階段 tickets

本清單把已選定的 Design System 與 App Shell 接到正式產品開發。每張 ticket 開始前仍須核對相關 ADR；不得因本清單推定 production 發布或付費存取已獲批准。

## TL-001：定義工具 catalog schema 與狀態生命週期

**目標**：將目前 catalog 基線補成可擴充且可驗證的正式註冊契約。

**驗收條件**：

- 定義必要欄位、locale fallback、分類唯一性與 stable slug 規則。
- 定義 NEW 的起訖條件、熱門的非個人化來源與常用工具的本機／登入合併規則。
- `PRO` 只定義顯示語意；付費限制另行提出產品決策與 ADR。
- catalog schema 與重複 slug 有自動測試。

## TL-002：完成新臺幣國字大寫正式規格

**目標**：把代表性工作區從基礎轉換器提升為符合台灣用途差異的正式工具。

**驗收條件**：

- 依 CONTEXT.md 的「新臺幣國字大寫」定義會計、支票與國庫付款憑單用途。
- 以可信來源確認零、整、角、分、負值、上限與輸入正規化規則。
- domain module 具邊界值與用途差異測試。
- 所有輸入與結果只留在瀏覽器。

## TL-003：常用工具本機儲存

**目標**：讓匿名使用者能收藏與取消收藏工具。

**驗收條件**：

- 使用者主動操作後才寫入本機儲存。
- App Shell 與手機導覽能檢視常用工具；空狀態可理解。
- 不儲存工具內容與使用歷史。
- 尚未接 Supabase；登入後合併行為另開 ticket。

## TL-004：首頁品牌與內容設計

**目標**：在不改變 ADR-0015 資訊架構的前提下，重新設計 Landing Page 品牌呈現。

**驗收條件**：

- 保留大型搜尋、本機處理承諾、全部分類與工具簡介。
- 不加入 App Shell 側邊欄或首頁工具工作區。
- 同時完成繁中與英文內容、SEO／GEO／AEO 與 structured data 檢查。
- 動態不追蹤指標、不遮擋操作，並完整支援 reduced motion。

## TL-005：工具 module 樣板與品質 gate

**目標**：讓每個新工具沿用一致的 privacy-by-construction 與測試方式。

**驗收條件**：

- 提供 domain、UI adapter、local asset、worker 邊界與測試的目錄範例。
- 自動檢查工具內容沒有被送到 server route、Supabase 或分析事件。
- 文件涵蓋雙語、canonical、hreflang、structured data 與無障礙檢查。
- 不自動產生 production deployment。

## TL-006：完整跨瀏覽器與可及性測試

**目標**：把目前 Chromium smoke test 擴充為 release gate。

**驗收條件**：

- 覆蓋 Chromium、Firefox、WebKit 的手機、平板與桌面斷點。
- 加入 axe-core 或等效的自動檢查，並保留人工鍵盤與 200% zoom checklist。
- 對 light／dark 的語意 token 組合建立可重跑對比測試。
- CI 只執行驗證，不觸發 production deployment。

## 建議順序

先完成 TL-001 與 TL-005，接著以 TL-002 驗證工具 module 契約；TL-003 可平行規格化，TL-004 在工具結構穩定後獨立設計，TL-006 於 release candidate 前升級為必要 gate。
