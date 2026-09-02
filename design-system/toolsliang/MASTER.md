# toolsliang Design System

> 狀態：正式基線。建立頁面前先讀本文件，再讀 `design-system/toolsliang/pages/<page>.md`；頁面文件只可覆寫有明確理由的部分。

## 方向

toolsliang 採「平靜、快速、可信任的工具桌」：淺色優先、低噪音、清楚邊界、少量紫色重點與不干擾任務的動態。工具內容必須留在使用者裝置。介面不使用吉祥物、遊戲化、指標追蹤光暈、裝飾性卡片陰影或亮色模式黑色側邊欄。

## 色彩

### Primitive tokens

| Token | Light | Dark | 用途 |
|---|---:|---:|---|
| `neutral-0` | `#FFFFFF` | `#FFFFFF` | 純白基準 |
| `neutral-50` | `#FAFAFC` | `#F7F7FA` | 最淺表面 |
| `neutral-100` | `#F3F3F6` | `#E8E8EE` | 頁面底色／暗色文字次級 |
| `neutral-200` | `#E4E3E9` | `#C8C7D0` | 邊框／暗色次級文字 |
| `neutral-600` | `#676671` | `#696874` | 亮色次級文字 |
| `neutral-900` | `#29282F` | `#1D1D24` | 亮色主文字／暗色表面 |
| `neutral-950` | `#14141A` | `#14141A` | 暗色背景 |
| `violet-50` | `#F3F0FF` | `#F3F0FF` | 重點柔和底色 |
| `violet-500` | `#6B4EFF` | `#A997FF` | 品牌／焦點 |
| `violet-700` | `#4F35D2` | `#C4B9FF` | 亮色互動文字／暗色重點 |
| `green-50` | `#E8F6EF` | `#17372E` | 成功與本機處理底色 |
| `green-700` | `#197659` | `#7BDDB7` | 成功與本機處理文字 |
| `amber-50` | `#FFF5E8` | `#3C281F` | 熱門／警示底色 |
| `amber-700` | `#98471F` | `#FFB38B` | 熱門／警示文字 |
| `red-50` | `#FFF0F0` | `#3A1E23` | 錯誤底色 |
| `red-700` | `#B4232E` | `#FF9AA5` | 錯誤文字 |

### Semantic tokens

| Token | Light | Dark |
|---|---|---|
| `background` | `neutral-100` | `neutral-950` |
| `foreground` | `neutral-900` | `neutral-50` |
| `surface` | `neutral-0` | `neutral-900` |
| `surface-subtle` | `neutral-50` | `#24242D` |
| `surface-hover` | `violet-50` | `#302A4D` |
| `muted-foreground` | `neutral-600` | `neutral-200` |
| `border` | `neutral-200` | `#393844` |
| `primary` | `violet-500` | `#A997FF` |
| `primary-foreground` | `neutral-0` | `neutral-950` |
| `focus-ring` | `violet-500` | `#B6A8FF` |
| `success` | `green-700` | `#7BDDB7` |
| `success-surface` | `green-50` | `#17372E` |
| `warning` | `amber-700` | `#FFB38B` |
| `warning-surface` | `amber-50` | `#3C281F` |
| `destructive` | `red-700` | `#FF9AA5` |
| `destructive-surface` | `red-50` | `#3A1E23` |

任何文字／背景組合必須驗證對比，不可只因 token 名稱合理就假設合格。狀態不得只靠顏色，需搭配文字、icon 或邊框。

## Typography

不從第三方字型 CDN 載入字型，避免隱私、效能與離線風險。正式字型堆疊：

- 繁體中文：`"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif`
- 英文：`"Avenir Next", Avenir, ui-sans-serif, system-ui, sans-serif`
- 等寬：`"SFMono-Regular", Consolas, "Liberation Mono", monospace`

| Token | Size / line-height | Weight | 用途 |
|---|---|---:|---|
| `display-lg` | `clamp(2.5rem, 6vw, 5rem) / 0.98` | 750 | Landing hero |
| `display-sm` | `clamp(2rem, 4vw, 3.5rem) / 1.02` | 750 | 工具目錄標題 |
| `heading-xl` | `2rem / 1.15` | 700 | 工具頁標題 |
| `heading-lg` | `1.5rem / 1.25` | 700 | 區段標題 |
| `heading-md` | `1.125rem / 1.35` | 650 | 卡片／分類標題 |
| `body-lg` | `1.125rem / 1.65` | 400 | Landing 說明 |
| `body-md` | `1rem / 1.6` | 400 | 一般內文 |
| `body-sm` | `0.875rem / 1.55` | 400 | 工具簡介 |
| `label` | `0.75rem / 1.3` | 700 | label、eyebrow |
| `caption` | `0.6875rem / 1.4` | 650 | badge、輔助資訊 |

英文可使用較緊字距；中文內文不使用負字距。最小可讀文字原則為 12px，互動資訊不得小於 12px。

## Spacing、radius、border、shadow、z-index

### Spacing

採 4px 基線：`space-0=0`、`space-1=4`、`space-2=8`、`space-3=12`、`space-4=16`、`space-5=20`、`space-6=24`、`space-8=32`、`space-10=40`、`space-12=48`、`space-16=64`、`space-20=80`。

### Radius

`radius-sm=8px`、`radius-md=12px`、`radius-lg=16px`、`radius-xl=22px`、`radius-full=999px`。工具卡以 12px、主要容器以 16–22px；不要把每個元素都做成膠囊。

### Border

一般邊框 `1px solid border`；選取或焦點可使用 primary。工具卡與 hover 以邊框和背景區分，不用陰影。分隔線不可低於 3:1 的非文字對比要求。

### Shadow

`shadow-none=none`、`shadow-overlay=0 24px 64px rgb(0 0 0 / 24%)`。工具卡、分類卡、側邊欄、header 與 hover 一律 `shadow-none`；只有 dialog、popover、dropdown 等會離開文件流的 overlay 可使用 `shadow-overlay`。

### Z-index

`z-base=0`、`z-sticky=20`、`z-dropdown=40`、`z-overlay=60`、`z-toast=80`、`z-skip-link=100`。不可在頁面內任意新增更大的數值。

## Responsive breakpoints

| 名稱 | 最小寬度 | 行為 |
|---|---:|---|
| `phone` | `0` | 單欄、底部常駐導覽、44px 以上觸控區 |
| `phone-lg` | `480px` | 增加內容 gutter |
| `tablet` | `768px` | 雙欄分類網格、底部導覽；不得假設 hover |
| `desktop` | `1024px` | 顯示可收合左側欄，隱藏手機底部導覽 |
| `desktop-lg` | `1280px` | 工具目錄最多 3 欄，內容寬度上限 1440px |
| `wide` | `1536px` | 只增加留白，不無限制拉長文字行寬 |

## Motion

- `duration-instant=80ms`：pressed feedback。
- `duration-fast=150ms`：hover、focus、badge。
- `duration-normal=220ms`：側欄與 accordion。
- `duration-slow=360ms`：單次頁面／區塊進場。
- `ease-standard=cubic-bezier(0.2, 0, 0, 1)`。
- `ease-enter=cubic-bezier(0.16, 1, 0.3, 1)`。
- `ease-exit=cubic-bezier(0.4, 0, 1, 1)`。

頁面只允許一組主要進場序列；不做持續漂浮、彈跳、scroll-jacking、pointer-follow 或會移動版面的 hover。`prefers-reduced-motion: reduce` 時取消進場與平滑捲動，transition duration 降到接近 0，且不可隱藏內容等待動畫完成。

## Icon

- 正式介面使用 Lucide 的 Vue outline icon；同一層級固定 1.75px–2px stroke。
- 16px 用於文字內，20px 用於工具列，24px 用於導覽，32px 只用於分類或空狀態。
- icon-only button 視覺可小於 44px，但 hit target 至少 44×44px，且必須有可理解的 accessible name。
- 不使用 emoji 當結構 icon，不混用 filled 與 outline，不自行猜測第三方品牌 logo。
- 工具項目左側使用最貼近任務的 icon；狀態標籤固定在右側，不以 icon 取代文字狀態。

## Component states

| 狀態 | 規則 |
|---|---|
| Default | 使用 surface、foreground 與 border，邊界清楚。 |
| Hover | 僅 pointer 裝置套用 surface-hover／primary border；不加陰影、不位移。 |
| Focus | 使用 3px focus-ring，offset 2px；不得以 `outline: none` 移除。 |
| Active | 加深背景或縮短 transition；不可造成 layout shift。 |
| Disabled | 原生 `disabled`／`aria-disabled`，opacity 55%，游標與事件均停用。 |
| Loading | 保留原尺寸，顯示 spinner 或 skeleton；`aria-busy=true`，文字說明不可只靠動畫。 |
| Error | destructive 文字＋icon＋邊框，表單訊息以 `aria-describedby` 關聯並可被宣告。 |
| Success | success 文字＋check icon＋可理解文案；不可只有綠色。 |

### 工具狀態標籤

- `NEW`：success 色系，表示近期推出；需由產品規格定義何時移除。
- `PRO`：primary 實色；目前只保留視覺語意，不得據此限制匿名使用。
- `熱門`／`HOT`：warning 色系，表示非個人化的編輯精選或聚合排行。
- `常用`／`SAVED`：neutral 色系，表示使用者主動收藏。

## WCAG 2.2 AA

- 一般文字對比至少 4.5:1；大字至少 3:1；UI 邊界、focus 與 icon 至少 3:1。
- 所有功能可用鍵盤完成；視覺順序與 DOM／focus 順序一致，沒有 keyboard trap。
- 提供 skip link、語意 landmark、單一頁面 `h1` 與連續 heading hierarchy。
- 互動目標至少 24×24 CSS px（WCAG 2.2），產品基線提高為 44×44px；相鄰目標保留間距。
- sticky header／底部導覽不可遮住聚焦項目；使用 `scroll-padding` 與內容 inset。
- 不只用顏色表達狀態；錯誤、成功與 loading 必須有文字或可存取名稱。
- 支援 200% 縮放、320 CSS px reflow、文字間距覆寫、`prefers-reduced-motion`。
- 觸控與鍵盤都能操作，不依賴 hover、拖曳或路徑手勢完成主要任務。
- 變更語言時更新 `html[lang]`；中英文頁面維持 canonical 與 hreflang。

## 禁止事項

- 不使用 Variant A、Variant C、prototype switcher 或 `?variant=`。
- 不把 prototype component／CSS 直接複製到 production。
- 首頁不顯示 App Shell 側邊欄或工具工作區。
- 亮色模式不使用黑色側邊欄。
- 工具卡及其 hover 不使用陰影、位移或縮放。
- 不上傳工具內容，不把搜尋字串送到分析或第三方。
- 不因 `PRO` 標籤自行加入付費鎖定。

## Definition of done

- light／dark、375px／768px／1024px／1440px 均有驗證。
- typecheck、lint、單元／元件測試、無障礙 smoke test 與 production build 通過。
- Design System Page 展示 tokens、components、responsive 與所有狀態。
- 瀏覽器 console 無錯誤；本機工具互動期間沒有外部內容 request。
