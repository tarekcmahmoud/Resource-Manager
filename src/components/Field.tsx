import type { InputHTMLAttributes } from 'react';
import s from './Field.module.css';

export function Field({ label, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className={s.field}>
      {label}
      <input className={s.input} {...rest} />
      {error && <span className={s.error}>{error}</span>}
    </label>
  );
}
