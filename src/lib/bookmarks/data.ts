import type { SupabaseClient } from '@supabase/supabase-js';

export type Board = { id: string; name: string; position: number };
export type Group = {
  id: string; board_id: string; name: string; pinned: boolean;
  col: number | null; position: number;          // layout on its board
  pin_col: number | null; pin_position: number;  // layout on the Pinned tab
};
export type Subgroup = { id: string; group_id: string; name: string | null; position: number; collapsed: boolean };
export type Link = { id: string; subgroup_id: string; name: string; url: string; note: string; position: number };
export type BookmarkData = { boards: Board[]; groups: Group[]; subgroups: Subgroup[]; links: Link[] };

const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/** Loads every bookmark row for the signed-in user. Row level security scopes it to them. */
export async function loadAll(db: SupabaseClient): Promise<BookmarkData> {
  const [b, g, s, l] = await Promise.all([
    db.from('bm_boards').select('id,name,position'),
    db.from('bm_groups').select('id,board_id,name,pinned,col,position,pin_col,pin_position'),
    db.from('bm_subgroups').select('id,group_id,name,position,collapsed'),
    db.from('bm_links').select('id,subgroup_id,name,url,note,position'),
  ]);
  const err = b.error || g.error || s.error || l.error;
  if (err) throw new Error(err.message);
  return {
    boards: (b.data as Board[]).sort(byPos),
    groups: g.data as Group[],
    subgroups: (s.data as Subgroup[]).sort(byPos),
    links: (l.data as Link[]).sort(byPos),
  };
}

/** Normalises a URL for duplicate checks: no scheme, no www, no trailing slash, lower case. */
export function normUrl(u: string) {
  return u.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();
}

export function hostOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}
