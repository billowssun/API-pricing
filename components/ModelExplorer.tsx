'use client';

import Link from 'next/link';
import { IconArrowUpRight, IconSearch, IconSelector, IconX } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { formatPrice, type Model } from '@/lib/data';
import { ProviderMark } from './ProviderMark';

type SortKey = 'newest' | 'input-asc' | 'output-asc' | 'context-desc';

function contextNumber(value = '') {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return value.toUpperCase().includes('M') ? parsed * 1_000_000 : parsed * 1_000;
}

function sourceLabel(model: Model) {
  return model.priceStatus === 'official' ? '官方' : '聚合';
}

export function ModelExplorer({ models }: { models: Model[] }) {
  const providers = [...new Set(models.map((model) => model.provider))];
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('全部');
  const [sort, setSort] = useState<SortKey>('newest');

  const shown = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return models
      .filter((model) => provider === '全部' || model.provider === provider)
      .filter((model) => !normalized || `${model.name} ${model.provider} ${model.apiId ?? ''}`.toLowerCase().includes(normalized))
      .toSorted((a, b) => {
        if (sort === 'input-asc') return (a.input ?? Infinity) - (b.input ?? Infinity);
        if (sort === 'output-asc') return (a.output ?? Infinity) - (b.output ?? Infinity);
        if (sort === 'context-desc') return contextNumber(b.context) - contextNumber(a.context);
        return (b.releaseDate || '').localeCompare(a.releaseDate || '');
      });
  }, [models, provider, query, sort]);

  const reset = () => { setQuery(''); setProvider('全部'); };
  const hasFilters = Boolean(query || provider !== '全部');

  return (
    <section className="catalog-section" id="models">
      <div className="catalog-toolbar">
        <label className="search-field">
          <span className="sr-only">搜索模型</span>
          <IconSearch size={19} stroke={1.8} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模型、厂商或 API ID" />
          {query && <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}><IconX size={17} /></button>}
        </label>
        <label className="select-field sort-field">
          <IconSelector size={18} stroke={1.8} />
          <span className="sr-only">排序方式</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="newest">新模型优先</option>
            <option value="input-asc">输入价格最低</option>
            <option value="output-asc">输出价格最低</option>
            <option value="context-desc">上下文最大</option>
          </select>
        </label>
      </div>

      <div className="provider-tabs" aria-label="按厂商筛选">
        {['全部', ...providers].map((item) => (
          <button key={item} type="button" className={provider === item ? 'active' : ''} aria-pressed={provider === item} onClick={() => setProvider(item)}>
            {item}
          </button>
        ))}
      </div>

      <div className="result-meta">
        <span>{shown.length} 个模型</span>
        {hasFilters && <button type="button" onClick={reset}>清除筛选</button>}
      </div>

      {shown.length ? (
        <div className="model-results">
          <div className="price-table" role="table" aria-label="模型价格列表">
            <div className="price-row price-head" role="row">
              <span role="columnheader">模型</span><span role="columnheader">输入</span><span role="columnheader">缓存</span>
              <span role="columnheader">输出</span><span role="columnheader">上下文</span><span role="columnheader">来源</span><span />
            </div>
            {shown.map((model) => (
              <Link className="price-row" role="row" href={`/models/${model.id}`} key={model.id}>
                <span className="model-cell" role="cell">
                  <ProviderMark provider={model.provider} />
                  <span><strong>{model.name}</strong><small><code>{model.apiId || model.id}</code></small></span>
                </span>
                <span className="price-cell" role="cell"><strong>{formatPrice(model.input, model.baseCurrency)}</strong><small>/ 1M</small></span>
                <span className="price-cell" role="cell"><strong>{formatPrice(model.cachedInput, model.baseCurrency)}</strong><small>/ 1M</small></span>
                <span className="price-cell" role="cell"><strong>{formatPrice(model.output, model.baseCurrency)}</strong><small>/ 1M</small></span>
                <span className="context-cell" role="cell">{model.context || '未公布'}</span>
                <span role="cell"><em className={`source-badge ${model.priceStatus}`}>{sourceLabel(model)}</em></span>
                <span className="row-action" role="cell"><IconArrowUpRight size={18} stroke={1.7} /></span>
              </Link>
            ))}
          </div>

          <div className="mobile-model-list">
            {shown.map((model) => (
              <Link className="mobile-model-row" href={`/models/${model.id}`} key={model.id}>
                <ProviderMark provider={model.provider} size="small" />
                <span className="mobile-model-main"><strong>{model.name}</strong><small>{model.apiId || model.id}</small></span>
                <span className="mobile-model-price"><strong>{formatPrice(model.input, model.baseCurrency)}</strong><small>输入 / 1M</small></span>
                <em className={`source-badge ${model.priceStatus}`}>{sourceLabel(model)}</em>
                <IconArrowUpRight className="mobile-row-arrow" size={16} />
                <span className="mobile-model-secondary">
                  <small>输出 <b>{formatPrice(model.output, model.baseCurrency)}</b></small>
                  <small>上下文 <b>{model.context || '未公布'}</b></small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state"><IconSearch size={28} /><h3>没有匹配的模型</h3><p>换一个关键词或清除厂商筛选。</p><button type="button" onClick={reset}>查看全部模型</button></div>
      )}
    </section>
  );
}
