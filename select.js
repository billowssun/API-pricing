// 从 OpenRouter 模型目录中挑选"主流模型"。浏览器和同步脚本共用这一份逻辑。
//
// 一、产品线：同一厂商的模型按"去掉版本号后的名字"归为一条产品线（挡位），
//     例如 GPT-5.6 Luna / GPT-6 Luna → "gpt luna"，Claude Opus 4.7 / 5.5 → "claude opus"。
//     每条产品线只展示最新的一个版本。各挡位更新节奏不同也没关系：
//     Terra 升到 6.1 时 Luna 仍停在 6，两者都显示各自的最新版。
//
// 二、哪些产品线算"主流"：由同步脚本按真实使用量决定（见 scripts/sync.mjs），
//     结果写进 models.json 的 tiers 字段；本文件只负责按 tiers 取每条产品线的最新型号。
//     - 厂商改名（如 GPT-5.4 Mini → GPT-6 Luna）：新名字的使用量上来后自动入选，
//       旧名字使用量掉下去后自动淘汰；
//     - 新产品线刚发布还没有使用量：发布 30 天内直接收录；
//     - 拿不到使用量时：退回"每家取最新的几条产品线"。

export const SOURCE = 'https://openrouter.ai/api/v1/models?output_modalities=all';

// OpenRouter 对按张计费的图片模型统一按每张 4175 个图片 token 折算单价
// （例：Seedream 5.5 的 $4.79/M × 4175 ≈ 页面标注的 $0.02/张）。
const TOKENS_PER_IMAGE = 4175;
export const MAX_AGE_DAYS = 540;   // 再主流也不展示超过这个天数的老型号
export const NEW_DAYS = 30;        // 新产品线的免检期

const num = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const perMillion = v => num(v) ? round(num(v) * 1e6) : null;

// threshold：产品线在该厂商（该类）使用量中的占比达到多少算主流
// perProvider：每家最多几条产品线（语音为每种类型）；也是没有使用量数据时的回退条数
export const CATEGORIES = {
  text: {
    label: '文本',
    threshold: 0.05,   // 花费占比或 token 占比任一达到 5%（便宜挡位 token 多、旗舰挡位花费多）
    perProvider: 8,
    providers: {
      openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', 'x-ai': 'xAI',
      deepseek: 'DeepSeek', qwen: '通义千问', moonshotai: 'Kimi', 'z-ai': '智谱 GLM',
      minimax: 'MiniMax', 'bytedance-seed': '豆包', mistralai: 'Mistral',
    },
    skip: /\b(free|batch|image|audio|vision|exp|experimental|preview|custom ?tools|multi-agent|safeguard|oss|gemma|lyria|banana|latest|chat|legal|omni|vl|decisions?)\b|\b\d+v\b|\d+(\.\d+)?[tb]\b/i,
    accepts: out => out.length === 1 && out[0] === 'text',
    price: p => {
      const input = perMillion(p.prompt), output = perMillion(p.completion);
      return input || output ? { input, output, cached: perMillion(p.input_cache_read) } : null;
    },
  },
  image: {
    label: '图片',
    threshold: 0.1,    // 请求数占比
    perProvider: 3,
    providers: {
      openai: 'OpenAI', google: 'Google', 'bytedance-seed': '字节跳动', qwen: '通义千问',
      'black-forest-labs': 'FLUX', minimax: 'MiniMax', 'x-ai': 'xAI', microsoft: 'Microsoft',
      recraft: 'Recraft', tencent: '腾讯混元',
    },
    skip: /\b(free|batch|edit|upscale|preview|exp|experimental|panorama|world)\b/i,
    accepts: out => out.includes('image'),
    price: p => {
      const image = num(p.image_output) || num(p.image_token);
      if (!image) return null;
      // 文本 token 不收费 → 按张计费；否则按 token 计费
      if (!num(p.prompt) && !num(p.completion)) return { perImage: round(image * TOKENS_PER_IMAGE) };
      return { input: perMillion(p.prompt), imageOutput: round(image * 1e6) };
    },
  },
  video: {
    label: '视频',
    threshold: 0.1,
    perProvider: 3,
    providers: {
      google: 'Google', bytedance: '字节 Seedance', kwaivgi: '可灵 Kling', minimax: 'MiniMax 海螺',
      alibaba: '阿里万相', runway: 'Runway', 'x-ai': 'xAI', 'black-forest-labs': 'FLUX',
    },
    skip: /\b(free|edit|upscale|preview|exp|experimental|avatar)\b/i,
    accepts: out => out.length === 1 && out[0] === 'video',
    // 目录 API 里视频价格都是 0，真实价格（每秒）由同步脚本从模型页面读取
    price: () => ({ perSecond: null }),
  },
  speech: {
    label: '语音',
    threshold: 0.1,
    perProvider: 2,    // 合成、识别分开算
    providers: {
      openai: 'OpenAI', google: 'Google', elevenlabs: 'ElevenLabs', minimax: 'MiniMax',
      microsoft: 'Microsoft', 'x-ai': 'xAI', mistralai: 'Mistral', qwen: '通义千问',
      'bytedance-seed': '字节跳动', deepgram: 'Deepgram', assemblyai: 'AssemblyAI', 'fish-audio': 'Fish Audio',
    },
    skip: /\b(free|preview|exp|experimental|medical|streaming)\b|\d+(\.\d+)?[mb]\b/i,
    accepts: out => out.length === 1 && (out[0] === 'speech' || out[0] === 'transcription'),
    // OpenRouter 的计价单位（已与模型页面核对）：
    //   合成：prompt = 每字符，completion = 每秒音频；两者都有时为每 token
    //   识别：prompt = 每秒音频（个别模型数值 ≥ 0.01 时实为每小时）；有 completion 时为每 token
    price: (p, out) => {
      const kind = out[0] === 'speech' ? 'tts' : 'stt';
      const a = num(p.prompt), b = num(p.completion);
      if (a && b) return { kind, input: perMillion(a), output: perMillion(b) };
      if (kind === 'tts' && a) return { kind, unitPrice: round(a * 1e6), unit: 'M 字符' };
      if (kind === 'tts' && b) return { kind, unitPrice: round(b * 60), unit: '分钟' };
      if (kind === 'stt' && a) return { kind, unitPrice: round(a >= 0.01 ? a / 60 : a * 60, 5), unit: '分钟' };
      return null;
    },
  },
};

// "Kling: Video v3.0 Pro" → "Kling Video v3.0 Pro"；"Google: Nano Banana Pro (Gemini 3 Pro Image)" → "Nano Banana Pro"
export const displayName = m => {
  const full = (m.name || m.id).replace(/\s*\(.*?\)/g, '').trim();
  const short = full.replace(/^[^:]+:\s*/, '');
  return /^(video|image|tts|stt)\b/i.test(short) ? full.replace(':', '') : short;
};

// 产品线名：去掉版本号、日期、括号，以及别名的 latest。
// preview 保留成单独的产品线：预览版的使用量不能算到旧正式版头上（否则 3.1 Pro Preview 的热度会把 2.5 Pro 带回来）
export function familyOf(name) {
  return name.toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\d+(\.\d+)*/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\b(v|k|m|latest)\b/g, ' ')
    .trim().replace(/\s+/g, ' ');
}

// 判断模型属于哪个厂商、哪种类型、哪条产品线；不属于该大类返回 null。
// group = 厂商 + 类型（语音分合成 / 识别），主流判断在 group 内进行。
export function classify(m, category) {
  const cat = CATEGORIES[category];
  const author = m.id.replace(/^~/, '').split('/')[0];
  const provider = cat.providers[author];
  if (!provider) return null;
  const out = m.architecture?.output_modalities || [];
  if (!cat.accepts(out)) return null;
  const name = displayName(m);
  const kind = category === 'speech' ? (out[0] === 'speech' ? 'tts' : 'stt') : '';
  return { author, provider, kind, name, group: `${author}|${kind}`, family: familyOf(name) };
}

// 每条产品线的最新可展示型号，以及产品线首次出现的时间
export function productLines(catalog, category, now = Date.now()) {
  const cat = CATEGORIES[category];
  const minCreated = now / 1000 - MAX_AGE_DAYS * 86400;
  const lines = new Map();
  for (const m of catalog) {
    const c = classify(m, category);
    if (!c) continue;
    const key = `${c.group}|${c.family}`;
    const line = lines.get(key) || { group: c.group, family: c.family, first: Infinity, model: null };
    if (m.created) line.first = Math.min(line.first, m.created);
    lines.set(key, line);

    // 别名（~xxx-latest）、:free / :batch 变体、预览版等不作为展示型号
    if (m.id.startsWith('~') || m.id.includes(':')) continue;
    if (cat.skip.test(c.name) || cat.skip.test(m.id)) continue;
    if ((m.created || 0) < minCreated) continue;
    if (line.model && line.model.created >= m.created) continue;
    const price = cat.price(m.pricing || {}, m.architecture.output_modalities);
    if (!price) continue;
    line.model = {
      category, id: m.id, name: c.name, provider: c.provider, ...price,
      ...(category === 'text' ? { context: m.context_length || null } : {}),
      created: m.created || 0,
    };
  }
  return lines;
}

// tiers：{ "openai|": ["gpt sol", "gpt luna", ...] }，来自 models.json，由同步脚本按使用量算出。
// since：tiers 的计算时间（秒）。之后才出现的新产品线也一并展示。
export function selectModels(catalog, category = 'text', { tiers, since, now = Date.now() } = {}) {
  const cat = CATEGORIES[category];
  const groups = new Map();
  for (const line of productLines(catalog, category, now).values()) {
    if (!line.model) continue;
    const list = groups.get(line.group) || [];
    list.push(line);
    groups.set(line.group, list);
  }

  const result = [];
  for (const [group, lines] of groups) {
    lines.sort((a, b) => b.model.created - a.model.created);
    const chosen = tiers?.[group];
    const picked = chosen
      ? lines.filter(l => chosen.includes(l.family) || (since && l.first > since))
      : lines.slice(0, cat.perProvider);          // 没有使用量数据：取最新的几条产品线
    result.push(...picked.map(l => l.model));
  }
  return result;
}

// 从模型页面 <meta name="description"> 中读取 "Priced from $0.40 per second."
export function parseVideoPrice(html) {
  const meta = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] || '';
  const m = /Priced (from|at) \$([\d.]+) per second/i.exec(meta);
  return m ? { perSecond: Number(m[2]), from: m[1].toLowerCase() === 'from' } : null;
}

// 从排行榜页面（openrouter.ai/rankings）读取本周热门的文本模型厂商：
// 返回 { 作者: 显示名 }，只算正式付费版（不含 free 变体、预览版、别名），且不含已收录的厂商。
export function discoverVendors(rankingsHtml, catalog) {
  const text = rankingsHtml.replace(/\\"/g, '"');
  const bySlug = new Map(catalog.map(m => [m.canonical_slug || m.id, m]));
  const cat = CATEGORIES.text;
  const found = {};
  for (const [, slug, variant] of text.matchAll(/"model_permaslug":"([^"]+)","variant":"([^"]+)"/g)) {
    const m = bySlug.get(slug);
    if (variant !== 'standard' || !m || m.id.startsWith('~') || m.id.includes(':')) continue;
    if (!cat.accepts(m.architecture?.output_modalities || []) || cat.skip.test(m.name || '')) continue;
    const author = m.id.split('/')[0];
    if (cat.providers[author] || /^(openrouter|stealth)$/.test(author)) continue;
    found[author] = (m.name || author).split(':')[0].trim() || author;
  }
  return found;
}

// 从厂商页面（openrouter.ai/<厂商>）里读取近几天各模型的使用量：
// { 'openai/gpt-6-luna-20260922': { prompt, completion, count } }
export function parseUsage(html) {
  const text = html.replace(/\\"/g, '"');
  const usage = {};
  for (const m of text.matchAll(/\{"date":"[^"]+","model_permaslug":"([^"]+)","variant":"[^"]+"([^{}]*)\}/g)) {
    const field = k => Number(new RegExp(`"${k}":(\\d+)`).exec(m[2])?.[1] || 0);
    const u = usage[m[1]] ||= { prompt: 0, completion: 0, count: 0 };
    u.prompt += field('total_prompt_tokens');
    u.completion += field('total_completion_tokens');
    u.count += field('count');
  }
  return usage;
}

// 按使用量决定每个 group 的主流产品线。usage 为 null 的厂商不出结果（由调用方沿用旧值）。
export function computeTiers(catalog, category, usageByAuthor, now = Date.now()) {
  const cat = CATEGORIES[category];
  const lines = productLines(catalog, category, now);
  const stats = new Map();     // group|family → { spend, tokens, count }
  const totals = new Map();    // group → { spend, tokens, count }
  const add = (map, key, s) => {
    const t = map.get(key) || { spend: 0, tokens: 0, count: 0 };
    t.spend += s.spend; t.tokens += s.tokens; t.count += s.count;
    map.set(key, t);
  };
  for (const m of catalog) {
    const c = classify(m, category);
    const u = c && usageByAuthor[c.author]?.[m.canonical_slug || m.id];
    if (!u) continue;
    const s = {
      spend: u.prompt * num(m.pricing?.prompt) + u.completion * num(m.pricing?.completion),
      tokens: u.prompt + u.completion,
      count: u.count,
    };
    add(stats, `${c.group}|${c.family}`, s);
    add(totals, c.group, s);
  }

  const tiers = {};
  const newSince = now / 1000 - NEW_DAYS * 86400;
  const groups = new Set([...lines.values()].map(l => l.group));
  for (const group of groups) {
    if (!usageByAuthor[group.split('|')[0]]) continue;            // 没拿到这家的数据
    const total = totals.get(group);
    const has = category === 'text' ? total?.tokens : total?.count;
    if (!has) continue;                                             // 这家没有使用量 → 回退"取最新"
    const share = s => category === 'text'
      ? Math.max(total.spend ? s.spend / total.spend : 0, s.tokens / total.tokens)
      : s.count / total.count;
    const shown = [...lines.values()].filter(l => l.group === group && l.model);
    const ranked = shown
      .map(l => ({ family: l.family, share: share(stats.get(`${group}|${l.family}`) || { spend: 0, tokens: 0, count: 0 }) }))
      .filter(x => x.share >= cat.threshold)
      .sort((a, b) => b.share - a.share)
      .slice(0, cat.perProvider)
      .map(x => x.family);
    const fresh = shown.filter(l => l.first >= newSince && !ranked.includes(l.family)).map(l => l.family);
    tiers[group] = [...ranked, ...fresh];
  }
  return tiers;
}
