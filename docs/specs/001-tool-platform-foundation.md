# 工具平台基礎規格

## 狀態

- 階段：正式基線，等待各工具功能規格接續
- 決策來源：ADR-0001、ADR-0003、ADR-0008、ADR-0010、ADR-0011、ADR-0015
- Design System：`design-system/toolsliang/MASTER.md`

## 目的

建立 toolsliang 的正式導覽、工具頁框架與共用視覺語言，讓後續工具能在不重複解決布局、雙語、主題、隱私與無障礙問題的前提下，以獨立 deep module 開發。

## 使用者流程

1. 使用者從 `/zh-tw/` 或 `/en/` 進入 Landing Page。
2. 使用者可在首頁本機搜尋，或瀏覽全部工具分類與簡介。
3. 使用者選擇工具後進入固定英文 slug 的個別工具頁。
4. 桌面使用者透過可收合淺色側邊欄切換工具；手機與平板使用底部常駐導覽。
5. 工具的輸入、處理與結果留在使用者裝置；登入不是使用工具的前提。

## 正式頁面責任

### Landing Page

- 提供主要價值說明、大型工具搜尋、本機處理承諾與完整分類網格。
- 不顯示工具 App Shell 側邊欄、常用工作區或工具操作面板。
- 本階段只建立資訊架構基線；完整品牌首頁另開 ticket 設計。

### 工具目錄

- 依穩定的工具分類顯示所有工具。
- 工具項目左側為語意 icon，中間為名稱與短說明，右側可顯示 NEW、PRO、熱門或常用。
- 點擊項目只導向工具自己的永久頁面，不在目錄原地展開工作區。

### 個別工具頁

- 使用 App Shell 與固定路徑 `/{locale}/tools/{stable-english-slug}/`。
- 顯示工具名稱、分類、說明、狀態與本機處理聲明。
- 工具核心邏輯放在獨立 feature module；UI 不直接持有難以測試的處理規則。

### Design System Page

- 路徑為 `/{locale}/design-system/`。
- 展示色彩、語意 token、中英文 typography、spacing、radius、border、shadow、z-index、主題、斷點、motion、icon、元件狀態與 WCAG 基線。
- 文件 `MASTER.md` 是規格來源，展示頁是可操作的實作驗證，不取代文件。

## 功能需求

- 所有工具與分類資料由單一本機 catalog 註冊，具繁中、英文名稱與說明。
- 搜尋只比對目前瀏覽器記憶體中的 catalog，不送出搜尋字串。
- light 為預設；只有使用者主動切換時才保存主題偏好。
- `html[lang]`、canonical、hreflang 與頁面說明隨 locale 更新。
- 工具頁輸出 WebApplication structured data；首頁輸出 WebSite structured data。
- `PRO` 在目前階段只表示保留的產品狀態，不得限制匿名使用。

## 非功能需求

- Nuxt strict typecheck、lint、單元測試與 production build 必須通過。
- 375px、768px、1024px 與 1440px 不可水平溢出。
- 所有主要互動可用鍵盤完成，focus ring 清楚可見。
- 一般文字至少 4.5:1；大字、圖示與 UI 邊界至少 3:1。
- 主要觸控目標以 44 × 44 CSS px 為產品基線。
- `prefers-reduced-motion: reduce` 時關閉非必要動畫。
- 工具卡、側邊欄與 hover 不使用陰影；不使用 pointer-follow 效果。
- 工具互動期間不得產生工具內容的外部 request，console 不得出現 error。

## 明確排除

- Variant A、Variant C、prototype switcher 與 `?variant=` 行為。
- 將 prototype component 或 CSS 直接搬入 production。
- production deployment。
- Supabase 帳號、同步、訂閱或權限檢查。
- 依 `PRO` 標籤限制工具使用。
- Landing Page 的最終品牌視覺與行銷內容。

## 本階段驗收

- `/zh-tw/`、`/en/`、工具目錄、所有 catalog 工具永久頁與 Design System Page 可開啟。
- 新台幣大寫轉換代表性工具可完全離線執行並具單元測試。
- 桌面側邊欄可收合；手機與平板顯示底部導覽。
- light／dark、鍵盤、reduced motion、對比、console 與外部 request smoke test 通過。
