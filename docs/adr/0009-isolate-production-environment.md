# Production 與非正式環境完全隔離

`feature/*` PR、`develop`、`release/*` 與 `main` 分別對應 Cloudflare preview、staging、release candidate 與 production；只有 `main` 能在人工核准後部署 production。Preview、staging 與 release candidate 可共用非正式 Supabase project，production 必須使用獨立的 Supabase project、Auth 設定與資料，避免測試、preview 或公開快取觸及真實帳號資料。
