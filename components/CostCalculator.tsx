'use client';

import { IconCalculator } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { formatPrice, type Model } from '@/lib/data';

export function CostCalculator({ model }: { model: Model }) {
  const [inputTokens, setInputTokens] = useState(1_000_000);
  const [outputTokens, setOutputTokens] = useState(100_000);
  const [cachedPercent, setCachedPercent] = useState(0);

  const cost = useMemo(() => {
    const cachedTokens = inputTokens * (cachedPercent / 100);
    const regularTokens = inputTokens - cachedTokens;
    const inputCost = (regularTokens / 1_000_000) * (model.input ?? 0);
    const cachedRate = model.cachedInput ?? model.input ?? 0;
    const cachedCost = (cachedTokens / 1_000_000) * cachedRate;
    const outputCost = (outputTokens / 1_000_000) * (model.output ?? 0);
    return inputCost + cachedCost + outputCost;
  }, [cachedPercent, inputTokens, model, outputTokens]);

  if (model.type !== 'text') return null;

  return (
    <section className="calculator-card">
      <div className="detail-section-title">
        <IconCalculator size={21} stroke={1.7} />
        <div><h2>费用估算</h2><p>输入预期 token 用量，快速估算单次或批量调用成本。</p></div>
      </div>
      <div className="calculator-grid">
        <label>
          <span>输入 tokens</span>
          <input type="number" min="0" step="1000" value={inputTokens} onChange={(event) => setInputTokens(Math.max(0, Number(event.target.value)))} />
        </label>
        <label>
          <span>输出 tokens</span>
          <input type="number" min="0" step="1000" value={outputTokens} onChange={(event) => setOutputTokens(Math.max(0, Number(event.target.value)))} />
        </label>
        <label>
          <span>缓存命中比例</span>
          <div className="range-wrap">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={cachedPercent}
              disabled={model.cachedInput == null}
              onChange={(event) => setCachedPercent(Number(event.target.value))}
            />
            <strong>{model.cachedInput == null ? '不适用' : `${cachedPercent}%`}</strong>
          </div>
        </label>
        <div className="estimate-result">
          <span>预估费用</span>
          <strong>{formatPrice(cost, model.baseCurrency)}</strong>
          <small>不含税费、工具调用、长上下文和地区加价</small>
        </div>
      </div>
    </section>
  );
}
