import Link from 'next/link';
import type { ReactNode } from 'react';
import { SignOut } from '@/app/SignOut';
import s from './TopBar.module.css';

/** App header: name, main navigation, page actions, sign out. */
export function TopBar({ current, children }: { current: 'wall' | 'bookmarks'; children?: ReactNode }) {
  return (
    <div className={s.top}>
      <span className={s.mark}>Resource Manager</span>
      <nav className={s.nav} aria-label="Main">
        <Link href="/wall" aria-current={current === 'wall' ? 'page' : undefined}>Wall</Link>
        <Link href="/bookmarks" aria-current={current === 'bookmarks' ? 'page' : undefined}>Bookmarks</Link>
      </nav>
      <div className={s.actions}>{children}<SignOut /></div>
    </div>
  );
}
