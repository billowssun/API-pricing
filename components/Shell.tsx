'use client';

import Link from 'next/link';
import { IconBrandGithub, IconMenu2, IconX } from '@tabler/icons-react';
import { useState } from 'react';

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="nav-inner">
          <Link href="/" className="brand" aria-label="ModelPrice 首页">
            <span className="brand-symbol" aria-hidden="true">MP</span>
            <span>ModelPrice</span>
          </Link>
          <nav className={open ? 'nav-links is-open' : 'nav-links'} aria-label="主导航">
            <Link href="/#models" onClick={() => setOpen(false)}>模型价格</Link>
            <Link href="/#about" onClick={() => setOpen(false)}>数据说明</Link>
            <a href="https://github.com/billowssun/API-pricing" target="_blank" rel="noreferrer">
              <IconBrandGithub size={18} stroke={1.7} />
              <span>GitHub</span>
            </a>
          </nav>
          <button
            className="menu-button"
            type="button"
            aria-label={open ? '关闭菜单' : '打开菜单'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <IconX size={21} /> : <IconMenu2 size={21} />}
          </button>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div>
          <Link href="/" className="brand compact">
            <span className="brand-symbol" aria-hidden="true">MP</span>
            <span>ModelPrice</span>
          </Link>
          <p>价格用于估算，实际结算以厂商官方账单为准。</p>
        </div>
        <a href="/#about">数据来源与更新机制</a>
      </footer>
    </>
  );
}
