'use client';

import Link from 'next/link';
import { IconBrandGithub, IconInfoCircle } from '@tabler/icons-react';

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-header">
        <div className="nav-inner">
          <Link href="/" className="brand" aria-label="ModelPrice 首页">
            <span className="brand-symbol" aria-hidden="true">MP</span>
            <span>ModelPrice</span>
          </Link>
          <nav className="nav-links" aria-label="主导航">
            <Link href="/#models">价格表</Link>
            <Link href="/#about"><IconInfoCircle size={17} /><span>数据状态</span></Link>
            <a href="https://github.com/billowssun/API-pricing" target="_blank" rel="noreferrer" aria-label="打开 GitHub 仓库">
              <IconBrandGithub size={18} /><span>GitHub</span>
            </a>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <span>ModelPrice</span>
        <p>价格用于估算，实际结算以厂商账单为准。</p>
        <a href="/#about">数据来源</a>
      </footer>
    </>
  );
}
