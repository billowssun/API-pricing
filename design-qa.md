# Retro workbench design QA — 2026-09-21

Source visual truth: C:/Users/Administrator/.codex/generated_images/019f49ad-f951-79c1-88c8-92febf869a5a/exec-145f5d1d-2781-4572-b4e4-a1d59745b485.png

Implementation: http://127.0.0.1:4174/; evidence design-evidence/retro-desktop-v1.png and retro-mobile-v1.png.
Full-view comparison: design-evidence/retro-comparison-v1.png, both scaled to 720px width without changing aspect ratio. Desktop CSS viewport 1440x1000; mobile 390x844. Default OpenAI expanded, other providers collapsed, estimator blank.

## Findings / iteration 1
- P2 typography: table/sidebar and supplemental text too small relative to reference when normalized. Increase desktop table to 14px, utility text to 13–14px, and display titles to 35–44px.
- P2 image contrast: white Kimi color logo disappeared on light backgrounds. Fixed by using library-supplied monochrome Kimi SVG.
- P2 token leakage: old global estimate-result styles caused green type/rounded surface. Fixed with explicitly scoped square result panel and black text.
- P2 calculator composition: vertical result panel made section taller than target. Place result beside fields on desktop, preserve stacked mobile flow.

## Required fidelity surfaces
Typography, spacing/layout, colors/tokens, asset quality, and content compared in combined image. Reference example counts/prices are intentionally replaced by current repository data; OpenAI has six models, including Sol and Sol Pro. Nonfunctional window controls intentionally removed. Retained existing provider brand assets rather than fabricated mock logos. No invented changelog events.

## Interactions tested so far
Sol detail opens with its own verification date; empty search resets; DeepSeek and Kimi sidebar filters work; Sol 1M input/200K output/50% cache = USD6.20; cache101% rejected; retirement filter and verification disclosure work. No console errors in initial desktop capture.

## Final comparison / iteration 2 — 2026-09-22

All four initial P2 findings addressed: desktop table/sidebar enlarged to 14px, display heading 44px and supplemental headings 35px; Kimi monochrome asset loads; result panel square and black with homepage-scoped styles; calculator result sits beside inputs on desktop. No outstanding P0/P1/P2 findings.

Full-view evidence: `design-evidence/retro-comparison-final.png`, approved source (left) and production build (right), each aspect-preserving scaled to 720px wide. Source 971x1619 pixels, implementation 1425x2566 screenshot pixels at CSS viewport 1440x1000, devicePixelRatio 1 (screenshot excludes scrollbar). Content region is compared by width, not stretched to equal page height. `design-evidence/retro-focused-final.png` aligns source pricing region at 850px width with implementation pricing region at 850px, inspecting heading, labels, input controls, cell spacing, prices, and source indicators. Source mock contains four illustrative OpenAI rows while real data contains six: differing row counts are intentional, not missing content.

Final implementation captures: `design-evidence/retro-desktop-final.png`, `design-evidence/retro-mobile-final.png` (390x844 CSS viewport), and `design-evidence/retro-tablet-final.png` (820x1000 CSS viewport). Mobile no document overflow (scrollWidth = viewport width = 390), horizontal overflow is confined to price table/provider index. All provider images loaded, including Kimi.

### Required surface decisions
- Typography: system Arial/Chinese sans-serif with Consolas/Cascadia metadata substitutes for mock grotesk/mono, no network font dependency. Real-data UI deliberately denser than raster mock; 14px desktop price text remains readable. Hierarchy and Chinese wrapping reviewed in focused image.
- Layout: centered 1080px retro window, 1200px supporting editorial area, square ruled panels, three numbered sections. Desktop calculator side-by-side; mobile stacks and preserves real controls. Extra provenance disclosure and pricing caveat intentionally add useful page length.
- Tokens: pink dither field, warm white page, gray window surfaces, black controls. Source statuses retain green/blue semantics. Decorative fake window controls and marginal slogans omitted intentionally.
- Images: generated cloud texture optimized to 355KB WebP; real local brand SVGs instead of mock-generated logos. No broken images, no external icon CDN.
- Content: 33 selected models, all six OpenAI product lines retained; no hard four limit. Official/aggregated source distinctions and 11 outdated/unverified records explicit. Empty event feed is honest, with real Git history link; no fabricated event dates.

### Completed verification
- Production `npm run check`: 24 tests passed, 52 data records validated, TypeScript and Next production build passed; `git diff --check` passed.
- Country China yields 18 models / six providers; China + lightweight yields four models / four providers; ascending input column sets aria-sort. Reset, collapse-all and individual OpenAI expansion restore Sol.
- Search empty state/reset; provider index DeepSeek and Kimi; Sol expandable API ID/context/verification; calculator USD6.20 case and invalid 101% cache error; source disclosure; empty retired-event filter tested.
- Mobile keyboard horizontal table scrolling observed; provider chips usable. Desktop and mobile inspected in in-app browser. Production console warn/error list empty.
- React review: pure derived calculation, immutable filter/sort arrays, controlled labeled inputs, button state semantics, no unnecessary effect/fetch, client state only for interaction. Stable source links and server-computed provenance summary retained.

### Follow-up polish (P3 / non-blocking)
- Generated cloud texture is art-direction matched, not an exact pixel duplicate.
- A real verified event ingestion pipeline remains future work; this build intentionally labels the absence of verified events instead of claiming it exists.

final result: passed
