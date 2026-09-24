import type { ReactNode } from 'react';
import s from './Pill.module.css';

/** Circle that expands to show its label on hover (tags, source link). */
export function Pill({ icon, label, expanded, href, onClick }: { icon: ReactNode; label?: string; expanded?: boolean; href?: string; onClick?: () => void }) {
  const cls = [s.pill, expanded && s.expanded].filter(Boolean).join(' ');
  const inner = <><span className={s.ic}>{icon}</span>{label && <span className={s.lb}>{label}</span>}</>;
  if (href) return <a className={cls} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>{inner}</a>;
  return <button type="button" className={cls} onClick={onClick} aria-label={label}>{inner}</button>;
}
