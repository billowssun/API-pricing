import Link from 'next/link';
import { Shell } from '@/components/Shell';

export default function ModelNotFound() {
  return (
    <Shell>
      <div className="not-found">
        <span>404</span>
        <h1>没有找到这个模型</h1>
        <p>它可能已下架，或链接已经变更。</p>
        <Link href="/#models">返回模型列表</Link>
      </div>
    </Shell>
  );
}
