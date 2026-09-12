// One representative per current product family, not a popularity ranking.
const providers = [
  {
    id: "OpenAI",
    name: "OpenAI",
    country: "US",
    families: [
      ["旗舰", /astra(?!.*pro)|sol$/i],
      ["进阶", /astra.*pro$/i],
      ["均衡", /terra$/i],
      ["轻量", /luna$/i],
    ],
  },
  {
    id: "Anthropic",
    name: "Anthropic",
    country: "US",
    families: [
      ["旗舰", /fable/i],
      ["旗舰", /opus/i],
      ["均衡", /sonnet/i],
      ["轻量", /haiku/i],
    ],
  },
  {
    id: "Google",
    name: "Google",
    country: "US",
    families: [
      ["旗舰", /pro/i],
      ["均衡", /flash(?!.*lite)/i],
      ["轻量", /flash.*lite/i],
    ],
  },
  {
    id: "DeepSeek",
    name: "DeepSeek",
    country: "CN",
    families: [
      ["旗舰", /v\d.*pro/i],
      ["轻量", /v\d.*flash/i],
    ],
  },
  {
    id: "Alibaba",
    name: "通义千问",
    country: "CN",
    families: [
      ["旗舰", /max/i],
      ["均衡", /plus/i],
      ["轻量", /flash/i],
      ["编程", /coder/i],
    ],
  },
  {
    id: "ByteDance",
    name: "豆包",
    country: "CN",
    families: [
      ["旗舰", /seed.*pro/i],
      ["均衡", /seed.*turbo/i],
      ["轻量", /seed.*lite/i],
      ["编程", /seed.*code/i],
    ],
  },
  {
    id: "Moonshot",
    name: "Kimi",
    country: "CN",
    families: [
      ["旗舰", /kimi-k[3-9](?!.*code)/i],
      ["均衡", /kimi-k2\.\d+(?!.*code)$/i],
      ["编程", /kimi.*code/i],
    ],
  },
  {
    id: "ZAI",
    name: "智谱 GLM",
    country: "CN",
    families: [
      ["旗舰", /^glm-\d+(?:\.\d+)?$/i],
      ["轻量", /glm.*flash$/i],
    ],
  },
  {
    id: "MiniMax",
    name: "MiniMax",
    country: "CN",
    families: [
      ["旗舰", /minimax-m[3-9]$/i],
      ["均衡", /minimax-m2\.\d+$/i],
      ["高速", /minimax.*highspeed/i],
    ],
  },
  {
    id: "xAI",
    name: "xAI",
    country: "US",
    families: [
      ["旗舰", /^grok-\d+(?:\.\d+)?$/i],
      ["轻量", /grok.*fast/i],
      ["编程", /grok.*(?:code|build)/i],
    ],
  },
];
function canonical(m) {
  return (m.apiId || m.name)
    .toLowerCase()
    .replace(/^doubao-/, "")
    .replace(/-(?:\d{4}|\d{8}|\d{4}-\d{2}-\d{2})$/, "")
    .replace(/-preview$/, "")
    .replace(/(haiku|opus|sonnet)-(\d+)-(\d+)$/, "$1-$2.$3");
}
function version(m) {
  return (canonical(m).match(/\d+(?:\.\d+)*/g) || []).flatMap((n) =>
    n.split(".").map(Number),
  );
}
function newest(a, b) {
  if (
    a.provider === "xAI" &&
    a.releaseDate &&
    b.releaseDate &&
    a.releaseDate !== b.releaseDate
  )
    return b.releaseDate.localeCompare(a.releaseDate);
  const av = version(a),
    bv = version(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i++)
    if ((av[i] || 0) !== (bv[i] || 0)) return (bv[i] || 0) - (av[i] || 0);
  if (a.priceStatus !== b.priceStatus)
    return a.priceStatus === "official" ? -1 : 1;
  return (
    (b.releaseDate || "").localeCompare(a.releaseDate || "") ||
    a.id.localeCompare(b.id)
  );
}
function applyPriceSchedule(model, now = Date.now()) {
  const schedule = model.priceSchedule;
  return { ...model, ...(schedule && now >= Date.parse(schedule.endsAt) ? schedule.after : {}) };
}
function selectMainstreamModels(models, now = Date.now()) {
  const candidates = models.filter(
    (m) =>
      m.type === "text" &&
      !/exp(?:erimental)?|vision|:free|multi-agent|ui-tars|deprecated/i.test(
        m.apiId || m.name,
      ),
  );
  return providers.flatMap((p) => {
    const selected = new Set();
    return p.families.flatMap(([tier, pattern]) => {
      const match = candidates
        .filter(
          (m) =>
            m.provider === p.id &&
            pattern.test(canonical(m)) &&
            !selected.has(m.id),
        )
        .sort(newest)[0];
      if (!match) return [];
      selected.add(match.id);
      return [{ ...applyPriceSchedule(match, now), tier }];
    });
  });
}
module.exports = { providers, selectMainstreamModels, canonical, applyPriceSchedule };
