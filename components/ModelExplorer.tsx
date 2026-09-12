"use client";
import { Fragment, useMemo, useState } from "react";
import {
  IconArrowDown,
  IconChevronDown,
  IconExternalLink,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import type { Model } from "@/lib/data";
import { providers } from "@/lib/catalog-policy.cjs";
import { ProviderMark } from "./ProviderMark";
type SortKey = "default" | "input" | "output";
const tiers = ["旗舰", "进阶", "均衡", "轻量", "编程", "高速"];
function Price({
  value,
  currency,
}: {
  value: number | null | undefined;
  currency: string;
}) {
  if (value == null)
    return (
      <span className="price-missing" title="来源未提供此项报价">
        —
      </span>
    );
  return (
    <span className="board-price">
      {currency === "CNY" ? "¥" : "$"}
      {value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })}
      <small>{currency}</small>
    </span>
  );
}
export function ModelExplorer({ models }: { models: Model[] }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");
  const [tier, setTier] = useState("all");
  const [sort, setSort] = useState<SortKey>("default");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const groups = useMemo(
    () =>
      providers.flatMap((provider) => {
        if (country !== "all" && provider.country !== country) return [];
        const normalized = query.trim().toLowerCase();
        const rows = models.filter(
          (m) =>
            m.provider === provider.id &&
            (tier === "all" || m.tier === tier) &&
            (!normalized ||
              `${m.name} ${m.apiId || ""} ${provider.name} ${provider.id}`
                .toLowerCase()
                .includes(normalized)),
        );
        if (sort !== "default")
          rows.sort(
            (a, b) =>
              a.baseCurrency.localeCompare(b.baseCurrency) ||
              (a[sort] ?? Infinity) - (b[sort] ?? Infinity),
          );
        return rows.length ? [{ provider, rows }] : [];
      }),
    [models, query, country, tier, sort],
  );
  const count = groups.reduce((sum, g) => sum + g.rows.length, 0);
  const filtered = Boolean(query || country !== "all" || tier !== "all");
  function reset() {
    setQuery("");
    setCountry("all");
    setTier("all");
    setSort("default");
    setCollapsed(new Set());
  }
  function toggleProvider(id: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSort(key: SortKey) {
    setSort((previous) => (previous === key ? "default" : key));
  }
  return (
    <section id="models" aria-label="主流模型价目表">
      <div className="board-toolbar">
        <label className="board-search">
          <IconSearch size={18} stroke={1.7} />
          <span className="sr-only">搜索模型名称或厂商</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模型名称或厂商"
          />
          {query ? (
            <button
              type="button"
              aria-label="清空搜索"
              onClick={() => setQuery("")}
            >
              <IconX size={16} />
            </button>
          ) : null}
        </label>
        <div className="board-filters">
          <div className="country-filter" role="group" aria-label="按国家筛选">
            {[
              ["all", "全部"],
              ["CN", "中国"],
              ["US", "美国"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={country === value}
                onClick={() => setCountry(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="board-tier">
            <span>档次</span>
            <select
              aria-label="按档次筛选"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="all">全部</option>
              {tiers.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <IconChevronDown size={14} />
          </label>
        </div>
      </div>
      {filtered || sort !== "default" ? (
        <div className="board-filter-status">
          <span aria-live="polite">
            找到 {count} 个模型
            {sort !== "default" ? " · 各厂商内按币种分组后升序排列" : ""}
          </span>
          <button type="button" onClick={reset}>
            重置筛选
          </button>
        </div>
      ) : null}
      {count ? (
        <p className="board-mobile-guide">
          每百万 tokens · 左右滑动查看完整价格
        </p>
      ) : null}
      {count ? (
        <div
          className="board-table-wrap"
          tabIndex={0}
          role="region"
          aria-label="价格表，小屏幕可左右滑动"
        >
          <table className="board-table">
            <caption className="sr-only">
              {count} 个模型，所有价格为原币每百万
              tokens。点击输入或输出表头可在厂商内按同币种排序。
            </caption>
            <colgroup>
              <col className="col-model" />
              <col className="col-tier" />
              <col className="col-price" />
              <col className="col-price" />
              <col className="col-price" />
              <col className="col-source" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">模型</th>
                <th scope="col">档次</th>
                <th
                  scope="col"
                  aria-sort={sort === "input" ? "ascending" : "none"}
                >
                  <button onClick={() => toggleSort("input")} type="button">
                    输入{" "}
                    <IconArrowDown
                      size={13}
                      className={sort === "input" ? "sort-active" : "sort-idle"}
                    />
                  </button>
                </th>
                <th scope="col">缓存</th>
                <th
                  scope="col"
                  aria-sort={sort === "output" ? "ascending" : "none"}
                >
                  <button onClick={() => toggleSort("output")} type="button">
                    输出{" "}
                    <IconArrowDown
                      size={13}
                      className={
                        sort === "output" ? "sort-active" : "sort-idle"
                      }
                    />
                  </button>
                </th>
                <th scope="col">来源</th>
              </tr>
            </thead>
            {groups.map(({ provider, rows }) => {
              const closed = collapsed.has(provider.id) && !filtered;
              return (
                <tbody key={provider.id}>
                  <tr className="board-provider">
                    <th colSpan={6} scope="rowgroup">
                      <button
                        type="button"
                        aria-expanded={!closed}
                        onClick={() => toggleProvider(provider.id)}
                        disabled={filtered}
                      >
                        <ProviderMark provider={provider.id} />
                        <span>{provider.name}</span>
                        <small>{rows.length} 个模型</small>
                        <IconChevronDown
                          size={17}
                          className={closed ? "is-closed" : ""}
                        />
                      </button>
                    </th>
                  </tr>
                  {!closed
                    ? rows.map((model) => (
                        <Fragment key={model.id}>
                          <tr
                            className={`board-model-row ${expanded === model.id ? "is-expanded" : ""}`}
                          >
                            <th scope="row">
                              <button
                                type="button"
                                className="model-expand"
                                aria-expanded={expanded === model.id}
                                aria-controls={`detail-${model.id}`}
                                onClick={() =>
                                  setExpanded(
                                    expanded === model.id ? null : model.id,
                                  )
                                }
                              >
                                <span>{model.name}</span>
                                {model.priceLabel ? <small className="model-price-label">{model.priceLabel}</small> : null}
                                <IconChevronDown size={13} />
                              </button>
                            </th>
                            <td className="board-tier-cell">{model.tier}</td>
                            <td>
                              <Price
                                value={model.input}
                                currency={model.baseCurrency}
                              />
                            </td>
                            <td>
                              <Price
                                value={model.cachedInput}
                                currency={model.baseCurrency}
                              />
                            </td>
                            <td>
                              <Price
                                value={model.output}
                                currency={model.baseCurrency}
                              />
                            </td>
                            <td>
                              <a
                                className={`board-source ${model.priceStatus}`}
                                href={model.source}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${model.name} ${model.priceStatus === "official" ? "官方" : "聚合"}价格来源`}
                              >
                                {model.priceStatus === "official"
                                  ? "官方"
                                  : "聚合"}
                                <IconExternalLink size={13} stroke={1.7} />
                              </a>
                            </td>
                          </tr>
                          <tr
                            id={`detail-${model.id}`}
                            hidden={expanded !== model.id}
                            className="board-detail"
                          >
                            <td colSpan={6}>
                              <dl>
                                <div>
                                  <dt>API ID</dt>
                                  <dd>
                                    <code>{model.apiId || model.id}</code>
                                  </dd>
                                </div>
                                <div>
                                  <dt>上下文</dt>
                                  <dd>{model.context || "未公布"}</dd>
                                </div>
                                <div>
                                  <dt>最大输出</dt>
                                  <dd>{model.maxOutput || "未公布"}</dd>
                                </div>
                                <div>
                                  <dt>报价核验</dt>
                                  <dd>
                                    {model.lastVerifiedAt
                                      ? model.lastVerifiedAt.slice(0, 10)
                                      : "未记录"}
                                  </dd>
                                </div>
                              </dl>
                              <p>
                                {model.pricingNote ||
                                  "标准文本 token 报价；具体计费限制以来源页面为准。"}
                              </p>
                              {model.availability === "preview" ? (
                                <p>当前为预览版本，定价与可用性可能变化。</p>
                              ) : null}
                            </td>
                          </tr>
                        </Fragment>
                      ))
                    : null}
                </tbody>
              );
            })}
          </table>
        </div>
      ) : (
        <div className="board-empty">
          <IconSearch size={26} stroke={1.5} />
          <h2>没有匹配的模型</h2>
          <p>试试其他关键词，或清除国家与档次筛选。</p>
          <button type="button" onClick={reset}>
            查看全部模型
          </button>
        </div>
      )}
      <div className="board-table-note">
        <span>每百万 tokens · 原币报价</span>
        <span>
          点击型号展开详情{" "}
          <span className="mobile-scroll-hint">· 左右滑动查看完整表格</span>
        </span>
      </div>
    </section>
  );
}
