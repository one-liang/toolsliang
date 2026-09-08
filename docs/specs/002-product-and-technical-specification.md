# toolsliang 正式產品與技術規格

> 狀態：可交付 tickets 拆解；本規格不授權 production deployment，也不改變既有 ADR。

## Problem Statement

toolsliang 已確認 Design System、Variant B App Shell 與本機處理邊界，但目前仍缺一份把 Landing、工具註冊、雙語、PWA、偏好同步、環境隔離、品質 gate 與首批工具連成可實作契約的規格。沒有共同基線會造成 slug、bundle、隱私、離線快取、SEO 能力聲明與環境資料交叉等風險。

## Solution

Nuxt 4 公開內容採 SSR/prerender，工具內容只在瀏覽器處理；工具以 Tool Definition 註冊，並使用純 domain function 或 Web Worker Tool Engine。平台統一提供雙語永久網址、Design System、PWA、常用工具、只同步雲端偏好的 Supabase adapter，以及隔離的 Cloudflare 環境。每個工具都需通過功能、網路邊界、WCAG、跨瀏覽器、效能與安全驗收；Word to PDF 未通過可行性 gate 不發布，第一版不支援 HEIC。

## User Stories

1. As an 匿名使用者, I want every published tool without an account, so that I can start immediately.
2. As a privacy-conscious user, I want tool content and results to stay on my device, so that confidential material is not disclosed.
3. As a Taiwan user, I want complete Traditional Chinese pages and Taiwan-specific rules, so that tools fit my context.
4. As an English reader, I want complete English routes and copy, so that I never depend on mixed-language UI.
5. As a returning user, I want stable locale-prefixed URLs, so that links survive display-name changes.
6. As a first-time visitor, I want a concise Landing Page with search and categories, so that I can find a task quickly.
7. As a desktop user, I want a collapsible light sidebar, so that navigation and workspace remain balanced.
8. As a phone or tablet user, I want persistent reachable navigation, so that touch use does not lose core actions.
9. As a keyboard or low-vision user, I want visible focus, reflow, zoom, and complete keyboard paths, so that I can finish the same tasks.
10. As a motion-sensitive user, I want non-essential motion removed, so that the interface remains comfortable.
11. As a new user, I want accessible light by default and persistence only after my action, so that the site does not assume a preference.
12. As a user, I want local search, so that search terms do not reach analytics or third parties.
13. As an anonymous returning user, I want common tools saved on this device, so that they are quick to reopen.
14. As a signed-in user, I want only common tools and explicit interface preferences synchronized, so that tool content and local assets stay private.
15. As an offline user, I want the App Shell and lightweight tools after a prior visit, so that intermittent connectivity is tolerable.
16. As a heavy-tool user, I want models or WASM downloaded only when needed, so that initial load stays fast.
17. As a user with unfinished work, I want to choose when a PWA update refreshes, so that results are not lost.
18. As a developer, I want one validated Tool Definition route contract and one heavy Tool Engine contract, so that every tool shares platform guarantees.
19. As a release manager, I want isolated preview, staging, release candidate, and production with human production approval, so that test state cannot cross boundaries.
20. As a search visitor, I want localized canonical content, visible answers, sources, and limitations, so that I land on accurate information.
21. As an adult, I want sourced BMI calculation and caveats, so that I do not mistake it for diagnosis.
22. As a user, I want device time labeled as device-derived, so that I do not mistake it for official network time.
23. As a Taiwan office user, I want NTD wording for a selected document purpose, so that the output matches that context.
24. As an organizer, I want equal-probability local drawing and an optional wheel with audit limitations, so that names are not uploaded or fairness overstated.
25. As a Taiwan user, I want a source-versioned calendar with Gregorian, ROC, lunar, solar-term, holiday, and adjusted-workday data, so that planning is traceable.
26. As a scheduler, I want local custom calendar overrides with storage controls, so that private schedules stay under my control.
27. As an image user, I want local compression with progress and quality controls, so that I can reduce supported files privately.
28. As an image user, I want local background removal, so that image pixels never reach an external AI service.
29. As a merchant, I want reviewed compliant-image presets and a no-approval guarantee notice, so that guidance is useful but honest.
30. As a商用創作者, I want local background, frame, and Logo composition without first-version text or price tags, so that scope stays reliable.
31. As a商用創作者, I want reusable image engines combined in a batch workbench, so that repeated import/export is unnecessary.
32. As a PDF user, I want local handwritten-signature placement clearly distinguished from digital signatures, so that capability and limits are clear.
33. As a Word user, I want Word to PDF published only after reliable browser-local validation, so that conversion is not misleading.
34. As an iPhone image user, I want a clear bilingual HEIC exclusion, so that an unsupported file is not mishandled or uploaded.
35. As a constrained-device user, I want preflight limits, named progress, cancellation, and safe errors, so that heavy work remains controllable.
36. As a security reviewer, I want self-hosted assets, CSP, input/resource limits, and zero-content network tests, so that local processing is verifiable.
37. As a product owner, I want NEW, PRO, HOT, and SAVED to remain semantic labels, so that PRO does not silently restrict anonymous use.

## Implementation Decisions

### 1. Product and application foundation

- Use Nuxt 4, Vue 3, strict TypeScript, shadcn-vue source-owned components, the accepted toolsliang Design System, and GSAP only for finite, non-blocking feedback. Public pages use SSR or prerender; interactive workspaces hydrate and process content in the browser.
- Keep Landing Page and Tool App Shell as separate layouts sharing brand, locale, theme, search, account, token, and primitive components. Production keeps Variant B only. Variant A, Variant C, prototype switcher, `?variant=`, prototype CSS, hand-drawn styling, pointer-follow effects, and card shadows are forbidden.
- The visual baseline is light-first, flat, warm, minimal, and uses the accepted semantic tokens. The exact brand primitive `#FF8C42` is not used as small text on light surfaces; readable semantic aliases are mandatory. English uses locally bundled Roboto; Traditional Chinese uses the approved system stack.
- The root URL redirects temporarily to `/zh-tw/` without language sniffing. Supported locale prefixes are exactly `/zh-tw/` and `/en/`. `/tw/` is not a canonical locale and must not be generated. Browser language may suggest a switch but may not force navigation.
- Every tool uses `/{locale}/tools/{stable-english-slug}/`. Display names can change without changing the slug. A slug change requires an explicit migration, permanent redirect map, updated canonical, and regression test.
- Initial tool categories are product-owned stable identifiers, not audience modes. The final category list must cover calculation, time and calendar, random selection, images and commerce, and documents without assigning one tool to multiple primary categories. Cross-category groupings such as merchant or office collections are optional shortcuts, not categories.

### 2. Highest test seam and module contracts

- The main test seam is the registered Tool Definition observed through the rendered locale route: one fixture registration must be discoverable in local search, navigation, category output, canonical and hreflang metadata, structured data, privacy disclosure, capability gate, and its selected workspace adapter. This is the highest reusable seam and is the default integration contract for all tools.
- Lightweight tools expose a pure, side-effect-free domain function. It accepts serializable validated input and returns a typed result or a stable structured error. It must not import browser networking, Supabase, analytics, UI, or storage adapters.
- Heavy tools expose one Tool Engine contract with `capabilities`, `prepare`, `run`, `cancel`, and `dispose` responsibilities. Work runs in a Web Worker; input and output cross the boundary with transferable data when possible. Progress consists of stable stage code, completed units, total units when known, and localized UI copy supplied outside the engine.
- Cancellation uses `AbortSignal` semantics and is idempotent. A cancelled run yields a `cancelled` outcome, not a generic error; partial output is discarded unless the tool explicitly defines recoverable completed items.
- Structured errors include stable code, recoverability, safe technical details, and an optional suggested action. Error payloads, logs, monitoring, and clipboard diagnostics must never contain filenames, text, image pixels, PDF content, values entered into tools, or output.
- Tool Definition includes slug, primary category, icon key, localized name and short description, status metadata, availability state, processing class, route component key, SEO content key, capability requirements, accepted input description, local-processing statement, and content/source review metadata. Runtime components are resolved from an allowlisted registry rather than arbitrary dynamic paths.
- Catalog validation rejects duplicate slugs, missing locales, unknown categories or icons, invalid status dates, inaccessible label combinations, and a published tool without SEO and capability metadata.
- NEW has explicit `startsAt` and `endsAt`; after expiry it disappears automatically. HOT is an editorial or aggregate non-personalized flag with a documented source. SAVED comes from the user's common-tool state. PRO remains presentational only until a separate accepted product and access-control decision exists.

### 3. Landing Page, App Shell, search, and Design System Page

- Landing Page contains a concise value proposition, large local tool search, the on-device privacy commitment, and all tool categories with short tool introductions. It does not show the App Shell sidebar, bottom app navigation, pinned workspace, or inline tool execution. Full brand marketing work remains a dedicated later design ticket.
- Desktop Tool App Shell uses a light surface collapsible sidebar; collapsed navigation uses icons with accessible names. Category headings have typographic hierarchy and no heading icon. Tool entries use a semantic icon on the left and optional short status label on the right. Light theme never uses a black sidebar.
- Phone and tablet hide the desktop sidebar. A persistent bottom navigation has at least 44×44 CSS px targets, safe-area padding, and no focused element can be hidden behind it. Category navigation opens as a full-screen accessible drawer; primary tasks do not depend on hover or drag.
- The tool directory lists every published tool once under its primary category and links to its individual page. A tool workspace never expands inside the directory or Landing Page.
- Search builds an in-memory index from the local catalog, matches localized name, aliases, description, category, and curated keywords, and never transmits the query. It supports keyboard selection, announced result count, empty state, Escape dismissal, and deterministic ranking: exact name, prefix, alias/keyword, then description.
- Design System Page at `/{locale}/design-system/` renders the same production tokens and components. It covers primitive, semantic, and component tokens; bilingual typography; spacing; radius; border; shadow; z-index; light/dark; breakpoints; motion and reduced motion; icons; focus, hover, active, disabled, loading, error, success; labels; responsive examples; and WCAG rules.

### 4. Internationalization and content contract

- All public UI, help text, validation, errors, progress stages, limitations, FAQs, metadata, and structured data ship in both Traditional Chinese and English. No runtime machine translation and no English placeholder are allowed on a published route.
- Traditional Chinese is written for Taiwan using the domain glossary. English favors short plain-language task terms. Legal, health, privacy, randomness, and channel-compliance limitations cannot be softened into playful claims.
- Locale switching preserves the stable path, query state when safe, and fragment. It updates `html[lang]`, title, description, Open Graph fields, canonical, hreflang, visible text, and structured data.
- Dates and numbers use locale-aware presentation, but domain values remain canonical. ROC year is an additional display, never a replacement for an unambiguous Gregorian date in stored records.

### 5. Theme and interface preferences

- Light is the default on first use and before hydration. No theme preference is written until the user explicitly toggles. Once changed, the selected theme can be stored locally and, after voluntary sign-in, synchronized as a cloud preference.
- Theme application prevents an avoidable flash, respects the explicit choice over system preference, and uses the approved light/dark semantic tokens. Every state and overlay is validated in both themes.
- Sidebar collapsed state, locale preference, and reduced-density preferences may be synchronized only after an explicit user choice. Operating-system reduced-motion remains a device capability and is not overridden by cloud preference.

### 6. Local processing and network boundary

- Tool content means all user-provided files, pixels, text, names, values, metadata, intermediate buffers, results, signatures, templates, frames, Logos, and custom calendar events. Tool content never goes to platform routes, Supabase, analytics, error monitoring, logging, or third-party servers.
- Search queries are tool content for the purpose of the network boundary. URL query parameters must not contain tool input, filenames, draw candidates, signature data, or results.
- Models, WASM, fonts, holiday data, and static channel presets are immutable application assets served only from toolsliang-controlled Cloudflare origins. Their requests contain version identifiers only, not user content or content-derived identifiers.
- The platform has no server endpoint accepting tool content. Network-bound adapters accept only an explicit allowlist of account identity, common-tool slugs, locale, theme, interface preference, coarse non-identifying traffic/performance signals, and Auth protocol data.
- Service Worker caches only versioned application/static assets. It must not cache tool inputs or outputs, Blob URLs, IndexedDB content, Auth responses, private/no-store routes, Supabase responses, or user-specific HTML.
- General tool input/output is memory-only and released on reset, route leave, worker termination, or tab close. A local asset is persisted only after an explicit save action and remains on the device.
- Local assets use an IndexedDB repository with versioned schemas, quota estimation, per-asset size, export/import where appropriate, and clear-all controls. The UI states that browser cleanup, private browsing, quota eviction, or device loss can remove them.

### 7. PWA and progressive offline behavior

- Provide an installable manifest with localized name/description, standalone display, approved theme/background colors, platform icons, shortcuts only to lightweight public tools, and no promise that every heavy tool works before its assets are downloaded.
- Precache the minimum App Shell, catalog, Design System-critical CSS, local fonts required for the current locale, offline explanation, and lightweight tool modules. Heavy engines, models, fonts, calendars, and channel presets are fetched on first use and cached by explicit version.
- Each tool declares `offlineMode`: `ready`, `requires-first-download`, or `online-to-prepare`. Capability UI explains the current state before work starts. Once required static assets are cached, processing remains local and can continue offline.
- When a new version is ready, notify rather than force reload. If any workspace is dirty, running, or holds undownloaded output, defer activation until the user confirms. Security updates can increase urgency but still explain the effect.
- Storage management lists large cached engines/models separately from local assets. Safe cleanup removes obsolete static versions only when no active worker uses them and never deletes a local asset without explicit confirmation.

### 8. Common tools, Supabase Auth, and cloud preferences

- All tools remain anonymously usable. Authentication exists only to synchronize cloud preferences. The first Auth method is Supabase email magic link/OTP; additional identity providers require a separate privacy and support decision.
- Anonymous common tools are stored in a device-local namespace. On first sign-in, the user is told that only tool slugs and interface preferences will sync; local and cloud common-tool sets are merged by union once. Later signed-in add/remove operations synchronize explicitly and use optimistic local state with retry.
- Signing out returns to the anonymous namespace and clears account-specific cached responses and pending Auth state from shared UI memory. It does not delete local assets and does not silently copy cloud choices into anonymous storage.
- Cloud schema is limited to an owner-scoped preference record and owner-scoped common-tool rows. Preference fields are nullable until explicitly chosen and include locale, theme, sidebar state, timestamps, and schema version. Common-tool rows contain user id, stable tool slug, created/updated time, and deletion/version information needed to prevent unintended resurrection.
- Row Level Security requires authenticated ownership for every read and mutation. There is no service-role credential in the client. Auth callbacks and account routes are private/no-store and excluded from Service Worker caches.
- Offline preference operations may queue only allowlisted preference fields and tool slugs. Queue records contain no tool content. Conflicts use latest explicit mutation by server timestamp after the one-time union; an invalid or retired slug is ignored and reported as a non-blocking sync warning.
- Account deletion removes Supabase Auth identity and cloud preferences through an authenticated server flow. Local assets are separate; the UI offers an independent clear-local-assets action rather than implying cloud account deletion removed device content.

### 9. SEO, AEO, and GEO

- Every indexable page has one localized canonical URL, reciprocal `zh-Hant-TW` and `en` hreflang, `x-default` to `/zh-tw/`, unique title, meta description, Open Graph metadata, one `h1`, semantic landmarks, and crawlable links. Query variants, Auth, preview, staging, release candidate, and unavailable feasibility routes are `noindex`.
- Landing Page emits `WebSite` structured data and a discoverable local-search interaction description without implying server search. Tool pages emit `WebApplication` and `BreadcrumbList`. `FAQPage` is used only when the same localized questions and answers are visible. Do not fabricate ratings, prices, review counts, claims, or platform approvals.
- Each tool content record contains localized concise answer, what it does, how it works, input/output, privacy boundary, limitations, steps, FAQ, source links where the claim changes over time, source edition, and review date. This visible content is the single source for SEO, AEO, and GEO summaries.
- Taiwan holidays, workday adjustments, health categories, document wording, and marketplace presets require authoritative primary sources and explicit effective dates. Changing claims are versioned and can be withdrawn without changing the stable tool slug.
- Generated output, user input, common tools, or local assets never become indexable URLs. No user content is embedded in structured data or server-rendered HTML.

### 10. Cloudflare Workers and environment isolation

- Deploy Nuxt 4 with Cloudflare Workers and Static Assets, not a pure SPA. Public content is SSR/prerendered; tool engines run client-side. Versioned assets too large for Static Assets live in private project-controlled R2 delivery with immutable public asset URLs and no user content.
- `feature/*` Pull Requests map to ephemeral feature preview, `develop` to staging, `release/*` to release candidate, and `main` to production. Only `main` can request production deployment, and the final production environment requires a human approval gate.
- Feature preview, staging, and release candidate may share a non-production Supabase project but use environment-specific redirect allowlists and non-production credentials. Production uses a separate Supabase project, Auth configuration, data, Cloudflare bindings, secrets, R2 namespace, and analytics property.
- Non-production environments send `X-Robots-Tag: noindex, nofollow`, are visually identified, and never emit production canonical URLs as if their host were production content. Production configuration cannot be loaded by preview builds.
- CI builds an immutable candidate once per commit where possible. Promotion verifies commit SHA, migrations, asset/model versions, and environment bindings. Database migrations are forward-compatible and tested against non-production before a release candidate.
- Rollback restores a prior application and static-asset version without deleting preference data. Tool definition and preference schema changes must tolerate one previous client version during PWA update overlap.

### 11. Cross-cutting accessibility, performance, and security

- WCAG 2.2 AA is a release requirement: text contrast 4.5:1, large text and non-text UI 3:1, visible 3px focus, logical DOM/focus order, skip link, semantic labels/errors, no keyboard trap, 44×44 product touch baseline, 320 CSS px reflow, 200% zoom, text-spacing override, screen-reader status, and focus not obscured by sticky UI.
- Drag and drop, canvas manipulation, and wheel interaction always have a keyboard and form-based alternative. Canvas-only meaning has adjacent semantic text. Live regions announce meaningful completion and error changes without repeating every progress tick.
- Reduced motion removes entry sequences, wheel flourish, smooth scrolling, and animated progress where a static equivalent works. No pointer-follow, scroll-jacking, endless decorative motion, layout-shifting hover, card shadow, hover shadow, or forced sound.
- Public route targets at p75: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 on representative Taiwan mobile conditions. Shared initial JavaScript target is ≤220 KiB gzip and CSS ≤60 KiB gzip, excluding lazily loaded tool engines/models. A ticket exceeding the target must include a measured exception and split plan.
- Heavy modules are route-lazy and worker-lazy. No background-removal model, PDF engine, office engine, or image workbench code enters Landing Page or lightweight tool chunks. Main-thread tasks should remain under 50 ms; progress UI must become visible within 250 ms of starting preparation.
- Capability checks consider API availability, cross-origin isolation if required, storage quota, estimated memory, input type, dimensions/pages/items, and cached asset version. Unsupported cases fail before destructive work with a bilingual alternative that does not recommend uploading to another service.
- Validate file signatures and decoded content rather than extension alone. Define per-tool item, byte, pixel, and page limits; reject decompression bombs and unreasonable dimensions. Revoke Blob URLs, terminate workers, clear canvases/buffers, and dispose models after use.
- Apply a restrictive CSP, same-origin static assets, Trusted Types where supported, dependency lockfile review, license/model provenance review, no runtime `eval`, no remote scripts, no third-party font CDN, and no HTML/SVG execution from user files. Uploaded-looking content is never inserted as unsanitized HTML.
- Production analytics is limited to Google Search Console and Cloudflare Web Analytics without user-level tracking. No session replay, advertising identifiers, tool input, filenames, values, output, search queries, or error payloads. Any future completion telemetry requires a new allowlist decision.

### 12. Tool specifications

#### 12.1 BMI calculation

- **User story and non-goals:** An adult can enter height and weight and receive BMI plus a clearly sourced category explanation. It is not medical diagnosis, treatment advice, body-fat measurement, pediatric assessment, pregnancy assessment, or an emergency service.
- **Local boundary:** Height, weight, unit choice, BMI, and category remain in memory. They are not persisted, synchronized, placed in the URL, or logged.
- **Module and interface:** A pure calculator accepts metric or imperial input normalized to kilograms and meters, validates finite positive ranges, and returns numeric BMI, rounded display, source-versioned category id, and caveat keys. Category thresholds are configuration reviewed against an authoritative Taiwan health source before release.
- **Route and slug:** `/{locale}/tools/bmi-calculator/`; stable slug `bmi-calculator`.
- **Bilingual content:** `BMI 計算` / `BMI Calculator`; concise description states “依身高與體重估算成人 BMI” / “Estimate adult BMI from height and weight.” Privacy copy states that measurements stay on the device. Both locales show formula, category source date, and health limitations.
- **SEO/AEO/GEO:** Answer “BMI 如何計算 / How is BMI calculated?” with the visible formula and units. Use WebApplication, BreadcrumbList, and only visible FAQ. Avoid claims that a result establishes health, fitness, or disease.
- **Errors, cancellation, progress, capability:** Inline errors cover missing, non-numeric, zero/negative, and outside-supported-range input. Calculation is immediate; no progress or cancel UI. Capability requires JavaScript only.
- **Accessibility:** Inputs have units in labels, results are announced politely, category is text not color-only, and unit switching is a labeled control with preserved values.
- **Performance budget:** Calculation ≤50 ms and route adds ≤15 KiB gzip tool code.
- **Tests and acceptance:** Unit conversion, threshold boundaries, rounding, invalid numbers, locale copy, keyboard form, screen-reader result, no network request, and source-version display pass.
- **Dependencies and risks:** Thresholds and health wording can change and are high-stakes; source research and content review block publication.

#### 12.2 Device time

- **User story and non-goals:** A user sees current date, time, timezone, UTC offset, and optional common formatting based on the device. It is not network-corrected national standard time, time synchronization, legal timestamping, or proof of time.
- **Local boundary:** Time is read from browser APIs only. Timezone and display choice are not sent or persisted unless later added as an explicit interface preference.
- **Module and interface:** A pure formatter accepts an injected instant, locale, timezone from `Intl`, and format option; a UI clock schedules aligned updates and corrects after visibility change rather than accumulating interval drift.
- **Route and slug:** `/{locale}/tools/device-time/`; stable slug `device-time`.
- **Bilingual content:** `裝置時間` / `Device Time`; copy explicitly says it follows the device clock and settings. Show timezone identifier and UTC offset beside the time.
- **SEO/AEO/GEO:** Answer what device time means and why it can be wrong. Never title or describe it as exact, official, atomic, or Taiwan standard time.
- **Errors, cancellation, progress, capability:** If timezone or advanced `Intl` parts are unavailable, show a reduced local clock and a capability notice. No long-running progress or cancel.
- **Accessibility:** Use a user-controlled option for seconds; do not announce every tick. The semantic time element exposes a machine-readable datetime; updates do not steal focus.
- **Performance budget:** Each update ≤16 ms, no continuous animation frame loop, and background tabs pause nonessential rendering.
- **Tests and acceptance:** Injected-time deterministic tests cover DST/offset/locale formatting; visibility resumption, no per-second live announcement, reduced capabilities, and no network calls pass.
- **Dependencies and risks:** Device clock and timezone database may be wrong or stale; limitations must remain adjacent to the result.

#### 12.3 NTD uppercase

- **User story and non-goals:** A Taiwan user converts a New Taiwan dollar amount using an explicitly selected accounting, cheque-reference, or treasury-payment-voucher rule set. It is not legal review, payment authorization, or a guarantee that a receiving institution accepts the wording.
- **Local boundary:** Amount, purpose, normalized value, and output stay in memory and are excluded from analytics, URL, and storage.
- **Module and interface:** A pure decimal-safe converter accepts a string and purpose enum, never binary floating-point as the authoritative amount. It returns normalized decimal parts, uppercase tokens, final wording, and rule-version id. Negative values, zero, `整`, `角`, `分`, internal zeros, upper bound, and purpose differences are explicit.
- **Route and slug:** `/{locale}/tools/ntd-uppercase/`; stable slug `ntd-uppercase`.
- **Bilingual content:** `新臺幣國字大寫` / `NTD Uppercase`; use the formal glossary term and explain that the output is Traditional Chinese document wording. Errors and help are fully bilingual even when the result itself is Chinese.
- **SEO/AEO/GEO:** Visible answers explain supported purposes, decimal rules, and examples. Claims and wording rules cite reviewed primary or institutional sources with edition dates.
- **Errors, cancellation, progress, capability:** Reject exponent notation, extra decimal places, unsupported signs, unsafe range, and ambiguous separators with specific inline messages. Immediate result; no progress/cancel.
- **Accessibility:** Purpose options form a labeled radio group or select; output is selectable text, announced after valid change, with explicit copy confirmation.
- **Performance budget:** Conversion ≤50 ms and no external dependency required.
- **Tests and acceptance:** Exhaustive boundary and golden cases cover every digit/unit transition, decimals, zero, purpose rules, input normalization, both locales, keyboard flow, and zero requests.
- **Dependencies and risks:** Existing representative logic is not authoritative for all purposes. Source research and decimal refactor are mandatory before declaring the tool complete.

#### 12.4 Equal-probability local draw and wheel

- **User story and non-goals:** A user enters candidates, chooses draw count/replacement rules, and runs an equal-probability local draw with either accessible list results or a wheel presentation. It is not audited, tamper-proof, certified, remotely shared, or suitable for regulated lotteries.
- **Local boundary:** Candidate names, weights—weights are not supported in version one—results, and history remain in memory unless the user explicitly exports a local file. No candidates appear in URLs or logs.
- **Module and interface:** A pure random-selection module consumes candidate ids and an injectable cryptographic random-byte source. It uses rejection sampling to avoid modulo bias and Fisher–Yates for without-replacement ordering. The wheel is presentation only and lands on the precomputed result; animation never determines fairness.
- **Route and slug:** `/{locale}/tools/local-random-draw/`; stable slug `local-random-draw`.
- **Bilingual content:** `本機抽選與抽籤輪盤` / `Local Random Draw & Wheel`; state equal probability, local processing, and no anti-cheat/audit capability.
- **SEO/AEO/GEO:** Visible explanation answers how equal probability is achieved and why a local result cannot be independently verified. Do not use “certified fair” or “online lottery.”
- **Errors, cancellation, progress, capability:** Detect empty/duplicate-only lists, invalid draw count, unavailable secure randomness, and too many entries. Parsing can show progress for large pasted lists. A running wheel can be skipped/cancelled without changing the chosen result.
- **Accessibility:** The form and text-result flow is complete without wheel/drag. Wheel canvas has an adjacent candidate list, result live region, skip-animation control, and reduced-motion instant result.
- **Performance budget:** Parse and draw 10,000 short candidates in ≤200 ms on the reference desktop; wheel targets 60 fps and never blocks result access.
- **Tests and acceptance:** Deterministic injected-random tests cover mapping, replacement, cancellation, duplicates, and result immutability; statistical smoke tests detect gross bias but do not replace algorithm review. Keyboard, reduced motion, screen reader, and no-network tests pass.
- **Dependencies and risks:** Browser randomness availability, misleading fairness language, huge pasted content, and animation-result divergence require explicit tests.

#### 12.5 Taiwan calendar

- **User story and non-goals:** A user views a year with Gregorian date, ROC year, lunar date, solar terms, national holidays, and officially adjusted workdays. It does not predict future government decisions or claim unofficial school/company schedules.
- **Local boundary:** Selected year and filters may be interface state; no personal event is required or sent. Downloaded calendar datasets are public versioned assets, not tool content.
- **Module and interface:** A calendar domain combines a deterministic Gregorian/ROC layer, reviewed lunar/solar-term library or dataset, and a versioned official-day registry. Every annotation carries type, source edition, effective date, and confidence/status. Years without published official data are clearly marked.
- **Route and slug:** `/{locale}/tools/taiwan-calendar/` with crawlable year views using a safe path or canonical query policy defined in implementation; stable tool slug `taiwan-calendar`.
- **Bilingual content:** `台灣行事曆` / `Taiwan Calendar`; labels distinguish `國定放假日`, `補班日/調整上班日`, lunar date, and solar term. English retains Taiwan-specific terms with short explanations.
- **SEO/AEO/GEO:** Annual pages may be indexed only when complete, source-versioned, and canonical. Visible answers cite the responsible Taiwan authority and dataset publication/review date; structured data must not imply events beyond the source.
- **Errors, cancellation, progress, capability:** Offline uncached years show download requirement; unavailable/future official data shows unknown rather than guessing. Dataset preparation is cancellable; lightweight year/filter changes are immediate.
- **Accessibility:** Calendar is available as logical table/list, not color-only grid. Today, holiday, workday, lunar, and solar terms have text; keyboard navigation does not trap focus; mobile offers an equivalent agenda list.
- **Performance budget:** Cached year data renders meaningful content ≤500 ms, month changes ≤100 ms, and only the active year/month DOM is expanded on constrained devices.
- **Tests and acceptance:** Golden dates cover Gregorian/ROC conversion, lunar boundaries, leap months, solar terms, cross-year weeks, official holidays, adjusted workdays, unknown years, locale, keyboard, reflow, and data-edition display.
- **Dependencies and risks:** Official calendars change annually; lunar and solar-term licensing/accuracy are nontrivial. Primary-source ingestion, review ownership, and withdrawal procedure block publication.

#### 12.6 Custom calendar

- **User story and non-goals:** A user layers company holidays, school days, shifts, or other work/non-work overrides on the Taiwan calendar and saves them on the current device. It is not a shared team calendar, cloud calendar, legal labor-rule engine, notification service, or Supabase-synced asset.
- **Local boundary:** Titles, notes, dates, recurrence, imports, and exports are local assets in IndexedDB. They never sync as cloud preferences or enter analytics.
- **Module and interface:** A calendar-overlay domain validates local event/override records and applies them without mutating official source data. A local asset repository supports schema migration, list/read/write/delete, export/import, storage size, and explicit clear. Official and custom layers remain distinguishable.
- **Route and slug:** `/{locale}/tools/custom-calendar/`; stable slug `custom-calendar`.
- **Bilingual content:** `自訂行事曆` / `Custom Calendar`; explain “saved on this device only” and loss risks. Export/import copy states exactly what the local file contains.
- **SEO/AEO/GEO:** Index only general capability/help, never user event routes. Answer how local saving works, what can be lost, and how official versus custom dates differ.
- **Errors, cancellation, progress, capability:** Handle unavailable/quota-limited IndexedDB, invalid date/range, import schema/version, duplicate ids, and conflicts. Bulk import/export is cancellable with item progress and rollback on invalid transaction.
- **Accessibility:** Event editor is form-first with keyboard-accessible date inputs; drag resizing is optional. Layer type and conflict are textual and screen-reader discoverable.
- **Performance budget:** Open 5,000 local records ≤500 ms on reference desktop; ordinary save/delete feedback ≤100 ms after transaction completion.
- **Tests and acceptance:** Repository contract, migration, quota error, import rollback, official-layer immutability, logout independence, clear confirmation, keyboard editor, screen reader, and no-network persistence tests pass.
- **Dependencies and risks:** Browser eviction and private mode can erase assets; recurring-event complexity and ambiguous labor rules remain constrained and clearly stated.

#### 12.7 Image compression

- **User story and non-goals:** A user compresses supported raster images locally, previews tradeoffs, and downloads output. It is not archival preservation, a promise of lossless reduction, cloud backup, or HEIC conversion in version one.
- **Local boundary:** Source pixels, EXIF, previews, output, and filenames stay in memory or explicit local downloads. Static codecs may be fetched from toolsliang-controlled assets.
- **Module and interface:** A worker engine decodes supported PNG, JPEG, and WebP, normalizes orientation, offers quality/format/resize choices, strips metadata by default, estimates output, and returns Blob plus dimensions/size. Metadata retention, if later supported, must be explicit.
- **Route and slug:** `/{locale}/tools/image-compressor/`; stable slug `image-compressor`.
- **Bilingual content:** `圖片壓縮` / `Image Compressor`; list supported formats, metadata behavior, quality caveat, and local-processing statement.
- **SEO/AEO/GEO:** Explain lossy versus lossless behavior and that local processing does not upload images. Do not claim a fixed reduction percentage.
- **Errors, cancellation, progress, capability:** Validate signature, decode support, dimensions, byte/pixel limits, memory estimate, storage, and encoder availability. Stages: reading, decoding, processing, encoding, preparing download. Every running stage is cancellable.
- **Accessibility:** File picker is primary; drop zone is supplementary. Preview has text dimensions and sizes, slider has numeric field/value, before/after is not visual-only, and download control is keyboard reachable.
- **Performance budget:** Progress visible ≤250 ms; a 12 MP reference JPEG completes ≤8 s on reference desktop and ≤20 s on reference mobile; main thread remains responsive. Batch is outside this independent tool's first release.
- **Tests and acceptance:** Orientation, alpha, format conversion, quality extremes, metadata stripping, corrupt/oversized input, cancellation, Blob cleanup, visual golden tolerance, cross-browser codec fallback, and zero content requests pass.
- **Dependencies and risks:** Browser codec differences, memory spikes, color profile changes, animation loss, and encoder licensing require measured limits and copy.

#### 12.8 Image background remover

- **User story and non-goals:** A user removes a foreground image background locally and downloads a transparent result. It is not manual professional masking, guaranteed hair/detail accuracy, human retouching, or a third-party AI API.
- **Version one scope:** Portrait matting only, on the WebAssembly baseline. The feasibility study (`docs/research/007-image-background-removal-model-evaluation.md`) found no redistributable general-purpose model that runs in a browser inside the transfer budget, so version one ships the portrait model it recommends and says so in the tool name, the description, and the page itself. WebGPU acceleration, mask refinement, and general object removal are deferred; `docs/research/008-portrait-background-removal-implementation.md` records what was chosen and why.
- **Local boundary:** Image pixels and masks stay in the worker/device. The versioned model/runtime is fetched only from toolsliang-controlled Cloudflare assets and can be cached for offline reuse.
- **Module and interface:** A worker engine exposes model capability/download state, version, estimated memory, preprocess, inference, optional local mask refinement, export, cancel, and dispose. WASM is the cross-browser baseline; WebGPU is an optional enhancement with identical result contract.
- **Route and slug:** `/{locale}/tools/image-background-remover/`; stable slug `image-background-remover`.
- **Bilingual content:** `圖片去背` / `Image Background Remover`; disclose first-use model download, expected variability, local inference, and supported formats.
- **SEO/AEO/GEO:** Explain that the AI model runs in the browser and why first use may require a download. Do not claim perfect edges or universal device support.
- **Errors, cancellation, progress, capability:** Check WebAssembly, optional WebGPU, model cache, storage, memory, image limits, and worker creation before inference. Stages include model download with bytes, decode, inference, mask, export. Cancellation terminates inference and frees buffers.
- **Accessibility:** Provide non-canvas status, text progress, before/after description and zoom controls, keyboard-operable refinement alternative if refinement ships, and reduced-motion previews.
- **Performance budget:** Model compressed transfer target ≤40 MiB unless an approved measured exception; cached 12 MP result target ≤30 s desktop and ≤60 s supported mobile. Unsupported devices fail before loading the full model.
- **Tests and acceptance:** Capability matrix, model integrity/version, offline cached run, WebGPU fallback, cancellation/resource cleanup, corrupt image, visual mask fixtures with tolerance, keyboard flow, and network capture proving pixels never leave pass.
- **Dependencies and risks:** Model size/license, device memory, WebGPU variability, cold-start cost, and output quality are release-critical. Model provenance and redistribution rights are mandatory.

#### 12.9 Compliant product image

- **User story and non-goals:** A merchant prepares an image against a reviewed public channel preset covering canvas, background, centering, and product occupancy. The tool does not guarantee approval and does not add border, Logo, promotional text, or price tags.
- **Local boundary:** Product images and outputs stay on device. Channel preset JSON and source citations are public static assets from toolsliang-controlled origins.
- **Module and interface:** A versioned preset registry defines channel, region, image role, dimensions, aspect, background, allowed formats/size, occupancy guidance, source URL, effective/review date, and status. A worker composition engine validates and renders without claiming to algorithmically prove every policy.
- **Route and slug:** `/{locale}/tools/compliant-product-image/`; stable slug `compliant-product-image`.
- **Bilingual content:** `合規主圖` / `Compliant Product Image`; visible copy says “規格輔助，不保證通路審核通過” / “Specification guidance, not a guarantee of channel approval.”
- **SEO/AEO/GEO:** Channel-specific content is indexable only for verified active presets. Answer what is checked, what is not checked, and the source/review date. Retired presets remain documented or redirect safely without stale claims.
- **Errors, cancellation, progress, capability:** Block expired/unverified presets, unsupported image, impossible dimensions, memory limits, and render failure. Stages: validate preset, decode, fit, render, encode. Cancel is available after start.
- **Accessibility:** Preset selector exposes source date/status; crop/position has numeric keyboard controls and an accessible preview summary. Warnings use text/icon, not color only.
- **Performance budget:** Cached preset loads ≤100 ms; one 12 MP image renders ≤10 s desktop and ≤25 s supported mobile.
- **Tests and acceptance:** Registry schema/source dates, no forbidden overlay capabilities, geometry golden tests, output format/size, expired preset behavior, keyboard adjustment, disclaimer visibility, and no-content-network tests pass.
- **Dependencies and risks:** Marketplace policies change without notice. Each supported channel needs named source ownership and periodic review; ambiguity must reduce claims rather than invent validation.

#### 12.10 Brand promo image

- **User story and non-goals:** A商用創作者 combines a product image with a background, local frame, and local Logo for promotional output. Version one has no text, price tag, generative image, compliance claim, or cloud template library.
- **Local boundary:** Source image, background, frame, Logo, layout, and output remain local. Saved frames and Logos are local assets and never synchronize through Supabase.
- **Module and interface:** A scene document references local asset ids and normalized transforms for background, product, frame, and Logo. A renderer supports layer ordering, fit, position, scale, opacity where safe, undo/redo command history, export, and disposal. It shares image engines without merging its product purpose with compliant product images.
- **Route and slug:** `/{locale}/tools/brand-promo-image/`; stable slug `brand-promo-image`.
- **Bilingual content:** `品牌宣傳圖` / `Brand Promo Image`; state that the first version supports background, frame, and Logo only and that assets are saved on this device.
- **SEO/AEO/GEO:** Explain the supported layer types and difference from a compliant product image. Do not optimize for or claim marketplace main-image approval.
- **Errors, cancellation, progress, capability:** Validate layer type, decoded dimensions, local asset availability, quota, memory, and output size. Render/export is cancellable with layer/render/encode progress; missing local assets yield recoverable placeholders, not silent omission.
- **Accessibility:** Every transform has numeric fields and nudge controls; drag is optional. Layer order, visibility, selection, and Logo placement are represented in an accessible list. Undo/redo has names and keyboard shortcuts.
- **Performance budget:** Editor response to control input ≤100 ms; preview update ≤200 ms; 12 MP export ≤10 s desktop and ≤25 s supported mobile.
- **Tests and acceptance:** Scene serialization without pixels, layer ordering, transform math, undo/redo, local asset persistence, missing asset recovery, export golden fixtures, keyboard-only composition, and no-network tests pass.
- **Dependencies and risks:** Canvas color fidelity, large assets, local quota, third-party trademark/Logo rights, and user confusion with compliant output require explicit copy.

#### 12.11 Product image workbench

- **User story and non-goals:** A商用創作者 processes a batch through import, optional background removal, layout/purpose preset, compression, and batch download without repeated import/export. It is not a full image editor, DAM, cloud collaboration tool, or server render farm.
- **Local boundary:** Batch files, scene state, masks, intermediate pixels, outputs, names, and archives stay on device. Only versioned engines/presets are downloaded.
- **Module and interface:** An orchestration module composes the same background-removal, layout, compliance/promo, compression, and export engines used by independent tools. It owns a resumable in-tab job graph, bounded concurrency, per-item state, aggregate progress, cancel-all/cancel-item, retry, and deterministic cleanup. It does not duplicate engine logic.
- **Route and slug:** `/{locale}/tools/product-image-workbench/`; stable slug `product-image-workbench`.
- **Bilingual content:** `商品圖工作台` / `Product Image Workbench`; copy explains the pipeline, device limits, which steps require first download, and that work is not cloud-saved.
- **SEO/AEO/GEO:** Describe the workflow and link to independent tool pages. Clearly separate compliant and promotional branches and their limitations.
- **Errors, cancellation, progress, capability:** Preflight total bytes/pixels/items, required engines, storage, memory, and archive capability. Default first-release limit is 20 images and 200 MiB combined subject to lower device capability. Progress is per item and stage; cancellation preserves explicitly completed downloadable items only.
- **Accessibility:** Job queue is an operable list/table with status text, per-item actions, aggregate live summary, focus restoration, and no drag-only ordering. Visual previews have filename-free accessible item labels generated locally.
- **Performance budget:** Shell becomes interactive without loading heavy engines; bounded concurrency defaults to one inference and up to two codec jobs. Long tasks never block the main thread over 50 ms.
- **Tests and acceptance:** Engine contract mocks, job graph ordering, bounded concurrency, mixed success, per-item/cancel-all, retry, cleanup, offline assets, accessible queue, batch archive, and network boundary pass across representative devices.
- **Dependencies and risks:** Combined memory, model/code size, archive limits, long-running tab suspension, and PWA updates during work make this a later milestone after independent engines stabilize.

#### 12.12 PDF handwritten signature

- **User story and non-goals:** A user places a drawn, typed, or transparent-image signature, initials, and date onto PDF pages and downloads a new PDF locally. It is not identity verification, certificate-based digital signing, legal advice, workflow routing, or a hosted signature service.
- **Local boundary:** PDF bytes, page previews, signature strokes/images, positions, and output stay on device. A saved signature is an explicit local asset and never becomes a cloud preference.
- **Module and interface:** A worker PDF engine parses pages without executing embedded actions, rasterizes safe previews, applies normalized annotations, exports a new document, and disposes source buffers. Signature asset repository supports draw/typed/image forms, explicit save, delete, export/import where safe, and storage size.
- **Route and slug:** `/{locale}/tools/pdf-signature/`; stable slug `pdf-signature`.
- **Bilingual content:** `PDF 手寫簽名` / `PDF Handwritten Signature`; always distinguish the result from a certificate-based digital signature and explain local asset behavior.
- **SEO/AEO/GEO:** Answer how to place a signature locally and the difference between handwriting placement and digital signatures. Do not promise legal validity or identity assurance.
- **Errors, cancellation, progress, capability:** Validate PDF signature, encryption/password state, pages, bytes, malformed structures, memory, and output. Stages: read, parse, preview, apply, write. Parsing/export is cancellable; password support is a separately declared capability, never sent to a server.
- **Accessibility:** Page thumbnails have page numbers; signature placement has numeric position/size, nudge, page select, and text summary; drawing has typed/image alternatives. Focus is managed across dialogs and canvas.
- **Performance budget:** For a 20-page 20 MiB reference PDF, first-page preview ≤3 s and export ≤15 s desktop; default safety cap 100 pages/50 MiB subject to device capability.
- **Tests and acceptance:** Multi-page, rotation, crop boxes, transparent signatures, annotation coordinates, malformed/encrypted PDF, cancellation, metadata/output review, keyboard-only placement, screen-reader summary, local asset clearing, and no-content-network tests pass.
- **Dependencies and risks:** PDF library license/security, malformed document attacks, font embedding, signature legal language, memory, and fidelity require security and content review.

#### 12.13 Word to PDF feasibility validation

- **User story and non-goals:** A user should see a published Word to PDF tool only if browser-local conversion reliably preserves supported documents. The spike is not permission to upload documents, call Office/Google APIs, claim pixel-perfect conversion, or publish a low-fidelity converter.
- **Local boundary:** Test and user documents, fonts, layout tree, and PDF stay on device. Any runtime/font bundle is project-controlled and license-reviewed. No fallback may send a document elsewhere.
- **Module and interface:** Build a disposable feasibility adapter behind the heavy Tool Engine contract, not a catalog-visible product. It reports supported OOXML features, missing fonts, conversion warnings, page count, and deterministic result. The production module is created only after the gate passes.
- **Route and slug:** Reserved stable slug `word-to-pdf`; no indexable public route, navigation entry, sitemap entry, or structured data until approval. A development-only capability surface may exist in non-production.
- **Bilingual content:** Reserved name `Word 轉 PDF` / `Word to PDF`; if published, copy must list the exact supported DOCX subset and known fidelity limits. Before publication, public UI must not advertise availability.
- **SEO/AEO/GEO:** No SEO/AEO/GEO publication during feasibility. After approval, visible content must avoid “identical to Word” unless verified and must describe local conversion and unsupported features.
- **Errors, cancellation, progress, capability:** Spike checks WASM/worker, fonts, memory, OOXML validity, encryption, macros, external links, and unsupported features. Stages are parse, layout, font resolution, PDF render, validate; all long stages cancellable.
- **Accessibility:** Feasibility UI and any future product use file-picker alternatives, textual fidelity warnings, page/issue summary, keyboard actions, and non-visual progress.
- **Performance budget:** Spike target: first progress ≤250 ms and a representative 20-page DOCX ≤30 s desktop without >50 ms main-thread tasks. Performance alone cannot override fidelity failure.
- **Tests and acceptance:** Release gate uses a reviewed corpus of at least 30 documents across simple text, tables, images, headers/footers, page breaks, lists, CJK/Latin fonts, equations, footnotes, tracked changes, and unsupported macros. Chromium, Firefox, and WebKit must produce readable, stable pagination for the declared subset; no document request; licenses permit distribution; security review passes. Any critical content loss, silent reflow beyond declared tolerance, unavailable redistributable fonts/runtime, or material cross-browser divergence means do not publish.
- **Dependencies and risks:** Office layout fidelity, font licensing/substitution, OOXML complexity, WASM size, memory, macros/external content, and cross-browser rendering make non-publication a valid and expected outcome.

#### 12.14 iPhone HEIC first-release exclusion

- **User story and non-goals:** An iPhone user receives a clear explanation when selecting HEIC/HEIF. Version one does not decode, preview, compress, remove background from, compose, or convert HEIC, and never uploads it as a fallback.
- **Local boundary:** Detection uses filename, MIME, and file signature locally. The file is immediately rejected before decode/model work and is not persisted.
- **Module and interface:** A shared image-input validator returns stable `unsupported_heic` with localized guidance. All image tools and the workbench consume the same validator so behavior cannot diverge.
- **Route and slug:** No HEIC tool route or reserved conversion slug in version one. Existing image tool routes keep their stable slugs and declare supported formats.
- **Bilingual content:** `第一版不支援 iPhone HEIC／HEIF，請先在裝置上轉為 JPEG、PNG 或 WebP。` / `HEIC/HEIF from iPhone is not supported in version one. Convert it to JPEG, PNG, or WebP on your device first.` Guidance must not direct users to upload to a third party.
- **SEO/AEO/GEO:** Supported-format sections and FAQs disclose the exclusion. Do not create a HEIC conversion landing page or imply future availability.
- **Errors, cancellation, progress, capability:** Reject before progress starts with the stable error and retained file-picker focus. No cancel is necessary because no processing begins.
- **Accessibility:** Error is linked to the file input, announced once, includes text and accepted formats, and does not rely on extension color/icon.
- **Performance budget:** Detection and rejection ≤100 ms without decoding the full file.
- **Tests and acceptance:** Extension/MIME/signature mismatches, renamed HEIC, multi-file batches, keyboard retry, bilingual message, zero persistence, zero network, and consistent behavior across every image entry point pass.
- **Dependencies and risks:** Browser MIME values vary and users may rename files; signature detection must be bounded and security-reviewed. Future support requires its own feasibility, codec license, memory, and cross-browser decision.

### 13. Delivery order and dependency graph

- Phase 0: merge and preserve the accepted Design System/App Shell baseline; formalize catalog schema, module template, privacy network gate, and environment skeleton.
- Phase 1 lightweight: BMI calculation, device time, NTD uppercase, local random draw, anonymous common tools, and PWA App Shell. These validate pure modules, routes, content, and offline behavior.
- Phase 2 calendar and persistence: Taiwan calendar source pipeline, custom calendar local assets, storage manager, and import/export safety.
- Phase 3 independent image engines: compression, background removal, compliant product image, and brand promo image. Each ships independently only after its own capability and network tests.
- Phase 4 composition: product image workbench reuses stable Phase 3 engines; PDF handwritten signature develops its own reviewed engine and local signature assets.
- Parallel feasibility: Word to PDF remains non-public until its full gate passes. HEIC remains excluded throughout version one.
- Platform completion: Supabase Auth/preferences, full cross-browser/a11y automation, SEO content review, feature preview/staging/release candidate isolation, and release hardening. Production still waits for explicit human approval.

## Testing Decisions

- Good tests observe external behavior and stable contracts, not component internals or incidental markup.
- The primary integration test registers a representative tool and verifies the full public contract through its localized route: catalog grouping, local search, navigation, status, page content, workspace, canonical/hreflang, structured data, privacy statement, capability gate, and absence of tool-content network requests.
- Pure domain modules use table-driven boundary and property-oriented tests with deterministic injected clocks/randomness/configuration. Existing NTD conversion boundary tests are prior art, but formal NTD tests expand to purpose-specific authoritative rules.
- Heavy Tool Engines use contract tests shared by image/PDF/office implementations: capability result, progress ordering, cancellation idempotency, structured errors, transferable output, worker termination, Blob revocation, memory cleanup, and no network adapter access.
- Catalog schema tests extend the existing unique-slug, complete-bilingual-copy, valid-category, and exactly-once grouping tests. They add status lifecycle, route component allowlist, SEO completeness, availability, capability metadata, and reserved/unpublished slug behavior.
- Component tests extend current Button tests to keyboard semantics, states, accessible names, locale, and theme; visual tests assert outcomes such as no shadow and visible focus. Browser tests run in Chromium, Firefox, and WebKit at 375, 768, 1024, and 1440 CSS px, plus 320 px reflow and 200% zoom.
- Automated accessibility uses axe-core or equivalent as a smoke gate plus manual screen-reader, keyboard, zoom, text-spacing, canvas-alternative, and cognitive-clarity checks; automation alone never claims conformance.
- Network-boundary tests intercept fetch, XHR, beacon, WebSocket, worker fetch, Service Worker cache operations, Supabase, analytics, and error channels during representative inputs. Any content-derived request, log, cache entry, or payload is a release blocker.
- PWA tests cover first visit, installed/offline modes, heavy first download/cache, quota, waiting updates, dirty workspaces, cleanup, and Auth/private cache exclusions. Supabase tests cover RLS, explicit preferences, merge/conflict, offline retry, logout, retired slugs, deletion, and absence of tool-content fields.
- SEO tests inspect server HTML for localized content, one h1, canonical/hreflang, environment/availability noindex, visible-copy structured data, sitemap/redirects, and absence of user content.
- Performance tests use fixed reference devices/documents/images, cold and warm caches, bundle analysis, long-task reporting, memory observation where supported, and Web Vitals. Tool-specific budgets are gates or require a documented approved exception before ticket completion.
- Security tests include malformed and polyglot files, MIME/extension mismatch, decompression bombs, huge dimensions/pages, PDF active content, OOXML macros/external links, CSP, no remote code, dependency/model integrity, RLS, and secret scanning.
- Each tool's acceptance suite includes both locales, light/dark, keyboard, reduced motion where applicable, cancellation/progress or proof they are unnecessary, capability failure, offline mode, resource cleanup, and zero tool-content network transmission.
- Feature tests never deploy production; the final production action remains separately human-approved.

## Out of Scope

- Production deployment, DNS/data cutover, or bypassing human approval.
- Losing prototype variants/switcher/query, hand-drawn direction, pointer effects, card shadows, or a light-theme black sidebar.
- Cloud/third-party processing or storage of tool content; content-bearing analytics/errors; session replay, ads, or user-level tracking.
- Mandatory accounts, billing, subscription enforcement, or using PRO to restrict anonymous access.
- Cloud sync of local assets, calendars, signatures, frames, Logos, templates, content, history, or workbench projects.
- Final Landing campaign art, promo text/price tags/generative backgrounds, and claims that promotional output is compliant.
- Certified/remote/weighted draws, certificate-based PDF signing, identity/legal assurance, or hosted signing.
- Public Word to PDF before its gate, HEIC/HEIF support in version one, and predictions/legal interpretation of calendars.

## Further Notes

- This spec synthesizes accepted decisions; ADR-0013 is superseded. Demo catalog entries outside this scope are not roadmap commitments and must be removed or unpublished.
- `/tw/` conflicts with the accepted locale ADR. Implement `/zh-tw/`; never generate `/tw/` as canonical navigation.
- Ticketing preserves the chosen seam: validate the registered route, then add domain/engine contracts as needed. Scope may narrow, but privacy, anonymous use, accessibility, isolation, and truthful claims require a new decision to change.
- Next run `$to-tickets`; regulated data and engines need research tickets, and Word/HEIC gates remain explicit.
