import type { ElementType, ReactNode, HTMLAttributes } from 'react';
import { Icon } from './Icon';
import s from './Frame.module.css';

/** A surface with the four corner crosses. Crosses turn accent on hover when interactive. */
export function Frame({ as: Tag = 'div', interactive, active, className = '', children, ...rest }:
  { as?: ElementType; interactive?: boolean; active?: boolean; className?: string; children?: ReactNode } & HTMLAttributes<HTMLElement>) {
  const cls = [s.frame, interactive && s.interactive, active && s.active, className].filter(Boolean).join(' ');
  return (
    <Tag className={cls} {...rest}>
      {(['tl', 'tr', 'bl', 'br'] as const).map((p) => (
        <span key={p} className={`${s.cross} ${s[p]}`} aria-hidden="true"><Icon name="plus" size={24} stroke={1} /></span>
      ))}
      {children}
    </Tag>
  );
}
