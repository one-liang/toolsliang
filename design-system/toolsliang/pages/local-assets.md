# 本機資產頁

沿用 Tool App Shell、平面 Card、Button、語意色彩與字型，不新增動畫或遠端資產。

- 頁面標題沿用工具頁的 `tool-heading--with-icon`；`裝置儲存` 為 eyebrow，說明沿用 `body-md`。
- 邊界說明、儲存用量與操作各自成為一張平面卡片，維持 `radius-lg` 與 `card-shadow: none`。
- 儲存用量的配額比例條只是輔助圖形，寬度以百分比呈現並標記 `aria-hidden`；同一組數字必須在相鄰文字寫出，狀態不得只靠顏色或長度。
- 匯出、匯入與清除放在同一張操作卡片，各自附帶說明文字；卡片以 `auto-fit` 網格排列，窄螢幕自動堆疊。
- 檔案選擇器的原生按鈕文字由瀏覽器語言決定，因此輸入元素視覺隱藏（保留在無障礙樹），改由 `<label>` 呈現產品文案；`:focus-within` 時 label 顯示 3px focus ring，觸控目標維持 44px。
- 刪除與清除為破壞性操作：先在原位顯示 destructive 色系確認區塊，焦點移到確認按鈕；取消後回到原本清單。
- 破壞性按鈕使用 `button-destructive-bg`／`button-destructive-fg`；暗色主題的 destructive 是淺色，文字改為 `neutral-950` 以維持 AA 對比。
- 更名在該列展開輸入欄位，空白名稱時儲存按鈕維持 `disabled`；讀不到的資料只保留刪除。
- 操作結果由 `role="status"` 宣告，並把焦點移到狀態訊息，因為被刪除的列已經不在頁面上。狀態訊息只寫檔名與筆數，不重述資產內容。
