import Link from 'next/link';
import type { ReactNode } from 'react';
import { SignOut } from '@/app/SignOut';
import s from './TopBar.module.css';

/** App header: name, main navigation, page actions, sign out. */
export function TopBar({ current, children, signedIn = true }: { current: 'wall' | 'bookmarks' | 'dev'; children?: ReactNode; signedIn?: boolean }) {
  return (
    <div className={s.top}>
      <span className={s.mark}>Resource Manager</span>
      <nav className={s.nav} aria-label="Main">
        <Link href="/wall" aria-current={current === 'wall' ? 'page' : undefined}>Wall</Link>
        <Link href="/bookmarks" aria-current={current === 'bookmarks' ? 'page' : undefined}>Bookmarks</Link>
        <Link href="/dev" aria-current={current === 'dev' ? 'page' : undefined}>Dev</Link>
      </nav>
      <div className={s.actions}>{children}{signedIn ? <SignOut /> : <Link href="/login" className={s.signIn}>Sign in</Link>}</div>
    </div>
  );
}
