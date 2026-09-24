import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon';
import s from './Chip.module.css';

/** Toggle chip used for filters and tag picking. */
export function Chip({ selected, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button type="button" aria-pressed={!!selected} className={[s.chip, selected && s.on, className].filter(Boolean).join(' ')} {...rest}>
      {children}
      <span className={s.check}><Icon name="check" size={11} stroke={2.4} /></span>
    </button>
  );
}
