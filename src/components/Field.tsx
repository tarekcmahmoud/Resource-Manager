import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
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

export function SelectField({ label, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={s.field}>
      {label}
      <select className={`${s.input} ${s.select}`} {...rest}>{children}</select>
    </label>
  );
}
