import { IconArrowDown, IconDatabase, IconRefresh } from '@tabler/icons-react';
import { ModelExplorer } from '@/components/ModelExplorer';
import { Shell } from '@/components/Shell';
import { formatUpdated, models, providers, updatedAt } from '@/lib/data';

export const revalidate = 3600;

export default function HomePage() {
  const textModels = models.filter((model) => model.type === 'text');
  const cheapest = textModels.reduce(
    (best, model) => (model.input ?? Infinity) < (best.input ?? Infinity) ? model : best,
    textModels[0],
  );

  return (
    <Shell>
      <div className="page-shell">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">AI API PRICE INDEX</p>
            <h1>模型价格<br />一眼看清</h1>
            <p className="hero-lead">集中查看国内外主流 AI API 的输入、缓存和输出价格，并直达厂商官方来源。</p>
            <a className="primary-action" href="#models">
              查看全部模型
              <IconArrowDown size={18} stroke={1.8} />
            </a>
          </div>
          <div className="hero-summary" aria-label="数据摘要">
            <div className="hero-metric primary">
              <span>精选模型</span>
              <strong>{models.length}</strong>
              <small>个当前公开 API 模型</small>
            </div>
            <div className="hero-metric">
              <span>覆盖厂商</span>
              <strong>{providers.length}</strong>
              <small>家国内外主流厂商</small>
            </div>
            <div className="hero-metric">
              <span>最低输入价</span>
              <strong>{cheapest.baseCurrency === 'CNY' ? '¥' : '$'}{cheapest.input}</strong>
              <small>{cheapest.name} / 1M tokens</small>
            </div>
            <div className="sync-card">
              <IconRefresh size={18} stroke={1.7} />
              <span><strong>每小时核验官方价格</strong><small>数据版本：{formatUpdated(updatedAt)}</small></span>
            </div>
          </div>
        </section>

        <ModelExplorer models={models} />

        <section className="about-section" id="about">
          <div>
            <IconDatabase size={23} stroke={1.6} />
            <h2>数据如何更新</h2>
          </div>
          <div className="about-copy">
            <p>自动任务每小时访问厂商官方价格页。只有来源可访问、模型存在且价格字段通过校验时才会写入；解析失败会保留上一版，不会把缺失价格写成零。</p>
            <p>首页展示标准按量价格。长上下文、阶梯计价、地区、Batch、工具调用和限时优惠可能采用不同费率，详情页会标注适用条件并提供原始来源。</p>
          </div>
        </section>
      </div>
    </Shell>
  );
}
