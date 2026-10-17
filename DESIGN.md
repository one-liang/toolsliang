---
name: toolsliang
description: Free single-job web tools for Taiwan tasks, drawn as white paper, 2px ink rules and five flat category fills, with no shadows.
colors:
  ink-950: "#0b0b0b"
  ink-800: "#3b3a36"
  ink-700: "#4a4844"
  ink-200: "#d6d4cd"
  paper-0: "#ffffff"
  paper-50: "#f4f3ef"
  checker: "#e6e4de"
  night-950: "#0f0f0e"
  night-900: "#161615"
  night-800: "#1f1f1d"
  night-700: "#3a3936"
  chalk-50: "#f4f2ec"
  chalk-300: "#c9c6bd"
  yellow-400: "#ffd23f"
  yellow-500: "#ffc61a"
  yellow-50: "#fff6d1"
  coral-400: "#ff7f5c"
  sky-400: "#86bbff"
  mint-400: "#63dca8"
  pink-400: "#ff9ed8"
  coral-700: "#b8321a"
  coral-50: "#ffe6dd"
  green-700: "#197659"
  green-50: "#e3f7ec"
  amber-700: "#98471f"
  amber-50: "#fff1df"
  red-700: "#b4232e"
  red-50: "#ffeced"
  dark-hover: "#3d3412"
  dark-result: "#2a2610"
  dark-holiday: "#ff9b7e"
  dark-holiday-surface: "#3a221b"
  dark-success: "#7bddb7"
  dark-success-surface: "#17372e"
  dark-warning: "#ffb38b"
  dark-warning-surface: "#3c281f"
  dark-destructive: "#ff9aa5"
  dark-destructive-surface: "#3a1e23"
typography:
  display:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif'
    fontSize: "clamp(2.6rem, 1.15rem + 5.1vw, 5.6rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif'
    fontSize: "clamp(2.1rem, 1.3rem + 3vw, 3.9rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  headline-page:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif'
    fontSize: "clamp(2.2rem, 5vw, 3.6rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title-tool:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif'
    fontSize: "clamp(1.9rem, 4vw, 2.8rem)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  title-block:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif'
    fontSize: "clamp(1.6rem, 1.2rem + 1.2vw, 2.3rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title-section:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif'
    fontSize: "clamp(1.2rem, 3vw, 1.55rem)"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body-lead:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif'
    fontSize: "clamp(1.0625rem, 1rem + 0.35vw, 1.3rem)"
    fontWeight: 500
    lineHeight: 1.6
  body:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif'
    fontSize: "0.83rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif'
    fontSize: "0.86rem"
    fontWeight: 700
    lineHeight: 1.6
  button:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif'
    fontSize: "0.9rem"
    fontWeight: 800
    lineHeight: 1
  badge:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "0.6875rem"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "0.035em"
  numeral:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif'
    fontSize: "clamp(2.6rem, 1.9rem + 2vw, 3.4rem)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontFeature: '"tnum"'
    fontVariation: '"wdth" 116'
  wordmark:
    fontFamily: '"Archivo Variable", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "1.25rem"
    fontWeight: 800
    letterSpacing: "-0.02em"
    fontVariation: '"wdth" 112'
  mono:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "0.8rem"
    fontWeight: 400
rounded:
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "28px"
  full: "999px"
spacing:
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
  gutter: "clamp(16px, 4vw, 48px)"
  section: "clamp(72px, 9vw, 128px)"
components:
  button-primary:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.paper-0}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "0 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.yellow-400}"
    textColor: "{colors.ink-950}"
  button-primary-active:
    backgroundColor: "{colors.ink-800}"
    textColor: "{colors.paper-0}"
  button-outline:
    backgroundColor: "{colors.paper-0}"
    textColor: "{colors.ink-950}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "0 18px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.yellow-400}"
    textColor: "{colors.ink-950}"
  button-hero:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.paper-0}"
    rounded: "{rounded.full}"
    padding: "0 26px"
    height: "56px"
  button-hero-hover:
    backgroundColor: "{colors.yellow-400}"
    textColor: "{colors.ink-950}"
  input:
    backgroundColor: "{colors.paper-0}"
    textColor: "{colors.ink-950}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 13px"
    height: "44px"
  search-large:
    backgroundColor: "{colors.paper-0}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.full}"
    padding: "0 58px"
    height: "64px"
  option-pill:
    backgroundColor: "{colors.paper-0}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
    height: "44px"
  option-pill-selected:
    backgroundColor: "{colors.yellow-400}"
    textColor: "{colors.ink-950}"
  badge-new:
    backgroundColor: "{colors.mint-400}"
    textColor: "{colors.ink-950}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
    height: "22px"
  badge-pro:
    backgroundColor: "{colors.yellow-400}"
    textColor: "{colors.ink-950}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
  badge-hot:
    backgroundColor: "{colors.coral-400}"
    textColor: "{colors.ink-950}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
  badge-saved:
    backgroundColor: "{colors.paper-0}"
    textColor: "{colors.ink-950}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
  card:
    backgroundColor: "{colors.paper-0}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.lg}"
    padding: "clamp(16px, 3vw, 24px)"
  tool-card:
    backgroundColor: "{colors.paper-0}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.lg}"
    padding: "16px"
    height: "96px"
  tool-card-hover:
    backgroundColor: "{colors.yellow-400}"
  result-panel:
    backgroundColor: "{colors.yellow-50}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.md}"
    padding: "22px"
    height: "148px"
  tool-heading-filled:
    textColor: "{colors.ink-950}"
    rounded: "{rounded.xl}"
    padding: "clamp(20px, 3vw, 32px)"
  category-block:
    textColor: "{colors.ink-950}"
    rounded: "{rounded.xl}"
    padding: "clamp(20px, 2.4vw, 32px)"
  output-slip:
    textColor: "{colors.ink-950}"
    rounded: "{rounded.lg}"
    padding: "20px 22px 22px"
  faq-row:
    backgroundColor: "{colors.paper-0}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.lg}"
    padding: "16px 20px 16px 24px"
    height: "68px"
  sidebar-link:
    textColor: "{colors.ink-700}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
    height: "44px"
  sidebar-link-hover:
    backgroundColor: "{colors.yellow-400}"
    textColor: "{colors.ink-950}"
  sidebar-link-active:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.paper-0}"
  mobile-nav:
    backgroundColor: "{colors.paper-0}"
    rounded: "{rounded.lg}"
    padding: "5px"
    height: "68px"
---

# Design System: toolsliang

> The project's formal, Traditional-Chinese design-system spec is `design-system/toolsliang/MASTER.md` (ADR-0020); per-page overrides live in `design-system/toolsliang/pages/`. This file records the same world as it is built in code (`app/assets/css/main.css`, `app/assets/css/landing.css`). Where the two disagree, the code is what ships.

## Overview

**Creative North Star: "The Ink-Ruled Catalogue"**

toolsliang is drawn on white paper with a near-black pen. Every container is closed by a 2px ink rule, every category owns one flat sticker colour, and nothing floats: there are no shadows, no gradients and no blur. The world is neo-brutalist in material and calm in hierarchy: big heavy headings, one message per block, and few words. The landing page shows each category's real output (a cheque wording, a holiday run, a BMI reading, a cut-out portrait, a signed form, a wheel result) instead of describing it. Tool pages keep the same materials and become a focused, ruled workspace.

Density is medium. The landing page breathes at display scale. The App Shell (sidebar, directory, tool pages) is denser: 44px controls, 8–16px gaps, and one ruled card per tool with its sub-sections separated by hairlines rather than nested frames. Dark mode inverts only the ground, the surfaces and the rules. The category fills and the ink set on them stay the same in both themes.

Motion is an enhancement that only replays how a finished state was reached. Every demo renders its end state in HTML. GSAP loads lazily on the landing page only and plays each sequence once inside `gsap.matchMedia('(prefers-reduced-motion: no-preference)')`.

**Key Characteristics:**
- White ground, ink text, and a 2px ink rule on every container. A 1px hairline separates sections inside a ruled container.
- Five flat category fills that never invert, always with ink on them.
- Sun yellow is the single highlight colour: hover, selected, text selection, the hero mark.
- Pills for pressable controls, with a radius ladder of 12 / 16 / 20 / 28px for containers.
- Heavy 800-weight headings with tight tracking. Archivo Variable leads every font stack, and Chinese falls through to each platform's system face.
- Zero shadows. Depth comes from rules, fills, overlap and ink inversion.

## Colors

Ink on paper, five flat category fills, and one yellow highlight. Light values are below. The dark theme swaps the neutrals and status colours as noted, and every fill stays put.

### Primary
- **Ink** (#0b0b0b, `ink-950`): Text, every 2px rule, the primary button, the focus ring (light), and the inverted "current" state. It is also the fixed ink (`--fill-ink`) on every category fill in both themes.
- **Sun Yellow** (#ffd23f, `yellow-400`): The only highlight. It is used for the hover fill of buttons, links, rows and cards, the selected option pill, `::selection`, the hero headline mark, the PRO badge, the closing-band CTA, and the quota bar. It also serves as the random-selection category fill. Pressed and hover-deep is #ffc61a (`yellow-500`).
- **Result Cream** (#fff6d1, `yellow-50`): The result panel ground, so a tool's output reads as the warm answer area.

### Secondary (category fills)
These are identity, not state. Each category id maps to one fill through `.category-fill--<id>` (App Shell) or `.nb-fill--<id>` (landing), which sets `--tool-fill` / `--nb-fill`.
- **Lilac Pink** (#ff9ed8, `pink-400`): Images and commerce assets.
- **Sky Blue** (#86bbff, `sky-400`): Documents and money.
- **Coral** (#ff7f5c, `coral-400`): Time and calendar. Also the HOT badge.
- **Mint** (#63dca8, `mint-400`): Calculation. Also the NEW badge.
- **Sun Yellow** (`yellow-400`): Random selection.

### Tertiary (status)
- **Holiday Red** (#b8321a on #ffe6dd, `coral-700` / `coral-50`): Days off on the Taiwan calendar. Dark mode: #ff9b7e on #3a221b.
- **Success Green** (#197659 on #e3f7ec): Saved / copied status, today marker, local-boundary icons. Dark mode: #7bddb7 on #17372e.
- **Warning Amber** (#98471f on #fff1df): Storage notices, capability warnings, scope notes. Dark mode: #ffb38b on #3c281f.
- **Destructive Red** (#b4232e on #ffeced): Field errors, delete confirmations, destructive buttons. Dark mode: #ff9aa5 on #3a1e23, and the destructive button then carries ink text.

### Neutral
- **Paper** (#ffffff, `paper-0`): Page and surface in light mode.
- **Warm Paper** (#f4f3ef, `paper-50`): `surface-subtle`, used for table headers, weekend cells, notes, formula chips and drop zones.
- **Soft Ink** (#4a4844, `ink-700`): `muted-foreground` for descriptions and help text. Landing secondary copy uses #3b3a36 (`ink-800`).
- **Hairline** (#d6d4cd, `ink-200`): `border-subtle`, the 1px divider inside a ruled container (table cells, agenda rows, inner sections).
- **Checker** (#e6e4de): The transparency checkerboard behind alpha previews.
- **Night** (#0f0f0e ground, #161615 surface, #1f1f1d subtle, #3a3936 hairline): Dark-mode neutrals.
- **Chalk** (#f4f2ec text and rules, #c9c6bd muted): Dark-mode ink. Dark mode hover is **Deep Yellow** (#3d3412) so chalk text stays legible, and the dark result panel is #2a2610.

### Named Rules
**The Fills Don't Invert Rule.** Category fills and the ink on them are identical in light and dark mode. Only ground, surface, text and rules invert. Text on a fill is always `ink-950` (7:1 or better on every fill).

**The One Highlight Rule.** Yellow is the only interaction colour. Hover, selected and highlighted states use it, and the four other fills never signal interaction state. Components reference semantic tokens (`--color-*`, `--fill-*`, `--button-*`), never primitives or raw hex.

**The Meaning Twice Rule.** Colour never carries meaning alone. A holiday cell also has its text mark and accessible name. Errors and warnings pair the colour with an icon, a 2px border and words.

## Typography

**Display Font:** Archivo Variable (self-hosted via `@fontsource-variable/archivo/wdth.css`, `wght` and `wdth` axes)
**Body Font:** The same stack. Chinese falls through to "PingFang TC", "Noto Sans TC" and "Microsoft JhengHei".
**Label/Mono Font:** "SFMono-Regular", Consolas, "Liberation Mono", monospace, for data and code only.

**Character:** A wide, heavy grotesk for Latin and numerals sits beside each platform's own Chinese system face at 800 weight. Headings are blunt and tightly tracked. Numbers that are the point (BMI, holiday counts, the device clock) widen to `wdth` 106–116 and use tabular figures. No CJK webfont is loaded, by the user's decision, so Chinese rendering varies slightly by platform.

### Hierarchy
- **Display** (800, `clamp(2.6rem, 1.15rem + 5.1vw, 5.6rem)`, 1.1): The landing hero H1. The closing-band title uses the same scale (`clamp(2.5rem, 1.2rem + 5vw, 5.6rem)`, 1.06).
- **Headline** (800, `clamp(2.1rem, 1.3rem + 3vw, 3.9rem)`, 1.08): Landing section titles, max 16ch.
- **Headline Page** (800, `clamp(2.2rem, 5vw, 3.6rem)`, 1.08): App Shell page H1 (directory, storage, design-system).
- **Title Tool** (800, `clamp(1.9rem, 4vw, 2.8rem)`, 1.12): The H1 inside a tool's filled heading. Under 768px it is `clamp(1.5rem, 7.5vw, 1.75rem)`, so a seven-character Chinese name still fits beside the Save star at 320px.
- **Title Block** (800, `clamp(1.6rem, 1.2rem + 1.2vw, 2.3rem)`, 1.1): Landing category block titles.
- **Title Section** (800, `clamp(1.2rem, 3vw, 1.55rem)`, 1.25): Tool-page section headings. Directory category headings are 1.35rem.
- **Body Lead** (500, `clamp(1.0625rem, 1rem + .35vw, 1.3rem)`, 1.6): Landing intro and pitch copy, max 30em.
- **Body** (400, 1rem, 1.6): Default. FAQ answers cap at 62ch.
- **Body Small** (400, .83rem, 1.5): Card descriptions and help text.
- **Label** (700, .86rem): Field labels and legends. Definition terms drop to .72–.75rem at 800.
- **Badge** (750, .6875rem, +.035em): Status pills, set in the Latin-first stack.
- **Numeral** (800, `clamp(2.6rem, 1.9rem + 2vw, 3.4rem)`, .9, `wdth` 116, tabular): Readings in hero slips and demos.

### Named Rules
**The Heavy Heading Rule.** Every h1–h3 is 800 weight with -0.02em to -0.035em tracking. `main.css` re-asserts this after Tailwind preflight resets heading weight.

**The Punctuation Break Rule.** Chinese headings and lead copy use `word-break: keep-all` with `overflow-wrap: anywhere`, so lines break at punctuation and never inside a phrase. Headlines also use `text-wrap: balance`.

**The No Eyebrow Rule.** No small label sits above a heading. A heading stands on its own, and supporting copy goes below it.

## Layout

**Two shells.** The landing layout (`app/layouts/landing.vue`) and the App Shell (`app-shell`) are separate. The landing page never shows the sidebar or a tool workspace.

**Landing.** Content sits in `.nb-wrap`: `min(1320px, 100%)` with a `clamp(16px, 4vw, 48px)` gutter. The header is 72px (64px under 768px) with a 2px bottom rule. At 1024px and up, the hero is a 7fr / 5fr grid that fills `100svh` minus the header: copy, search and CTA on the left, and the dealt slip deck on the right. The category bento is one column, then two columns at 768px (image-commerce spans both), then a 12-column grid at 1024px (7 + 5, then 4 + 4 + 4). The FAQ becomes a 4fr / 8fr split at 1024px. Sections are spaced `clamp(72px, 9vw, 128px)`. A full-bleed ink closing band precedes the footer.

**App Shell.** At 1024px and up there is a fixed left sidebar of 256px (80px collapsed, animated on `width`) and a sticky 64px topbar with a 2px bottom rule. Pages use `min(1160px, 100%)` with padding of 36px 20px 116px on phones (room for the bottom nav) and 52px 40px 88px on desktop (56px inline at 1280px). Tool pages narrow to `min(980px, 100%)`; a tool that asks for a wide workspace (the image tools and the PDF signature) widens the whole page to `min(1440px, 100%)`, so the heading, the workspace and the sections below share one pair of edges while running text inside the sections keeps a 72ch measure. The directory lays category panels in one column, and in two CSS columns (28px gap, `break-inside: avoid`) at 768px. Below 1024px, a floating bottom nav and a full-screen category drawer replace the sidebar.

**Rhythm.** Spacing is not tokenized in CSS. The observed rhythm is a 4px base (4 / 8 / 12 / 16 / 20 / 24 / 32 / 48) with frequent 2px half-steps (6 / 10 / 14 / 18 / 22) for internal padding. Fluid `clamp()` padding is used on large containers. Every interactive target is at least 44×44px.

**Breakpoints.** 480px (header "all tools" link appears), 768px (two columns), 1024px (sidebar, hero split, 12-column bento), 1280px (wider page padding, four-column state matrix).

## Elevation & Depth

There are no shadows. `--card-shadow` is literally `none`, and no component, overlay, dropdown or hover adds one. Depth comes from four flat devices:
1. **Rules:** a 2px ink border closes every surface.
2. **Fills:** category colour and the yellow highlight separate planes.
3. **Overlap:** hero slips overlap by 12px at resting tilts of -2.5°, 2° and -1.5°, stacked by z-index. Hover or focus brings a slip to the front and straightens it.
4. **Ink inversion:** the current location (sidebar link, mobile nav item, drawer link, selected calendar day) becomes an ink block with paper text.

The only blur-free veil is the drawer scrim: ink at 58% via `color-mix`. Two editor overlays use a thin outline ring (`0 0 0 1px` white on the promo-image selection box, `0 0 0 2px` surface on a selected PDF signature placement) so a selection stays visible on any image. These are identification outlines, not depth.

### Named Rules
**The No-Shadow Rule.** No `box-shadow` is used for elevation, ever. If something needs to stand out, give it a rule, a fill, or invert it to ink.

**The Ruled-Once Rule.** A tool gets one ruled card. Notes, caveats, legends, sources and model panels inside it are sections under a 1px `border-subtle` hairline, with no border, radius or background of their own. Tables keep a hairline frame because they are data, not cards.

## Shapes

**Rules.** `--rule: 2px` is the structural line. 1.5px is used inside fills (badge outlines, the dividers between tool rows in a category block, the mini-calendar cells). 1px `border-subtle` is used for hairlines inside ruled containers. Dashed 2px means "drop here, or this differs": file pickers, empty states, make-up workdays, user-changed calendar days, and placement guides.

**Radius ladder** (scales with container size):
- **Pill** (999px): every button, search field, option toggle, badge, chip, round icon button and progress bar.
- **Small** (12px): text inputs, selects, 40px icon tiles, sidebar links, and small rows.
- **Medium** (16px): inner panels, result panels, saved-tool rows, and notices.
- **Large** (20px): cards, tool workspaces, the search dropdown, hero slips, FAQ rows, and the mobile nav.
- **Extra Large** (28px): landing category blocks and the filled tool heading.

The brand mark is a 32px yellow square (9px radius, 2px ink rule) holding a 10px ink dot. Swatches are 16px squares with a 2px ink rule.

### Named Rules
**The Pill Press Rule.** Pressable controls are pills. Text inputs and selects are 12px, and the search field is the one input drawn as a pill. Container radius grows with container size: 12, then 16, then 20, then 28px.

## Components

### Buttons
Confident, flat pills that never lift.
- **Shape:** Full pill (999px), 2px border, min-height 44px (36px small, 48px large, 44×44 icon).
- **Primary:** Ink fill with paper text, label at .9rem / 800. Hover becomes yellow with ink text and an ink rule. Active drops to `ink-800`. Dark mode: chalk fill with ink text.
- **Outline / Secondary / Ghost:** Surface fill with an ink rule (ghost has no rule). Hover fills yellow. The tool heading's "Save" toggle is an outline pill with `aria-pressed`.
- **Header utilities** (search link, theme, locale): outline pills that **invert to ink** on hover instead of turning yellow.
- **Hero / CTA** (landing): 56px tall, 26px inline padding, 1.0625rem / 800, with a trailing arrow. The ink variant hovers to yellow. The yellow variant (closing band) hovers to paper. On hover the arrow slides 5px right, and on press the button settles 2px down.
- **Copy result:** uses the `--button-contrast-*` pair, which shares the primary's ink and chalk scheme.
- **Disabled:** native `disabled` / `aria-disabled` at 55% opacity, with no pointer events.

### Chips and Badges
- **Status badges:** pill, 1.5px ink outline, .6875rem / 750, padding 2px 9px. NEW is mint, PRO is yellow, HOT (熱門) is coral, and Saved (常用) is a surface fill. PRO is a visual label only and never gates access.
- **Option pills** (BMI units, NTD purposes, picker options): 44px pills with a 2px rule and a native radio inside. When checked they become a yellow fill, an ink rule and 700 text.
- **Summary chips** (picker names, workbench steps): small pills with a 2px rule on a subtle or paper ground. Landing step chips light to ink-on-fill in sequence.

### Cards / Containers
- **Corner Style:** 20px (`rounded.lg`) by default.
- **Background:** surface (paper or night-900).
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 2px `--color-border`.
- **Tool card** (directory): a 96px-min row with a 40px icon tile in the category fill (2px ink rule, 12px radius), the name at 800, a .83rem description, badges top-right, and a trailing arrow. On hover the whole card fills yellow and the arrow turns ink.
- **Tool workspace:** a ruled card with `clamp(16px, 3vw, 24px)` padding and a two-column grid at 768px (inputs left, result right).
- **Wide tool workspace:** the picture on the left on a warm `paper-50` frame, every control in a right column of `clamp(280px, 26vw, 340px)` behind a 1px divider. In the canvas editors (brand promo image, product workbench) the left column holds only the photo strip, the canvas and its one line of help, and stays in view while the controls scroll; numbers that repeat a drag gesture fold into a closed disclosure.
- **Result panel:** min 148px, 22px padding, 16px radius, 2px rule, on Result Cream. The answer is set at `clamp(1.15rem, 3vw, 1.6rem)`. Under 768px, stacked below its fields, it is only as tall as its content (14px 18px 16px padding), so the buttons after it stay on the first screen.
- **Filled tool heading:** the tool page header is a block of its category fill (28px radius, 2px ink rule, ink text) holding the H1, the description and the Save pill. Its icon tile, when shown, sits on paper. Under 768px it gives its height to the workspace: the H1 and a 44×44 star-only Save toggle share the first row (the words stay its accessible name, and the star fills once saved), and the description runs the full width below.
- **Disclosure cards** ("Before you start", FAQ): ruled cards whose `<summary>` is a 44px row with a chevron that rotates 180° when open.

### Inputs / Fields
- **Style:** 2px ink rule, 12px radius, 44px min height, 10px 13px padding, on surface. Placeholder uses muted ink.
- **Focus:** the border stays ink, plus a 3px `--color-focus-ring` outline at 2px offset (ink in light mode, yellow in dark mode).
- **Error / Disabled:** `aria-invalid` turns the border destructive and a bold .8rem error line follows. Disabled uses the subtle ground at 55%.
- **Select:** native appearance removed, with a 16px chevron drawn from the per-theme `--select-chevron` token.
- **Large search:** a 64px pill with a 2px ink rule, a leading search icon and a trailing clear button. Results open 8–10px below in a 20px-radius ruled panel whose rows hover yellow.

### Navigation
- **Sidebar** (≥1024px): white or night surface with a 2px right rule. It holds the brand row (72px) and three primary links (all tools, saved, local assets), then a saved-tools group and one group per category, each titled with its 12px fill swatch. Links are 44px with 12px radius in muted ink. Hover is yellow. The current link is an **ink block** with paper text. In light mode the sidebar is never a full black panel.
- **Topbar:** sticky, 64px, with a 2px bottom rule on the page background. It shows the brand (hidden at ≥1024px), a "find a tool" pill, and the theme and locale pills.
- **Landing header:** 72px, with a 2px bottom rule. It holds the brand mark, an "all tools" pill (hidden under 480px), and the theme and locale pills.
- **Mobile nav** (<1024px): a floating 68px bar inset 12px from the edges, with a 2px rule and 20px radius, and four 56px items (home, tools, categories drawer, saved). The active item is an ink block.
- **Category drawer:** a full-screen sheet over an ink 58% scrim. It enters with a 16px rise on `ease-enter`. Tool links are 52px ruled rows, and the current one is an ink block.
- **Text links in content:** ink (`primary-strong`), underlined at a 3px offset.

### Output Slips (signature)
The landing hero's dealt deck. There are three overlapping cards, each in its category fill with a 2px ink rule, 20px radius and ink text. Each slip is one real tool output: the cheque wording from the NTD converter, a February holiday run from the calendar data, and a BMI reading. A slip's title is a stretched link, so the whole slip is clickable. A 34px round arrow badge inverts to ink and rotates -45° on hover. On load the slips deal in from 96px below with extra tilt (`expo.out`, 1.1s, .14s stagger). Then the cheque wording wipes in, the holiday days pop, and the BMI counts up. If the script never runs, CSS settles everything at 3.2s.

### Category Blocks (signature)
The landing bento. Each block is its category fill with a 28px radius and 2px ink rule. It holds a block title, a 1.0625rem pitch, a live demo sitting straight on the fill (no inner card), and a ruled list of every tool in the category. Tool rows are 68px. On hover a row inverts to ink with the fill colour as text, its text slides 6px, and a round arrow fades in. Each demo plays once when it scrolls into view (top 85%): a checkerboard reveal of the cut-out, a signature stroke drawing, the BMI marker travelling to its band, and the wheel landing. The time block shows the live device clock instead of an entrance animation.

### FAQ Rows and Closing Band
FAQ items are 20px-radius ruled rows with a 68px summary at 1.15rem / 800 and a 38px round plus icon. When open, the icon turns yellow and rotates 45°. The closing band is full-bleed ink with a display-scale question and a yellow CTA pill, and its focus ring turns yellow.

### Motion
Tokens: 80 / 150 / 220 / 360ms, with `ease-standard` cubic-bezier(.2, 0, 0, 1) for state changes and `ease-enter` cubic-bezier(.16, 1, .3, 1) for arrivals. Interface transitions change only background, border and colour. GSAP (core, ScrollTrigger, DrawSVG) is dynamically imported on the landing page only, and is never downloaded when reduced motion is already preferred. Under `prefers-reduced-motion: reduce`, every CSS animation and transition collapses to 0.01ms.

## Do's and Don'ts

### Do:
- **Do** close every surface with the 2px `--rule` in `--color-border`, and separate sections inside it with a 1px `--color-border-subtle` hairline.
- **Do** set ink (`--fill-ink`) on every category fill, and keep fills unchanged in dark mode.
- **Do** use yellow (`--color-surface-hover`) as the hover and selected fill on pointer devices only (`@media (hover: hover) and (pointer: fine)`). In dark mode it resolves to Deep Yellow.
- **Do** mark the current location by inverting to ink (`--sidebar-active-bg` / `-fg`).
- **Do** make buttons, search fields, option toggles and badges full pills, and keep text inputs at 12px.
- **Do** keep a visible 3px focus outline at a 2–3px offset on everything focusable.
- **Do** keep every interactive target at least 44×44px.
- **Do** render every demo or animated value in its finished state in HTML, and animate only inside `gsap.matchMedia('(prefers-reduced-motion: no-preference)')`, once.
- **Do** show a category's real output in place of describing it on the landing page.

### Don't:
- **Don't** add `box-shadow`, drop shadows, glows, glass blur, or decorative gradients. The only gradient in the system is the functional transparency checkerboard.
- **Don't** nest a 2px-ruled card inside another ruled card. Use a hairline section instead.
- **Don't** use any of the four non-yellow fills to signal hover, selection or focus.
- **Don't** put a small eyebrow or kicker above a heading.
- **Don't** let colour carry meaning alone. Pair it with text, an icon or a border.
- **Don't** paint the light-mode sidebar as a full black panel. Only the current item is inverted.
- **Don't** scale, float, parallax, scroll-jack or pointer-follow. Landing demos play once and stop.
- **Don't** load a CJK webfont or any third-party font CDN.
- **Don't** use emoji or Unicode symbols as icons. Use Lucide outline icons or the landing's own SVG drawings.
