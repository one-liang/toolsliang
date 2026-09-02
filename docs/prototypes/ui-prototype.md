# toolsliang UI Prototype

> 狀態：等待人工選擇；此文件與 `app/components/variants/` 均為拋棄式驗證材料，不是 production Design System。

## 要回答的問題

toolsliang 的 Landing Page、工具導覽與工具工作區，應採用什麼結構及視覺方向？

三個方案集中在同一個 Nuxt prototype harness，以 `/zh-tw/?variant=A`、`/zh-tw/?variant=B`、`/zh-tw/?variant=C` 切換；英文示意使用 `/en/` 前綴。所有工具資料與代表性轉換都只在瀏覽器記憶體執行，不連接 Supabase、不呼叫外部處理 API。

## 方案假設

### Variant A：搜尋廣場

Landing Page 先建立品牌、搜尋與本機處理信任，再把使用者帶入獨立 App Shell。首頁與工作區角色最清楚，適合從搜尋與 SEO 入口逐步理解產品的人。

### Variant B：工具駕駛艙

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

尚未決定。選定 A、B、C 或混合方案後，應在此記錄採用結構、理由與明確捨棄內容，讓 Codex 與 Claude Code 取得相同決策脈絡。未獲選方案不得進入正式 production 程式碼。
