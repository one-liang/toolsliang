---
status: accepted
---

# 採用 Variant B 的工具 App Shell 與平面化 Design System

正式工具體驗採用 UI Prototype Variant B 的資訊架構：桌面使用可收合淺色側邊欄，工具目錄以分類網格呈現，工具項目左側使用語意 icon、右側使用短狀態標籤，工具頁在主要內容區顯示自己的工作區。這個方向能讓回訪者快速找到工具，同時維持低文字密度與清楚層級；視覺採簡約平面化介面，hover 只改變背景與邊框，不使用指標追蹤光暈或工具卡陰影。

Landing Page 與工具 App Shell 仍依 ADR-0008 分離。首頁現階段只提供大型搜尋、本機處理承諾，以及全部工具分類與工具簡介；點擊後前往各自工具頁，不在首頁顯示桌面側邊欄、釘選工作區或工具操作面板。首頁的完整品牌視覺留待後續獨立設計，不阻擋工具目錄、工具頁與 Design System 先建立。

Prototype 只作為結構與視覺決策的一手材料，production 必須用正式 token、shadcn-vue 元件與深 module 重新實作。Variant A、Variant C、prototype switcher、prototype query parameter、手繪樣式與 prototype CSS 均不得進入正式分支；亮色模式不得使用全黑側邊欄。

工具狀態標籤先支援 `NEW`、`PRO`、熱門與常用的視覺及語意狀態。`PRO` 目前是保留狀態，不改變 ADR-0001 所定「所有工具可匿名使用」的產品邊界，也不得在本決策下加入訂閱檢查或付費鎖定；若未來要限制存取，必須另行更新產品決策、隱私說明與 ADR。

正式 Design System 的文件來源位於 `design-system/toolsliang/MASTER.md`，程式 token 與元件必須與其一致；頁面差異只能記錄在 `design-system/toolsliang/pages/`，不得以頁面內任意色碼或尺寸取代語意 token。
