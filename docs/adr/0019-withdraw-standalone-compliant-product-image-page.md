# 撤下合規主圖獨立工具頁

依使用者要求，撤下 `/{locale}/tools/compliant-product-image/` 獨立工具頁。合規主圖不再出現在工具目錄、搜尋、sitemap、結構化資料、FAQ 與公開 route；`compliant-product-image` 這個 slug 依 ADR-0011 保留，以未發布狀態留在工具註冊表，避免日後被其他工具佔用，已收藏的裝置也會依註冊表自動清除這筆收藏。

撤下的只有頁面。商品圖工作台的合規分支仍沿用 `app/features/tools/compliant-product-image/` 的通路 preset、規則判定與版面引擎，ADR-0012 對合規主圖與品牌宣傳圖的區分維持不變；工作台原本連到獨立頁「查看完整規則與來源」的連結，改為直接外連該 preset 的通路公開規格原文。`docs/research/005-compliant-product-image-presets-and-sources.md` 仍是這些 preset 的查核依據。

補註（#107）：ADR-0022 移除了工作台的合規分支。通路 preset、規則判定、來源連結與核對結果都已移除，ADR-0012 的區分由 ADR-0022 取代；工作台只產生品牌宣傳圖，版型步驟仍沿用這個資料夾的版面引擎。`docs/research/005-compliant-product-image-presets-and-sources.md` 改為不再使用的歷史紀錄。

若日後要恢復獨立頁，需重新評估工具目錄的定位，並補回工作區、FAQ 與 e2e 驗證。
