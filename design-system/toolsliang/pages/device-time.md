# 裝置時間工具頁

沿用 Tool App Shell、平面 Card、Button、語意色彩與字型，不新增動畫或遠端資產。

- 時鐘使用 `--device-clock-font-size`（`clamp(2rem, 4vw, 3.5rem)`）與 `--device-clock-font-weight`（750），沿用 MASTER 的 `display-sm` 尺寸及字重。
- `--device-clock-line-height` 使用 1.35，較標題預設行高寬鬆，讓等寬數字在文字間距覆寫和放大時仍有足夠垂直空間。這是數字時鐘的元件差異，不改變共用標題。
- 日期沿用 `body-lg`，時區標籤與狀態訊息沿用 `body-sm`；時區名稱允許折行。
- 秒數控制使用 `aria-pressed` 與可見的開／關文字。隱藏頁面暫停更新；時鐘不使用逐秒 live announcement。
- 複製等待時保留按鈕尺寸與焦點，以可見文字及圖示說明狀態；成功使用 success 色彩與 check 圖示，失敗使用 destructive 色彩、警示圖示與邊框。
- 本工具的 320px reflow 驗證發現共用頂部導覽溢出，因此在小於 480px 時將搜尋文字視覺隱藏，保留搜尋 icon、完整可存取名稱及 44px 操作目標。
