# 工具透過統一 Interface 註冊為深 Module

每個工具以穩定的 Tool Definition Interface 註冊名稱、分類、路由、SEO、隱私標示與工作區，平台統一處理 App Shell、搜尋、常用工具、能力檢查、進度、錯誤與內容模板。即時計算 Module 以無副作用的結果函式隔離行為；PDF、圖片與模型處理等重型 Module 則透過 Tool Engine Interface 在 Web Worker 執行，並封裝進度、取消、能力檢測、記憶體清理、Blob 輸出與結構化錯誤。這保留共用介面的杠桿與維護在地性，但不強迫快速計算與重型處理共用一個膚淺的執行介面。
