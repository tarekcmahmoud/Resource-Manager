'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { useColumnCount } from '@/lib/useColumnCount';
import { BUCKET, mediaPaths, TYPES, type SubType, type Submission } from '@/lib/wall/data';
import { Card, type Urls } from './Card';
import { FocusView } from './FocusView';
import { draftFrom, SubmissionForm, type Draft } from './SubmissionForm';
import s from './wall.module.css';

type Filters = { board: string; tags: string[]; type: SubType | ''; archived: boolean };
const NO_FILTERS: Filters = { board: '', tags: [], type: '', archived: false };
type Form = { existing: Submission | null; draft: Draft; files?: File[]; uploaded?: string[] };

export function Wall({ initial, initialUrls, userId, bookmarkBoards }: {
  initial: Submission[]; initialUrls: Urls; userId: string; bookmarkBoards: string[];
}) {
  const db = useMemo(() => createClient(), []);
  const [subs, setSubs] = useState(initial);
  const [urls, setUrls] = useState(initialUrls);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [panel, setPanel] = useState<'' | 'board' | 'tags'>('');
  const [order, setOrder] = useState<string[] | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const { toast, toastNode } = useToast();

  async function write(what: string, q: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await q;
    if (error) toast(`Couldn't save ${what}. ${error.message}`);
  }
  const removeFiles = (paths: string[]) => { if (paths.length) void db.storage.from(BUCKET).remove(paths); };

  /* ---------- filtering and order ---------- */
  const allTags = useMemo(() => [...new Set(subs.flatMap((x) => x.tags))].sort(), [subs]);
  const allBoards = useMemo(() => [...new Set(subs.flatMap((x) => x.boards))].sort((a, b) => a.localeCompare(b)), [subs]);
  const visible = useMemo(() => {
    const list = subs.filter((x) => (f.archived || !x.archived) && (!f.board || x.boards.includes(f.board))
      && f.tags.every((t) => x.tags.includes(t)) && (!f.type || x.type === f.type));
    if (order) {
      const pos = new Map(order.map((id, i) => [id, i]));
      return list.sort((a, b) => (pos.get(a.id) ?? -1) - (pos.get(b.id) ?? -1));
    }
    return list.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  }, [subs, f, order]);
  const filtered = !!(f.board || f.tags.length || f.type || f.archived);
  const addTagFilter = (t: string) => { setF((x) => (x.tags.includes(t) ? x : { ...x, tags: [...x.tags, t] })); toast(`Showing submissions tagged ${t}.`); };

  function randomise() {
    const ids = subs.map((x) => x.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    setOrder(ids);
    toast('Shuffled. Refresh the page to go back to newest first.');
  }

  /* ---------- masonry: each card goes to the lowest open spot; wide cards need two neighbouring columns ---------- */
  const grid = useRef<HTMLDivElement>(null);
  const { n, width, gap } = useColumnCount(grid);
  const colW = width ? (width - (n - 1) * gap) / n : 0;
  const slots = useRef(new Map<string, HTMLDivElement>());
  const placed = useRef(false);

  // Positions are written straight to the DOM: they depend on measured card heights.
  const layout = useCallback(() => {
    const el = grid.current;
    if (!el || !colW) return;
    const rowGap = parseFloat(getComputedStyle(el).rowGap) || 0;
    const h = new Array(n).fill(0);
    for (const x of visible) {
      const slot = slots.current.get(x.id);
      if (!slot) continue;
      const span = Math.min(x.span ?? 1, n);
      let col = 0, top = Infinity;
      for (let c = 0; c <= n - span; c++) {
        const t = Math.max(...h.slice(c, c + span));
        if (t < top - 0.5) { top = t; col = c; }
      }
      slot.style.transform = `translate(${col * (colW + gap)}px, ${top}px)`;
      slot.style.visibility = 'visible';
      for (let c = col; c < col + span; c++) h[c] = top + slot.offsetHeight + rowGap;
    }
    el.style.height = `${Math.max(0, Math.max(...h) - rowGap)}px`;
    // Animate moves only after the first placement, so the page doesn't fly in on load.
    if (!placed.current) requestAnimationFrame(() => el.dataset.placed = '');
    placed.current = true;
  }, [visible, n, colW, gap]);

  useLayoutEffect(layout, [layout]);
  useEffect(() => {
    // Card heights change when fonts load or text wraps differently.
    const ro = new ResizeObserver(() => layout());
    slots.current.forEach((x) => ro.observe(x));
    return () => ro.disconnect();
  }, [layout]);

  /* ---------- files dropped anywhere on the wall open the form ---------- */
  useEffect(() => {
    const over = (e: DragEvent) => { if (!form && e.dataTransfer?.types.includes('Files')) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (form || !e.dataTransfer?.files.length) return;
      e.preventDefault();
      setForm({ existing: null, draft: draftFrom(null), files: [...e.dataTransfer.files] });
    };
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => { document.removeEventListener('dragover', over); document.removeEventListener('drop', drop); };
  }, [form]);

  /* ---------- actions ---------- */
  function onSave(sub: Submission, newUrls: Urls, removed: string[]) {
    const isNew = !form?.existing;
    setUrls((u) => ({ ...u, ...newUrls }));
    setSubs((x) => (isNew ? [sub, ...x] : x.map((y) => (y.id === sub.id ? sub : y))));
    if (isNew) setOrder(null);
    setForm(null);
    toast(isNew ? 'Saved to the wall.' : 'Changes saved.');
    const { id, ...row } = sub;
    write('the submission', isNew ? db.from('submissions').insert(sub) : db.from('submissions').update(row).eq('id', id))
      .then(() => removeFiles(removed));
  }

  function onCancel(draft: Draft, uploaded: string[]) {
    const wasNew = !form?.existing;
    setForm(null);
    const dirty = draft.blocks.some((b) => (b.kind === 'images' ? b.images.length : b.kind === 'text' || b.kind === 'quote' ? b.text.trim() : b.kind === 'video' ? b.url.trim() : b.path || b.url))
      || draft.title || draft.notes || draft.tags.length;
    if (!dirty || !wasNew) { removeFiles(uploaded); return; }
    // Keep uploads around while Undo is offered, then clean up.
    const timer = setTimeout(() => removeFiles(uploaded), 8000);
    toast('Submission discarded.', 'Undo', () => { clearTimeout(timer); setForm({ existing: null, draft, uploaded }); });
  }

  function toggleArchive(sub: Submission) {
    const archived = !sub.archived;
    setSubs((x) => x.map((y) => (y.id === sub.id ? { ...y, archived } : y)));
    toast(archived ? 'Archived. Tick Show archived to find it again.' : 'Unarchived.');
    write('the change', db.from('submissions').update({ archived, updated_at: new Date().toISOString() }).eq('id', sub.id));
  }

  function setSpan(sub: Submission, span: 1 | 2 | 3) {
    setSubs((x) => x.map((y) => (y.id === sub.id ? { ...y, span } : y)));
    write('the width', db.from('submissions').update({ span, updated_at: new Date().toISOString() }).eq('id', sub.id));
  }

  function remove(sub: Submission) {
    setSubs((x) => x.filter((y) => y.id !== sub.id));
    setFocus(null);
    write('the deletion', db.from('submissions').delete().eq('id', sub.id));
    const timer = setTimeout(() => removeFiles(mediaPaths(sub.blocks)), 8000);
    toast('Deleted.', 'Undo', () => {
      clearTimeout(timer);
      setSubs((x) => [...x, sub]);
      write('the undo', db.from('submissions').insert(sub));
    });
  }

  /* ---------- render ---------- */
  const fi = focus ? visible.findIndex((x) => x.id === focus) : -1;
  const focused = focus ? subs.find((x) => x.id === focus) : undefined;

  return (
    <main className={s.page}>
      <header className={s.header}>
        <TopBar current="wall">
          <Button variant="primary" className={s.addBtn} aria-label="New submission"
            onClick={() => setForm({ existing: null, draft: draftFrom(null) })}>
            <Icon name="add" /><span>New submission</span>
          </Button>
        </TopBar>
        <div className={s.filters}>
          <div className={s.fgroup}>
            <button type="button" className={s.sel} aria-expanded={panel === 'board'} onClick={() => setPanel(panel === 'board' ? '' : 'board')}>
              <span>Board</span><b>{f.board || 'All'}</b><Icon name="chev" size={14} />
            </button>
            <button type="button" className={s.sel} aria-expanded={panel === 'tags'} onClick={() => setPanel(panel === 'tags' ? '' : 'tags')}>
              <span>Tags</span><b>{f.tags.length ? f.tags.join(', ') : 'All'}</b><Icon name="chev" size={14} />
            </button>
            <div className={s.seg} role="group" aria-label="Type">
              {[['', 'All'] as const, ...TYPES].map(([k, label]) => (
                <button key={k} type="button" aria-pressed={f.type === k} onClick={() => setF({ ...f, type: k })}>{label}</button>
              ))}
            </div>
            <label className={s.chk}><input type="checkbox" checked={f.archived} onChange={(e) => setF({ ...f, archived: e.target.checked })} />Show archived</label>
            {filtered && <button type="button" className={s.clear} onClick={() => setF(NO_FILTERS)}>Clear filters</button>}
          </div>
          <Button onClick={randomise}><Icon name="shuffle" />{order ? 'Shuffle again' : 'Randomise'}</Button>
        </div>
        {panel && (
          <div className={s.chipPanel} onKeyDown={(e) => { if (e.key === 'Escape') setPanel(''); }}>
            <span className={s.hint}>{panel === 'board' ? 'Pick one board. Pick it again to show all.' : 'Pick any number of tags. The wall shows submissions that have all of them.'}</span>
            <div className={s.chipRow} role="group" aria-label={panel === 'board' ? 'Board' : 'Tags'}>
              {panel === 'board'
                ? allBoards.map((b) => <Chip key={b} selected={f.board === b} onClick={() => setF({ ...f, board: f.board === b ? '' : b })}>{b}</Chip>)
                : allTags.map((t) => <Chip key={t} selected={f.tags.includes(t)} onClick={() => setF({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] })}>{t}</Chip>)}
              {!(panel === 'board' ? allBoards : allTags).length && <span className={s.meta}>None yet. Add them in the Extended form.</span>}
            </div>
          </div>
        )}
      </header>

      <h1 className="sr-only">Wall</h1>
      <div className={s.wall} ref={grid} aria-live="polite">
        {!visible.length ? (
          <div className={s.empty}>
            {subs.length
              ? <><strong>Nothing matches these filters</strong>Clear a filter, or add a new submission.</>
              : <><strong>The wall is empty</strong>Use New submission, or drop images anywhere on this page.</>}
          </div>
        ) : visible.map((x) => {
          const span = Math.min(x.span ?? 1, n);
          return (
            <div key={x.id} className={s.slot} style={{ width: span * colW + (span - 1) * gap || undefined }}
              ref={(el) => { if (el) slots.current.set(x.id, el); else slots.current.delete(x.id); }}>
              <Card sub={x} urls={urls} onOpen={() => setFocus(x.id)} onTag={addTagFilter} />
            </div>
          );
        })}
      </div>

      {focused && (
        <FocusView key={focused.id} sub={focused} urls={urls} hasPrev={fi > 0} hasNext={fi >= 0 && fi < visible.length - 1}
          onPrev={() => fi > 0 && setFocus(visible[fi - 1].id)} onNext={() => fi < visible.length - 1 && setFocus(visible[fi + 1].id)}
          onClose={() => setFocus(null)} onEdit={() => { setFocus(null); setForm({ existing: focused, draft: draftFrom(focused) }); }}
          onArchive={() => toggleArchive(focused)} onDelete={() => remove(focused)} onSpan={(sp) => setSpan(focused, sp)}
          onTag={(t) => { setFocus(null); addTagFilter(t); }} />
      )}
      {form && (
        <SubmissionForm db={db} userId={userId} existing={form.existing} initial={form.draft} initialFiles={form.files} initialUploads={form.uploaded}
          urls={urls} all={subs} tagOptions={allTags} boardOptions={[...new Set([...allBoards, ...bookmarkBoards])].sort()}
          onSave={onSave} onCancel={onCancel} onOpenExisting={(id) => setFocus(id)} toast={toast} />
      )}
      {toastNode}
    </main>
  );
}
