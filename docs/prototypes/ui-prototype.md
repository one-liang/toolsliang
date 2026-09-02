# toolsliang UI Prototype

> 狀態：已選擇 B 的結構，正在驗證簡約介面與動態互動風格；此文件與 `app/components/variants/` 均為拋棄式驗證材料，不是 production Design System。

## 要回答的問題

toolsliang 的 Landing Page、工具導覽與工具工作區，應採用什麼結構及視覺方向？

三個方案集中在同一個 Nuxt prototype harness，以 `/zh-tw/?variant=A`、`/zh-tw/?variant=B`、`/zh-tw/?variant=C` 切換；英文示意使用 `/en/` 前綴。所有工具資料與代表性轉換都只在瀏覽器記憶體執行，不連接 Supabase、不呼叫外部處理 API。

## 方案假設

### Variant A：搜尋廣場

Landing Page 先建立品牌、搜尋與本機處理信任，再把使用者帶入獨立 App Shell。首頁與工作區角色最清楚，適合從搜尋與 SEO 入口逐步理解產品的人。

### Variant B：簡約動態工具台

從第一屏就同時呈現側邊導覽、工具分類與釘選工作區。操作路徑最短、資訊密度最高，適合常回訪或已知道目標的人。

### Variant C：任務跑道

先詢問使用者要完成的任務，再以「選工具 → 輸入內容 → 檢查結果」的步驟引導。工具目錄退居次要位置，適合不熟悉工具名稱但清楚任務的人。

## 驗證範圍

- Landing Page 首屏、大型工具搜尋、工具分類、熱門工具與本機處理承諾
- 桌面可收合側邊欄、手機底部導覽與代表性「新臺幣國字大寫」工作區
- 中英文、亮暗色、常用工具與 URL 方案切換示意
- 375px、平板與桌面布局
- 鍵盤導覽、可見焦點、左右鍵方案切換與 skip link
- `prefers-reduced-motion`、基本 WCAG 2.2 AA 對比與瀏覽器 console error

## 決策紀錄

### 2026-09-02：採用 Variant B 的結構

以 Variant B 的「桌面左側導覽、中間工具探索、右側釘選工作區」為主要結構。這項決策確認資訊架構，不代表原有視覺風格或 prototype 程式碼可直接升格為 production。

視覺方向改為「簡約＋動態互動」：使用淺色側邊欄、低對比背景、白色工作卡、單一紫色重點與清楚的工具層級，移除手繪線、紙張紋理、膠帶和歪斜卡片。文字只保留搜尋、分類、工具名稱與本機處理承諾。GSAP 用於一次性區塊進場，指標光暈與 hover 回饋集中在主要操作區，且必須尊重 `prefers-reduced-motion`。

待視覺方向確認後，正式實作應從 `develop` 建立新 feature branch，以 shadcn-vue 重建勝出結構與元件、建立 Design System Page，並排除 A、C、prototype switcher 與所有拋棄式程式碼。
