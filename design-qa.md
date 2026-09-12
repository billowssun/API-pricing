# Compact price board — design QA

## Result and scope

final result: passed

Local UI handoff only; not deployed. Last build and browser smoke check: 2026-09-12. This is not a claim that every vendor's prices were reverified on that date.

## Visual truth and evidence

- Selected option 1: `C:/Users/Administrator/.codex/generated_images/019f49ad-f951-79c1-88c8-92febf869a5a/exec-08e20c8f-cefb-47a1-94f9-1d111d1235a4.png` (1487 × 1058 pixels).
- Desktop implementation: `design-evidence/desktop-final.png`; browser viewport 1487 × 1058 CSS pixels, normal density, scrollbar gutter excluded from content capture.
- Mobile implementation: `design-evidence/mobile-final.png`; browser viewport 390 × 844 CSS pixels, normal density, scrollbar gutter excluded.
- State: homepage, light theme, empty search, all countries and tiers, providers expanded, model details closed.
- Source and both final screenshots were opened together in one comparison input. Full-view composition and readable table/control details were reviewed. Separate focused crops were unnecessary at the supplied readable image sizes.
- The September 12 browser smoke check confirmed unchanged layout and expired promotional pricing on the homepage and direct model detail route. Browser console warnings/errors: none.

## Intentional adaptations

- Board width is capped at 1080 CSS pixels, honoring the user's compact, non-fullscreen requirement rather than the wider mock canvas.
- Production catalog has 30 selected models across 10 vendors instead of the mock's nine illustrative rows. Vertical scrolling is expected; no attempt to squeeze all rows above the fold.
- Current catalog names and official/aggregated source labels replace illustrative mock content. This is a family-based representative selection, not a measured popularity ranking.
- Mobile uses a horizontally scrollable price table, with the instruction above it; there was no separate mobile source mock.

## Required fidelity surfaces

- Typography: restrained sans-serif Chinese/system fallback, clear title and provider hierarchy, final model and price text 14px; currency suffix deliberately secondary. No clipped desktop model names in reviewed views.
- Layout: centered white sheet, compact header, search/filter toolbar, aligned price columns, thin row dividers and modest rounded outer frame. Mobile page itself does not overflow; the table scrolls internally.
- Colors: pale neutral canvas, white sheet, muted borders, green brand/selected controls and official-source links. Aggregated sources are visually distinct.
- Assets: local unmodified LobeHub SVG provider logos and Tabler UI icons. All ten homepage provider images loaded with positive natural dimensions. Attribution/license retained in `public/providers`.
- Copy: model name, tier, input/cache/output and source remain the primary content. Original currency and per-million-token units are explained. Individual verification dates and pricing conditions are available in expanded details.

## Comparison history

1. P2 — Mobile scrolling instruction was below the long table, making hidden columns harder to discover. Moved the hint above the table; recaptured `mobile-final.png`. Hint is now visible before the first provider.
2. P2 — Initial 13px model/price text was too small for the compact density. Increased to 14px; recaptured desktop and mobile final images and compared again. Column alignment remains intact.
3. No remaining actionable P0/P1/P2 visual findings in the reviewed scope.

## Functional verification

- Search and clear; China filter (17 models); China plus lightweight tier (4 models); empty state and reset (30 models).
- Provider collapse/expand; model details; input sorting within provider and original currency; source explanation anchor/disclosure.
- Mobile horizontal scroll actually moved the table (observed scrollLeft 343) and exposed cache/output/source columns.
- All ten logos loaded. Browser console check returned an empty error/warning list.
- September 12: homepage and GLM Flash detail both use post-expiry scheduled pricing; detail explicitly says the promotion ended.
- `npm run check`: all 16 tests, 68-model data validation, TypeScript and production build passed. `git diff --check` passed.

## Remaining limitations / follow-up

- Live full-catalog sync was not rerun successfully locally; earlier network connection resets prevented that check. Existing per-source dates are retained, not relabeled as fresh.
- Totally new product-family naming needs a policy update. ZAI/MiniMax additions were source-reviewed manually; this is not a universal official-site parser.
- Scheduled changes follow server regeneration (one-hour revalidation), not an instantaneous push to an already-open tab.
- Legacy deep-link pages retain their previous layout; homepage is the redesigned experience.

## Handoff checklist

- [x] Selected visual implemented with documented compact-width adaptation.
- [x] Desktop/mobile comparison and primary interactions verified.
- [x] P2 findings fixed and recaptured.
- [x] Production build and tests passed.
- [x] Local preview restarted and left open at the homepage.
- [ ] Publish only after the user requests deployment.
