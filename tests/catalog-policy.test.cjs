const test = require("node:test");
const assert = require("node:assert/strict");
const {
  selectMainstreamModels,
  providers,
} = require("../lib/catalog-policy.cjs");
const data = require("../pricing.json");
test('time-limited pricing returns to the official list price at the exact deadline', () => {
  const before = selectMainstreamModels(data.models, Date.parse('2026-09-09T15:59:59Z')).find(m => m.apiId === 'glm-5.3-flash');
  const after = selectMainstreamModels(data.models, Date.parse('2026-09-09T16:00:00Z')).find(m => m.apiId === 'glm-5.3-flash');
  assert.equal(before.input, 0.075);
  assert.equal(after.input, 0.15);
  assert.equal(after.priceLabel, '');
});
const row = (apiId, extra = {}) => ({
  id: apiId,
  apiId,
  name: apiId,
  provider: "Google",
  type: "text",
  priceStatus: "aggregated",
  ...extra,
});
test("new versions replace old family members, retaining distinct tiers", () => {
  assert.deepEqual(
    selectMainstreamModels([
      row("gemini-3.7-flash"),
      row("gemini-3.8-flash"),
      row("gemini-3.5-flash-lite"),
    ]).map((m) => m.apiId),
    ["gemini-3.8-flash", "gemini-3.5-flash-lite"],
  );
});
test("official alias wins over duplicate snapshots without mutation", () => {
  const rows = [
    row("deepseek-v4-pro", { provider: "DeepSeek", priceStatus: "official" }),
    row("deepseek-v4-pro-0813", { provider: "DeepSeek" }),
  ];
  const before = structuredClone(rows);
  assert.equal(selectMainstreamModels(rows)[0].apiId, "deepseek-v4-pro");
  assert.deepEqual(rows, before);
});
test("experiments do not replace stable models", () =>
  assert.equal(
    selectMainstreamModels([
      row("deepseek-v4-flash-vision-exp", { provider: "DeepSeek" }),
    ]).length,
    0,
  ));
test("independent current product lines coexist without a per-provider cap", () => {
  const result = selectMainstreamModels(data.models);
  assert.equal(new Set(result.map((m) => m.id)).size, result.length);
  for (const id of ['gpt-5.6-sol', 'gpt-6-astra', 'gpt-6-astra-pro', 'gpt-5.6-terra', 'gpt-5.6-luna'])
    assert.ok(result.some(m => m.apiId === id), `${id} must remain visible`);
  assert.ok(result.some((m) => m.apiId === "gpt-6-astra"));
  assert.ok(!result.some((m) => m.apiId === "gemini-3.7-flash"));
});
test('MiniMax minor upgrades replace old versions in the same line', () => {
  const result = selectMainstreamModels(['minimax-m3', 'minimax-m3.1'].map(id => row(id, { provider: 'MiniMax' })));
  assert.deepEqual(result.map(m => m.apiId), ['minimax-m3.1']);
});
test('retirement takes effect at its explicit deadline, not from age alone', () => {
  const models = [row('gemini-3.1-pro', { retireAt: '2026-10-01T00:00:00Z' })];
  assert.equal(selectMainstreamModels(models, Date.parse('2026-09-30')).length, 1);
  assert.equal(selectMainstreamModels(models, Date.parse('2026-10-01')).length, 0);
  assert.equal(selectMainstreamModels([row('gemini-3.1-pro', { lifecycle: 'retired' })]).length, 0);
});
test('discovery keeps Sol alongside Astra instead of dropping a live product line', () => {
  const { selectCatalog } = require('../scraper.js');
  const models = ['gpt-5.6-sol', 'gpt-6-astra', 'gpt-6-astra-pro', 'gpt-5.6-terra', 'gpt-5.6-luna'].map(id => ({
    id: `openai/${id}`, name: id, architecture: { output_modalities: ['text'] }, pricing: { prompt: '0.000001', completion: '0.000002' }
  }));
  assert.equal(selectCatalog(models).length, 5);
});
test("discovery retains tiers even when many more recent Flash variants exist", () => {
  const { selectCatalog } = require("../scraper.js");
  const raw = (id, created) => ({
    id,
    name: id,
    created,
    architecture: { output_modalities: ["text"] },
    pricing: { prompt: "0.000001", completion: "0.000002" },
  });
  const list = [
    raw("google/gemini-3.1-pro", 1),
    ...Array.from({ length: 10 }, (_, i) =>
      raw(`google/gemini-3.${i + 2}-flash`, i + 2),
    ),
  ];
  const selected = selectCatalog(list);
  assert.equal(selected.length, 2);
  assert.ok(selected.some((m) => m.id === "google/gemini-3.1-pro"));
});
