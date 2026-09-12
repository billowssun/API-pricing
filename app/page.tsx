import { IconExternalLink } from "@tabler/icons-react";
import { ModelExplorer } from "@/components/ModelExplorer";
import { models, sync, formatUpdated } from "@/lib/data";
import { selectMainstreamModels } from "@/lib/catalog-policy.cjs";
export const revalidate = 3600;
export default function HomePage() {
  return (
    <main className="price-board">
      <header className="board-masthead">
        <a href="/" className="board-brand">
          ModelPrice
        </a>
        <span className="board-edition">精选价目簿</span>
        <a className="board-source-link" href="#sources">
          来源说明 <IconExternalLink size={13} />
        </a>
      </header>
      <div className="board-content">
        <div className="board-heading">
          <h1>大模型价格</h1>
          <p>精选主流 · 按厂商分组</p>
        </div>
        <ModelExplorer models={selectMainstreamModels(models)} />
        <footer className="board-footer">
          <span>
            USD 美元 <span className="footer-separator">/</span> CNY 人民币{" "}
            <span className="footer-separator">·</span> 每百万 tokens
          </span>
          <a
            href="#sources"
            className={sync.status === "healthy" ? "" : "sync-warning"}
          >
            目录同步 {formatUpdated(sync.checkedAt)}
            {sync.status !== "healthy" ? " · 部分来源异常" : ""}
          </a>
        </footer>
        <details className="board-sources" id="sources">
          <summary>来源与选型说明</summary>
          <div className="sources-content">
            <p>
              每家保留各产品线的当前代表型号，同系列新版本替换旧版本；不代表调用量排名。实验版、重复快照与旧型号不进入本表。点击模型名称可查看上下文、API
              ID 和计费限制。
            </p>
            <p>
              <strong>官方</strong>为厂商直连报价；<strong>聚合</strong>为
              OpenRouter
              路由报价。按原币展示，不将人民币与美元直接排名。长上下文、Batch、缓存写入、地区和工具调用可能另外收费。
            </p>
            <p>
              目录同步时间不等于每一条价格的核验时间。各模型的核验日期在展开详情中单独显示，外站可访问也不代表该厂商的报价已重新解析。
            </p>
            <ul>
              {sync.sources.map((source) => (
                <li key={source.name}>
                  <span>{source.name}</span>
                  <span>
                    {source.status === "ok"
                      ? source.role
                      : `异常 · ${source.message || "保留上次数据"}`}
                  </span>
                </li>
              ))}
            </ul>
            <a
              href="https://github.com/billowssun/API-pricing"
              target="_blank"
              rel="noreferrer"
            >
              查看开源数据与同步记录 <IconExternalLink size={13} />
            </a>
          </div>
        </details>
      </div>
    </main>
  );
}
