import type { Group } from './data';

/** Board tabs lay groups out by col/position; the Pinned tab has its own pin_col/pin_position. */
export type LayoutKey = 'board' | 'pinned';

export function slot(g: Group, key: LayoutKey) {
  return key === 'pinned' ? { col: g.pin_col, pos: g.pin_position } : { col: g.col, pos: g.position };
}

export function withSlot(g: Group, key: LayoutKey, col: number, pos: number): Group {
  return key === 'pinned' ? { ...g, pin_col: col, pin_position: pos } : { ...g, col, position: pos };
}

/**
 * Splits groups into n columns. Groups with a stored column keep it (clamped to the last
 * column on narrow screens); groups without one go to the shortest column, using
 * estHeight to guess card heights.
 */
export function toColumns(groups: Group[], n: number, key: LayoutKey, estHeight: (g: Group) => number) {
  const cols: Group[][] = Array.from({ length: n }, () => []);
  const heights = new Array(n).fill(0);
  const placed = groups.filter((g) => slot(g, key).col != null)
    .sort((a, b) => (slot(a, key).col! - slot(b, key).col!) || (slot(a, key).pos - slot(b, key).pos));
  for (const g of placed) {
    const c = Math.min(slot(g, key).col!, n - 1);
    cols[c].push(g); heights[c] += estHeight(g);
  }
  const loose = groups.filter((g) => slot(g, key).col == null).sort((a, b) => slot(a, key).pos - slot(b, key).pos);
  for (const g of loose) {
    const c = heights.indexOf(Math.min(...heights));
    cols[c].push(g); heights[c] += estHeight(g);
  }
  return cols.map((c) => c.map((g) => g.id));
}

/** Moves one group to column ci, before beforeId (or to the end of that column). */
export function moveInColumns(cols: string[][], id: string, ci: number, beforeId: string | null) {
  const next = cols.map((c) => c.filter((x) => x !== id));
  const at = beforeId ? next[ci].indexOf(beforeId) : -1;
  if (at < 0) next[ci].push(id); else next[ci].splice(at, 0, id);
  return next;
}

/** Writes the column arrangement back onto the groups as col + position. */
export function applyColumns(groups: Group[], cols: string[][], key: LayoutKey) {
  const where = new Map<string, [number, number]>();
  cols.forEach((c, ci) => c.forEach((id, pi) => where.set(id, [ci, pi])));
  return groups.map((g) => {
    const w = where.get(g.id);
    return w ? withSlot(g, key, w[0], w[1]) : g;
  });
}
