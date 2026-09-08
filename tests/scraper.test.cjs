const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseOpenAIPrice, updateOpenAIPrices } = require('../scraper.js');

const luna = { id: 'luna', apiId: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'OpenAI', priceStatus: 'official', input: 9, cachedInput: 8, output: 7, lastVerifiedAt: 'old' };
// Pricing table excerpt observed in the real Actions response on 2026-09-08.
const table = fs.readFileSync(path.join(__dirname, 'fixtures/openai-luna.md'), 'utf8');
// Minimal fixture of the official model page's heading and pricing structure.
const page = (name = luna.name) => `<nav>GPT-6 Astra Input $10 Cached Input $1 Output $50</nav><h1>${name}</h1><h2>Pricing</h2><h3>Text tokens</h3><p>Per 1M tokens</p><div>Input</div><div>$0.20</div><div>Cached input</div><div>$0.02</div><div>Output</div><div>$1.20</div><h3>Quick comparison</h3>GPT-5.6 Terra $2`;

test('reads the model own prices, ignoring navigation and comparison cards', () => {
  assert.deepEqual(parseOpenAIPrice(luna, page()), { input: 0.2, cachedInput: 0.02, output: 1.2 });
});
test('supports official markdown responses', () => {
  assert.deepEqual(parseOpenAIPrice(luna, '# GPT-5.6 Luna\n## Pricing\n### Text tokens\nPer 1M tokens\nInput\n$0.20\nCached input\n$0.02\nOutput\n$1.20\nQuick comparison'), { input: 0.2, cachedInput: 0.02, output: 1.2 });
});
test('parses the content-negotiated Markdown table returned to Actions', () => {
  assert.deepEqual(parseOpenAIPrice(luna, table), { input: 0.2, cachedInput: 0.02, output: 1.2 });
});
test('rejects missing rows and inconsistent units in Markdown tables', () => {
  for (const body of [table.replace('| Cached input | $0.02 | 1M tokens |', ''), table.replace('$1.2 | 1M', '$1.2 | 1K')]) {
    assert.throws(() => parseOpenAIPrice(luna, body), /字段不完整/);
  }
});
test('rejects compare pages, wrong model pages and HTTP error bodies', () => {
  for (const body of [page('Compare models'), page('GPT-6 Astra'), 'Forbidden']) {
    assert.throws(() => parseOpenAIPrice(luna, body), /标题不匹配/);
  }
});
test('never borrows missing fields from a later comparison card', () => {
  assert.throws(() => parseOpenAIPrice(luna, page().replace('<div>Output</div><div>$1.20</div>', '') + ' Output $50'), /字段不完整/);
});
test('rejects changed units and malformed prices', () => {
  for (const body of [page().replace('Per 1M', 'Per 1K'), page().replace('$0.20', '$-1'), page().replace('$1.20', '$1.2.3')]) {
    assert.throws(() => parseOpenAIPrice(luna, body), /字段不完整/);
  }
});
test('fetches each independent model page, not the default compare selection', async () => {
  const urls = [];
  const other = { ...luna, id: 'sol', apiId: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' };
  const result = await updateOpenAIPrices([luna, other], 'new', async url => {
    urls.push(url);
    return page(url.endsWith('luna') ? luna.name : other.name);
  });
  assert.deepEqual(urls, ['https://developers.openai.com/api/docs/models/gpt-5.6-luna', 'https://developers.openai.com/api/docs/models/gpt-5.6-sol']);
  assert.equal(result[0].lastVerifiedAt, 'new');
  assert.equal(result[0].input, 0.2);
  assert.equal(luna.input, 9);
  assert.equal(luna.lastVerifiedAt, 'old');
});
test('a failed model prevents partial publication and retains original prices/dates', async () => {
  const models = [luna, { ...luna, apiId: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' }];
  const before = structuredClone(models);
  await assert.rejects(updateOpenAIPrices(models, 'new', async url => {
    if (url.endsWith('luna')) throw new Error('HTTP 403');
    return page('GPT-5.6 Sol');
  }), /gpt-5.6-luna: HTTP 403/);
  assert.deepEqual(models, before);
});
test('does not request aggregated or other provider models', async () => {
  const models = [{ ...luna, priceStatus: 'aggregated' }, { ...luna, provider: 'Google' }];
  assert.deepEqual(await updateOpenAIPrices(models, 'new', () => assert.fail('unexpected request')), models);
});
