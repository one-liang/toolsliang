# toolsliang

台灣優先、工具內容留在使用者裝置上的萬用工具網站。使用 Nuxt 4、TypeScript、shadcn-vue、GSAP、Cloudflare 與 Supabase 建置。

目前已建立正式 Design System、工具導覽 App Shell 與第一個代表性本機工具工作區：

- [專案語言與核心概念](./CONTEXT.md)
- [架構決策紀錄](./docs/adr/)
- [Git Flow 與協作規範](./docs/GIT_FLOW.md)
- [正式 Design System](./design-system/toolsliang/MASTER.md)
- [工具平台基礎規格](./docs/specs/001-tool-platform-foundation.md)
- [下一階段 tickets](./docs/tickets/tool-platform-backlog.md)

正式網站預定使用 `toolsliang.com`。

## 本機開發

```bash
npm install
npm run dev
```

開發服務預設位於 `http://localhost:3000`。可直接檢查：

- 繁體中文首頁：`/zh-tw/`
- 英文首頁：`/en/`
- 工具目錄：`/zh-tw/tools/`
- 代表性工具：`/zh-tw/tools/ntd-uppercase/`
- Design System Page：`/zh-tw/design-system/`

## 驗證

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

可用 `npm run quality` 依序執行完整本機品質閘門。第一次執行瀏覽器測試前，先安裝三個測試引擎：

```bash
npx playwright install chromium firefox webkit
```

品質閘門的範圍、失敗判讀與人工驗證邊界請見 [前端品質閘門](./docs/QUALITY_GATES.md)。

工具搜尋與工具內容處理只在瀏覽器執行，不得加入會傳送工具內容的伺服器 API、分析事件或第三方服務。
