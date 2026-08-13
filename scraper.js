/**
 * ModelPrice catalog synchronizer.
 *
 * OpenRouter is used only to discover newly available mainstream models and
 * its prices are labelled as aggregated. Existing first-party prices remain
 * first-party and are never overwritten by aggregated prices.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PRICING_FILE = path.join(__dirname, 'pricing.json');
const STATUS_FILE = path.join(__dirname, 'sync-status.json');
const VALIDATE_ONLY = process.argv.includes('--validate');
const TIMEOUT_MS = 30_000;
const OPENROUTER_MODELS = 'https://openrouter.ai/api/v1/models?output_modalities=text';
const OPENAI_COMPARE = 'https://developers.openai.com/api/docs/models/compare';
const OFFICIAL_SOURCES = [
  ['Anthropic 官方价格', 'https://platform.claude.com/docs/en/about-claude/pricing'],
  ['Google 官方价格', 'https://ai.google.dev/gemini-api/docs/pricing?hl=en'],
  ['DeepSeek 官方价格', 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing'],
  ['Moonshot 官方平台', 'https://platform.kimi.com/'],
  ['xAI 官方价格', 'https://docs.x.ai/developers/pricing'],
  ['Mistral 官方价格', 'https://mistral.ai/pricing/api/'],
  ['Alibaba 官方价格', 'https://help.aliyun.com/zh/model-studio/model-pricing'],
  ['ByteDance 官方价格', 'https://www.volcengine.com/docs/84458/1585097'],
];
const current = JSON.parse(fs.readFileSync(PRICING_FILE, 'utf8'));

const PROVIDERS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek',
  moonshotai: 'Moonshot',
  'x-ai': 'xAI',
  mistralai: 'Mistral',
  qwen: 'Alibaba',
  bytedance: 'ByteDance',
  'bytedance-seed': 'ByteDance',
};

const OFFICIAL_HOSTS = new Set([
  'developers.openai.com', 'platform.claude.com', 'ai.google.dev',
  'api-docs.deepseek.com', 'platform.kimi.com', 'docs.x.ai', 'mistral.ai',
  'help.aliyun.com', 'www.volcengine.com',
]);

function validate(data) {
  if (!data || !Array.isArray(data.models) || data.models.length < 18) {
    throw new Error('pricing.json 至少需要 18 个模型');
  }
  const ids = new Set();
  for (const model of data.models) {
    for (const field of ['id', 'name', 'provider', 'tier', 'type', 'baseCurrency', 'notes', 'source']) {
      if (!model[field]) throw new Error(`${model.id || 'unknown'} 缺少 ${field}`);
    }
    if (ids.has(model.id)) throw new Error(`重复模型 ID: ${model.id}`);
    ids.add(model.id);
    for (const field of ['input', 'cachedInput', 'output']) {
      const value = model[field];
      if (value != null && (!Number.isFinite(value) || value < 0)) {
        throw new Error(`${model.id} 的 ${field} 价格无效`);
      }
    }
    const source = new URL(model.source);
    if (source.protocol !== 'https:') throw new Error(`${model.id} 的来源不是 HTTPS`);
    if (model.priceStatus === 'official' && !OFFICIAL_HOSTS.has(source.hostname)) {
      throw new Error(`${model.id} 的官方来源域名不受信任`);
    }
    if (!['official', 'aggregated'].includes(model.priceStatus)) {
      throw new Error(`${model.id} 缺少有效的价格来源级别`);
    }
  }
  return true;
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url, { accept: 'application/json' });
  return response.json();
}

async function fetchText(url) {
  try {
    const response = await fetchWithTimeout(url, { accept: 'text/markdown,text/plain;q=0.9,text/html;q=0.8' });
    return response.text();
  } catch (fetchError) {
    const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
    try {
      return execFileSync(curl, ['--location', '--silent', '--show-error', '--compressed', '--max-time', '45', '--user-agent', 'Mozilla/5.0 Chrome/138 ModelPriceBot/3.0', url], {
        encoding: 'utf8', maxBuffer: 30 * 1024 * 1024,
      });
    } catch {
      throw fetchError;
    }
  }
}

async function fetchWithTimeout(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { ...headers, 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138 Safari/537.36 ModelPriceBot/3.0' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function number(value) {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function dollarsPerMillion(value) {
  const perToken = number(value);
  return perToken == null ? null : Number((perToken * 1_000_000).toPrecision(8));
}

function humanTokens(value) {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(2))}M`;
  return `${Math.round(value / 1_000)}K`;
}

function tierFor(name) {
  const value = name.toLowerCase();
  if (/mini|nano|lite|flash|small|haiku/.test(value)) return '轻量';
  if (/code|coder/.test(value)) return '编程';
  if (/pro|opus|max|flagship|sol|ultra/.test(value)) return '旗舰';
  return '均衡';
}

function cleanName(name) {
  return name.replace(/^(OpenAI|Anthropic|Google|DeepSeek|MoonshotAI|SpaceXAI|Mistral|Qwen|ByteDance):\s*/i, '');
}

function cleanDocument(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#36;|&dollar;/gi, '$')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isPrimaryTextModel(model) {
  const id = model.id || '';
  const name = model.name || '';
  const output = model.architecture?.output_modalities || [];
  if (!PROVIDERS[id.split('/')[0]]) return false;
  if (id.includes(':') || /:batch$|-free$|instruct|embedding|transcribe|tts|image|video|audio|moderation/i.test(id)) return false;
  if (/\b(beta|free|batch|preview of)\b/i.test(name)) return false;
  if (!output.includes('text')) return false;
  return dollarsPerMillion(model.pricing?.prompt) != null && dollarsPerMillion(model.pricing?.completion) != null;
}

function selectCatalog(models) {
  const byProvider = new Map();
  for (const model of models.filter(isPrimaryTextModel).sort((a, b) => (b.created || 0) - (a.created || 0))) {
    const author = model.id.split('/')[0];
    const list = byProvider.get(author) || [];
    if (list.length < 6) list.push(model);
    byProvider.set(author, list);
  }
  return [...byProvider.values()].flat();
}

function catalogModel(model, checkedAt) {
  const [author, ...rest] = model.id.split('/');
  const apiId = rest.join('/');
  const provider = PROVIDERS[author];
  const name = cleanName(model.name || apiId);
  return {
    id: `catalog-${slug(model.id)}`,
    apiId,
    catalogId: model.id,
    name,
    provider,
    tier: tierFor(name),
    type: 'text',
    baseCurrency: 'USD',
    input: dollarsPerMillion(model.pricing.prompt),
    cachedInput: dollarsPerMillion(model.pricing.input_cache_read),
    output: dollarsPerMillion(model.pricing.completion),
    context: humanTokens(model.context_length),
    maxOutput: humanTokens(model.top_provider?.max_completion_tokens),
    notes: model.description ? model.description.replace(/\[[^\]]+\]\([^)]*\)/g, '').slice(0, 220) : `${provider} 的公开 API 模型。`,
    pricingNote: '价格来自 OpenRouter 当前路由报价，可能与厂商直连接口不同。',
    pricingRegion: 'global',
    availability: 'public',
    releaseDate: model.created ? new Date(model.created * 1000).toISOString().slice(0, 10) : undefined,
    discoveredAt: checkedAt,
    lastVerifiedAt: checkedAt,
    source: `https://openrouter.ai/${model.id}`,
    priceStatus: 'aggregated',
  };
}

function updateOpenAIPrices(models, markdown, checkedAt) {
  markdown = cleanDocument(markdown);
  const next = models.map((model) => ({ ...model }));
  for (const model of next.filter((item) => item.provider === 'OpenAI' && item.priceStatus === 'official')) {
    const marker = model.name;
    const start = markdown.toLowerCase().indexOf(marker.toLowerCase());
    if (start < 0) throw new Error(`官方页面未找到 ${marker}`);
    const block = markdown.slice(start, start + 1800);
    const input = block.match(/Input\s*\$\s*([\d.]+)/i);
    const cached = block.match(/Cached Input\s*\$\s*([\d.]+)/i);
    const output = block.match(/Output\s*\$\s*([\d.]+)/i);
    if (!input || !cached || !output) throw new Error(`${marker} 官方价格字段不完整`);
    model.input = number(input[1]);
    model.cachedInput = number(cached[1]);
    model.output = number(output[1]);
    model.lastVerifiedAt = checkedAt;
  }
  return next;
}

function mergeCatalog(existing, catalog, checkedAt) {
  const discoveredIds = new Set(catalog.map((model) => model.catalogId));
  const officialApiIds = new Set(existing.filter((model) => model.priceStatus === 'official').map((model) => model.apiId));
  const kept = existing.filter((model) => model.priceStatus !== 'aggregated' || discoveredIds.has(model.catalogId));
  const byCatalog = new Map(kept.filter((model) => model.catalogId).map((model) => [model.catalogId, model]));
  for (const model of catalog) {
    if (officialApiIds.has(model.apiId)) continue;
    const previous = byCatalog.get(model.catalogId);
    if (previous) Object.assign(previous, model, { discoveredAt: previous.discoveredAt || checkedAt });
    else kept.push(model);
  }
  return kept.sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '') || a.provider.localeCompare(b.provider));
}

function normalizeVisibleText(models) {
  return models.map((model) => {
    const next = { ...model };
    for (const field of ['name', 'tier', 'notes', 'pricingNote']) {
      if (typeof next[field] === 'string') next[field] = next[field].replace(/[—–]/g, '-');
    }
    return next;
  });
}

async function run() {
  validate(current);
  if (VALIDATE_ONLY) {
    console.log(`pricing.json 校验通过：${current.models.length} 个模型`);
    return;
  }

  const checkedAt = new Date().toISOString();
  const status = { checkedAt, status: 'healthy', sources: [], modelCount: current.models.length };
  let nextModels = current.models.map((model) => ({
    ...model,
    lastVerifiedAt: model.lastVerifiedAt || current.updated,
  }));

  try {
    const payload = await fetchJson(OPENROUTER_MODELS);
    if (!Array.isArray(payload.data) || payload.data.length < 100) throw new Error('模型目录返回数量异常');
    const selected = selectCatalog(payload.data);
    nextModels = mergeCatalog(nextModels, selected.map((model) => catalogModel(model, checkedAt)), checkedAt);
    status.sources.push({ name: 'OpenRouter 模型目录', status: 'ok', count: selected.length, role: '发现与聚合报价' });
  } catch (error) {
    status.status = 'failed';
    status.sources.push({ name: 'OpenRouter 模型目录', status: 'error', message: error.message, role: '发现与聚合报价' });
  }

  const healthResults = await Promise.allSettled(OFFICIAL_SOURCES.map(async ([name, url]) => {
    const text = await fetchText(url);
    if (text.length < 500) throw new Error('响应内容过短');
    return { name, status: 'ok', role: '官方页面可访问' };
  }));
  healthResults.forEach((result, index) => {
    if (result.status === 'fulfilled') status.sources.push(result.value);
    else {
      if (status.status === 'healthy') status.status = 'degraded';
      status.sources.push({ name: OFFICIAL_SOURCES[index][0], status: 'error', role: '保留上次官方报价', message: result.reason.message });
    }
  });

  try {
    const markdown = await fetchText(OPENAI_COMPARE);
    nextModels = updateOpenAIPrices(nextModels, markdown, checkedAt);
    status.sources.push({ name: 'OpenAI 官方价格', status: 'ok', role: '官方价格校验' });
  } catch (error) {
    status.status = 'failed';
    status.sources.push({ name: 'OpenAI 官方价格', status: 'error', message: error.message, role: '官方价格校验' });
  }

  status.modelCount = nextModels.length;
  fs.writeFileSync(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
  if (status.status === 'failed') {
    throw new Error(status.sources.filter((source) => source.status === 'error').map((source) => `${source.name}: ${source.message}`).join('; '));
  }

  nextModels = normalizeVisibleText(nextModels);
  const next = { updated: checkedAt, models: nextModels };
  validate(next);
  fs.writeFileSync(PRICING_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  const discovered = nextModels.filter((model) => model.priceStatus === 'aggregated').length;
  console.log(`同步完成：${nextModels.length} 个模型，其中 ${discovered} 个由聚合目录自动发现`);
}

run().catch((error) => {
  console.error(`同步失败：${error.message}`);
  process.exitCode = 1;
});
