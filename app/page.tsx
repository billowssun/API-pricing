import {
  IconArrowUpRight,
  IconBrandGithub,
  IconInfoCircle,
  IconDatabase,
  IconShieldCheck,
} from "@tabler/icons-react";
import { ModelExplorer } from "@/components/ModelExplorer";
import { BudgetEstimator } from "@/components/BudgetEstimator";
import { ChangeLog } from "@/components/ChangeLog";
import { models, sync, formatUpdated } from "@/lib/data";
import { selectMainstreamModels } from "@/lib/catalog-policy.cjs";
import { needsReview } from "@/lib/estimate.cjs";
export const revalidate = 3600;
const repository = "https://github.com/billowssun/API-pricing";
export default function HomePage() {
  const visibleModels = selectMainstreamModels(models);
  const staleModels = visibleModels.filter((model) =>
    needsReview(model.lastVerifiedAt),
  );
  return (
    <main className="price-board" id="top">
      <a className="skip-board" href="#models">
        跳到模型价格
      </a>
      <header className="board-masthead">
        <a href="#top" className="board-brand">
          ModelPrice <span>/</span> <small>API PRICE INDEX</small>
        </a>
        <nav aria-label="主导航">
          <a href="#models">价格</a>
          <a href="#estimate">成本估算</a>
          <a href="#sources">数据方法</a>
          <a href="#changes">更新记录</a>
          <a
            href={repository}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub 开源项目"
          >
            <IconBrandGithub size={17} />
            <span>GitHub</span>
          </a>
        </nav>
      </header>
      <section className="board-stage" aria-label="模型价格工作台">
        <div className="desktop-window">
          <div className="window-title dark">
            <span>ModelPrice / API PRICE INDEX</span>
            <a href="#sources">
              {visibleModels.length} MODELS <IconDatabase size={13} />
            </a>
          </div>
          <ModelExplorer models={visibleModels} />
          <div className="directory-status">
            <a
              href="#sources"
              className={sync.status === "healthy" ? "" : "sync-warning"}
            >
              目录同步 {formatUpdated(sync.checkedAt)}
              {sync.status !== "healthy" ? " · 来源异常" : ""}
            </a>
            <a href="#verification">
              {staleModels.length
                ? `${staleModels.length} 条报价待复核`
                : "查看逐条核验时间"}
              <IconArrowUpRight size={12} />
            </a>
          </div>
        </div>
      </section>
      <div className="board-supplements">
        <section
          className="utility-section"
          id="estimate"
          aria-labelledby="estimate-title"
        >
          <div className="section-heading">
            <span className="section-number">01</span>
            <h2 id="estimate-title">估算你的实际账单</h2>
            <p>
              把模型单价，换成你的使用成本。
              <br />
              按当前记录的标准文本价格估算。
            </p>
          </div>
          <BudgetEstimator models={visibleModels} />
          <aside className="utility-notes">
            <h3>
              <IconInfoCircle size={18} /> 计算前，留意这三点
            </h3>
            <ol>
              <li>
                <strong>缓存命中，不等于免费</strong>
                <p>
                  命中的输入按缓存读取价计算；缓存写入与存储费用不包含在估算中。
                </p>
              </li>
              <li>
                <strong>长上下文可能分档计费</strong>
                <p>
                  单次请求长度可能改变单价。月度总量不能代替单次上下文长度。
                </p>
              </li>
              <li>
                <strong>批处理与工具另行核对</strong>
                <p>
                  Batch、搜索、图片与音频等费用不包含在内。折扣以具体厂商说明为准。
                </p>
              </li>
            </ol>
          </aside>
        </section>
        <section
          className="utility-section"
          id="sources"
          aria-labelledby="sources-title"
        >
          <div className="section-heading">
            <span className="section-number">02</span>
            <h2 id="sources-title">
              每个报价，
              <br />
              都应该可追溯
            </h2>
            <p>
              看清来源，也看清边界。
              <br />
              同步时间不等于报价核验时间。
            </p>
            <a className="text-link" href="#verification">
              查看数据健康状况 <IconArrowUpRight size={14} />
            </a>
          </div>
          <div className="mini-window">
            <div className="window-title">
              <span>
                <IconShieldCheck size={14} /> 价格来源说明
              </span>
              <span>PROVENANCE</span>
            </div>
            <dl className="provenance-list">
              <div>
                <dt>
                  官方价格{" "}
                  <small>
                    {
                      visibleModels.filter((m) => m.priceStatus === "official")
                        .length
                    }{" "}
                    条
                  </small>
                </dt>
                <dd>
                  记录自厂商官方价格页。适用地区、版本与限制以原始页面为准。
                </dd>
              </div>
              <div>
                <dt>
                  聚合价格{" "}
                  <small>
                    {
                      visibleModels.filter(
                        (m) => m.priceStatus === "aggregated",
                      ).length
                    }{" "}
                    条
                  </small>
                </dt>
                <dd>
                  记录自 OpenRouter，代表聚合路由报价，不等同于厂商直连价格。
                </dd>
              </div>
              <div>
                <dt>
                  待复核 <small>{staleModels.length} 条</small>
                </dt>
                <dd>
                  超过 30
                  天未核验或缺少有效日期。可能与官方或聚合条目重叠，不代表确定有误。
                </dd>
              </div>
            </dl>
          </div>
          <aside className="utility-notes">
            <h3>
              <IconDatabase size={18} /> 这张表如何使用
            </h3>
            <dl className="field-guide">
              <div>
                <dt>原币比较</dt>
                <dd>USD 与 CNY 分开看，不使用没有依据的汇率混合排名。</dd>
              </div>
              <div>
                <dt>展开型号</dt>
                <dd>查看 API ID、上下文、价格核验日期和计费备注。</dd>
              </div>
              <div>
                <dt>保留规则</dt>
                <dd>
                  保留独立产品线，仅去除同线旧版本与重复快照；没有每家 4
                  个的上限。
                </dd>
              </div>
            </dl>
          </aside>
          <details className="verification-details" id="verification">
            <summary>
              <span>数据健康与核验明细</span>
              <span>
                {staleModels.length} 条待复核 · {sync.sources.length} 个同步来源
              </span>
            </summary>
            <div className="verification-content">
              <p>
                页面可访问只代表连通性检查通过，不代表报价已重新解析。自动目录筛选也不等同于使用量排名；有明确退役依据的型号不再展示。
              </p>
              <h3>待复核报价</h3>
              {staleModels.length ? (
                <ul className="review-list">
                  {staleModels.map((m) => (
                    <li key={m.id}>
                      <a href={m.source} target="_blank" rel="noreferrer">
                        {m.name}
                        <IconArrowUpRight size={13} />
                      </a>
                      <span>
                        {m.lastVerifiedAt?.slice(0, 10) || "未记录核验日期"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  当前没有超过 30
                  天未核验的记录；这不保证来源页面在此后未发生变化。
                </p>
              )}
              <h3>同步来源状态</h3>
              <ul className="review-list">
                {sync.sources.map((s) => (
                  <li key={s.name}>
                    <span>{s.name}</span>
                    <span>
                      {s.status === "ok"
                        ? s.role
                        : `异常 · ${s.message || "保留上次数据"}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </section>
        <section
          className="utility-section"
          id="changes"
          aria-labelledby="changes-title"
        >
          <div className="section-heading">
            <span className="section-number">03</span>
            <h2 id="changes-title">
              关注变化，
              <br />
              而不是噪声
            </h2>
            <p>
              调价、上新与退役，需要各自的依据。
              <br />
              一次目录更新，不自动算一次模型发布。
            </p>
          </div>
          <ChangeLog />
          <aside className="utility-notes">
            <h3>
              <IconInfoCircle size={18} /> 原始记录，公开可查
            </h3>
            <p>
              当前尚未建立逐条核验的变更日志。你可以查看仓库中的实际数据修改，不把抓取时间当作事件发生时间。
            </p>
            <a
              className="outline-link"
              href={`${repository}/commits/main/pricing.json`}
              target="_blank"
              rel="noreferrer"
            >
              查看数据提交记录 <IconArrowUpRight size={15} />
            </a>
          </aside>
        </section>
        <footer className="board-footer">
          <a href="#top" className="board-brand">
            ModelPrice
          </a>
          <span>让模型价格更透明。</span>
          <nav aria-label="页脚导航">
            <a href="#sources">数据方法</a>
            <a href={repository} target="_blank" rel="noreferrer">
              GitHub <IconArrowUpRight size={12} />
            </a>
            <a href="#top">回到顶部</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
