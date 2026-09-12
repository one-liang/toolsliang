---
status: accepted
---

# 不發布瀏覽器本機的 Word 轉 PDF 工具

Word 轉 PDF 的本機可行性驗證（#28）判定為 **no-go**。在 Chromium、Firefox 與 WebKit 上對四條轉換管線、四十二份程式產生的 DOCX 完成量測後，沒有任何組合能在使用者裝置上把 Word 文件轉成一份忠實、可讀、可搜尋的 PDF。量測方法、逐格結果與判定依據記於 `docs/research/011-word-to-pdf-local-conversion-feasibility.md`，決策要點以 `app/features/tools/word-to-pdf/domain/reference.ts` 提供給平台引用。

判定來自三件事實，而不是任何一個候選的品質問題。第一，沒有可自行散布的瀏覽器端 Word 排版引擎：`docx-preview` 不計算分頁，它重播撰寫程式在存檔時留下的 `w:lastRenderedPageBreak`；同一份文字帶著這些標記會得到正確的三頁，拿掉之後就變成一頁超長版面。分節符號的 `nextPage` 完全不生效，換頁尺寸與換直橫向的分節則晚一節才斷開，橫向頁因此被畫成直向。第二，能把版面變成 PDF 的唯一可散布路徑是把頁面拍成圖片：七十八份輸出檔全部可以被獨立的 PDF 閱讀器開啟，全部零個文字項目。那是一份沒有文字可選、可搜尋、可複製、可被輔助技術讀出的 PDF，違反 WCAG 2.2 AA 對非文字內容的要求。第三，沒有任何候選提供進度或取消介面，也沒有任何一條管線能離開主執行緒——`docx-preview` 與 `html2canvas` 都需要 DOM——量到的主執行緒阻塞最高 214 毫秒，超過規格 §12.13 的 50 毫秒上限。

因此本站不提供 Word 轉 PDF。`word-to-pdf` 這個穩定 slug 依 ADR-0011 保留，但以未發布狀態註冊在工具註冊表中：它不得出現在公開 route、導覽、工具目錄、搜尋索引、sitemap、結構化資料、SEO 頁面或離線資產清單上。介面不得以任何形式預告它即將推出。這個邊界由 `wordToPdfForbiddenSurfaces` 與既有的未發布工具測試共同把關。

不採用雲端轉檔。Microsoft、Google 與各家轉檔 API 都能把這件事做好，而它們的做法是把使用者的文件送到別人的機器上。ADR-0001 把工具內容留在裝置上當成產品承諾而不是最佳化選項；一份合約、一份履歷、一份尚未公開的財報，值得的答案是「我們做不到」，不是在小字裡改用伺服器。同理，`zetajs` 背後的 LibreOffice WebAssembly 建置雖然真的能排版，但它不在 npm 上、由第三方網域提供、授權為 LGPL-3.0 與 MPL-2.0、體積以百 MB 計，本站無法從自有來源散布它。

未來要重新評估，必須先有下列其中一項成立：出現授權可自行散布、可在瀏覽器執行的 Word 排版引擎；出現能把版面寫成帶文字的 PDF 而不是圖片的可散布路徑；轉換能完全在 Web Worker 中執行；候選提供進度與取消介面。重新量測時仍須沿用 §12.13 的測試集規模與門檻，`docs/research/011-word-to-pdf-local-conversion-feasibility.md` §9.3 列出的條件是重新開啟這個問題的前提。在那之前，任何把 Word 轉 PDF 加回產品的提案都應先修改這份決策。
