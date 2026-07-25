'use client';

import Link from 'next/link';
import { IconArrowUpRight, IconSearch, IconSelector, IconX } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { formatPrice, type Model, typeLabel } from '@/lib/data';
import { ProviderMark } from './ProviderMark';

type SortKey = 'recommended' | 'input-asc' | 'output-asc' | 'context-desc';

function contextNumber(value = '') {
  const number = Number.parseFloat(value);
  if (Number.isNaN(number)) return 0;
  return value.toUpperCase().includes('M') ? number * 1_000_000 : number * 1_000;
}

export function ModelExplorer({ models }: { models: Model[] }) {
  const providers = [...new Set(models.map((model) => model.provider))];
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('全部');
  const [sort, setSort] = useState<SortKey>('recommended');

  const shown = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return models
      .filter((model) => provider === '全部' || model.provider === provider)
      .filter((model) => !normalized || `${model.name} ${model.provider} ${model.apiId ?? ''}`.toLowerCase().includes(normalized))
      .toSorted((a, b) => {
        if (sort === 'input-asc') return (a.input ?? Number.POSITIVE_INFINITY) - (b.input ?? Number.POSITIVE_INFINITY);
        if (sort === 'output-asc') return (a.output ?? Number.POSITIVE_INFINITY) - (b.output ?? Number.POSITIVE_INFINITY);
        if (sort === 'context-desc') return contextNumber(b.context) - contextNumber(a.context);
        return 0;
      });
  }, [models, provider, query, sort]);

  const hasFilters = Boolean(query || provider !== '全部');
  const reset = () => {
    setQuery('');
    setProvider('全部');
  };

  return (
    <section className="catalog-section" id="models">
      <div className="section-heading">
        <h2>模型价格</h2>
        <p>统一按每 100 万 tokens 展示厂商标准按量价格；阶梯价、长上下文加价和限时价格会在详情页明确标注。</p>
      </div>

      <div className="catalog-toolbar">
        <label className="search-field">
          <span className="sr-only">搜索模型</span>
          <IconSearch size={19} stroke={1.7} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模型、厂商或 API ID"
          />
          {query && (
            <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}>
              <IconX size={17} />
            </button>
          )}
        </label>
        <label className="select-field sort-field">
          <IconSelector size={18} stroke={1.7} />
          <span className="sr-only">排序方式</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="recommended">推荐排序</option>
            <option value="input-asc">输入价从低到高</option>
            <option value="output-asc">输出价从低到高</option>
            <option value="context-desc">上下文从大到小</option>
          </select>
        </label>
      </div>

      <div className="provider-tabs" aria-label="按厂商筛选">
        {['全部', ...providers].map((item) => (
          <button
            key={item}
            type="button"
            className={provider === item ? 'active' : ''}
            aria-pressed={provider === item}
            onClick={() => setProvider(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="result-meta">
        <span>共 {shown.length} 个模型</span>
        {hasFilters && <button type="button" onClick={reset}>清除筛选</button>}
      </div>

      {shown.length ? (
        <>
          <div className="price-table" role="table" aria-label="模型价格列表">
            <div className="price-row price-head" role="row">
              <span role="columnheader">模型</span>
              <span role="columnheader">输入</span>
              <span role="columnheader">缓存输入</span>
              <span role="columnheader">输出</span>
              <span role="columnheader">上下文</span>
              <span role="columnheader" aria-label="详情" />
            </div>
            {shown.map((model) => (
              <Link className="price-row" role="row" href={`/models/${model.id}`} key={model.id}>
                <span className="model-cell" role="cell">
                  <ProviderMark provider={model.provider} />
                  <span>
                    <strong>{model.name}</strong>
                    <small>{model.provider} <i>{typeLabel(model.type)}</i></small>
                  </span>
                </span>
                <span className="price-cell" role="cell">
                  <strong>{formatPrice(model.input, model.baseCurrency)}</strong>
                  <small>/ 1M tokens</small>
                </span>
                <span className="price-cell" role="cell">
                  <strong>{formatPrice(model.cachedInput, model.baseCurrency)}</strong>
                  <small>{model.cachedInput == null ? '官方未列出' : '/ 1M tokens'}</small>
                </span>
                <span className="price-cell" role="cell">
                  <strong>{formatPrice(model.output, model.baseCurrency)}</strong>
                  <small>/ 1M tokens</small>
                </span>
                <span className="context-cell" role="cell">{model.context || '未公布'}</span>
                <span className="row-action" role="cell"><IconArrowUpRight size={19} stroke={1.6} /></span>
              </Link>
            ))}
          </div>

          <div className="mobile-model-list">
            {shown.map((model) => (
              <Link className="mobile-model-card" href={`/models/${model.id}`} key={model.id}>
                <div className="mobile-model-title">
                  <ProviderMark provider={model.provider} />
                  <span><strong>{model.name}</strong><small>{model.provider} · {model.context}</small></span>
                  <IconArrowUpRight size={18} stroke={1.6} />
                </div>
                <div className="mobile-prices">
                  <span><small>输入</small><strong>{formatPrice(model.input, model.baseCurrency)}</strong></span>
                  <span><small>缓存</small><strong>{formatPrice(model.cachedInput, model.baseCurrency)}</strong></span>
                  <span><small>输出</small><strong>{formatPrice(model.output, model.baseCurrency)}</strong></span>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <IconSearch size={28} stroke={1.5} />
          <h3>没有匹配的模型</h3>
          <p>换一个关键词或清除厂商筛选。</p>
          <button type="button" onClick={reset}>查看全部模型</button>
        </div>
      )}
    </section>
  );
}
