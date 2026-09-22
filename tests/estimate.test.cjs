const { test } = require("node:test");
const assert = require("node:assert/strict");
const { estimateCost, needsReview } = require("../lib/estimate.cjs");
const model = { input: 4, cachedInput: 0.4, output: 20 };
test("standard cost and cache split preserve token totals", () => {
  assert.deepEqual(estimateCost(model, 1e6, 2e5, 50), {
    inputCost: 2,
    cacheCost: 0.2,
    outputCost: 4,
    total: 6.2,
  });
});
test("zero usage and explicitly free prices remain valid", () => {
  assert.equal(estimateCost({}, 0, 0, 0).total, 0);
  assert.equal(
    estimateCost({ input: 0, output: 0, cachedInput: 0 }, 1e6, 1e6, 100).total,
    0,
  );
});
test("missing required prices never silently become free", () => {
  assert.ok(estimateCost({ input: 2, output: 3 }, 1e6, 1e6, 50).error);
  assert.ok(estimateCost({ input: null }, 1, 0, 0).error);
  assert.equal(estimateCost({ cachedInput: 1 }, 1e6, 0, 100).total, 1);
});
test("invalid inputs and non-finite prices rejected", () => {
  for (const values of [
    [-1, 0, 0],
    [1, 0, 101],
    [NaN, 0, 0],
    [Infinity, 0, 0],
    [1, 0, -1],
  ])
    assert.ok(estimateCost(model, ...values).error);
  assert.ok(estimateCost({ input: Infinity }, 1, 0, 0).error);
});
test("freshness distinguishes invalid, future, and aged dates", () => {
  const now = Date.parse("2026-09-21T00:00:00Z");
  assert.equal(needsReview("2026-09-20", now), false);
  for (const date of [undefined, "invalid", "2026-10-01", "2026-08-01"])
    assert.equal(needsReview(date, now), true);
});
