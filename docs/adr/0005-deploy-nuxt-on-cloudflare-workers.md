# 以 Cloudflare Workers 部署 Nuxt

平台使用 Cloudflare Workers 與 Static Assets 部署 Nuxt 4，而不使用 Pages 或純 SPA。公開內容採 SSR 或 prerender，工具互動工作區在用戶端執行，驗證與帳號路由則使用 private/no-store 回應。重型運算透過 Web Worker 執行，WASM 為跨瀏覽器基線，WebGPU 只作為漸進式增強；超過 Static Assets 限制的版本化模型放在 Cloudflare R2。
