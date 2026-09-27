'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Frame } from './Frame';
import { Icon } from './Icon';
import s from './Dialog.module.css';

/**
 * Modal panel on the veil. Uses the native <dialog> for focus trapping, Escape and
 * returning focus. Render it only while open.
 */
export function Dialog({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <dialog ref={ref} className={s.dialog} aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}>
      <Frame className={s.panel}>
        <div className={s.head}>
          <h2 className={s.title}>{title}</h2>
          <button type="button" className={s.close} onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className={s.body}>{children}</div>
        {footer && <div className={s.foot}>{footer}</div>}
      </Frame>
    </dialog>
  );
}
