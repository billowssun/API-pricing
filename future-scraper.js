// future-scraper.js - 未来大模型雷达
// 只追踪官方/可信新闻信号，不把未确认模型写入正式 pricing.json。
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'future-models.json');
const PRICING = path.join(__dirname, 'pricing.json');
const PREV = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { items: [] };
const PRICING_DATA = fs.existsSync(PRICING) ? JSON.parse(fs.readFileSync(PRICING, 'utf8')) : { models: [] };
const TODAY = new Date().toISOString().slice(0, 10);
const TIMEOUT = 8000;

const STATUS_LABEL = new Set(['official-preview', 'limited-access', 'rumored', 'announced', 'released', 'stale']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);

const WATCHLIST = [
    {
        id: 'anthropic-claude-fable-5',
        name: 'Claude Fable 5',
        provider: 'Anthropic',
        keywords: ['claude fable 5', 'fable 5'],
        expectedWindow: '已发布 / 正式同步待确认',
        officialSources: [
            'https://www.anthropic.com/news',
            'https://docs.anthropic.com/en/release-notes/api',
            'https://docs.anthropic.com/en/docs/about-claude/models/overview',
            'https://docs.anthropic.com/en/docs/about-claude/pricing',
        ],
        mediaSources: ['https://www.theverge.com/ai-artificial-intelligence', 'https://techcrunch.com/category/artificial-intelligence/'],
    },
    {
        id: 'anthropic-claude-mythos-5',
        name: 'Claude Mythos 5',
        provider: 'Anthropic',
        keywords: ['claude mythos 5', 'mythos 5'],
        expectedWindow: '限量开放 / 正式同步待确认',
        officialSources: [
            'https://www.anthropic.com/news',
            'https://docs.anthropic.com/en/release-notes/api',
            'https://docs.anthropic.com/en/docs/about-claude/models/overview',
            'https://docs.anthropic.com/en/docs/about-claude/pricing',
        ],
        mediaSources: ['https://www.theverge.com/ai-artificial-intelligence', 'https://techcrunch.com/category/artificial-intelligence/'],
    },
    {
        id: 'openai-next-frontier-model',
        name: 'OpenAI 下一代前沿模型',
        provider: 'OpenAI',
        keywords: ['next model', 'frontier model', 'gpt-6', 'gpt 6'],
        expectedWindow: '未来数月',
        officialSources: ['https://openai.com/news/', 'https://platform.openai.com/docs/models'],
        mediaSources: ['https://www.theverge.com/ai-artificial-intelligence', 'https://techcrunch.com/category/artificial-intelligence/'],
    },
    {
        id: 'google-next-gemini-model',
        name: 'Google 下一代 Gemini 模型',
        provider: 'Google',
        keywords: ['next gemini', 'gemini 4', 'gemini ultra'],
        expectedWindow: '未来数月',
        officialSources: ['https://blog.google/technology/google-deepmind/', 'https://ai.google.dev/gemini-api/docs/models'],
        mediaSources: ['https://www.theverge.com/ai-artificial-intelligence', 'https://techcrunch.com/category/artificial-intelligence/'],
    },
    {
        id: 'deepseek-next-main-model',
        name: 'DeepSeek 下一代主力模型',
        provider: 'DeepSeek',
        keywords: ['deepseek v5', 'deepseek next', 'deepseek-v5'],
        expectedWindow: '未知',
        officialSources: ['https://api-docs.deepseek.com/zh-cn/quick_start/pricing', 'https://www.deepseek.com/'],
        mediaSources: ['https://techcrunch.com/category/artificial-intelligence/'],
    },
];

function timeoutFetch(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    return fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'FutureModelRadar/1 (+https://github.com)' },
    }).finally(() => clearTimeout(timer));
}

function normalizeId(provider, name) {
    return `${provider}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

function textOf(html) {
    return String(html)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function pageTitle(html, fallbackUrl) {
    const title = String(html).match(/<title[^>]*>(.*?)<\/title>/i)?.[1];
    return title ? textOf(title).slice(0, 80) : new URL(fallbackUrl).hostname;
}

async function scanUrl(url, candidate, type) {
    try {
        const rsp = await timeoutFetch(url);
        if (!rsp.ok) return null;
        const html = await rsp.text();
        const lower = textOf(html).toLowerCase();
        const hit = candidate.keywords.find((kw) => lower.includes(kw.toLowerCase()));
        if (!hit) return null;
        return {
            title: pageTitle(html, url),
            url,
            type,
            hit,
        };
    } catch (_) {
        return null;
    }
}

function officialModelExists(candidate) {
    const needle = candidate.name.toLowerCase().replace(/^claude\s+/i, '').trim();
    return (PRICING_DATA.models || []).some((m) => {
        const modelName = String(m.name || '').toLowerCase();
        const provider = String(m.provider || '').toLowerCase();
        return provider === candidate.provider.toLowerCase() && (modelName === candidate.name.toLowerCase() || modelName.includes(needle));
    });
}

function previousItem(id) {
    return (PREV.items || []).find((item) => item.id === id);
}

function mergeSources(prevSources, newSources) {
    const byUrl = new Map();
    for (const src of [...(prevSources || []), ...newSources]) byUrl.set(src.url, src);
    return [...byUrl.values()].slice(0, 6);
}

function daysSince(dateText) {
    const t = Date.parse(dateText);
    if (!Number.isFinite(t)) return 999;
    return Math.floor((Date.now() - t) / 86400000);
}

async function buildCandidate(candidate) {
    const officialHits = (await Promise.all((candidate.officialSources || []).map((url) => scanUrl(url, candidate, 'official')))).filter(Boolean);
    const mediaHits = (await Promise.all((candidate.mediaSources || []).map((url) => scanUrl(url, candidate, 'media')))).filter(Boolean);

    const prev = previousItem(candidate.id);
    const released = officialModelExists(candidate);
    const hits = [...officialHits, ...mediaHits];
    if (!hits.length && !prev) return null;

    let status = prev?.status || 'rumored';
    let confidence = prev?.confidence || 'medium';
    if (released) {
        status = 'released';
        confidence = 'high';
    } else if (officialHits.length) {
        status = candidate.name.toLowerCase().includes('mythos') ? 'limited-access' : 'announced';
        confidence = 'high';
    } else if (mediaHits.length >= 1) {
        status = 'rumored';
        confidence = 'medium';
    }

    const lastSeen = hits.length ? TODAY : (prev?.lastSeen || TODAY);
    if (!released && daysSince(lastSeen) > 30) status = 'stale';

    return validateItem({
        id: candidate.id || normalizeId(candidate.provider, candidate.name),
        name: candidate.name,
        provider: candidate.provider,
        status,
        confidence,
        expectedWindow: released ? '已上架' : (candidate.expectedWindow || prev?.expectedWindow || '未知'),
        summary: released
            ? '已被正式模型数据确认上架，保留在雷达中用于迁移提示。'
            : (prev?.summary || `${candidate.provider} 相关未来模型信号，正式上架前仅作为观察项。`),
        signals: [
            ...(hits.length ? hits.slice(0, 3).map((hit) => `${hit.type === 'official' ? '官方' : '媒体'}来源出现关键词：${hit.hit}`) : []),
            ...(released ? ['正式价格看板已出现该模型或同名模型'] : []),
            ...((prev?.signals || []).slice(0, 2)),
        ].filter(Boolean).slice(0, 4),
        sources: mergeSources(prev?.sources, hits.map(({ title, url, type }) => ({ title, url, type }))),
        lastSeen,
    });
}

function validateItem(item) {
    return {
        id: item.id || normalizeId(item.provider || 'Unknown', item.name || 'Unknown'),
        name: item.name || 'Unknown model',
        provider: item.provider || 'Unknown',
        status: STATUS_LABEL.has(item.status) ? item.status : 'rumored',
        confidence: CONFIDENCE.has(item.confidence) ? item.confidence : 'low',
        expectedWindow: item.expectedWindow || '未知',
        summary: String(item.summary || '').slice(0, 120),
        signals: (item.signals || []).map((s) => String(s).slice(0, 80)).slice(0, 4),
        sources: (item.sources || []).map((s) => ({
            title: String(s.title || 'Source').slice(0, 80),
            url: String(s.url || ''),
            type: s.type || 'media',
        })).filter((s) => /^https?:\/\//.test(s.url)).slice(0, 6),
        lastSeen: item.lastSeen || TODAY,
    };
}

function visibleEnough(item) {
    if (item.status === 'released') return false;
    if (item.confidence === 'low') return false;
    if (item.status === 'stale' && daysSince(item.lastSeen) > 90) return false;
    return true;
}

(async () => {
    const next = [];
    for (const candidate of WATCHLIST) {
        const item = await buildCandidate(candidate);
        if (item) next.push(item);
    }

    for (const prev of PREV.items || []) {
        if (!next.find((item) => item.id === prev.id)) next.push(validateItem(prev));
    }

    next.sort((a, b) => {
        const rank = { released: 0, announced: 1, 'official-preview': 2, 'limited-access': 3, rumored: 4, stale: 5 };
        const conf = { high: 0, medium: 1, low: 2 };
        return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (conf[a.confidence] ?? 9) - (conf[b.confidence] ?? 9);
    });

    const out = {
        updated: new Date().toISOString(),
        items: next,
        visibleCount: next.filter(visibleEnough).length,
    };
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
    console.log(`未来模型雷达: ${out.items.length} 条观察项，${out.visibleCount} 条默认展示 -> future-models.json`);
})();
