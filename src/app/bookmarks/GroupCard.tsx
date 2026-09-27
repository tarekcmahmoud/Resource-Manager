'use client';
import type { KeyboardEvent, PointerEvent } from 'react';
import { Frame } from '@/components/Frame';
import { Icon } from '@/components/Icon';
import type { Group, Link, Subgroup } from '@/lib/bookmarks/data';
import s from './bookmarks.module.css';

const LIMIT = 8;

type Props = {
  group: Group; subs: Subgroup[]; linksBySub: Map<string, Link[]>;
  boardName?: string; full: boolean; expanded: boolean; dragging: boolean; canDrag: boolean;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void; onGripKeyDown: (e: KeyboardEvent<HTMLElement>, id: string) => void;
  onToggleMore: () => void; onPin: () => void; onEdit: () => void; onOpenAll: () => void;
  onEditLink: (l: Link) => void; onToggleSub: (sub: Subgroup) => void;
};

export function GroupCard(p: Props) {
  const { group: g, subs } = p;
  const total = subs.reduce((n, sub) => n + (p.linksBySub.get(sub.id)?.length ?? 0), 0);
  const showAll = p.full || p.expanded;
  let shown = 0, hidden = 0;

  const body = subs.map((sub) => {
    const links = p.linksBySub.get(sub.id) ?? [];
    const named = sub.name != null;
    if (named && sub.collapsed) {
      return (
        <div key={sub.id}>
          <SubHead sub={sub} count={links.length} onToggle={() => p.onToggleSub(sub)} />
        </div>
      );
    }
    const rows = [];
    for (const l of links) {
      if (!showAll && shown >= LIMIT) { hidden++; continue; }
      shown++;
      rows.push(
        <div key={l.id} className={s.row}>
          <a href={l.url} target="_blank" rel="noopener noreferrer">
            <span className={s.fav} aria-hidden="true">{(l.name || '?').charAt(0).toUpperCase()}</span>
            <span className={s.rowText}><b>{l.name}</b>{l.note && <span>{l.note}</span>}</span>
          </a>
          <button type="button" className={s.rowEdit} onClick={() => p.onEditLink(l)} aria-label={`Edit ${l.name}`}>
            <Icon name="edit" size={14} />
          </button>
        </div>,
      );
    }
    if (!named && !rows.length) return null;
    if (named && !rows.length && links.length) return null; // cut off by the row limit
    return (
      <div key={sub.id}>
        {named && <SubHead sub={sub} count={links.length} onToggle={() => p.onToggleSub(sub)} />}
        {rows}
      </div>
    );
  });

  return (
    <Frame as="section" interactive className={[s.card, p.dragging && s.dragging].filter(Boolean).join(' ')}
      data-g={g.id} aria-labelledby={`gh-${g.id}`}>
      <div className={[s.head, p.canDrag && s.grab].filter(Boolean).join(' ')} data-ghandle={g.id} onPointerDown={p.onPointerDown}>
        {p.boardName && <span className={s.boardName}>{p.boardName}</span>}
        <div className={s.headTop}>
          {p.canDrag && (
            <button type="button" className={s.grip} data-grip onKeyDown={(e) => p.onGripKeyDown(e, g.id)}
              aria-label={`Move ${g.name}. Arrow keys move it between columns and up or down`} title="Drag to move">
              <Icon name="grip" size={16} />
            </button>
          )}
          <h2 id={`gh-${g.id}`}>{g.name}</h2>
          <button type="button" className={s.sbtn} data-icon aria-pressed={g.pinned} onClick={p.onPin}
            aria-label={`${g.pinned ? 'Unpin' : 'Pin'} ${g.name}`} title={g.pinned ? 'Pinned' : 'Pin'}>
            <Icon name="pin" size={14} />
          </button>
          <button type="button" className={s.sbtn} data-icon onClick={p.onEdit} aria-label={`Edit ${g.name}`} title="Edit group">
            <Icon name="edit" size={14} />
          </button>
        </div>
        <div className={s.meta}>
          <span>{total} bookmark{total === 1 ? '' : 's'}</span>
          <button type="button" className={s.sbtn} onClick={p.onOpenAll} disabled={!total}>
            <Icon name="ext" size={12} />Open all
          </button>
        </div>
      </div>
      {total || subs.some((x) => x.name != null) ? body : <p className={s.emptyGroup}>No bookmarks yet. Use Add bookmark to start this group.</p>}
      {!p.full && (hidden > 0 || p.expanded) && (
        <button type="button" className={s.more} onClick={p.onToggleMore} aria-expanded={p.expanded}>
          {p.expanded ? 'Show less' : `+ ${hidden} more`}
        </button>
      )}
    </Frame>
  );
}

function SubHead({ sub, count, onToggle }: { sub: Subgroup; count: number; onToggle: () => void }) {
  return (
    <button type="button" className={s.subHead} onClick={onToggle} aria-expanded={!sub.collapsed}>
      <span className={sub.collapsed ? s.chevClosed : s.chev}><Icon name="chev" size={12} /></span>
      <span>{sub.name}</span>
      {sub.collapsed && <span className={s.subCount}>{count}</span>}
    </button>
  );
}
