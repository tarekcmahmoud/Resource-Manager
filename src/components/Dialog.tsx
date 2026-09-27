'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Frame } from './Frame';
import { Icon } from './Icon';
import s from './Dialog.module.css';

/**
 * Full-screen modal layer on the veil. Uses the native <dialog> for focus trapping,
 * Escape and returning focus. Clicking the veil closes it. Render it only while open.
 */
export function Overlay({ label, onClose, children, onKeyDown }: {
  label: string; onClose: () => void; children: ReactNode; onKeyDown?: (e: React.KeyboardEvent<HTMLDialogElement>) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current!.showModal();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <dialog ref={ref} className={s.dialog} aria-label={label} onKeyDown={onKeyDown}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}>
      {children}
    </dialog>
  );
}

/** Titled panel inside an Overlay, for forms. */
export function Dialog({ title, onClose, children, footer, wide, actions }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; actions?: ReactNode;
}) {
  return (
    <Overlay label={title} onClose={onClose}>
      <Frame className={[s.panel, wide && s.wide].filter(Boolean).join(' ')}>
        <div className={s.head}>
          <h2 className={s.title}>{title}</h2>
          <div className={s.actions}>
            {actions}
            <button type="button" className={s.close} onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
          </div>
        </div>
        <div className={s.body}>{children}</div>
        {footer && <div className={s.foot}>{footer}</div>}
      </Frame>
    </Overlay>
  );
}
