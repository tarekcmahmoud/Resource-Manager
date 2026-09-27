'use client';
import { useCallback, useRef, useState } from 'react';
import s from './Toast.module.css';

type T = { msg: string; action?: string; onAction?: () => void };

/** Short status message at the bottom of the screen, with an optional action such as Undo. */
export function useToast() {
  const [t, setT] = useState<T | null>(null);
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((msg: string, action?: string, onAction?: () => void) => {
    setT({ msg, action, onAction }); setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), action ? 7000 : 3500);
  }, []);
  const node = (
    <div className={[s.toast, on && s.on].filter(Boolean).join(' ')} role="status" aria-live="polite">
      <span>{t?.msg}</span>
      {on && t?.action && (
        <button type="button" onClick={() => { t.onAction?.(); setOn(false); }}>{t.action}</button>
      )}
    </div>
  );
  return { toast: show, toastNode: node };
}
