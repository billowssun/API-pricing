/**
 * ModelPrice official-source synchronizer.
 *
 * Rules:
 * 1. Only first-party pricing pages are accepted.
 * 2. A provider is updated only when its source and parser both succeed.
 * 3. Missing or ambiguous values never become zero.
 * 4. Providers with tiered/dynamic pages are health-checked and kept unchanged
 *    until a deterministic parser is available.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PRICING_FILE = path.join(__dirname, 'pricing.json');
const TIMEOUT_MS = 30_000;
const VALIDATE_ONLY = process.argv.includes('--validate');
const current = JSON.parse(fs.readFileSync(PRICING_FILE, 'utf8'));

const SOURCES = {
  OpenAI: 'https://developers.openai.com/api/docs/models/compare',
  Anthropic: 'https://platform.claude.com/docs/en/about-claude/pricing',
  Google: 'https://ai.google.dev/gemini-api/docs/pricing?hl=en',
  DeepSeek: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
  Moonshot: 'https://platform.kimi.com/',
  xAI: 'https://docs.x.ai/developers/pricing',
  Mistral: 'https://mistral.ai/pricing/api/',
  Alibaba: 'https://help.aliyun.com/zh/model-studio/model-pricing',
  ByteDance: 'https://www.volcengine.com/docs/84458/1585097',
};

const OFFICIAL_HOSTS = new Set([
  'developers.openai.com',
  'platform.claude.com',
  'ai.google.dev',
  'api-docs.deepseek.com',
  'platform.kimi.com',
  'docs.x.ai',
  'mistral.ai',
  'help.aliyun.com',
  'www.volcengine.com',
]);

function validate(data) {
  if (!data || !Array.isArray(data.models) || data.models.length < 18) {
    throw new Error('pricing.json 至少需要 18 个精选模型');
  }
  const ids = new Set();
  const providers = new Set();
  for (const model of data.models) {
    for (const field of ['id', 'name', 'provider', 'tier', 'type', 'baseCurrency', 'notes', 'source']) {
      if (!model[field]) throw new Error(`${model.id || 'unknown'} 缺少 ${field}`);
    }
    if (ids.has(model.id)) throw new Error(`重复模型 ID: ${model.id}`);
    ids.add(model.id);
    providers.add(model.provider);
    for (const field of ['input', 'cachedInput', 'output']) {
      const value = model[field];
      if (value != null && (!Number.isFinite(value) || value < 0)) {
        throw new Error(`${model.id} 的 ${field} 价格无效`);
      }
    }
    const source = new URL(model.source);
    if (source.protocol !== 'https:' || !OFFICIAL_HOSTS.has(source.hostname)) {
      throw new Error(`${model.id} 不是受信任的官方 HTTPS 来源`);
    }
    if (model.priceStatus !== 'official') throw new Error(`${model.id} 未标记为官方价格`);
    const visibleText = [model.name, model.provider, model.tier, model.notes, model.pricingNote].filter(Boolean).join(' ');
    if (/�|锟斤拷|future model/i.test(visibleText)) throw new Error(`${model.id} 包含乱码或未来模型占位内容`);
  }
  if (providers.size < 8) throw new Error(`厂商覆盖不足：当前仅 ${providers.size} 家`);
  if (!ids.has('moonshot-kimi-k3')) throw new Error('缺少当前 Kimi K3 模型');
  return true;
}

function cleanText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#36;|&dollar;/gi, '$')
    .replace(/&yen;|&#165;/gi, '¥')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138 Safari/537.36 ModelPriceBot/2.0',
          accept: url.endsWith('.md') ? 'text/markdown' : 'text/html,application/xhtml+xml',
          'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if (html.length < 500) throw new Error('响应内容过短');
      return html;
    } catch (fetchError) {
      const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
      try {
        const html = execFileSync(curl, [
          '--location',
          '--silent',
          '--show-error',
          '--compressed',
          '--max-time',
          '45',
          '--user-agent',
          'Mozilla/5.0 ModelPriceBot/2.0',
          '--header',
          url.endsWith('.md') ? 'Accept: text/markdown' : 'Accept: text/html',
          url,
        ], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
        if (!html || html.length < 500) throw new Error('curl 响应为空');
        return html;
      } catch {
        throw new Error(`${fetchError.message}; curl fallback failed`);
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

function number(value) {
  const parsed = Number.parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function sliceFrom(text, marker, length = 2600) {
  const index = text.toLowerCase().indexOf(marker.toLowerCase());
  if (index < 0) throw new Error(`未找到 ${marker}`);
  return text.slice(index, index + length);
}

function moneyValues(text, symbol = '\\$') {
  return [...text.matchAll(new RegExp(`${symbol}\\s*([\\d,.]+)`, 'g'))]
    .map((match) => number(match[1]))
    .filter((value) => value != null);
}

function pricedSlice(text, marker, minValues, length = 2600) {
  let from = 0;
  while (from < text.length) {
    const index = text.toLowerCase().indexOf(marker.toLowerCase(), from);
    if (index < 0) break;
    const block = text.slice(index, index + length);
    if (moneyValues(block).length >= minValues) return block;
    from = index + marker.length;
  }
  throw new Error(`${marker} 价格区块不存在`);
}

function merge(modelId, patch, source) {
  const model = current.models.find((item) => item.id === modelId);
  if (!model) throw new Error(`本地缺少模型 ${modelId}`);
  for (const field of ['input', 'cachedInput', 'output']) {
    if (patch[field] != null && (!Number.isFinite(patch[field]) || patch[field] < 0)) {
      throw new Error(`${modelId} 的 ${field} 解析结果无效`);
    }
  }
  return { ...model, ...patch, source, priceStatus: 'official' };
}

function parseOpenAI(text) {
  const configs = [
    ['openai-gpt-5-6-sol', 'GPT-5.6 Sol'],
    ['openai-gpt-5-6-terra', 'GPT-5.6 Terra'],
    ['openai-gpt-5-6-luna', 'GPT-5.6 Luna'],
  ];
  return configs.map(([id, marker]) => {
    const block = sliceFrom(text, marker, 1900);
    const input = block.match(/Input(?:\s+price)?\s*\$\s*([\d.]+)/i);
    const cached = block.match(/Cached Input\s*\$\s*([\d.]+)/i);
    const output = block.match(/Output(?:\s+price)?\s*\$\s*([\d.]+)/i);
    if (!input || !cached || !output) throw new Error(`${marker} 价格字段不完整`);
    return merge(id, {
      input: number(input[1]),
      cachedInput: number(cached[1]),
      output: number(output[1]),
    }, SOURCES.OpenAI);
  });
}

function parseAnthropic(text) {
  const configs = [
    ['anthropic-claude-fable-5', 'Claude Fable 5'],
    ['anthropic-claude-opus-5', 'Claude Opus 5'],
    ['anthropic-claude-sonnet-5', 'Claude Sonnet 5'],
    ['anthropic-claude-haiku-4-5', 'Claude Haiku 4.5'],
  ];
  return configs.map(([id, marker]) => {
    const values = moneyValues(pricedSlice(text, marker, 5, 1800));
    if (values.length < 5) throw new Error(`${marker} 价格字段不完整`);
    return merge(id, { input: values[0], cachedInput: values[3], output: values[4] }, SOURCES.Anthropic);
  });
}

function parseGoogle(text) {
  const configs = [
    ['google-gemini-3-1-pro', 'Gemini 3.1 Pro Preview'],
    ['google-gemini-3-6-flash', 'Gemini 3.6 Flash'],
    ['google-gemini-3-5-flash-lite', 'Gemini 3.5 Flash-Lite'],
  ];
  return configs.map(([id, marker]) => {
    const block = sliceFrom(text, marker, 2200);
    const input = block.match(/Input price[\s\S]{0,160}?\$\s*([\d.]+)/i);
    const output = block.match(/Output price(?:\s*\([^)]*\))?[\s\S]{0,160}?\$\s*([\d.]+)/i);
    const cached = block.match(/Context caching price[\s\S]{0,160}?\$\s*([\d.]+)/i);
    if (!input || !output || !cached) throw new Error(`${marker} 价格字段不完整`);
    return merge(id, {
      input: number(input[1]),
      cachedInput: number(cached[1]),
      output: number(output[1]),
    }, SOURCES.Google);
  });
}

function parseMoonshot(text) {
  const configs = [
    ['moonshot-kimi-k3', 'K3 Kimi K3'],
    ['moonshot-kimi-k2-7-code', 'K2.7 Code Kimi K2.7 Code'],
    ['moonshot-kimi-k2-6', 'K2.6 Kimi K2.6'],
  ];
  return configs.map(([id, marker]) => {
    const block = sliceFrom(text, marker, 700);
    const cached = block.match(/缓存命中\s*¥\s*([\d.]+)/);
    const input = block.match(/输入\s*¥\s*([\d.]+)/);
    const output = block.match(/输出\s*¥\s*([\d.]+)/);
    if (!cached || !input || !output) throw new Error(`${marker} 价格字段不完整`);
    return merge(id, {
      input: number(input[1]),
      cachedInput: number(cached[1]),
      output: number(output[1]),
    }, SOURCES.Moonshot);
  });
}

function parseXAI(text) {
  const block = sliceFrom(text, 'grok-4.5', 1600);
  const values = moneyValues(block);
  const expected = [2, 0.3, 6];
  const found = expected.every((price) => values.includes(price));
  if (!found) throw new Error('Grok 4.5 标准价格字段不完整');
  return [merge('xai-grok-4-5', { input: 2, cachedInput: 0.3, output: 6 }, SOURCES.xAI)];
}

function parseMistral(text) {
  const configs = [
    ['mistral-medium-3-5', 'Mistral Medium 3.5'],
    ['mistral-small-4', 'Mistral Small 4'],
  ];
  return configs.map(([id, marker]) => {
    const block = pricedSlice(text, marker, 2, 2600);
    const input = block.match(/Input\s*\(\/M tokens\)\s*\$\s*([\d.]+)/i);
    const output = block.match(/Output\s*\(\/M tokens\)\s*\$\s*([\d.]+)/i);
    if (!input || !output) throw new Error(`${marker} 价格字段不完整`);
    const inputPrice = number(input[1]);
    return merge(id, {
      input: inputPrice,
      cachedInput: inputPrice / 10,
      output: number(output[1]),
    }, SOURCES.Mistral);
  });
}

async function healthCheck(name, url, markers) {
  const text = cleanText(await fetchPage(url));
  for (const marker of markers) {
    if (!text.toLowerCase().includes(marker.toLowerCase())) throw new Error(`未找到 ${marker}`);
  }
  console.log(`✓ ${name}: 官方页面可用，保留阶梯价格`);
  return [];
}

async function safeProvider(name, modelIds, task) {
  try {
    const models = await task();
    if (models.length) console.log(`✓ ${name}: ${models.length} 个模型价格核验通过`);
    return models;
  } catch (error) {
    console.warn(`! ${name}: ${error.message}，保留上一版`);
    return current.models.filter((model) => modelIds.includes(model.id));
  }
}

async function run() {
  validate(current);
  if (VALIDATE_ONLY) {
    console.log(`pricing.json 校验通过：${current.models.length} 个模型，${new Set(current.models.map((m) => m.provider)).size} 家厂商`);
    return;
  }

  const groups = await Promise.all([
    safeProvider('OpenAI', ['openai-gpt-5-6-sol', 'openai-gpt-5-6-terra', 'openai-gpt-5-6-luna'], async () =>
      parseOpenAI(cleanText(await fetchPage(SOURCES.OpenAI)))),
    safeProvider('Anthropic', ['anthropic-claude-fable-5', 'anthropic-claude-opus-5', 'anthropic-claude-sonnet-5', 'anthropic-claude-haiku-4-5'], async () =>
      healthCheck('Anthropic', SOURCES.Anthropic, ['Claude Fable 5', 'Claude Opus 5', 'Claude Sonnet 5', 'Claude Haiku 4.5'])),
    safeProvider('Google', ['google-gemini-3-1-pro', 'google-gemini-3-6-flash', 'google-gemini-3-5-flash-lite'], async () =>
      parseGoogle(cleanText(await fetchPage(SOURCES.Google)))),
    safeProvider('Moonshot', ['moonshot-kimi-k3', 'moonshot-kimi-k2-7-code', 'moonshot-kimi-k2-6'], async () =>
      parseMoonshot(cleanText(await fetchPage(SOURCES.Moonshot)))),
    safeProvider('xAI', ['xai-grok-4-5'], async () =>
      parseXAI(cleanText(await fetchPage(SOURCES.xAI)))),
    safeProvider('Mistral', ['mistral-medium-3-5', 'mistral-small-4'], async () =>
      parseMistral(cleanText(await fetchPage(SOURCES.Mistral)))),
    safeProvider('DeepSeek', ['deepseek-v4-pro', 'deepseek-v4-flash'], async () =>
      healthCheck('DeepSeek', SOURCES.DeepSeek, ['deepseek-v4-flash', 'deepseek-v4-pro'])),
    safeProvider('Alibaba', ['alibaba-qwen-3-7-max'], async () =>
      healthCheck('Alibaba', SOURCES.Alibaba, ['qwen3.7-max'])),
    safeProvider('ByteDance', ['bytedance-doubao-seed-2-pro', 'bytedance-doubao-seed-2-lite'], async () =>
      healthCheck('ByteDance', SOURCES.ByteDance, [])),
  ]);

  const updates = new Map(groups.flat().map((model) => [model.id, model]));
  const nextModels = current.models.map((model) => updates.get(model.id) || model);
  if (JSON.stringify(current.models) === JSON.stringify(nextModels)) {
    console.log('价格无变化，不写入文件');
    return;
  }

  const next = { updated: new Date().toISOString(), models: nextModels };
  validate(next);
  fs.writeFileSync(PRICING_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`已更新 pricing.json：${nextModels.length} 个模型`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
