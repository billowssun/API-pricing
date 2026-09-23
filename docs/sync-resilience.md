# Sync resilience — 2026-09-23

Incident: Actions run 35824566490 fetched 55 models successfully, then failed its post-sync test because a production-data assertion required `gpt-5.6-sol` to remain selected after `gpt-6-sol` appeared. Earlier runs passed the same test before fetching. This was a mutable-fixture bug, not an upstream fetch failure.

Strategy:
- Unit tests use deterministic fixtures and test policy invariants, not a fixed list of currently selected model IDs. Future major/minor upgrades are covered.
- Live schema/source/price validation and production builds remain required before publication. Do not remove these gates or use continue-on-error to disguise corruption.
- Catalog candidates are validated before merging. Entire-provider disappearance or >30% representative loss quarantines the catalog update; existing entries and timestamps remain. This is a review guard, not evidence to auto-retire a model.
- Official OpenAI reads fail independently: successfully parsed model prices update; failures retain their own old prices and timestamps. Partial problems are recorded as degraded. No timestamps are inferred from overall directory sync time.
- If no pricing source refreshes, sync fails and preserves the published catalog. Connectivity-only probes do not count as price refreshes.
- Failures during either sync or post-sync validation/build publish failed status only, restore the committed pricing file in the fresh runner, and link to the run. Diagnostic summary/artifact are produced after validation, so they describe the actual outcome.

Limits: newly named product families still require a reviewed policy change; format changes do not justify guessing prices. This is graceful degradation, not a guarantee that upstream changes never require maintenance.
