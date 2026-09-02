# toolsliang

台灣優先、工具內容留在使用者裝置上的萬用工具網站。規劃使用 Nuxt 4、TypeScript、shadcn-vue、GSAP、Cloudflare 與 Supabase 建置。

目前處於產品與架構規劃階段：

- [專案語言與核心概念](./CONTEXT.md)
- [架構決策紀錄](./docs/adr/)
- [Git Flow 與協作規範](./docs/GIT_FLOW.md)

正式網站預定使用 `toolsliang.com`。

## UI Prototype

目前的 Landing Page、工具導覽與工具工作區原型位於 `feature/ui-prototype`，屬於等待選案的拋棄式驗證，不是 production 成品或正式 Design System。

```bash
npm install
npm run prototype
```

啟動後可直接開啟：

- `http://127.0.0.1:3000/zh-tw/?variant=A`
- `http://127.0.0.1:3000/zh-tw/?variant=B`
- `http://127.0.0.1:3000/zh-tw/?variant=C`

使用畫面底部 switcher 或鍵盤左右鍵切換方案；輸入框聚焦時不攔截左右鍵。production build 不會顯示 switcher。

## UI Prototype

目前的拋棄式 UI Prototype 用來比較 Landing Page、工具導覽與工具工作區的三種結構，不代表 production 成品或正式 Design System。

```bash
npm install
npm run prototype
```

啟動後開啟：

- Variant A：`http://127.0.0.1:3000/zh-tw/?variant=A`
- Variant B：`http://127.0.0.1:3000/zh-tw/?variant=B`
- Variant C：`http://127.0.0.1:3000/zh-tw/?variant=C`

英文示意可將 `/zh-tw/` 改成 `/en/`。只有開發模式會顯示底部 Prototype switcher。
