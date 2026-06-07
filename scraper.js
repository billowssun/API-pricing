// scraper.js — 从 docsbot.ai 统一抓取全部厂商定价，自动发现新模型 / 移除下架模型
// 数据源: https://docsbot.ai/tools/gpt-openai-api-pricing-calculator (所有模型均为标准 USD 定价)
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'pricing.json');
const PREV = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { models: [] };

const SOURCE = 'https://docsbot.ai/tools/gpt-openai-api-pricing-calculator';
const TIMEOUT = 30000;

function timeoutFetch(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    return fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'PricingScraper/5' } })
        .finally(() => clearTimeout(timer));
}

const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0,40);
const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, '').trim();

// 厂商名映射: docsbot 名称 → 我们用的名称
const PROVIDER = {
    'OpenAI':        'OpenAI',
    'Anthropic':     'Anthropic',
    'DeepSeek':      'DeepSeek',
    'Google':        'Google',
    'Moonshot AI':   'Moonshot',
    'Zhipu AI':      '智谱 AI',
};

const COLOR = {
    'OpenAI':    'brand-openai',
    'Anthropic': 'brand-anthropic',
    'DeepSeek':  'brand-deepseek',
    'Google':    'brand-google',
    'Moonshot':  'brand-moonshot',
    'Zhipu AI':  'brand-zhipu',
};

function autoTier(name, inputPrice) {
    const n = name.toLowerCase();
    if (n.includes('fast') || n.includes('turbo')) return '极速';
    if (n.includes('opus') || n.includes('pro') || n.includes('ultra') || n.includes('premium')) return '旗舰';
    if (n.includes('nano') || n.includes('lite')) return '超轻';
    if (n.includes('mini') || n.includes('flash') || n.includes('haiku') || n.includes('light')) return '轻量';
    if (inputPrice > 8) return '极速';
    if (inputPrice > 4) return '旗舰';
    if (inputPrice <= 0.30) return '超轻';
    return '中坚';
}

function contextGuess(name, provider) {
    if (name.toLowerCase().includes('haiku')) return '200K';
    if (provider === 'Anthropic' && name.toLowerCase().includes('sonnet')) return '1M';
    if (provider === 'Anthropic' && name.toLowerCase().includes('opus')) return '1M';
    if (name.match(/mini|nano/i)) return '128K';
    if (name.match(/gpt-5\.4(?![- ])/i)) return '270K';
    if (name.match(/gpt-5\.5/i)) return '1.05M';
    if (provider === 'DeepSeek') return '1M';
    if (provider === 'Moonshot') return '256K';
    if (name.match(/pro/i) && provider === 'Google') return '200K (>200K加价)';
    if (provider === 'Google') return '1M';
    return '200K';
}

// ─── 主抓取逻辑: 解析 docsbot HTML 表格 ──────────
async function scrapeAll() {
    console.log(`🔍 抓取 ${SOURCE} …`);
    const rsp = await timeoutFetch(SOURCE);
    const html = await rsp.text();

    // docsbot 的表格行结构:
    // <tr><td>Provider</td><td>Model</td><td>Context</td><td>$input/1M</td><td>$output/1M</td>...
    // 同一 Provider 多行连续
    // 我们找所有同时包含目标 Provider 和 $ 价格的行

    const models = [];
    const seenIds = new Set();

    // 精确正则：匹配 Chat/Completion 表格中的模型行
    // html 中每行类似: <td>OpenAI</td><td>GPT-5.5</td><td>1M</td><td>$5</td><td>$30</td>
    const rowRe = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    let row;
    while ((row = rowRe.exec(html)) !== null) {
        const cells = [...row[0].matchAll(/<td[^>]*>(.*?)<\/td>/gi)].map(m => stripTags(m[1]));
        if (cells.length < 4) continue;

        const providerRaw = cells[0];
        const modelName = cells[1];
        // docsbot 表格列: Provider | Model | Context | Input | Output | PerCall | Total
        // 取第 3 和第 4 列（0-based: cells[3]=Input, cells[4]=Output）
        const inputStr = cells.length > 4 ? cells[3] : cells[cells.length - 2];
        const outputStr = cells.length > 4 ? cells[4] : cells[cells.length - 1];

        // 检查是否是我们要的厂商
        const ourProvider = PROVIDER[providerRaw];
        if (!ourProvider) continue;

        // 提取价格
        const inputM = inputStr.match(/\$(\d+\.?\d*)/);
        const outputM = outputStr.match(/\$(\d+\.?\d*)/);
        if (!inputM || !outputM) continue;
        const input = parseFloat(inputM[1]);
        const output = parseFloat(outputM[1]);

        // 从拼接的字符串中提取显示名：找到厂商对应的 slug 前缀，取之前的内容
        const slugPrefix = { 'OpenAI':'gpt', 'Anthropic':'claude', 'DeepSeek':'deepseek', 'Google':'gemini', 'Moonshot':'kimi', '智谱 AI':'glm' }[ourProvider];
        const slugIdx = slugPrefix ? modelName.lastIndexOf(slugPrefix) : -1;
        let name = (slugIdx > 0 ? modelName.slice(0, slugIdx) : modelName).trim();
        name = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
        if (!name || name.length < 2) continue;

        // 过滤：只保留当前主力模型，跳过旧代和特殊模型
        const nameLow = name.toLowerCase();
        // 跳过明显非文本/旧代模型
        if (/realtime|audio|embedding|fine-tun/i.test(nameLow)) continue;
        // Anthropic: 跳过 Claude 3 系列
        if (ourProvider === 'Anthropic' && /claude.*(\b3\b|haiku\s*3)/i.test(name)) continue;
        // DeepSeek: 跳过 V3/R1
        if (ourProvider === 'DeepSeek' && /\bv3\b|\br1\b/i.test(nameLow)) continue;
        // OpenAI: 只保留 GPT-5.4 和 GPT-5.5 系列（跳过 5.2/5.1/5.0/mini）
        if (ourProvider === 'OpenAI') {
            if (!/\bgpt-5\.[45]/i.test(nameLow)) continue;
        }
        // Normalize: "Claude Opus 4.8" → "Opus 4.8"
        if (ourProvider === 'Anthropic') {
            name = name.replace(/^Claude\s+/i, '');
        }
        // "DeepSeek-V4 Pro" → "DeepSeek V4 Pro"
        if (name.startsWith('DeepSeek-')) name = name.replace('-', ' ');
        if (name.startsWith('DeepSeek ')) ; // already fine

        const id = slug(ourProvider + '-' + name);
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const tier = autoTier(name, input);

        models.push({
            id, name, tier, type: 'text', baseCurrency: 'USD',
            input, cachedInput: input * 0.1, output,
            context: contextGuess(name, ourProvider),
            notes: tier === '旗舰' ? '最强推理。' :
                   tier === '极速' ? '低时延生产级。' :
                   tier === '中坚' ? '速度与智能平衡。' :
                   tier === '超轻' ? '极致低价。' : '高吞吐首选。',
            color: COLOR[providerRaw],
            provider: ourProvider,
        });
    }

    return models;
}

// ─── 去重：同 provider 同 tier 下只保留同一产品线的最新版本 ──
function deduplicateByTier(models, provider) {
    const groups = {}; // key: tier + product line root
    for (const m of models) {
        if (m.provider !== provider) continue;
        // 提取产品线根（去掉 Pro/Mini/Nano/Fast 等变体后缀）
        const root = m.name.replace(/\s+[\d.]+(\s*\(.*?\))?\s*$/g, '').replace(/\s*(Pro|Fast|mini|nano|Turbo|Lite)\s*$/i, '').trim();
        const key = m.tier + '|' + root;
        if (!groups[key]) { groups[key] = []; }
        groups[key].push(m);
    }
    const kept = [];
    for (const list of Object.values(groups)) {
        // 保留版本号最高的
        list.sort((a, b) => {
            const va = parseFloat((a.name.match(/[\d.]+(?:\s*$|(?=[^-0-9]))/) || ['0'])[0]);
            const vb = parseFloat((b.name.match(/[\d.]+(?:\s*$|(?=[^-0-9]))/) || ['0'])[0]);
            return vb - va;
        });
        kept.push(list[0]); // Keep highest version
        // 但如果同一个 root 有 Pro 变体，同时保留 Pro 版本
        const pros = list.filter(m => /\b(Pro|Fast|Turbo)\b/i.test(m.name));
        for (const p of pros) {
            if (!kept.find(k => k.id === p.id)) kept.push(p);
        }
    }
    return kept;
}

// ─── 合并 ────────────────────────────────────────
function diffAll(prev, fresh) {
    const prevIds = new Set(prev.map(m => m.id));
    const freshIds = new Set(fresh.map(m => m.id));

    const added = fresh.filter(m => !prevIds.has(m.id));
    const removed = prev.filter(m => !freshIds.has(m.id));

    if (added.length) console.log(`  🆕 新模型: ${added.map(m => m.provider + ' ' + m.name).join(', ')}`);
    if (removed.length) console.log(`  ❌ 下架: ${removed.map(m => m.provider + ' ' + m.name).join(', ')}`);
    if (!added.length && !removed.length) console.log(`  📌 无变化`);

    return fresh;
}

// ─── 补充缺失字段 ────────────────────────────────
function enrich(fresh) {
    // GPT-Image-2 (docsbot 不包含图像模型，手动维护)
    if (!fresh.find(m => m.id === 'gpt-image-2')) {
        fresh.push({
            id:'gpt-image-2', name:'GPT-Image-2', provider:'OpenAI', type:'image', tier:'旗舰',
            baseCurrency:'USD', context:'≤3840px',
            imagePrices: {'1024²':[0.006,0.053,0.211],'1024×1536':[0.005,0.041,0.165],'1536×1024':[0.005,0.041,0.165]},
            notes:'文本提示按 token 另计 ($5/1M)。表格为图像输出 token 折算的单张价格。',
            color:'brand-openai',
        });
    }
    // 所有模型统一 USD 基准（docsbot 已提供标准 USD 价格）
    for (const m of fresh) {
        m.baseCurrency = 'USD';
        // 补充 cachedInput
        if (!m.cachedInput) m.cachedInput = Math.round(m.input * 0.1 * 100) / 100;
    }
    return fresh;
}

// ─── 主流程 ──────────────────────────────────────
(async () => {
    console.log('🚀 全自动同步 — 数据源: docsbot.ai\n');

    let prev = PREV.models || [];

    let fresh;
    try {
        fresh = await scrapeAll();
    } catch (e) {
        console.warn(`❌ 抓取失败: ${e.message}\n⚠ 保留原有 ${prev.length} 个模型`);
        process.exit(0);
    }

    if (fresh.length === 0) {
        console.warn('❌ 未解析到任何模型\n⚠ 保留原有数据');
        process.exit(0);
    }

    // 每家厂商去重，每 tier 只保留最新
    const deduped = [];
    for (const p of Object.values(PROVIDER)) {
        deduped.push(...deduplicateByTier(fresh, p));
    }

    // Diff
    diffAll(prev, deduped);

    // 补充
    const final = enrich(deduped);

    // 排序
    const pOrder = {'Anthropic':1, 'OpenAI':2, 'DeepSeek':3, 'Google':4, 'Moonshot':5, '智谱 AI':6};
    const tOrder = {'旗舰':1, '极速':2, '中坚':3, '轻量':4, '超轻':5};
    final.sort((a,b) => ((pOrder[a.provider]||99)-(pOrder[b.provider]||99)) || ((tOrder[a.tier]||9)-(tOrder[b.tier]||9)));

    const out = { updated: new Date().toISOString(), models: final };
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
    console.log(`\n✅ ${out.models.length} 个模型 → pricing.json`);
})();
