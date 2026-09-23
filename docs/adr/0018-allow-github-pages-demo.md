# 允許以 GitHub Pages 提供獨立 demo

依使用者要求，新增 GitHub Pages 靜態 demo，網址為 `https://one-liang.github.io/toolsliang/`。這是 ADR 0005 與 ADR 0009 的非正式展示環境例外；正式站仍採 Cloudflare Workers，正式網域仍為 toolsliang.com。

Demo 預先產生公開頁面，工具內容仍只在使用者裝置處理。模型與 WASM 隨靜態資產由專案自己的 GitHub Pages 路徑提供，屬 ADR 0001 對資產主機的 demo 例外；不使用第三方推論服務或 production 帳號服務。

Demo 使用 `/toolsliang/` 路徑，加入 noindex，停用根目錄限定的 Service Worker 與安裝 manifest，因此不展示 PWA 離線安裝與版本更新。工具的本機處理與本機資產下載仍可使用。GitHub Pages 不執行伺服器端 API 或登入同步功能。

初次發布由 `feature/github-pages-demo` 驗證及部署；透過 PR 合入 `develop` 後，後續整合版本自動更新 demo。`github-pages` 是獨立的 GitHub environment，不使用 production 憑證。
