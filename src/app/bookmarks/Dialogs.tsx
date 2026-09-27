'use client';
import { useRef, useState, type FormEvent } from 'react';
import { fetchPageInfo } from '@/lib/pageInfo';
import { Dialog } from '@/components/Dialog';
import { Field, SelectField } from '@/components/Field';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { normUrl, type BookmarkData, type Board, type Group, type Link } from '@/lib/bookmarks/data';
import s from './bookmarks.module.css';

export const NEW = '__new';

/* ---------- link ---------- */

export type LinkDraft = {
  url: string; name: string; note: string;
  boardId: string; groupId: string; newGroup: string;
  subId: string; newSub: string; // subId '' = no sub-group
};

export function LinkDialog({ data, link, initial, onSave, onDelete, onClose }: {
  data: BookmarkData; link: Link | null; initial: LinkDraft;
  onSave: (d: LinkDraft) => void; onDelete: () => void; onClose: () => void;
}) {
  const [d, setD] = useState(initial);
  const [err, setErr] = useState('');
  const [armed, setArmed] = useState(false);
  const set = (patch: Partial<LinkDraft>) => setD((x) => ({ ...x, ...patch }));
  const [looking, setLooking] = useState(false);
  const asked = useRef('');

  /** Fills an empty name from the page's title once the link is complete. */
  function lookUp(raw: string) {
    let url = raw.trim();
    if (!url || d.name.trim() || asked.current === url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (!/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(url)) return;
    asked.current = raw.trim();
    setLooking(true);
    fetchPageInfo(url)
      .then((info) => setD((x) => (x.name.trim() || x.url.trim() !== raw.trim() ? x : { ...x, name: info.title || info.siteName })))
      .catch(() => { /* the name falls back to the site address on save */ })
      .finally(() => setLooking(false));
  }

  const groups = data.groups.filter((g) => g.board_id === d.boardId).sort((a, b) => a.name.localeCompare(b.name));
  const subs = data.subgroups.filter((x) => x.group_id === d.groupId && x.name != null);

  const n = normUrl(d.url);
  const dupe = n ? data.links.find((l) => l.id !== link?.id && normUrl(l.url) === n) : undefined;
  let dupeWhere = '';
  if (dupe) {
    const sub = data.subgroups.find((x) => x.id === dupe.subgroup_id);
    const g = data.groups.find((x) => x.id === sub?.group_id);
    const b = data.boards.find((x) => x.id === g?.board_id);
    dupeWhere = `${b?.name} › ${g?.name}`;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!d.url.trim()) return setErr('Add a link to save this bookmark.');
    if (d.groupId === NEW && !d.newGroup.trim()) return setErr('Name the new group, or pick an existing one.');
    if (d.subId === NEW && !d.newSub.trim()) return setErr('Name the new sub-group, or pick an existing one.');
    onSave(d);
  }

  return (
    <Dialog title={link ? 'Edit bookmark' : 'Add bookmark'} onClose={onClose}>
      <form className={s.form} onSubmit={submit}>
        <Field label="Link" value={d.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" inputMode="url" autoFocus
          onBlur={(e) => lookUp(e.target.value)} onPaste={(e) => { const t = e.clipboardData.getData('text'); setTimeout(() => lookUp(t), 0); }} />
        {dupe && <div className={s.dupe}>This link is already saved in {dupeWhere}.</div>}
        <Field label="Name" value={d.name} onChange={(e) => set({ name: e.target.value })}
          placeholder={looking ? 'Looking up the page title…' : 'Uses the page title if left empty'} />
        <Field label="Note" value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder="One line on why it is useful (optional)" />
        <SelectField label="Board" value={d.boardId} onChange={(e) => {
          const g = data.groups.filter((x) => x.board_id === e.target.value).sort((a, b) => a.name.localeCompare(b.name))[0];
          set({ boardId: e.target.value, groupId: g?.id ?? NEW, subId: '' });
        }}>
          {data.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </SelectField>
        <SelectField label="Group" value={d.groupId} onChange={(e) => set({ groupId: e.target.value, subId: '' })}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          <option value={NEW}>New group…</option>
        </SelectField>
        {d.groupId === NEW && <Field label="New group name" value={d.newGroup} onChange={(e) => set({ newGroup: e.target.value })} autoFocus />}
        <SelectField label="Sub-group" value={d.subId} onChange={(e) => set({ subId: e.target.value })}>
          <option value="">None</option>
          {subs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          <option value={NEW}>New sub-group…</option>
        </SelectField>
        {d.subId === NEW && <Field label="New sub-group name" value={d.newSub} onChange={(e) => set({ newSub: e.target.value })} autoFocus />}
        {err && <p className={s.err}>{err}</p>}
        <div className={s.foot}>
          <div>{link && (
            <Button variant={armed ? 'danger' : 'default'} onClick={() => (armed ? onDelete() : setArmed(true))}>
              {armed ? 'Confirm delete' : 'Delete'}
            </Button>
          )}</div>
          <div className={s.footR}>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">Save bookmark</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------- board ---------- */

export function BoardDialog({ board, counts, canDelete, onSave, onDelete, onClose }: {
  board: Board | null; counts: { groups: number; links: number }; canDelete: boolean;
  onSave: (name: string) => void; onDelete: () => void; onClose: () => void;
}) {
  const [name, setName] = useState(board?.name ?? '');
  const [err, setErr] = useState('');
  const [armed, setArmed] = useState(false);
  return (
    <Dialog title={board ? 'Edit board' : 'New board'} onClose={onClose}>
      <form className={s.form} onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return setErr('Name the board.'); onSave(name.trim()); }}>
        <Field label="Board name" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example, Making" autoFocus error={err} />
        {board && (
          <p className={s.note}>
            {counts.groups} group{counts.groups === 1 ? '' : 's'}, {counts.links} bookmark{counts.links === 1 ? '' : 's'}.
            {armed && counts.links > 0 && ' Deleting the board deletes all of them.'}
          </p>
        )}
        <div className={s.foot}>
          <div>{board && canDelete && (
            <Button variant={armed ? 'danger' : 'default'} onClick={() => (armed ? onDelete() : setArmed(true))}>
              {armed ? 'Confirm delete' : 'Delete board'}
            </Button>
          )}</div>
          <div className={s.footR}>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">{board ? 'Save' : 'Create board'}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------- group (with its sub-groups) ---------- */

export type SubDraft = { id: string; name: string; isNew: boolean; deleted: boolean };
export type GroupDraft = { name: string; boardId: string; subs: SubDraft[] };

export function GroupDialog({ group, boards, initial, linkCount, subLinkCount, onSave, onDelete, onClose }: {
  group: Group | null; boards: Board[]; initial: GroupDraft; linkCount: number; subLinkCount: (id: string) => number;
  onSave: (d: GroupDraft) => void; onDelete: () => void; onClose: () => void;
}) {
  const [d, setD] = useState(initial);
  const [err, setErr] = useState('');
  const [armed, setArmed] = useState(false);
  const [newSub, setNewSub] = useState('');
  const live = d.subs.filter((x) => !x.deleted);

  const setSub = (id: string, patch: Partial<SubDraft>) =>
    setD((x) => ({ ...x, subs: x.subs.map((y) => (y.id === id ? { ...y, ...patch } : y)) }));
  const moveSub = (id: string, dir: -1 | 1) => setD((x) => {
    const order = x.subs.filter((y) => !y.deleted), i = order.findIndex((y) => y.id === id), j = i + dir;
    if (j < 0 || j >= order.length) return x;
    [order[i], order[j]] = [order[j], order[i]];
    return { ...x, subs: [...order, ...x.subs.filter((y) => y.deleted)] };
  });
  const addSub = () => {
    const name = newSub.trim();
    if (!name) return;
    setD((x) => ({ ...x, subs: [...x.subs, { id: crypto.randomUUID(), name, isNew: true, deleted: false }] }));
    setNewSub('');
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!d.name.trim()) return setErr('Name the group.');
    if (live.some((x) => !x.name.trim())) return setErr('Give every sub-group a name, or remove it.');
    onSave({ ...d, name: d.name.trim(), subs: d.subs.map((x) => ({ ...x, name: x.name.trim() })) });
  }

  return (
    <Dialog title={group ? 'Edit group' : 'New group'} onClose={onClose}>
      <form className={s.form} onSubmit={submit}>
        <Field label="Group name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} autoFocus />
        <SelectField label="Board" value={d.boardId} onChange={(e) => setD({ ...d, boardId: e.target.value })}>
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </SelectField>

        <div className={s.subEditor}>
          <span className={s.label}>Sub-groups</span>
          {live.length === 0 && <p className={s.note}>None yet. Links without a sub-group sit at the top of the group.</p>}
          <ol className={s.subList}>
            {live.map((x, i) => (
              <li key={x.id}>
                <input className={s.subInput} value={x.name} aria-label={`Sub-group ${i + 1} name`}
                  onChange={(e) => setSub(x.id, { name: e.target.value })} />
                <button type="button" className={s.sbtn} data-icon onClick={() => moveSub(x.id, -1)} disabled={i === 0} aria-label={`Move ${x.name} up`}><Icon name="up" size={14} /></button>
                <button type="button" className={s.sbtn} data-icon onClick={() => moveSub(x.id, 1)} disabled={i === live.length - 1} aria-label={`Move ${x.name} down`}><Icon name="down" size={14} /></button>
                <button type="button" className={s.sbtn} data-icon onClick={() => setSub(x.id, { deleted: true })} aria-label={`Remove ${x.name}`}
                  title={!x.isNew && subLinkCount(x.id) ? 'Its links move to the top of the group' : 'Remove'}><Icon name="x" size={14} /></button>
              </li>
            ))}
          </ol>
          <div className={s.subAdd}>
            <input className={s.subInput} value={newSub} placeholder="New sub-group" aria-label="New sub-group name"
              onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} />
            <Button size="sm" onClick={addSub}><Icon name="add" size={14} />Add</Button>
          </div>
          {d.subs.some((x) => x.deleted && !x.isNew && subLinkCount(x.id)) && (
            <p className={s.note}>Links in removed sub-groups move to the top of the group.</p>
          )}
        </div>

        {group && armed && linkCount > 0 && <p className={s.note}>Deleting the group deletes its {linkCount} bookmark{linkCount === 1 ? '' : 's'}.</p>}
        {err && <p className={s.err}>{err}</p>}
        <div className={s.foot}>
          <div>{group && (
            <Button variant={armed ? 'danger' : 'default'} onClick={() => (armed ? onDelete() : setArmed(true))}>
              {armed ? 'Confirm delete' : 'Delete group'}
            </Button>
          )}</div>
          <div className={s.footR}>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">{group ? 'Save' : 'Create group'}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
