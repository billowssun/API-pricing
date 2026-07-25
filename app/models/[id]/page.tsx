import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowUpRight,
  IconCalendar,
  IconCheck,
  IconCode,
  IconCoin,
  IconDatabase,
  IconExternalLink,
} from '@tabler/icons-react';
import { CostCalculator } from '@/components/CostCalculator';
import { ModelPriceCard } from '@/components/ModelPriceCard';
import { ProviderMark } from '@/components/ProviderMark';
import { Shell } from '@/components/Shell';
import {
  availabilityLabel,
  formatPrice,
  formatUpdated,
  getModel,
  models,
  nearbyModels,
  typeLabel,
  updatedAt,
} from '@/lib/data';

export const revalidate = 3600;

export function generateStaticParams() {
  return models.map((model) => ({ id: model.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const model = getModel(id);
  if (!model) return { title: '模型不存在' };
  return {
    title: `${model.name} API 价格`,
    description: `${model.name} API 输入、缓存输入和输出价格，以及上下文、模型 ID 和官方来源。`,
  };
}

export default async function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = getModel(id);
  if (!model) notFound();
  const related = nearbyModels(model);

  return (
    <Shell>
      <div className="detail-shell">
        <Link href="/#models" className="back-link"><IconArrowLeft size={18} />返回模型列表</Link>

        <section className="detail-hero">
          <div className="detail-title">
            <ProviderMark provider={model.provider} size="large" />
            <div>
              <div className="detail-badges">
                <span>{model.provider}</span>
                <span>{typeLabel(model.type)}</span>
                <span>{model.tier}</span>
              </div>
              <h1>{model.name}</h1>
              <p>{model.notes}</p>
            </div>
          </div>
          <a className="source-button" href={model.source} target="_blank" rel="noreferrer">
            查看官方来源
            <IconExternalLink size={17} stroke={1.7} />
          </a>
        </section>

        <section className="pricing-overview" aria-label="价格摘要">
          <div className="pricing-block">
            <span>输入价格</span>
            <strong>{formatPrice(model.input, model.baseCurrency)}</strong>
            <small>每 100 万 tokens</small>
          </div>
          <div className="pricing-block">
            <span>缓存输入</span>
            <strong>{formatPrice(model.cachedInput, model.baseCurrency)}</strong>
            <small>{model.cachedInput == null ? '官方未列出独立费率' : '每 100 万 tokens'}</small>
          </div>
          <div className="pricing-block">
            <span>输出价格</span>
            <strong>{formatPrice(model.output, model.baseCurrency)}</strong>
            <small>每 100 万 tokens</small>
          </div>
        </section>

        {model.pricingNote && (
          <div className="pricing-note" role="note">
            <IconAlertCircle size={19} stroke={1.7} />
            <div><strong>计价条件</strong><p>{model.pricingNote}</p></div>
          </div>
        )}

        <div className="detail-main-grid">
          <CostCalculator model={model} />
          <aside className="spec-card">
            <h2>模型信息</h2>
            <dl>
              <div><dt><IconCode size={17} />API ID</dt><dd><code>{model.apiId || model.id}</code></dd></div>
              <div><dt><IconDatabase size={17} />上下文</dt><dd>{model.context || '未公布'}</dd></div>
              {model.maxOutput && <div><dt><IconArrowUpRight size={17} />最大输出</dt><dd>{model.maxOutput}</dd></div>}
              <div><dt><IconCoin size={17} />计价货币</dt><dd>{model.baseCurrency}</dd></div>
              <div><dt><IconCheck size={17} />可用状态</dt><dd>{availabilityLabel(model.availability)}</dd></div>
              {model.releaseDate && <div><dt><IconCalendar size={17} />发布日期</dt><dd>{model.releaseDate}</dd></div>}
            </dl>
            <p>数据校验于 {formatUpdated(updatedAt)}</p>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="related-section">
            <div className="section-heading"><h2>相近模型</h2><p>同厂商或同定位模型，方便继续比较。</p></div>
            <div className="related-grid">{related.map((item) => <ModelPriceCard model={item} key={item.id} />)}</div>
          </section>
        )}
      </div>
    </Shell>
  );
}
