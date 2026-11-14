// 拉取 OpenRouter 模型目录，挑出文本 / 图片 / 视频 / 语音主流模型，写入 models.json。
// 用法：node scripts/sync.mjs
// 某个大类数据异常（数量骤降、厂商整体消失）时，该大类沿用旧快照，其余照常更新。
import fs from 'node:fs';
import { SOURCE, CATEGORIES, selectModels, parseVideoPrice } from '../select.js';

const FILE = new URL('../models.json', import.meta.url);
const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { models: [] };
const oldOf = c => old.models.filter(m => (m.category || 'text') === c);

const get = (url, type) => fetch(url, {
  signal: AbortSignal.timeout(30_000),
  headers: { 'user-agent': 'Mozilla/5.0 (compatible; api-pricing-sync)' },
}).then(r => { if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`); return r[type](); });

const { data } = await get(SOURCE, 'json');
if (!Array.isArray(data) || data.length < 100) throw new Error('模型目录数量异常');

// GitHub Actions 里输出成黄色警告，在运行摘要页直接可见
const warn = msg => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `警告：${msg}`);

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
      failed.push(`${m.id}（${e.message.replace(/^.*→ /, '')}）`);
    }
    const p = prev.get(m.id);
    return p?.perSecond ? { ...m, perSecond: p.perSecond, from: p.from } : null;
  }));
  console.log(`[video] 页面读取价格 ${models.length - failed.length}/${models.length} 个`);
  if (failed.length) warn(`视频价格读取失败 ${failed.length} 个，已沿用旧价：${failed.join('、')}`);
  return priced.filter(Boolean);
}

const models = [];
for (const category of Object.keys(CATEGORIES)) {
  let next = selectModels(data, category);
  if (category === 'video') next = await withVideoPrices(next);
  const prev = oldOf(category);
  const lost = [...new Set(prev.map(m => m.provider))].filter(p => !next.some(m => m.provider === p));
  const problem = next.length < prev.length * 0.7 ? `数量从 ${prev.length} 降到 ${next.length}`
    : lost.length ? `厂商整体缺失：${lost.join('、')}` : null;
  if (problem) {
    warn(`[${category}] ${problem}，疑似上游异常，沿用旧快照`);
    next = prev.map(m => ({ category, ...m }));
  }
  console.log(`[${category}] ${next.length} 个模型`);
  models.push(...next);
}

// updated：数据最后一次变化的时间；checkedAt：最后一次成功检查的时间（每次运行都会更新）
const now = new Date().toISOString();
const same = JSON.stringify(models) === JSON.stringify(old.models);
fs.writeFileSync(FILE, JSON.stringify({ updated: same ? old.updated : now, checkedAt: now, models }, null, 2) + '\n');
console.log(same ? '价格无变化，已更新检查时间' : '价格有变化，已写入 models.json');
