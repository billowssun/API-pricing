// scraper.js - 每日同步主流大模型 API 定价
// 国外厂商使用 docsbot USD 聚合源；中国大陆厂商使用官方人民币口径。
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'pricing.json');
const PREV = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { models: [] };

const DOCSBOT_SOURCE = 'https://docsbot.ai/tools/gpt-openai-api-pricing-calculator';
const TIMEOUT = 30000;
const GLOBAL_PROVIDER = {
    OpenAI: 'OpenAI',
    Anthropic: 'Anthropic',
    Google: 'Google',
};
const CN_PROVIDERS = new Set(['DeepSeek', 'Moonshot', '智谱 AI']);

const COLOR = {
    OpenAI: 'brand-openai',
    Anthropic: 'brand-anthropic',
    DeepSeek: 'brand-deepseek',
    Google: 'brand-google',
    Moonshot: 'brand-moonshot',
    '智谱 AI': 'brand-zhipu',
};

const SOURCE = {
    docsbot: DOCSBOT_SOURCE,
    anthropicFableMythos: 'https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5',
    anthropicPricing: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
    deepseek: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
    deepseekLegacyCny: 'https://api-docs.deepseek.com/quick_start/pricing-details-cny',
    kimiK26: 'https://platform.kimi.com/docs/pricing/chat-k26',
    kimiK25: 'https://platform.kimi.com/docs/pricing/chat-k25',
    zhipu: 'https://open.bigmodel.cn/pricing',
};

function timeoutFetch(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    return fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'PricingScraper/6 (+https://github.com)' },
    }).finally(() => clearTimeout(timer));
}

const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48);
const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, '').trim();
const priceNum = (s) => {
    const m = String(s).match(/[¥￥$]\s*(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : null;
};

function autoTier(name, inputPrice) {
    const n = name.toLowerCase();
    if (n.includes('fast') || n.includes('turbo')) return '极速';
    if (n.includes('opus') || n.includes('pro') || n.includes('ultra') || n.includes('premium') || n.includes('reasoner')) return '旗舰';
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
    if (name.match(/pro/i) && provider === 'Google') return '200K (>200K加价)';
    if (provider === 'Google') return '1M';
    return '200K';
}

function noteForTier(tier) {
    return {
        旗舰: '最强推理。',
        极速: '低时延生产级。',
        中坚: '速度与智能平衡。',
        轻量: '高吞吐首选。',
        超轻: '极致低价。',
    }[tier] || '高吞吐首选。';
}

function previousByProvider(provider) {
    return (PREV.models || []).filter((m) => m.provider === provider);
}

async function scrapeGlobalModels() {
    console.log(`抓取全球 USD 定价: ${DOCSBOT_SOURCE}`);
    const rsp = await timeoutFetch(DOCSBOT_SOURCE);
    if (!rsp.ok) throw new Error(`docsbot 返回 ${rsp.status}`);
    const html = await rsp.text();
    const models = [];
    const seenIds = new Set();
    const rowRe = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    let row;

    while ((row = rowRe.exec(html)) !== null) {
        const cells = [...row[0].matchAll(/<td[^>]*>(.*?)<\/td>/gi)].map((m) => stripTags(m[1]));
        if (cells.length < 4) continue;

        const providerRaw = cells[0];
        const provider = GLOBAL_PROVIDER[providerRaw];
        if (!provider) continue;

        const modelName = cells[1];
        const input = priceNum(cells.length > 4 ? cells[3] : cells[cells.length - 2]);
        const output = priceNum(cells.length > 4 ? cells[4] : cells[cells.length - 1]);
        if (input === null || output === null) continue;

        const slugPrefix = { OpenAI: 'gpt', Anthropic: 'claude', Google: 'gemini' }[provider];
        const slugIdx = slugPrefix ? modelName.lastIndexOf(slugPrefix) : -1;
        let name = (slugIdx > 0 ? modelName.slice(0, slugIdx) : modelName).trim();
        name = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
        if (!name || name.length < 2) continue;

        const nameLow = name.toLowerCase();
        if (/realtime|audio|embedding|fine-tun/i.test(nameLow)) continue;
        if (provider === 'Anthropic' && /claude.*(\b3\b|haiku\s*3)/i.test(name)) continue;
        if (provider === 'OpenAI' && !/\bgpt-5\.[45]/i.test(nameLow)) continue;
        if (provider === 'Anthropic') name = name.replace(/^Claude\s+/i, '');

        const id = slug(`${provider}-${name}`);
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const tier = autoTier(name, input);
        models.push({
            id,
            name,
            tier,
            type: 'text',
            baseCurrency: 'USD',
            input,
            cachedInput: roundPrice(input * 0.1),
            output,
            context: contextGuess(name, provider),
            notes: noteForTier(tier),
            color: COLOR[provider],
            provider,
            pricingRegion: 'global',
            source: 'docsbot.ai',
        });
    }

    return models;
}

async function scrapeAnthropicOfficialModels() {
    const sources = [SOURCE.anthropicFableMythos, SOURCE.anthropicPricing];
    const pages = [];
    for (const url of sources) {
        try {
            const rsp = await timeoutFetch(url);
            if (rsp.ok) pages.push(await rsp.text());
        } catch (_) {}
    }
    const html = pages.join('\n').toLowerCase();
    if (!html.includes('claude-fable-5') && !html.includes('fable 5')) return [];

    return [{
        id: 'anthropic-claude-fable-5',
        apiId: 'claude-fable-5',
        name: 'Claude Fable 5',
        tier: '旗舰',
        type: 'text',
        baseCurrency: 'USD',
        input: 10,
        cachedInput: 1,
        output: 50,
        context: '1M',
        notes: 'Anthropic 官方 API 已上架模型。',
        color: COLOR.Anthropic,
        provider: 'Anthropic',
        pricingRegion: 'global',
        availability: 'public',
        releaseDate: '2026-06-09',
        source: SOURCE.anthropicFableMythos,
        priceStatus: 'official',
    }];
}

function roundPrice(v) {
    return Math.round(v * 10000) / 10000;
}

function formatTokenContext(raw) {
    const n = Number(String(raw).replace(/[^\d]/g, ''));
    if (!n) return String(raw);
    if (n >= 1000000) return `${roundPrice(n / 1000000)}M`;
    return `${Math.round(n / 1024)}K`;
}

function deduplicateByTier(models, provider) {
    const groups = {};
    for (const m of models) {
        if (m.provider !== provider) continue;
        const root = m.name.replace(/\s+[\d.]+(\s*\(.*?\))?\s*$/g, '').replace(/\s*(Pro|Fast|mini|nano|Turbo|Lite)\s*$/i, '').trim();
        const key = `${m.tier}|${root}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(m);
    }
    const kept = [];
    for (const list of Object.values(groups)) {
        list.sort((a, b) => {
            const va = parseFloat((a.name.match(/[\d.]+(?:\s*$|(?=[^-0-9]))/) || ['0'])[0]);
            const vb = parseFloat((b.name.match(/[\d.]+(?:\s*$|(?=[^-0-9]))/) || ['0'])[0]);
            return vb - va;
        });
        kept.push(list[0]);
        for (const p of list.filter((m) => /\b(Pro|Fast|Turbo)\b/i.test(m.name))) {
            if (!kept.find((k) => k.id === p.id)) kept.push(p);
        }
    }
    return kept;
}

function makeCnTextModel({ id, name, provider, tier, input, cachedInput, output, context, notes, source }) {
    return {
        id,
        name,
        tier,
        type: 'text',
        baseCurrency: 'CNY',
        input,
        cachedInput,
        output,
        context,
        notes,
        color: COLOR[provider],
        provider,
        pricingRegion: 'CN',
        source,
    };
}

async function scrapeDeepSeekModels() {
    const rsp = await timeoutFetch(SOURCE.deepseek);
    if (!rsp.ok) throw new Error(`DeepSeek 返回 ${rsp.status}`);
    const html = await rsp.text();
    if (!/deepseek-v4-flash|deepseek-v4-pro/i.test(html)) {
        throw new Error('DeepSeek 官方页未出现 V4 Pro/Flash 定价表');
    }

    return [
        makeCnTextModel({
            id: 'deepseek-deepseek-v4-pro',
            name: 'DeepSeek V4 Pro',
            provider: 'DeepSeek',
            tier: '旗舰',
            input: 3,
            cachedInput: 0.025,
            output: 6,
            context: '1M',
            notes: 'DeepSeek 官方主力高性能模型。',
            source: SOURCE.deepseek,
        }),
        makeCnTextModel({
            id: 'deepseek-deepseek-v4-flash',
            name: 'DeepSeek V4 Flash',
            provider: 'DeepSeek',
            tier: '轻量',
            input: 1,
            cachedInput: 0.02,
            output: 2,
            context: '1M',
            notes: 'DeepSeek 官方主力高性价比模型。',
            source: SOURCE.deepseek,
        }),
    ];
}

async function scrapeKimiPage(url, providerName) {
    const rsp = await timeoutFetch(url);
    if (!rsp.ok) throw new Error(`${providerName} 返回 ${rsp.status}`);
    const html = await rsp.text();
    const row = html.match(/rows:\s*\[\[\\"([^"]+)\\",\s*\\"1M tokens\\",\s*\\"([^"]+)\\",\s*\\"([^"]+)\\",\s*\\"([^"]+)\\",\s*\\"([^"]+)\\"\]\]/);
    if (!row) throw new Error(`${providerName} 官方表格解析为空`);
    return {
        model: row[1],
        cachedInput: priceNum(row[2]),
        input: priceNum(row[3]),
        output: priceNum(row[4]),
        context: row[5].replace(/\s*tokens/i, '').replace(',', 'K'),
    };
}

async function scrapeMoonshotModels() {
    const k26 = await scrapeKimiPage(SOURCE.kimiK26, 'Kimi K2.6');
    const k25 = await scrapeKimiPage(SOURCE.kimiK25, 'Kimi K2.5');
    return [k26, k25].map((m, idx) => makeCnTextModel({
        id: slug(`Moonshot-${m.model}`),
        name: m.model.replace(/^kimi-/i, 'Kimi ').toUpperCase().replace('KIMI ', 'Kimi '),
        provider: 'Moonshot',
        tier: idx === 0 ? '旗舰' : '中坚',
        input: m.input,
        cachedInput: m.cachedInput,
        output: m.output,
        context: formatTokenContext(m.context),
        notes: idx === 0 ? 'Kimi 最新多模态旗舰模型。' : 'Kimi 多模态长上下文模型。',
        source: idx === 0 ? SOURCE.kimiK26 : SOURCE.kimiK25,
    }));
}

async function scrapeZhipuModels() {
    const rsp = await timeoutFetch(SOURCE.zhipu);
    if (!rsp.ok) throw new Error(`智谱返回 ${rsp.status}`);
    const html = await rsp.text();
    if (!/智谱AI开放平台|智谱/.test(html)) throw new Error('智谱官方价格页健康检查失败');

    // 智谱价格页为前端应用，价格表由运行时接口加载。这里维护大陆官方口径，
    // 并用官方页面健康检查防止失效时误删或回退到 docsbot USD。
    return [
        makeCnTextModel({
            id: 'zhipu-glm-4-5',
            name: 'GLM-4.5',
            provider: '智谱 AI',
            tier: '旗舰',
            input: 4,
            cachedInput: 0.4,
            output: 16,
            context: '128K',
            notes: '智谱旗舰通用推理模型。',
            source: SOURCE.zhipu,
        }),
        makeCnTextModel({
            id: 'zhipu-glm-4-5-air',
            name: 'GLM-4.5-Air',
            provider: '智谱 AI',
            tier: '轻量',
            input: 0.8,
            cachedInput: 0.08,
            output: 2,
            context: '128K',
            notes: '智谱高性价比轻量模型。',
            source: SOURCE.zhipu,
        }),
    ];
}

async function scrapeCnProvider(provider, scraper) {
    try {
        if (process.env.SIMULATE_CN_SOURCE_FAILURE === provider || process.env.SIMULATE_CN_SOURCE_FAILURE === 'all') {
            throw new Error('模拟中国官方源失败');
        }
        const models = await scraper();
        if (!models.length) throw new Error(`${provider} 官方源无模型`);
        console.log(`中国大陆官方定价: ${provider} ${models.length} 个模型`);
        return models;
    } catch (e) {
        const prev = previousByProvider(provider).filter((m) => m.baseCurrency === 'CNY');
        if (prev.length) {
            console.warn(`${provider} 官方源失败: ${e.message}；保留上一版 ${prev.length} 个 CNY 模型`);
            return prev;
        }
        throw e;
    }
}

function enrich(models) {
    const fresh = [...models];
    if (!fresh.find((m) => m.id === 'gpt-image-2')) {
        fresh.push({
            id: 'gpt-image-2',
            name: 'GPT-Image-2',
            provider: 'OpenAI',
            type: 'image',
            tier: '旗舰',
            apiId: 'gpt-image-2',
            baseCurrency: 'USD',
            pricingRegion: 'global',
            source: 'https://platform.openai.com/docs/guides/image-generation',
            priceStatus: 'official',
            context: '≤3840px',
            input: 5,
            imageInput: 10,
            imagePrices: { '1024²': [0.006, 0.053, 0.211], '1024×1536': [0.005, 0.041, 0.165], '1536×1024': [0.005, 0.041, 0.165] },
            notes: '官方估算：表格为单张图像输出价，不含文本输入 ($5/1M)；图像编辑还会计图片输入 ($10/1M)。',
            color: 'brand-openai',
            cachedInput: null,
        });
    }
    for (const m of fresh) {
        if (!m.color) m.color = COLOR[m.provider];
        if (!m.pricingRegion) m.pricingRegion = CN_PROVIDERS.has(m.provider) ? 'CN' : 'global';
        if (!m.source) m.source = m.pricingRegion === 'CN' ? 'official' : 'docsbot.ai';
        if (m.type !== 'image' && (m.cachedInput === undefined || m.cachedInput === null)) {
            m.cachedInput = roundPrice(m.input * 0.1);
        }
    }
    return fresh;
}

function diffAll(prev, fresh) {
    const prevIds = new Set(prev.map((m) => m.id));
    const freshIds = new Set(fresh.map((m) => m.id));
    const added = fresh.filter((m) => !prevIds.has(m.id));
    const removed = prev.filter((m) => !freshIds.has(m.id));
    if (added.length) console.log(`新模型: ${added.map((m) => `${m.provider} ${m.name}`).join(', ')}`);
    if (removed.length) console.log(`下架/移除: ${removed.map((m) => `${m.provider} ${m.name}`).join(', ')}`);
    if (!added.length && !removed.length) console.log('模型列表无变化');
}

(async () => {
    console.log('每日定价同步 - 全球 USD + 中国大陆官方 CNY\n');
    const prev = PREV.models || [];

    let globalModels;
    try {
        globalModels = await scrapeGlobalModels();
    } catch (e) {
        console.warn(`全球 USD 源失败: ${e.message}；保留上一版全球模型`);
        globalModels = prev.filter((m) => !CN_PROVIDERS.has(m.provider));
    }
    if (!globalModels.length) {
        console.warn('未解析到全球模型，保留原有数据');
        process.exit(0);
    }

    const officialAnthropic = await scrapeAnthropicOfficialModels();
    const officialIds = new Set(officialAnthropic.map((m) => m.id));
    globalModels = globalModels.filter((m) => !officialIds.has(m.id));

    const dedupedGlobal = [...officialAnthropic];
    for (const p of Object.values(GLOBAL_PROVIDER)) dedupedGlobal.push(...deduplicateByTier(globalModels, p));

    const cnModels = [
        ...(await scrapeCnProvider('DeepSeek', scrapeDeepSeekModels)),
        ...(await scrapeCnProvider('Moonshot', scrapeMoonshotModels)),
        ...(await scrapeCnProvider('智谱 AI', scrapeZhipuModels)),
    ];

    const final = enrich([...dedupedGlobal, ...cnModels]);
    const pOrder = { Anthropic: 1, OpenAI: 2, DeepSeek: 3, Google: 4, Moonshot: 5, '智谱 AI': 6 };
    const tOrder = { 旗舰: 1, 极速: 2, 中坚: 3, 轻量: 4, 超轻: 5 };
    final.sort((a, b) => ((pOrder[a.provider] || 99) - (pOrder[b.provider] || 99)) || ((tOrder[a.tier] || 9) - (tOrder[b.tier] || 9)));

    diffAll(prev, final);
    const out = { updated: new Date().toISOString(), models: final };
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
    console.log(`\n完成: ${out.models.length} 个模型 -> pricing.json`);
})();
