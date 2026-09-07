# 圖片壓縮工作區

延續 MASTER.md 的工具外殼、Card、Button、Input 與語意色彩。單欄先呈現檔案選擇，再呈現輸出設定；tablet 以上設定與比較預覽使用雙欄。檔案拖曳是附加入口，所有必要操作均可用原生檔案欄位及鍵盤完成。

圖片預覽的內容上限使用 `--image-preview-max-height: 400px` 元件 token；圖片依比例縮放、不裁切。原圖預覽由 Worker 縮小至最大 800 × 800，圖說保留原圖真實尺寸與 bytes。圖說與增減比例提供非視覺比較，透明度、品質、格式限制用文字說明。

錯誤區域常駐 `role=alert` 並與檔案欄位關聯；HEIC 拒絕後保留檔案欄位焦點。處理進度採不虛構百分比的 indeterminate progressbar，取消按鈕位於工作表單之外的停用範圍。工作表單有 aria-busy，進度與錯誤訊息不置於 busy 範圍中。
