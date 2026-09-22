# Retro price workbench

The approved visual is the long-form third design, dated 2026-09-21. The homepage keeps the existing curated catalog and pipeline. It does not cap providers at four models.

New UI: provider index, grouped price table, bulk expand/collapse, standard-text monthly estimate, provenance counts, overdue verification list, source health details, and an explicitly empty verified change log linked to real Git history.

The estimate does not model context-tier pricing, cache writes/storage, batch discounts, tools, media, tax, or FX. Missing required prices produce an error, never a free estimate. Monthly input includes cached input; the hit percentage partitions it.

No invented release dates or pricing events are populated. A future verified event feed must include event type, model ID, effective date, evidence URL, verification timestamp, and reviewer/ingestion provenance before replacing the empty state.

Assets: generated dither background optimized to WebP; provider SVGs remain local LobeHub assets. Kimi uses its monochrome variant for light-surface contrast. No external font or icon CDN is required.

Checks: `npm run check`; browser test provider/search/country/tier/sort/expand flows, estimator success and error, source disclosure, log filter empty states, and 390px/820px/1440px responsive widths. See `design-qa.md` for evidence.
