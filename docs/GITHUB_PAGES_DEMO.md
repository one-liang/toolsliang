# GitHub Pages demo

Demo 網址：https://one-liang.github.io/toolsliang/

執行 `npm ci`、`npm run generate:demo`，靜態結果會寫入 `.output/public`。本機預覽必須把該目錄掛載在 `/toolsliang/`，以驗證與線上一致的資產與導覽路徑。

`.github/workflows/pages-demo.yml` 在初次設定分支與 `develop` 推送時，依序執行 lint、型別檢查、單元測試、靜態建置與 Pages 發布。GitHub repository 的 Settings → Pages → Source 必須設為 GitHub Actions。

Demo 可展示公開頁面與本機工具；不展示 PWA 安裝、離線頁面快取、Service Worker 更新或伺服器端帳號同步。瀏覽器仍需支援個別工具所使用的功能。檔案與輸出不會傳送到 GitHub，GitHub 只提供靜態程式、模型與 WASM。

正式部署維持 Cloudflare Workers；決策與例外範圍見 ADR 0018。
