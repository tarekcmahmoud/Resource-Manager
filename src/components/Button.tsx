import type { ButtonHTMLAttributes } from 'react';
import s from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  iconOnly?: boolean;
};

export function Button({ variant = 'default', size = 'md', iconOnly, className = '', type = 'button', ...rest }: Props) {
  const cls = [s.btn, variant !== 'default' && s[variant], size === 'sm' && s.sm, iconOnly && s.icon,
    rest['aria-pressed'] === true && s.pressed, className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest} />;
}
