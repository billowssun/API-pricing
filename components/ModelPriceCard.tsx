import Link from 'next/link';
import { IconArrowUpRight } from '@tabler/icons-react';
import { formatPrice, type Model } from '@/lib/data';
import { ProviderMark } from './ProviderMark';

export function ModelPriceCard({ model }: { model: Model }) {
  return (
    <Link href={`/models/${model.id}`} className="related-model">
      <div>
        <ProviderMark provider={model.provider} size="small" />
        <span><strong>{model.name}</strong><small>{model.provider}</small></span>
        <IconArrowUpRight size={18} />
      </div>
      <p>
        <span>输入 <strong>{formatPrice(model.input, model.baseCurrency)}</strong></span>
        <span>输出 <strong>{formatPrice(model.output, model.baseCurrency)}</strong></span>
      </p>
    </Link>
  );
}
