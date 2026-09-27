'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { moveInColumns } from '@/lib/bookmarks/layout';

type Drag = {
  id: string; x: number; y: number; on: boolean; last: string;
  cx: number; cy: number; ox: number; oy: number; l0: number; t0: number;
  gx: number; gy: number; svx: number; sp: number; rot: number; rv: number; sc: number;
  ghost?: HTMLElement; raf: number;
};

/**
 * Drag groups between columns. The picked-up card is cloned into a floating ghost that
 * trails the cursor, tilts with its speed and springs back upright; the other cards
 * slide into place (FLIP). The page scrolls near the top and bottom edges. The grip
 * button also moves its group with the arrow keys.
 *
 * Cards need data-g="<id>", columns data-col, and the drag handle data-ghandle="<id>".
 */
export function useGroupDrag({ grid, cols, enabled, ghostClass, landClass, onMove, onDrop }: {
  grid: RefObject<HTMLElement | null>; cols: string[][]; enabled: boolean; ghostClass: string; landClass: string;
  onMove: (cols: string[][]) => void; onDrop: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const flipFrom = useRef<Map<string, DOMRect> | null>(null);
  const latest = useRef({ cols, onMove, onDrop });
  useEffect(() => { latest.current = { cols, onMove, onDrop }; });

  const cards = () => [...(grid.current?.querySelectorAll<HTMLElement>('[data-g]') ?? [])];

  /** Records card positions, then applies the new arrangement; the layout effect animates the difference. */
  const move = useRef((next: string[][]) => {
    flipFrom.current = new Map(cards().map((c) => [c.dataset.g!, c.getBoundingClientRect()]));
    latest.current.onMove(next);
  });

  useLayoutEffect(() => {
    const from = flipFrom.current;
    if (!from) return;
    flipFrom.current = null;
    for (const c of cards()) {
      const f = from.get(c.dataset.g!);
      if (!f) continue;
      const r = c.getBoundingClientRect(), dx = f.left - r.left, dy = f.top - r.top;
      if (!dx && !dy) continue;
      c.style.transition = 'none';
      c.style.transform = `translate(${dx}px,${dy}px)`;
      void c.offsetWidth;
      c.style.transition = 'transform var(--dur-base) var(--ease)';
      c.style.transform = '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols]);

  useEffect(() => {
    /** Works out which column and slot the cursor is over, and moves the group there. */
    function retarget() {
      const d = drag.current;
      if (!d || !grid.current) return;
      const colEls = [...grid.current.querySelectorAll<HTMLElement>('[data-col]')];
      if (!colEls.length) return;
      let ci = 0, best = Infinity;
      colEls.forEach((k, i) => {
        const r = k.getBoundingClientRect();
        const dist = d.cx < r.left ? r.left - d.cx : d.cx > r.right ? d.cx - r.right : 0;
        if (dist < best) { best = dist; ci = i; }
      });
      const inCol = [...colEls[ci].querySelectorAll<HTMLElement>('[data-g]')].filter((c) => c.dataset.g !== d.id);
      let before: string | null = null;
      for (const c of inCol) {
        const r = c.getBoundingClientRect();
        if (d.cy < r.top + r.height / 2) { before = c.dataset.g!; break; }
      }
      const key = `${ci}:${before}`;
      if (key === d.last) return;
      d.last = key;
      move.current(moveInColumns(latest.current.cols, d.id, ci, before));
    }

    function tick() {
      const d = drag.current;
      if (!d || !d.on) return;
      // The ghost eases toward the cursor; tilt follows its smoothed horizontal speed and springs back.
      const tx = d.cx - d.ox, ty = d.cy - d.oy;
      const nx = d.gx + (tx - d.gx) * 0.3, ny = d.gy + (ty - d.gy) * 0.3, dx = nx - d.gx, dy = ny - d.gy;
      d.gx = nx; d.gy = ny;
      d.svx += (dx - d.svx) * 0.2;
      d.sp += (Math.min(1, Math.hypot(dx, dy) / 25) - d.sp) * 0.12;
      const target = Math.max(-9, Math.min(9, d.svx * 0.7));
      d.rv += (target - d.rot) * 0.08; d.rv *= 0.8; d.rot += d.rv;
      d.sc += ((1.03 + d.sp * 0.015) - d.sc) * 0.15;
      if (d.ghost) d.ghost.style.transform =
        `translate3d(${(d.gx - d.l0).toFixed(2)}px,${(d.gy - d.t0).toFixed(2)}px,0) rotate(${d.rot.toFixed(3)}deg) scale(${d.sc.toFixed(4)})`;
      // Scroll the page when the cursor is near the top or bottom edge.
      const h = window.innerHeight, zone = 90;
      let v = 0;
      if (d.cy > h - zone) v = Math.min(24, (d.cy - (h - zone)) / 3);
      else if (d.cy < zone + 64) v = -Math.min(24, (zone + 64 - d.cy) / 3);
      if (v) {
        const before = window.scrollY;
        window.scrollBy(0, v);
        if (window.scrollY !== before) retarget();
      }
      d.raf = requestAnimationFrame(tick);
    }

    function onPointerMove(e: globalThis.PointerEvent) {
      const d = drag.current;
      if (!d) return;
      if (!d.on) {
        if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 6) return;
        const src = grid.current?.querySelector<HTMLElement>(`[data-g="${d.id}"]`);
        if (!src) { drag.current = null; return; }
        const r = src.getBoundingClientRect();
        const gh = src.cloneNode(true) as HTMLElement;
        gh.classList.add(ghostClass);
        gh.removeAttribute('data-g');
        Object.assign(gh.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
        Object.assign(d, { on: true, ox: d.x - r.left, oy: d.y - r.top, l0: r.left, t0: r.top, gx: r.left, gy: r.top, ghost: gh });
        gh.style.transformOrigin = `${(d.ox / r.width) * 100}% ${d.oy}px`;
        document.body.appendChild(gh);
        document.body.dataset.dragging = '';
        setDragId(d.id);
        d.raf = requestAnimationFrame(tick);
      }
      d.cx = e.clientX; d.cy = e.clientY;
      retarget();
    }
    function onPointerUp() {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      cancelAnimationFrame(d.raf);
      if (!d.on) return;
      delete document.body.dataset.dragging;
      const ph = grid.current?.querySelector<HTMLElement>(`[data-g="${d.id}"]`), gh = d.ghost!;
      if (ph) {
        const r = ph.getBoundingClientRect();
        gh.classList.add(landClass);
        gh.style.transform = `translate3d(${r.left - d.l0}px,${r.top - d.t0}px,0)`;
      }
      setTimeout(() => { gh.remove(); setDragId(null); }, 350);
      latest.current.onDrop();
    }
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };
  }, [grid, ghostClass, landClass]);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (!enabled || e.button !== 0) return;
    const t = e.target as HTMLElement;
    const h = t.closest<HTMLElement>('[data-ghandle]');
    if (!h) return;
    if (t.closest('button, a') && !t.closest('[data-grip]')) return;
    e.preventDefault();
    drag.current = {
      id: h.dataset.ghandle!, x: e.clientX, y: e.clientY, on: false, last: '', cx: e.clientX, cy: e.clientY,
      ox: 0, oy: 0, l0: 0, t0: 0, gx: 0, gy: 0, svx: 0, sp: 0, rot: 0, rv: 0, sc: 1, raf: 0,
    };
  }, [enabled]);

  /** Arrow keys on a grip: left/right changes column, up/down moves within the column. */
  const onGripKeyDown = useCallback((e: KeyboardEvent<HTMLElement>, id: string) => {
    if (!enabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const c = latest.current.cols, ci = c.findIndex((col) => col.includes(id));
    if (ci < 0) return;
    const p = c[ci].indexOf(id), rest = c[ci].filter((x) => x !== id);
    let next: string[][] | null = null;
    if (e.key === 'ArrowLeft' && ci > 0) next = moveInColumns(c, id, ci - 1, null);
    if (e.key === 'ArrowRight' && ci < c.length - 1) next = moveInColumns(c, id, ci + 1, null);
    if (e.key === 'ArrowUp' && p > 0) next = moveInColumns(c, id, ci, c[ci][p - 1]);
    if (e.key === 'ArrowDown' && p < c[ci].length - 1) next = moveInColumns(c, id, ci, rest[p + 1] ?? null);
    if (!next) return;
    move.current(next);
    latest.current.onDrop();
    const btn = e.currentTarget;
    requestAnimationFrame(() => btn.focus());
  }, [enabled]);

  return { dragId, onPointerDown, onGripKeyDown };
}
