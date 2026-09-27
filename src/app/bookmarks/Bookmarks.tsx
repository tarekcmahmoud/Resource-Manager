'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { hostOf, loadAll, type BookmarkData, type Group, type Link, type Subgroup } from '@/lib/bookmarks/data';
import { applyColumns, slot, toColumns, type LayoutKey } from '@/lib/bookmarks/layout';
import { GroupCard } from './GroupCard';
import { BoardDialog, GroupDialog, LinkDialog, NEW, type GroupDraft, type LinkDraft } from './Dialogs';
import { useGroupDrag } from './useGroupDrag';
import { useColumnCount } from '@/lib/useColumnCount';
import s from './bookmarks.module.css';

const PINNED = 'pinned';
const TAB_KEY = 'rm.bookmarks.tab';

type Open =
  | { kind: 'link'; link: Link | null; draft: LinkDraft }
  | { kind: 'board'; boardId: string | null }
  | { kind: 'group'; group: Group | null; draft: GroupDraft };

type Result = { error: { message: string } | null };
/** Throws if a Supabase write failed, so one catch handles a chain of writes. */
async function must(q: PromiseLike<Result>) {
  const { error } = await q;
  if (error) throw new Error(error.message);
}
const maxPos = (xs: { position: number }[]) => xs.reduce((m, x) => Math.max(m, x.position), -1);
const uuid = () => crypto.randomUUID();

export function Bookmarks({ initial }: { initial: BookmarkData }) {
  const db = useMemo(() => createClient(), []);
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<string>(() => (initial.groups.some((g) => g.pinned) ? PINNED : initial.boards[0]?.id ?? PINNED));
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Open | null>(null);
  const { toast, toastNode } = useToast();

  // Remember the last tab on this device.
  useEffect(() => {
    try {
      const t = localStorage.getItem(TAB_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable after hydration
      if (t && (t === PINNED || initial.boards.some((b) => b.id === t))) setTab(t);
    } catch { /* storage blocked: start on the default tab */ }
  }, [initial.boards]);
  const selectTab = (t: string) => {
    setTab(t); setFilter('all');
    try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ }
  };

  /** Runs a chain of writes; on failure says so and reloads the real state from the database. */
  const persist = useCallback(async (what: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) {
      toast(`Couldn't save ${what}. ${(e as Error).message}`);
      try { setData(await loadAll(db)); } catch { /* keep local state */ }
    }
  }, [db, toast]);

  /* ---------- derived ---------- */
  const board = data.boards.find((b) => b.id === tab);
  const key: LayoutKey = tab === PINNED ? 'pinned' : 'board';
  const boardGroups = useMemo(() => (tab === PINNED ? data.groups.filter((g) => g.pinned) : data.groups.filter((g) => g.board_id === tab)), [data.groups, tab]);
  const visible = useMemo(() => boardGroups.filter((g) => filter === 'all' || (filter === PINNED ? g.pinned : g.id === filter)), [boardGroups, filter]);
  const canDrag = filter === 'all';

  const subsByGroup = useMemo(() => {
    const m = new Map<string, Subgroup[]>();
    for (const x of data.subgroups) m.set(x.group_id, [...(m.get(x.group_id) ?? []), x]);
    // Links without a sub-group come first, then named sub-groups in their order.
    for (const [k, v] of m) m.set(k, [...v.filter((x) => x.name == null), ...v.filter((x) => x.name != null)]);
    return m;
  }, [data.subgroups]);
  const linksBySub = useMemo(() => {
    const m = new Map<string, Link[]>();
    for (const l of data.links) m.set(l.subgroup_id, [...(m.get(l.subgroup_id) ?? []), l]);
    return m;
  }, [data.links]);
  const groupLinks = useCallback((gid: string) => (subsByGroup.get(gid) ?? []).flatMap((x) => linksBySub.get(x.id) ?? []), [subsByGroup, linksBySub]);
  const boardLinkCount = (bid: string) => data.groups.filter((g) => g.board_id === bid).reduce((n, g) => n + groupLinks(g.id).length, 0);

  /* ---------- columns ---------- */
  const grid = useRef<HTMLDivElement>(null);
  const n = useColumnCount(grid);
  const est = useCallback((g: Group) => {
    const subs = subsByGroup.get(g.id) ?? [];
    return 96 + 36 * Math.min(LIMIT_EST, groupLinks(g.id).length) + 28 * subs.filter((x) => x.name != null).length;
  }, [subsByGroup, groupLinks]);
  const cols = useMemo(() => toColumns(visible, n, key, est), [visible, n, key, est]);

  // Groups without a stored column get placed once, then keep that spot.
  useEffect(() => {
    if (!canDrag || !visible.some((g) => slot(g, key).col == null)) return;
    commitLayout(applyColumns(data.groups, cols, key));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols]);

  /** Saves the col/position of every group whose slot changed. */
  const committed = useRef(data.groups);
  useEffect(() => { committed.current = data.groups; }, [data.groups]);
  const pending = useRef<Group[] | null>(null);
  function commitLayout(next: Group[]) {
    const before = new Map(committed.current.map((g) => [g.id, g]));
    const changed = next.filter((g) => {
      const b = before.get(g.id);
      return b && (b.col !== g.col || b.position !== g.position || b.pin_col !== g.pin_col || b.pin_position !== g.pin_position);
    });
    setData((d) => ({ ...d, groups: next }));
    committed.current = next;
    if (!changed.length) return;
    persist('the layout', async () => {
      await Promise.all(changed.map((g) => must(db.from('bm_groups')
        .update({ col: g.col, position: g.position, pin_col: g.pin_col, pin_position: g.pin_position }).eq('id', g.id))));
    });
  }

  const { dragId, onPointerDown, onGripKeyDown } = useGroupDrag({
    grid, cols, enabled: canDrag, ghostClass: s.ghost, landClass: s.land,
    onMove: (next) => {
      const groups = applyColumns(pending.current ?? data.groups, next, key);
      pending.current = groups;
      setData((d) => ({ ...d, groups }));
    },
    onDrop: () => {
      if (pending.current) commitLayout(pending.current);
      pending.current = null;
    },
  });

  /* ---------- group actions ---------- */
  function togglePin(g: Group) {
    const pinned = !g.pinned;
    const pinPos = maxPos(data.groups.filter((x) => x.pinned).map((x) => ({ position: x.pin_position }))) + 1;
    const patch = pinned ? { pinned, pin_col: null, pin_position: pinPos } : { pinned };
    setData((d) => ({ ...d, groups: d.groups.map((x) => (x.id === g.id ? { ...x, ...patch } : x)) }));
    toast(pinned ? `Pinned ${g.name}.` : `Unpinned ${g.name}.`);
    persist('the pin', () => must(db.from('bm_groups').update(patch).eq('id', g.id)));
  }

  function toggleSub(sub: Subgroup) {
    const collapsed = !sub.collapsed;
    setData((d) => ({ ...d, subgroups: d.subgroups.map((x) => (x.id === sub.id ? { ...x, collapsed } : x)) }));
    persist('the sub-group', () => must(db.from('bm_subgroups').update({ collapsed }).eq('id', sub.id)));
  }

  function openAll(g: Group) {
    const urls = groupLinks(g.id).map((l) => l.url);
    let ok = 0;
    for (const u of urls) {
      const w = window.open(u, '_blank');
      if (w) { w.opener = null; ok++; }
    }
    toast(ok === urls.length ? `Opened ${ok} tabs.` : `Opened ${ok} of ${urls.length} tabs. Allow pop-ups for this site to open them all at once.`);
  }

  /* ---------- link dialog ---------- */
  function openLink(link: Link | null, groupId?: string) {
    let gid = groupId ?? (filter !== 'all' && filter !== PINNED ? filter : visible[0]?.id);
    let subId = '';
    if (link) {
      const sub = data.subgroups.find((x) => x.id === link.subgroup_id)!;
      gid = sub.group_id; subId = sub.name != null ? sub.id : '';
    }
    const g = data.groups.find((x) => x.id === gid);
    const boardId = g?.board_id ?? board?.id ?? data.boards[0].id;
    setOpen({ kind: 'link', link, draft: {
      url: link?.url ?? '', name: link?.name ?? '', note: link?.note ?? '',
      boardId, groupId: g?.id ?? NEW, newGroup: '', subId, newSub: '',
    } });
  }

  function saveLink(link: Link | null, d: LinkDraft) {
    let url = d.url.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const cur = data;
    const inserts: { groups: Group[]; subs: Subgroup[] } = { groups: [], subs: [] };

    let gid = d.groupId;
    if (gid === NEW) {
      const g: Group = { id: uuid(), board_id: d.boardId, name: d.newGroup.trim(), pinned: false,
        col: null, position: maxPos(cur.groups.filter((x) => x.board_id === d.boardId)) + 1, pin_col: null, pin_position: 0 };
      inserts.groups.push(g); gid = g.id;
    }
    const gSubs = cur.subgroups.filter((x) => x.group_id === gid);
    let sid = d.subId;
    if (sid === NEW) {
      const x: Subgroup = { id: uuid(), group_id: gid, name: d.newSub.trim(), position: maxPos(gSubs) + 1, collapsed: false };
      inserts.subs.push(x); sid = x.id;
    } else if (sid === '') {
      const top = gSubs.find((x) => x.name == null);
      if (top) sid = top.id;
      else {
        const x: Subgroup = { id: uuid(), group_id: gid, name: null, position: -1, collapsed: false };
        inserts.subs.push(x); sid = x.id;
      }
    }
    const sameSub = link?.subgroup_id === sid;
    const row: Link = {
      id: link?.id ?? uuid(), subgroup_id: sid, url, note: d.note.trim(),
      name: d.name.trim() || hostOf(url) || url,
      position: sameSub ? link!.position : maxPos(cur.links.filter((l) => l.subgroup_id === sid)) + 1,
    };

    setData((x) => ({
      ...x,
      groups: [...x.groups, ...inserts.groups],
      subgroups: [...x.subgroups, ...inserts.subs],
      links: link ? x.links.map((l) => (l.id === row.id ? row : l)) : [...x.links, row],
    }));
    setOpen(null);
    const g = [...cur.groups, ...inserts.groups].find((x) => x.id === gid)!;
    const b = cur.boards.find((x) => x.id === g.board_id)!;
    if (tab !== PINNED && tab !== b.id) selectTab(b.id);
    toast(`${link ? 'Saved changes to' : 'Added'} ${row.name} to ${b.name} › ${g.name}.`);

    persist('the bookmark', async () => {
      for (const x of inserts.groups) await must(db.from('bm_groups').insert(x));
      for (const x of inserts.subs) await must(db.from('bm_subgroups').insert(x));
      if (link) await must(db.from('bm_links').update(row).eq('id', row.id));
      else await must(db.from('bm_links').insert(row));
    });
  }

  function deleteLink(link: Link) {
    setData((x) => ({ ...x, links: x.links.filter((l) => l.id !== link.id) }));
    setOpen(null);
    persist('the deletion', () => must(db.from('bm_links').delete().eq('id', link.id)));
    toast(`Deleted ${link.name}.`, 'Undo', () => {
      setData((x) => ({ ...x, links: [...x.links, link].sort((a, b) => a.position - b.position) }));
      persist('the undo', () => must(db.from('bm_links').insert(link)));
    });
  }

  /* ---------- board dialog ---------- */
  function saveBoard(id: string | null, name: string) {
    setOpen(null);
    if (id) {
      setData((x) => ({ ...x, boards: x.boards.map((b) => (b.id === id ? { ...b, name } : b)) }));
      toast(`Renamed to ${name}.`);
      persist('the board', () => must(db.from('bm_boards').update({ name }).eq('id', id)));
      return;
    }
    const b = { id: uuid(), name, position: maxPos(data.boards) + 1 };
    setData((x) => ({ ...x, boards: [...x.boards, b] }));
    selectTab(b.id);
    toast(`Created ${name}.`);
    persist('the board', () => must(db.from('bm_boards').insert(b)));
  }

  function deleteBoard(id: string) {
    const i = data.boards.findIndex((b) => b.id === id), b = data.boards[i];
    const gids = new Set(data.groups.filter((g) => g.board_id === id).map((g) => g.id));
    const sids = new Set(data.subgroups.filter((x) => gids.has(x.group_id)).map((x) => x.id));
    setData((x) => ({
      boards: x.boards.filter((y) => y.id !== id), groups: x.groups.filter((g) => !gids.has(g.id)),
      subgroups: x.subgroups.filter((y) => !sids.has(y.id)), links: x.links.filter((l) => !sids.has(l.subgroup_id)),
    }));
    setOpen(null);
    const rest = data.boards.filter((y) => y.id !== id);
    selectTab(rest[Math.max(0, i - 1)]?.id ?? PINNED);
    toast(`Deleted ${b.name}.`);
    persist('the deletion', () => must(db.from('bm_boards').delete().eq('id', id)));
  }

  /* ---------- group dialog ---------- */
  function openGroup(g: Group | null) {
    const subs = g ? (subsByGroup.get(g.id) ?? []).filter((x) => x.name != null) : [];
    setOpen({ kind: 'group', group: g, draft: {
      name: g?.name ?? '', boardId: g?.board_id ?? board?.id ?? data.boards[0].id,
      subs: subs.map((x) => ({ id: x.id, name: x.name!, isNew: false, deleted: false })),
    } });
  }

  function saveGroup(g: Group | null, d: GroupDraft) {
    setOpen(null);
    const cur = data;
    const gid = g?.id ?? uuid();
    const moved = !g || g.board_id !== d.boardId;
    const group: Group = {
      ...(g ?? { pinned: false, pin_col: null, pin_position: 0 }),
      id: gid, name: d.name, board_id: d.boardId,
      col: moved ? null : g!.col,
      position: moved ? maxPos(cur.groups.filter((x) => x.board_id === d.boardId)) + 1 : g!.position,
    };

    const existing = cur.subgroups.filter((x) => x.group_id === gid);
    const live = d.subs.filter((x) => !x.deleted);
    const nextSubs: Subgroup[] = live.map((x, i) => ({
      id: x.id, group_id: gid, name: x.name, position: i,
      collapsed: existing.find((y) => y.id === x.id)?.collapsed ?? false,
    }));
    const removed = d.subs.filter((x) => x.deleted && !x.isNew).map((x) => x.id);
    const orphanLinks = cur.links.filter((l) => removed.includes(l.subgroup_id));
    let top = existing.find((x) => x.name == null);
    const newTop = !top && orphanLinks.length > 0;
    if (newTop) top = { id: uuid(), group_id: gid, name: null, position: -1, collapsed: false };
    const topStart = top ? maxPos(cur.links.filter((l) => l.subgroup_id === top!.id)) + 1 : 0;
    const rehomed = orphanLinks.map((l, i) => ({ ...l, subgroup_id: top!.id, position: topStart + i }));

    setData((x) => ({
      ...x,
      groups: g ? x.groups.map((y) => (y.id === gid ? group : y)) : [...x.groups, group],
      subgroups: [
        ...x.subgroups.filter((y) => y.group_id !== gid || y.name == null),
        ...(newTop ? [top!] : []), ...nextSubs,
      ],
      links: x.links.map((l) => rehomed.find((r) => r.id === l.id) ?? l),
    }));
    if (moved && g && tab !== PINNED) selectTab(d.boardId);
    toast(g ? `Saved ${d.name}.` : `Created ${d.name}.`);

    persist('the group', async () => {
      if (g) await must(db.from('bm_groups').update({ name: group.name, board_id: group.board_id, col: group.col, position: group.position }).eq('id', gid));
      else await must(db.from('bm_groups').insert(group));
      if (newTop) await must(db.from('bm_subgroups').insert(top!));
      for (const l of rehomed) await must(db.from('bm_links').update({ subgroup_id: l.subgroup_id, position: l.position }).eq('id', l.id));
      if (removed.length) await must(db.from('bm_subgroups').delete().in('id', removed));
      for (const x of nextSubs) {
        const was = existing.find((y) => y.id === x.id);
        if (!was) await must(db.from('bm_subgroups').insert(x));
        else if (was.name !== x.name || was.position !== x.position) await must(db.from('bm_subgroups').update({ name: x.name, position: x.position }).eq('id', x.id));
      }
    });
  }

  function deleteGroup(g: Group) {
    const sids = new Set(data.subgroups.filter((x) => x.group_id === g.id).map((x) => x.id));
    setData((x) => ({
      ...x, groups: x.groups.filter((y) => y.id !== g.id),
      subgroups: x.subgroups.filter((y) => !sids.has(y.id)), links: x.links.filter((l) => !sids.has(l.subgroup_id)),
    }));
    if (filter === g.id) setFilter('all');
    setOpen(null);
    toast(`Deleted ${g.name}.`);
    persist('the deletion', () => must(db.from('bm_groups').delete().eq('id', g.id)));
  }

  /* ---------- render ---------- */
  const pinnedCount = data.groups.filter((g) => g.pinned).length;
  const boardName = (id: string) => data.boards.find((b) => b.id === id)?.name;
  const single = filter !== 'all' && filter !== PINNED;

  let empty = '';
  if (!visible.length) {
    if (tab === PINNED) empty = 'No pinned groups yet|Use the pin on any group to keep it here, next to pins from your other boards.';
    else if (boardGroups.length) empty = `No pinned groups on ${board?.name}|Use the pin on a group to keep it here.`;
    else empty = `${board?.name} has no groups yet|Use New group or Add bookmark to start one.`;
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <TopBar current="bookmarks">
          <Button variant="primary" onClick={() => openLink(null)} aria-label="Add bookmark" className={s.addBtn}>
            <Icon name="add" /><span>Add bookmark</span>
          </Button>
        </TopBar>

        <div className={s.tabs} role="tablist" aria-label="Boards" onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          const ids = [PINNED, ...data.boards.map((b) => b.id)], i = ids.indexOf(tab), j = i + (e.key === 'ArrowRight' ? 1 : -1);
          if (j < 0 || j >= ids.length) return;
          selectTab(ids[j]);
          requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-tab="${ids[j]}"]`)?.focus());
        }}>
          <button type="button" role="tab" className={s.tab} data-tab={PINNED} aria-selected={tab === PINNED} tabIndex={tab === PINNED ? 0 : -1} onClick={() => selectTab(PINNED)}>
            <Icon name="pin" size={14} />Pinned<small>{pinnedCount}</small>
          </button>
          <span className={s.tabSep} aria-hidden="true" />
          {data.boards.map((b) => (
            <span key={b.id} className={s.tabWrap}>
              <button type="button" role="tab" className={s.tab} data-tab={b.id} aria-selected={tab === b.id} tabIndex={tab === b.id ? 0 : -1} onClick={() => selectTab(b.id)}>
                {b.name}<small>{boardLinkCount(b.id)}</small>
              </button>
              {tab === b.id && (
                <button type="button" className={s.sbtn} data-icon onClick={() => setOpen({ kind: 'board', boardId: b.id })} aria-label={`Rename or delete ${b.name}`} title="Edit board">
                  <Icon name="edit" size={14} />
                </button>
              )}
            </span>
          ))}
          <button type="button" className={`${s.tab} ${s.tabAdd}`} onClick={() => setOpen({ kind: 'board', boardId: null })}>
            <Icon name="add" size={14} />New board
          </button>
        </div>

        {tab !== PINNED && (
          <div className={s.chips} role="group" aria-label="Show groups">
            <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>All groups</Chip>
            <Chip selected={filter === PINNED} onClick={() => setFilter(filter === PINNED ? 'all' : PINNED)}>Pinned</Chip>
            {boardGroups.slice().sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
              <Chip key={g.id} selected={filter === g.id} onClick={() => setFilter(filter === g.id ? 'all' : g.id)}>{g.name}</Chip>
            ))}
            <Button size="sm" variant="ghost" onClick={() => openGroup(null)} className={s.newGroup}><Icon name="add" size={14} />New group</Button>
          </div>
        )}
      </header>

      <h1 className="sr-only">Bookmarks{board ? `: ${board.name}` : ': pinned'}</h1>
      <div className={s.grid} ref={grid}>
        {empty ? (
          <div className={s.empty}><strong>{empty.split('|')[0]}</strong>{empty.split('|')[1]}</div>
        ) : cols.map((c, ci) => (
          <div key={ci} className={s.col} data-col={ci}>
            {c.map((id) => {
              const g = data.groups.find((x) => x.id === id)!;
              return (
                <GroupCard key={id} group={g} subs={subsByGroup.get(id) ?? []} linksBySub={linksBySub}
                  boardName={tab === PINNED ? boardName(g.board_id) : undefined}
                  full={single} expanded={!!expanded[id]} dragging={dragId === id} canDrag={canDrag}
                  onPointerDown={onPointerDown} onGripKeyDown={onGripKeyDown}
                  onToggleMore={() => setExpanded((x) => ({ ...x, [id]: !x[id] }))}
                  onPin={() => togglePin(g)} onEdit={() => openGroup(g)} onOpenAll={() => openAll(g)}
                  onEditLink={(l) => openLink(l)} onToggleSub={toggleSub} />
              );
            })}
          </div>
        ))}
      </div>

      {open?.kind === 'link' && (
        <LinkDialog data={data} link={open.link} initial={open.draft} onClose={() => setOpen(null)}
          onSave={(d) => saveLink(open.link, d)} onDelete={() => deleteLink(open.link!)} />
      )}
      {open?.kind === 'board' && (
        <BoardDialog board={data.boards.find((b) => b.id === open.boardId) ?? null}
          counts={{ groups: data.groups.filter((g) => g.board_id === open.boardId).length, links: open.boardId ? boardLinkCount(open.boardId) : 0 }}
          canDelete={data.boards.length > 1} onClose={() => setOpen(null)}
          onSave={(name) => saveBoard(open.boardId, name)} onDelete={() => deleteBoard(open.boardId!)} />
      )}
      {open?.kind === 'group' && (
        <GroupDialog group={open.group} boards={data.boards} initial={open.draft}
          linkCount={open.group ? groupLinks(open.group.id).length : 0}
          subLinkCount={(id) => linksBySub.get(id)?.length ?? 0}
          onClose={() => setOpen(null)} onSave={(d) => saveGroup(open.group, d)} onDelete={() => deleteGroup(open.group!)} />
      )}
      {toastNode}
    </main>
  );
}

const LIMIT_EST = 8;
