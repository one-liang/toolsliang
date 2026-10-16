# toolsliang Design System

> 狀態：正式基線（2.0，ADR-0020）。建立頁面前先讀本文件，再讀 `design-system/toolsliang/pages/<page>.md`；頁面文件只可覆寫有明確理由的部分。

## 方向

toolsliang 採「無陰影的新粗獷工具站」：白紙、墨色 2px 邊界、五色分類平塗，以 Apple 產品頁式的清楚層級讓人一眼看懂工具在做什麼。首頁用每個工具的實際輸出取代說明文字；工具頁維持專注的工作區。介面不使用陰影、漸層、玻璃模糊、吉祥物、遊戲化或指標追蹤效果。工具內容必須留在使用者裝置。

## 色彩

採 Primitive → Semantic → Component 三層架構；頁面與元件只使用 semantic 或 component token，不直接引用 primitive 或任意色碼。程式來源為 `app/assets/css/main.css`。

### Primitive tokens

| Token | Value | 用途 |
|---|---:|---|
| `ink-950` | `#0B0B0B` | 墨色：文字、邊界、主要按鈕 |
| `ink-800` / `ink-700` | `#3B3A36` / `#4A4844` | 次要文字 |
| `ink-200` | `#D6D4CD` | 容器內的細線 |
| `paper-0` / `paper-50` | `#FFFFFF` / `#F4F3EF` | 頁面與次要表面 |
| `night-950` / `night-900` / `night-800` / `night-700` | `#0F0F0E` / `#161615` / `#1F1F1D` / `#3A3936` | 暗色背景、表面與細線 |
| `chalk-50` / `chalk-300` | `#F4F2EC` / `#C9C6BD` | 暗色文字與邊界 |
| `yellow-400` / `yellow-500` / `yellow-50` | `#FFD23F` / `#FFC61A` / `#FFF6D1` | 強調、hover、結果區 |
| `coral-400` / `coral-700` / `coral-50` | `#FF7F5C` / `#B8321A` / `#FFE6DD` | 時間分類、放假日文字與底色 |
| `sky-400` | `#86BBFF` | 文件分類 |
| `mint-400` | `#63DCA8` | 計算分類、NEW 標籤 |
| `pink-400` | `#FF9ED8` | 圖片與商務分類 |
| `green-700` / `amber-700` / `red-700` | `#197659` / `#98471F` / `#B4232E` | 成功、提醒、錯誤文字 |

### Semantic tokens

| Token | Light | Dark |
|---|---|---|
| `background` / `surface` | `paper-0` | `night-950` / `night-900` |
| `surface-subtle` | `paper-50` | `night-800` |
| `surface-hover` | `yellow-400` | `#3D3412`（暗色維持淺色文字） |
| `foreground` | `ink-950` | `chalk-50` |
| `muted-foreground` | `ink-700` | `chalk-300` |
| `border` / `border-strong` | `ink-950` | `chalk-50` |
| `border-subtle` | `ink-200` | `night-700` |
| `primary` | `yellow-400` | `yellow-400` |
| `primary-strong` | `ink-950` | `chalk-50` |
| `focus-ring` | `ink-950` | `yellow-400`（首頁版面暗色使用 `chalk-50`，黑色收尾區塊內使用 `yellow-400`） |
| `result-surface` | `yellow-50` | `#2A2610` |
| `holiday` / `holiday-surface` | `coral-700` / `coral-50` | `#FF9B7E` / `#3A221B` |
| `success` / `warning` / `destructive` | `green-700` / `amber-700` / `red-700` | `#7BDDB7` / `#FFB38B` / `#FF9AA5` |

### 分類平塗色

| Token | 分類 | 值 |
|---|---|---:|
| `fill-image-commerce` | 圖片與商務素材 | `pink-400` |
| `fill-document` | 文件與金額 | `sky-400` |
| `fill-time-calendar` | 時間與行事曆 | `coral-400` |
| `fill-calculation` | 計算工具 | `mint-400` |
| `fill-random-selection` | 隨機抽選 | `yellow-400` |

平塗色在亮暗主題都不變，上面的文字、icon 與邊界一律用 `fill-ink`（`ink-950`），對比都在 7:1 以上。元件只知道分類 id 時，加上 `category-fill--<id>` class 取得 `--tool-fill`。

任何文字／背景組合必須驗證對比；狀態不得只靠顏色，需搭配文字、icon 或邊框。

### Component tokens

| Token | 值 | 規則 |
|---|---|---|
| `button-primary-bg` / `-fg` | 亮色 `ink-950` / 白；暗色 `chalk-50` / `ink-950` | 黑色膠囊 |
| `button-primary-hover-bg` / `-fg` | `yellow-400` / `ink-950` | hover 轉黃底墨字，不加陰影或位移 |
| `button-contrast-*` | 與 primary 同色系 | 複製結果等主要操作 |
| `card-bg` / `card-border` / `card-shadow` | `surface` / `border` / `none` | 2px 邊界的平面卡片 |
| `input-border` / `input-focus-border` | `border-strong` / `primary-strong` | 2px 邊界 |
| `sidebar-active-bg` / `-fg` | 亮色 `ink-950` / 白；暗色反轉 | 目前所在項目反白 |
| `image-preview-max-height` | `400px` | 圖片預覽高度上限 |

## Typography

不從第三方字型 CDN 載入字型。正式字型堆疊（ADR-0020）：

- 繁體中文：各平台系統字型 `"PingFang TC", "Noto Sans TC", "Microsoft JhengHei"`；使用者選擇不自架中文字型。
- 英文與數字：自架 `"Archivo Variable"`（`@fontsource-variable/archivo/wdth.css`，含 `wght` 與 `wdth` 軸），中英文頁面的字型堆疊都以它開頭，讓數字與英文一致。
- 等寬：`"SFMono-Regular", Consolas, "Liberation Mono", monospace`，只用於程式碼與資料。

| 用途 | Size / line-height | Weight |
|---|---|---:|
| 首頁 H1 | `clamp(2.6rem, 1.15rem + 5.1vw, 5.6rem) / 1.1` | 800 |
| 頁面 H1 | `clamp(2.2rem, 5vw, 3.6rem) / 1.08` | 800 |
| 工具頁 H1 | `clamp(1.9rem, 4vw, 2.8rem) / 1.12` | 800 |
| 區段 H2 | `clamp(2.1rem, 1.3rem + 3vw, 3.9rem) / 1.08`（首頁）、`1.2–1.55rem`（工具頁） | 800 |
| 內文 | `1rem / 1.6`，首頁 `1.0625–1.3rem` | 400–600 |
| 標籤與說明 | `0.75–0.9rem` | 700–800 |

標題一律 800 字重（Tailwind preflight 會把 heading 重設為 inherit，`main.css` 明確設回）。字距不低於 `-0.04em`；中文段落以 `word-break: keep-all` 在標點處斷行，不在詞中間斷開。不使用 eyebrow（標題上方的小標）。

## Spacing、radius、border、shadow、z-index

- Spacing：以 4px 為基線（`0 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80`），元件內距允許 2px 半階（6、10、14、18、22）；目前沒有 spacing token，數值寫在元件規則內。
- 表單間距：欄位標籤自成一行、位於控制項上方，兩者相距 8px；控制項（`.ui-input`）是區塊元素，不與標籤並排在同一列。工作區內的提示框（`.capability-warning`、`.capability-checking`）與上下區塊至少相距 16px，一組欄位或欄位網格接在段落之後也留 16px；垂直 margin 互相合併，元件自己要求的較大間距仍然有效。
- Radius：`radius-sm=12px`、`radius-md=16px`、`radius-lg=20px`、`radius-xl=28px`、`radius-full=999px`。按鈕、搜尋框與選項為膠囊；分類區塊與工具頁標頭用 28px。
- Border：`--rule: 2px` 的墨色邊界是主要結構；容器內再分隔時改用 `border-subtle` 細線，避免框中框都用全重邊界。不使用寬於 1px 的彩色側邊條紋。
- Shadow：無。任何元件、overlay 與 hover 都不使用陰影；品牌宣傳圖選取框與 PDF 簽名選取框外的白色描邊，是在任意圖片上辨識選取的輪廓，不是深度。
- Z-index：`0 / 20 / 40 / 60 / 80 / 100`；分類 drawer 用 61 疊在自己的遮罩（60）之上，元件內部可用 1–5 排列子元素。不在頁面內任意新增更大的數值。

## Responsive breakpoints

| 名稱 | 最小寬度 | 行為 |
|---|---:|---|
| `phone` | `0` | 單欄、底部常駐導覽、44px 以上觸控區 |
| `phone-lg` | `480px` | 顯示首頁頁首的「全部工具」連結 |
| `tablet` | `768px` | 雙欄分類網格與首頁分類區塊 |
| `desktop` | `1024px` | 可收合左側欄（256px／80px）；首頁 7:5 首屏與 12 欄分類區塊 |
| `desktop-lg` | `1280px` | 增加工作區左右留白；首頁 1320px、工具頁 980px 的寬度上限在所有寬度都生效 |

## Motion

- `duration-instant=80ms`、`duration-fast=150ms`、`duration-normal=220ms`、`duration-slow=360ms`；`ease-standard=cubic-bezier(0.2, 0, 0, 1)`、`ease-enter=cubic-bezier(0.16, 1, 0.3, 1)`。
- 介面互動只用短轉場；hover 改背景與邊框，不加陰影、不縮放。允許的位移只有箭頭類細節：CTA 箭頭右移 5px、工具列文字右移 6px、按鈕按下時下沉 2px、範例卡片 hover 時轉正。
- 首頁的示範動畫（發牌、簽名筆跡、去背掃過、BMI 指針、輪盤）以 GSAP 延遲載入，每段只播放一次，並在 `gsap.matchMedia('(prefers-reduced-motion: no-preference)')` 內建立；減少動態或腳本失敗時直接呈現完成狀態，內容永遠不等動畫。
- 不做持續漂浮、scroll-jacking、視差、pointer-follow。

## Icon

- 介面使用 Lucide outline icon：工具 icon 1.8px、一般介面 icon 2px、首頁箭頭與輪盤等 2.5px；首頁示範圖為自繪 SVG。
- 工具 icon 放在分類平塗色的小方塊上（墨色框線與 icon）。
- 不使用 emoji 或 Unicode 符號代替 icon；首頁不重複使用 icon 列。
- icon-only button 的 hit target 至少 44×44px，並有 accessible name。

## Component states

| 狀態 | 規則 |
|---|---|
| Default | `surface`、`foreground`、2px `border` |
| Hover | 僅 pointer 裝置；一般元件為黃色背景（暗色為深黃）與墨色邊框；頁首控制項（全部工具、尋找工具、主題、語言）反白為墨色；不加陰影 |
| Focus | 3px `focus-ring`，offset 2–3px；不得移除 |
| Active／目前項目 | 墨色反白 |
| Selected 選項 | 黃色背景、墨色邊框與粗體文字 |
| Disabled | 原生 `disabled`／`aria-disabled`，opacity 55% |
| Loading | `aria-busy=true` 加文字說明 |
| Error／Success | 語意色文字＋icon＋邊框 |

### 工具狀態標籤

膠囊、1.5px 墨色框：`NEW` 薄荷底、`PRO` 黃底、`熱門` 珊瑚底、`常用` 白底。`PRO` 只保留視覺語意，不得據此限制匿名使用。

### 圖片批次（選圖區、縮圖列、下載）

可以一次處理多張的圖片工具共用三個元件（ADR-0024），不各自重做：

- **選圖區** `ImageBatchPicker`：還沒有圖片時是 2px 虛線的拖放區（次要表面、16px 圓角），左邊 48px 墨框 icon 方塊，右邊標題、格式與上限說明和主要按鈕。有圖片後縮成一列 28px 圓角的虛線托盤，只放「加入圖片」「全部清除」兩顆外框膠囊與用量，畫面主體留給預覽；托盤仍可拖放。拖曳經過時改成實線墨框與黃底。全部清除先在托盤內確認（紅框、紅底），Escape 取消。被退回的檔案以紅字列在托盤下方，寫出檔名（超過三個只列前三個與總數）。
- **縮圖列** `ImageBatchStrip`：64px（768px 以上 76px）的方形縮圖，橫向捲動。整列是一個 listbox、一個 Tab 停留點，方向鍵與 Home／End 切換預覽，Delete 移除。目前預覽的那張是墨色底框（亮暗主題各自反轉）；hover 是黃底。每張右下角有 22px 狀態圓章：等待（時鐘、表面色）、處理中（旋轉圈、黃底）、完成（勾、薄荷底）、失敗（驚嘆號、紅框紅字，縮圖外框也轉紅）。縮圖列下方一行寫出第幾張、檔名與狀態文字，旁邊是「重試」（只在可以重來的失敗時出現）與「移除」。
- **下載** `ImageBatchDownload`：只有一張時是「下載圖片」主要按鈕。多張時是「全部下載（ZIP）」主要按鈕加張數與合計大小，下面以細線分隔的「逐張下載」摺疊清單，每列是檔名、大小與 44px 下載圖示按鈕；無法打包時自動展開這份清單。

### 選項（radio／checkbox）

一行文字的選項使用 `.choice-option`，並排的一組放在 `.choice-group`（間距 8px）：至少 44px 高的膠囊、2px `input-border`，18px 的圓點與文字以同一條中線垂直置中、相距 10px；左內距 12px 讓圓點接近膠囊圓弧的圓心，右內距 18px。選取時套用上表的 Selected 規則，停用時 opacity 55%。包住 radio 或 checkbox 的標籤是選項，不套用欄位標籤的樣式。帶說明文字的卡片式選項（例如商品圖工作台的用途）把圓點對齊第一行標題。

## WCAG 2.2 AA

- 一般文字 4.5:1、大字 3:1、UI 邊界與 focus 3:1。
- 全部功能可用鍵盤完成；視覺順序與 focus 順序一致。
- skip link、語意 landmark、單一 `h1`、連續 heading hierarchy。
- 互動目標以 44×44px 為產品基線；sticky 區塊不得遮住 focus。
- 支援 200% 縮放、320px reflow、文字間距覆寫、`prefers-reduced-motion`。

## 禁止事項

- 任何陰影、漸層文字、玻璃模糊、寬於 1px 的彩色側邊條紋。
- 標題上方的 eyebrow 小標；首頁重複說明本機處理。
- 首頁顯示 App Shell 側邊欄或工具工作區。
- 亮色模式整片黑色側邊欄（只有目前項目反白）。
- 上傳工具內容，或把搜尋字串送到分析與第三方。
- 因 `PRO` 標籤自行加入付費鎖定。

## Definition of done

- light／dark、375px／768px／1024px／1440px 均有驗證。
- lint、typecheck、單元與 e2e 測試、production build 通過。
- Design System Page 展示 tokens、分類平塗色、元件與所有狀態。
- 瀏覽器 console 無錯誤；工具互動期間沒有外部內容 request。
