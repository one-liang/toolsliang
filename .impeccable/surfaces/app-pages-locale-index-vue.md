---
version: 1
slug: "app-pages-locale-index-vue"
primary_target: "app/pages/[locale]/index.vue"
related_targets: ["app/layouts/landing.vue"]
---

# Landing page (`/{locale}/`)

Scope: the bilingual landing page, the first surface of the site-wide visual redesign. The user approved carrying this world to every surface on 2026-10-15. Visitor mode: **Persuade**.

Audience: search visitors and returning users from both PRODUCT.md audiences. Job: understand within one viewport what toolsliang offers, then reach the one tool they came for. Action: the working local search, plus the category bento where every published tool appears once with its link.

Constraints from the user's brief: neo-brutalist, no shadows anywhere; Apple-product-page clarity (big type, one message per block, minimal copy and steps); the on-device/privacy message appears once, not as a recurring section; no repetitive icon rows; less empty space; GSAP interaction; colours free to reset. Quality bar named by the user: Apple.com product pages and Gumroad.

## Direction contract

THESIS: The category standard — neo-brutalist tool landing — executed at Apple product-page craft. The page is a catalogue that shows each category's real output instead of describing it; it refuses the empty hero over a grid of same-size icon cards and the repeated privacy sermon.

OWN-WORLD: White ground, near-black ink, 2px ink rules on every container, flat fills per category (sun yellow, coral, sky blue, mint, lilac-pink), zero shadows and zero gradients. Large radii (28px category blocks, 20px slips and FAQ rows), pill controls; demos sit straight on their block fill with no inner card. Chinese headlines use each platform's own system face at heavy weight with tight tracking (PingFang TC on Apple devices, Microsoft JhengHei on Windows), chosen by the user on 2026-10-15 over a self-hosted CJK face; Latin and numerals in a self-hosted grotesk. Primary control is a black pill that flips to yellow on hover; dark mode inverts ground and rules, fills stay.

STORY: The visitor reads one line and knows this is a set of free, single-job tools for Taiwan tasks; searches, or scans five category blocks whose demos show what each tool produces; clicks straight into a tool. Each claim is made once: free in the H1, the tool count in the catalog heading, and the boundaries (price and sign-up, privacy, phones) answered once each in the FAQ. The user removed the scrolling facts strip on 2026-10-15, so nothing above the FAQ restates them. A black closing band repeats the one action, browsing every tool, before the footer.

FIRST VIEWPORT: Left seven columns: two-line H1 at display scale, one short line of support copy, a 64px search field with a 2px ink border, a black "browse all tools" pill. Right five columns: a dealt stack of three tilted output slips (cheque wording from the real NTD converter, February 2026 holiday run from the real calendar data, a BMI reading) in flat category colours. The hero fills the first viewport below the header; the catalog starts below the fold.

FORM: Canon (category standard), user-chosen in the bolder round; seed key 13ab8046. Signature interaction: the hero slips deal in once on load; the calendar slip pops its holiday run and the BMI slip counts up during the deal; each category block performs its own demo once when it enters view (cut-out checkerboard reveal with the workbench steps lighting, signature stroke drawing on a form whose amount the NTD converter wrote, the BMI marker travelling to its band, the wheel landing on one name); the time block shows the live device clock instead of an entrance demo, because ticking is that tool's own output. All motion runs inside gsap.matchMedia on (prefers-reduced-motion: no-preference), so reduced motion shows every end state statically and switching it on mid-visit reverts to them.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- The provisional brand name: the wordmark stays replaceable.
