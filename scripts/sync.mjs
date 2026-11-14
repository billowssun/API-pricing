// 拉取 OpenRouter 模型目录和各厂商使用量，挑出文本 / 图片 / 视频 / 语音主流模型，写入 models.json。
// 用法：node scripts/sync.mjs
//
// 全程无需人工维护：
// - 哪些产品线算主流：按各厂商近几天的真实使用量算（computeTiers），结果存为 tiers；
// - 厂商页面读不到：该厂商沿用上次的 tiers；从来没有过：退回"取最新的几条产品线"；
// - 某个大类数据异常（数量骤降、厂商整体消失）：该大类沿用旧快照，其余照常更新。
import fs from 'node:fs';
import { SOURCE, CATEGORIES, selectModels, computeTiers, parseUsage, parseVideoPrice, discoverVendors } from '../select.js';

const FILE = new URL('../models.json', import.meta.url);
const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { models: [] };
const oldOf = c => old.models.filter(m => (m.category || 'text') === c);

// GitHub Actions 里输出成黄色警告，在运行摘要页直接可见
const warn = msg => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `警告：${msg}`);

const get = (url, type) => fetch(url, {
  signal: AbortSignal.timeout(30_000),
  headers: { 'user-agent': 'Mozilla/5.0 (compatible; api-pricing-sync)' },
}).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r[type](); });

const { data } = await get(SOURCE, 'json');
if (!Array.isArray(data) || data.length < 100) throw new Error('模型目录数量异常');

// ---------- 自动发现新厂商（文本类） ----------
// 本周排行榜里出现的正式付费文本模型的厂商自动收录；掉出榜单 30 天后移除。
const VENDOR_KEEP_DAYS = 30;
const vendors = {};
for (const [author, v] of Object.entries(old.vendors || {})) {
  if (Date.now() - Date.parse(v.lastSeen) < VENDOR_KEEP_DAYS * 86400e3) vendors[author] = v;
}
try {
  const found = discoverVendors(await get('https://openrouter.ai/rankings', 'text'), data);
  for (const [author, name] of Object.entries(found)) vendors[author] = { name, lastSeen: new Date().toISOString() };
  console.log(`[vendors] 排行榜新发现：${Object.values(found).join('、') || '无'}；当前自动收录：${Object.values(vendors).map(v => v.name).join('、') || '无'}`);
} catch (e) {
  warn(`排行榜读取失败（${e.message}），沿用上次自动收录的厂商`);
}
for (const [author, v] of Object.entries(vendors)) CATEGORIES.text.providers[author] ??= v.name;

// ---------- 各厂商使用量 ----------
const authors = [...new Set(Object.values(CATEGORIES).flatMap(c => Object.keys(c.providers)))];
const usageByAuthor = {};
const usageFailed = [];
await Promise.all(authors.map(async author => {
  try {
    const usage = parseUsage(await get(`https://openrouter.ai/${author}`, 'text'));
    usageByAuthor[author] = usage;
  } catch (e) {
    usageFailed.push(`${author}（${e.message}）`);
  }
}));
const withUsage = Object.values(usageByAuthor).filter(u => Object.keys(u).length).length;
console.log(`[usage] 读取厂商使用量 ${withUsage}/${authors.length} 家`);
if (usageFailed.length) warn(`厂商页面读取失败，沿用上次的主流判断：${usageFailed.join('、')}`);
if (!withUsage) warn('所有厂商都没读到使用量，页面结构可能变了；本次沿用上次的主流判断');

// ---------- 视频价格 ----------
// 视频价格不在 API 里，逐个读模型页面；读不到就沿用旧价，再没有就不展示
async function withVideoPrices(models) {
  const prev = new Map(oldOf('video').map(m => [m.id, m]));
  const failed = [];
  const priced = await Promise.all(models.map(async m => {
    try {
      const price = parseVideoPrice(await get(`https://openrouter.ai/${m.id}`, 'text'));
      if (price) return { ...m, ...price };
      failed.push(`${m.id}（页面里没找到价格）`);
    } catch (e) {
      failed.push(`${m.id}（${e.message}）`);
    }
    const p = prev.get(m.id);
    return p?.perSecond ? { ...m, perSecond: p.perSecond, from: p.from } : null;
  }));
  console.log(`[video] 页面读取价格 ${models.length - failed.length}/${models.length} 个`);
  if (failed.length) warn(`视频价格读取失败 ${failed.length} 个，已沿用旧价：${failed.join('、')}`);
  return priced.filter(Boolean);
}

// ---------- 逐类挑选 ----------
const models = [];
const tiers = {};
for (const category of Object.keys(CATEGORIES)) {
  const fresh = withUsage ? computeTiers(data, category, usageByAuthor) : {};
  // 本次没算出来的厂商（页面读取失败等）沿用上次结果
  tiers[category] = { ...(old.tiers?.[category] || {}), ...fresh };

  let next = selectModels(data, category, { tiers: tiers[category] });
  if (category === 'video') next = await withVideoPrices(next);

  const prev = oldOf(category);
  const lost = [...new Set(prev.map(m => m.provider))].filter(p => !next.some(m => m.provider === p));
  const problem = next.length < prev.length * 0.6 ? `数量从 ${prev.length} 降到 ${next.length}`
    : lost.length ? `厂商整体缺失：${lost.join('、')}` : null;
  if (problem) {
    warn(`[${category}] ${problem}，疑似上游异常，沿用旧快照`);
    next = prev.map(m => ({ category, ...m }));
    tiers[category] = old.tiers?.[category] || tiers[category];
  }
  console.log(`[${category}] ${next.length} 个模型`);
  models.push(...next);
}

// updated：数据最后一次变化的时间；checkedAt：最后一次成功检查的时间（每次运行都会更新）
const now = new Date().toISOString();
const same = JSON.stringify({ models, tiers }) === JSON.stringify({ models: old.models, tiers: old.tiers });
fs.writeFileSync(FILE, JSON.stringify({ updated: same ? old.updated : now, checkedAt: now, vendors, tiers, models }, null, 2) + '\n');
console.log(same ? '无变化，已更新检查时间' : '有变化，已写入 models.json');
