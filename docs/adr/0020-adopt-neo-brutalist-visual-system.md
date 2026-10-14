---
status: accepted
---

# 全站採用無陰影的新粗獷視覺系統

依使用者在 2026-10-15 的決定，全站視覺由原本以 `#FF8C42` 暖橘為主色的平面化系統，改為無陰影的新粗獷風格：白底、墨色 `#0B0B0B` 文字與 2px 邊界、黃色 `#FFD23F` 作為強調與 hover，五個工具分類各有固定的平塗色（圖片與商務素材粉紅、文件與金額天藍、時間與行事曆珊瑚、計算工具薄荷、本機抽選黃），平塗色上的文字在亮暗主題都使用墨色。任何元件都不使用陰影或漸層；主要按鈕為黑色膠囊，hover 轉為黃底墨字。

字型方面，中文沿用各平台系統字型（Apple 裝置為 PingFang TC、Windows 為微軟正黑體、其他為 Noto Sans TC），英文與數字改用自架的 Archivo variable，取代原本的 Roboto，仍不使用第三方字型 CDN。使用者評估過自架中文粗體字型後選擇系統字型，接受各平台顯示略有差異。

ADR-0015 的資訊架構維持不變：首頁與 App Shell 分離、可收合的淺色側邊欄、分類目錄與工具頁結構都不動；亮色模式的側邊欄仍為白底，只有目前所在項目以墨色反白標示，不構成 ADR-0015 禁止的黑色側邊欄。hover 只改變背景與邊框、不使用陰影的規則也延續。首頁的示範動畫以 GSAP 延遲載入、只播放一次，並在 `prefers-reduced-motion` 時直接呈現完成狀態。

正式規格以 `design-system/toolsliang/MASTER.md` 為準；`docs/specs/002-product-and-technical-specification.md` 中關於 `#FF8C42` 與 Roboto 的視覺基線由本決策取代。
