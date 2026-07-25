import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ModelPrice - AI API 模型价格',
    template: '%s | ModelPrice',
  },
  description: '快速查询国内外主流 AI 模型的 API 输入、缓存和输出价格，并查看上下文、模型 ID 与官方来源。',
  openGraph: {
    title: 'ModelPrice - AI API 模型价格',
    description: '主流 AI 模型 API 价格，一眼看清。',
    type: 'website',
    locale: 'zh_CN',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
