import { IconActivity, IconAlertTriangle, IconCheck, IconClock, IconDatabase } from '@tabler/icons-react';
import { ModelExplorer } from '@/components/ModelExplorer';
import { Shell } from '@/components/Shell';
import { formatUpdated, models, providers, sync } from '@/lib/data';

export const revalidate = 3600;

export default function HomePage() {
  const officialCount = models.filter((model) => model.priceStatus === 'official').length;
  const discoveredCount = models.length - officialCount;
  const healthy = sync.status === 'healthy';

  return (
    <Shell>
      <div className="page-shell tool-page">
        <section className="tool-header" aria-labelledby="page-title">
          <div>
            <h1 id="page-title">AI 模型价格监控</h1>
            <p>查价格、找新模型、核对来源。标准价格统一为每 100 万 tokens。</p>
          </div>
          <div className={`sync-state ${healthy ? 'healthy' : 'warning'}`}>
            {healthy ? <IconCheck size={17} /> : <IconAlertTriangle size={17} />}
            <span><strong>{healthy ? '目录同步正常' : '数据需要刷新'}</strong><small>{formatUpdated(sync.checkedAt)}</small></span>
          </div>
        </section>

        <section className="status-strip" aria-label="监控摘要">
          <div><IconDatabase size={17} /><span>模型</span><strong>{models.length}</strong></div>
          <div><IconActivity size={17} /><span>厂商</span><strong>{providers.length}</strong></div>
          <div><IconCheck size={17} /><span>官方报价</span><strong>{officialCount}</strong></div>
          <div><IconClock size={17} /><span>自动发现</span><strong>{discoveredCount}</strong></div>
        </section>

        <ModelExplorer models={models} />

        <section className="source-panel" id="about">
          <div className="section-heading compact-heading">
            <h2>数据源状态</h2>
            <p>官方报价与聚合报价分开标记。聚合报价只用于发现新模型和快速比较。</p>
          </div>
          <div className="source-list">
            {sync.sources.map((source) => (
              <div className="source-row" key={source.name}>
                <span className={`source-indicator ${source.status}`} aria-hidden="true" />
                <strong>{source.name}</strong>
                <span>{source.role}</span>
                <small>{source.message || (source.count ? `${source.count} 个候选模型` : '连接正常')}</small>
              </div>
            ))}
          </div>
          <p className="source-footnote">最终账单以厂商控制台为准。阶梯价、长上下文、Batch、工具调用和地区价格可能不同。</p>
        </section>
      </div>
    </Shell>
  );
}
