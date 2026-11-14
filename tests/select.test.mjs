// 用虚构的模型目录模拟未来可能发生的情况，确认"主流模型"的挑选无需人工维护也能正确跟进。
// 运行：node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectModels, computeTiers, parseUsage, discoverVendors, familyOf } from '../select.js';

const NOW = Date.parse('2027-06-01T00:00:00Z');
const day = n => Math.round(NOW / 1000 - n * 86400);   // n 天前（秒）

// 生成一个 OpenRouter 目录条目
const model = (id, name, daysAgo, input = 1, output = 5, out = ['text']) => ({
  id, canonical_slug: id, name, created: day(daysAgo),
  architecture: { output_modalities: out },
  pricing: { prompt: String(input / 1e6), completion: String(output / 1e6) },
});
// 使用量：{ slug: [prompt tokens, completion tokens] }
const usage = obj => Object.fromEntries(Object.entries(obj).map(([k, [p, c]]) => [k, { prompt: p, completion: c, count: 1 }]));
const names = list => list.map(m => m.name).sort();

// 现在的 OpenAI：四个挡位版本各不相同，外加一个旧命名的 mini
const catalog = [
  model('openai/gpt-6.1-sol', 'OpenAI: GPT-6.1 Sol', 60, 2, 10),
  model('openai/gpt-6-sol', 'OpenAI: GPT-6 Sol', 120, 2, 10),
  model('openai/gpt-6.1-terra', 'OpenAI: GPT-6.1 Terra', 30, 1, 5),
  model('openai/gpt-6-luna', 'OpenAI: GPT-6 Luna', 200, 0.1, 0.5),     // Luna 很久没更新
  model('openai/gpt-6-astra', 'OpenAI: GPT-6 Astra', 250, 10, 50),
  model('openai/gpt-5.4-mini', 'OpenAI: GPT-5.4 Mini', 400, 0.75, 4.5),  // 旧命名
  model('~openai/gpt-luna-latest', 'OpenAI: GPT Luna Latest', 100, 0.1, 0.5),
];
const used = {
  openai: usage({
    'openai/gpt-6.1-sol': [500e9, 50e9],
    'openai/gpt-6.1-terra': [100e9, 10e9],
    'openai/gpt-6-luna': [3000e9, 300e9],
    '~openai/gpt-luna-latest': [500e9, 50e9],
    'openai/gpt-6-astra': [20e9, 2e9],
    'openai/gpt-5.4-mini': [5e9, 1e9],
  }),
};

test('产品线按去掉版本号的名字归并', () => {
  assert.equal(familyOf('GPT-6.1 Sol'), 'gpt sol');
  assert.equal(familyOf('GPT Luna Latest'), 'gpt luna');
  assert.equal(familyOf('Claude Opus 4.7'), familyOf('Claude Opus 5.5'));
  assert.notEqual(familyOf('Gemini 3.1 Pro Preview'), familyOf('Gemini 2.5 Pro'));
});

test('按使用量选出主流挡位：长期不更新但有人用的 Luna 保留，旧命名 Mini 淘汰', () => {
  const tiers = computeTiers(catalog, 'text', used, NOW);
  assert.deepEqual([...tiers['openai|']].sort(), ['gpt astra', 'gpt luna', 'gpt sol', 'gpt terra']);
  const shown = selectModels(catalog, 'text', { tiers, now: NOW });
  assert.deepEqual(names(shown), ['GPT-6 Astra', 'GPT-6 Luna', 'GPT-6.1 Sol', 'GPT-6.1 Terra']);
});

test('某个挡位出新版本：自动换成新版本，无需重新计算主流', () => {
  const tiers = computeTiers(catalog, 'text', used, NOW);
  const next = [...catalog, model('openai/gpt-6.2-luna', 'OpenAI: GPT-6.2 Luna', 1, 0.1, 0.5)];
  const shown = selectModels(next, 'text', { tiers, now: NOW });
  assert.ok(shown.some(m => m.name === 'GPT-6.2 Luna'));
  assert.ok(!shown.some(m => m.name === 'GPT-6 Luna'));
});

test('厂商推出全新命名的产品线：发布 30 天内即使没有使用量也收录', () => {
  const next = [...catalog, model('openai/gpt-7-nova', 'OpenAI: GPT-7 Nova', 3, 3, 15)];
  const tiers = computeTiers(next, 'text', used, NOW);
  assert.ok(tiers['openai|'].includes('gpt nova'));
  // 浏览器端：快照之后才出现的产品线也直接显示
  const old = computeTiers(catalog, 'text', used, NOW);
  const shown = selectModels(next, 'text', { tiers: old, since: day(10), now: NOW });
  assert.ok(shown.some(m => m.name === 'GPT-7 Nova'));
});

test('旧挡位没人用了：下次同步自动淘汰', () => {
  const quiet = { openai: { ...used.openai } };
  quiet.openai['openai/gpt-6-astra'] = { prompt: 0, completion: 0, count: 0 };
  const tiers = computeTiers(catalog, 'text', quiet, NOW);
  assert.ok(!tiers['openai|'].includes('gpt astra'));
});

test('拿不到某厂商使用量时不给出结论（由同步脚本沿用旧结果）', () => {
  assert.equal(computeTiers(catalog, 'text', {}, NOW)['openai|'], undefined);
});

test('从来没有使用量数据时，退回每家最新的几条产品线', () => {
  const shown = selectModels(catalog, 'text', { now: NOW });
  assert.ok(shown.length > 0 && shown.length <= 8);
  assert.ok(!shown.some(m => m.id.startsWith('~')));   // 别名不作为展示型号
});

test('超过 540 天的老型号即使有人用也不展示', () => {
  const next = [...catalog, model('openai/gpt-4o', 'OpenAI: GPT-4o', 900, 2.5, 10)];
  const heavy = { openai: { ...used.openai, 'openai/gpt-4o': { prompt: 9000e9, completion: 900e9, count: 1 } } };
  const shown = selectModels(next, 'text', { tiers: computeTiers(next, 'text', heavy, NOW), now: NOW });
  assert.ok(!shown.some(m => m.name === 'GPT-4o'));
});

test('解析厂商页面里的使用量', () => {
  const html = '{\\"date\\":\\"2027-05-30 00:00:00\\",\\"model_permaslug\\":\\"openai/gpt-6-luna\\",\\"variant\\":\\"standard\\",\\"total_completion_tokens\\":20,\\"total_prompt_tokens\\":100,\\"count\\":3}';
  assert.deepEqual(parseUsage(html), { 'openai/gpt-6-luna': { prompt: 100, completion: 20, count: 3 } });
});

test('排行榜上出现的新厂商自动收录，免费版和已收录厂商不算', () => {
  const cat = [
    model('newlab/nova-2', 'NewLab: Nova 2', 5),
    model('freelab/x-1', 'FreeLab: X 1', 5),
    model('openai/gpt-6-luna', 'OpenAI: GPT-6 Luna', 5),
  ];
  const html = [
    ['newlab/nova-2', 'standard'], ['freelab/x-1', 'free'], ['openai/gpt-6-luna', 'standard'],
  ].map(([s, v]) => `{"model_permaslug":"${s}","variant":"${v}"}`).join(',');
  assert.deepEqual(discoverVendors(html, cat), { newlab: 'NewLab' });
});
