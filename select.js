// 从 OpenRouter 模型目录中挑选"主流模型"。浏览器和同步脚本共用这一份逻辑。
//
// 思路：不维护型号白名单，只维护厂商名单。每个厂商的模型按"产品线"归并
// （去掉版本号和日期后的名字，比如 "Claude Opus 5.5" → "claude opus"），
// 每条产品线只保留最新的一个，再取每家最近发布的若干条。
// 厂商发布新一代模型后，下一次同步会自动替换掉旧版本，无需改代码。

export const SOURCE = 'https://openrouter.ai/api/v1/models?output_modalities=all';

// OpenRouter 对按张计费的图片模型统一按每张 4175 个图片 token 折算单价
// （例：Seedream 5.5 的 $4.79/M × 4175 ≈ 页面标注的 $0.02/张）。
const TOKENS_PER_IMAGE = 4175;
const MAX_AGE_DAYS = 300;

const num = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const perMillion = v => num(v) ? round(num(v) * 1e6) : null;

export const CATEGORIES = {
  text: {
    label: '文本',
    perProvider: 5,
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
    perProvider: 2,   // 每家每种类型（合成 / 识别）各取 2 条
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
const displayName = m => {
  const full = (m.name || m.id).replace(/\s*\(.*?\)/g, '').trim();
  const short = full.replace(/^[^:]+:\s*/, '');
  return /^(video|image|tts|stt)\b/i.test(short) ? full.replace(':', '') : short;
};

export function familyOf(name) {
  return name.toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\d+(\.\d+)*/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\b(v|k|m)\b/g, ' ')
    .trim().replace(/\s+/g, ' ');
}

export function selectModels(catalog, category = 'text', now = Date.now()) {
  const cat = CATEGORIES[category];
  const minCreated = now / 1000 - MAX_AGE_DAYS * 86400;
  const families = new Map();

  for (const m of catalog) {
    const author = m.id.split('/')[0];
    const provider = cat.providers[author];
    if (!provider || m.id.includes(':')) continue;
    const out = m.architecture?.output_modalities || [];
    if (!cat.accepts(out)) continue;
    const name = displayName(m);
    if (cat.skip.test(name) || cat.skip.test(m.id)) continue;
    if ((m.created || 0) < minCreated) continue;
    const price = cat.price(m.pricing || {}, out);
    if (!price) continue;

    const key = `${author}|${price.kind || ''}|${familyOf(name)}`;
    const prev = families.get(key);
    if (prev && prev.created >= m.created) continue;
    families.set(key, {
      category, id: m.id, name, provider, ...price,
      ...(category === 'text' ? { context: m.context_length || null } : {}),
      created: m.created || 0,
    });
  }

  const byProvider = new Map();
  for (const m of [...families.values()].sort((a, b) => b.created - a.created)) {
    const group = m.provider + (m.kind || '');
    const list = byProvider.get(group) || [];
    if (list.length < cat.perProvider) list.push(m);
    byProvider.set(group, list);
  }
  return [...byProvider.values()].flat();
}

// 从模型页面 <meta name="description"> 中读取 "Priced from $0.40 per second."
export function parseVideoPrice(html) {
  const meta = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] || '';
  const m = /Priced (from|at) \$([\d.]+) per second/i.exec(meta);
  return m ? { perSecond: Number(m[2]), from: m[1].toLowerCase() === 'from' } : null;
}
