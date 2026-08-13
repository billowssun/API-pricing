import pricing from '@/pricing.json';
import syncStatus from '@/sync-status.json';

export type Currency = 'USD' | 'CNY';
export type ModelType = 'text' | 'image' | 'audio' | 'video';
export type Availability = 'public' | 'limited' | 'preview';

export type Model = {
  id: string;
  apiId?: string;
  name: string;
  provider: string;
  tier: string;
  type: ModelType;
  baseCurrency: Currency;
  input: number | null;
  cachedInput?: number | null;
  output?: number | null;
  context?: string;
  maxOutput?: string;
  notes: string;
  pricingNote?: string;
  pricingRegion: 'global' | 'CN';
  availability?: Availability;
  releaseDate?: string;
  source: string;
  priceStatus?: 'official' | 'aggregated';
  catalogId?: string;
  discoveredAt?: string;
  lastVerifiedAt?: string;
  imageInput?: number;
  imagePrices?: Record<string, number[]>;
};

export const models = pricing.models as Model[];
export const updatedAt = pricing.updated;
export const sync = syncStatus as {
  checkedAt: string;
  status: 'healthy' | 'degraded' | 'stale' | 'failed';
  modelCount: number;
  sources: Array<{ name: string; status: string; role: string; message?: string; count?: number }>;
};
export const providers = [...new Set(models.map((model) => model.provider))];

export function getModel(id: string) {
  return models.find((model) => model.id === id);
}

export function formatPrice(value: number | null | undefined, currency: Currency = 'USD') {
  if (value == null) return '未提供';
  const symbol = currency === 'CNY' ? '¥' : '$';
  return `${symbol}${new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: value < 0.1 ? 4 : 2,
  }).format(value)}`;
}

export function formatUpdated(value = updatedAt) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function typeLabel(type: ModelType) {
  return { text: '文本', image: '图像', audio: '音频', video: '视频' }[type];
}

export function availabilityLabel(value: Availability = 'public') {
  return { public: '公开可用', limited: '限量开放', preview: '预览版' }[value];
}

export function modelSummary(model: Model) {
  if (model.type === 'image') return '图像生成与编辑';
  if (model.tier === '旗舰') return '适合复杂推理与高质量生产任务';
  if (model.tier === '轻量') return '适合高并发和成本敏感型任务';
  if (model.tier === '编程') return '适合代码生成与智能体开发工作流';
  return '兼顾能力、速度与调用成本';
}

export function nearbyModels(model: Model) {
  return models
    .filter((candidate) => candidate.id !== model.id && (candidate.provider === model.provider || candidate.tier === model.tier))
    .slice(0, 4);
}
