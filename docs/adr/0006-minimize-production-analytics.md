# 第一版只收集非個人化的流量與效能資訊

第一版只使用 Google Search Console 與 Cloudflare Web Analytics 理解搜尋曝光、頁面流量與真實效能，不建立使用者層級追蹤，不使用 session replay、廣告追蹤，也不傳送工具輸入、檔名、內容、輸出或錯誤 payload。若日後需要工具完成率，必須先另行決定僅包含工具 slug、非識別性結果碼與粗略耗時區間的明確 allowlist。
