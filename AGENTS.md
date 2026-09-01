# 專案協作指引

開始工作前先讀取 [CONTEXT.md](./CONTEXT.md)；涉及架構、隱私、部署、品牌或產品邊界時，再讀取 [docs/adr](./docs/adr/) 內相關 ADR。

建立分支、提交、Pull Request 或發布時，遵守 [docs/GIT_FLOW.md](./docs/GIT_FLOW.md)。一般需求從 `develop` 建立 `feature/<english-kebab-case>`，完成驗證後透過 Pull Request 合回。

工具內容必須留在使用者裝置；若需求可能把檔案、圖片、文字、數值或處理結果送往伺服器或第三方，先停止實作並重新確認產品與隱私邊界。

產品文件、PR、issue 與工作摘要使用繁體中文。程式碼識別字、穩定網址 slug 與分支名稱使用英文。
