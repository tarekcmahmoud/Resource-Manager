import type { SupabaseClient } from '@supabase/supabase-js';

export const TYPES = [
  ['project', 'Project'], ['article', 'Article'], ['quote', 'Quote'], ['person', 'Person / Studio'],
] as const;
export type SubType = (typeof TYPES)[number][0];
export const TYPE_LABEL = Object.fromEntries(TYPES) as Record<SubType, string>;

/** An image is either a file in the media bucket (path) or an external address (url). */
export type Img = { path?: string; url?: string; ratio: number };
export type Block =
  | { kind: 'images'; images: Img[] }
  | { kind: 'video'; url: string }
  | { kind: 'anim'; path?: string; url?: string; ratio?: number; mime?: string }
  | { kind: 'text'; text: string }
  | { kind: 'quote'; text: string; attr?: string };

export type Submission = {
  id: string; type: SubType; title: string; source: string; notes: string;
  tags: string[]; boards: string[]; blocks: Block[]; archived: boolean;
  span: 1 | 2 | 3; // wall columns the card spans
  saved_at: string; updated_at: string;
};

export const BUCKET = 'media';
const SIGNED_FOR = 60 * 60 * 24; // seconds; the page refreshes them on each load

export async function loadSubmissions(db: SupabaseClient) {
  const { data, error } = await db.from('submissions')
    .select('id,type,title,source,notes,tags,boards,blocks,archived,span,saved_at,updated_at')
    .order('saved_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Submission[];
}

/** Every storage path a submission's blocks point at. */
export function mediaPaths(blocks: Block[]) {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'images') for (const im of b.images) { if (im.path) out.push(im.path); }
    if (b.kind === 'anim' && b.path) out.push(b.path);
  }
  return out;
}

/** Signed addresses for private files, keyed by storage path. */
export async function signPaths(db: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await db.storage.from(BUCKET).createSignedUrls(paths, SIGNED_FOR);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const x of data) if (x.path && x.signedUrl) out[x.path] = x.signedUrl;
  return out;
}

export function hostOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function normUrl(u: string) {
  return u.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();
}

/** YouTube or Vimeo link → privacy-friendly embed address and, for YouTube, a thumbnail. */
export function videoInfo(url: string): { embed: string; thumb?: string; site: string } | null {
  try {
    const u = new URL(url), h = u.hostname.replace(/^www\.|^m\./, '');
    let id = '';
    if (h === 'youtu.be') id = u.pathname.slice(1);
    else if (h.endsWith('youtube.com')) id = u.searchParams.get('v') ?? u.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] ?? '';
    if (id) return { embed: `https://www.youtube-nocookie.com/embed/${id}`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, site: 'YouTube' };
    if (h.endsWith('vimeo.com')) {
      const v = u.pathname.match(/\/(\d+)/)?.[1];
      if (v) return { embed: `https://player.vimeo.com/video/${v}`, site: 'Vimeo' };
    }
  } catch { /* not a URL */ }
  return null;
}

export const isVideoFile = (b: { mime?: string; url?: string; path?: string }) =>
  b.mime?.startsWith('video/') || /\.(mp4|webm|mov)(\?|$)/i.test(b.url ?? b.path ?? '');

/** The title a card shows when none was given. */
export function fallbackTitle(source: string, blocks: Block[]) {
  const q = blocks.find((b) => b.kind === 'quote') as { text: string } | undefined;
  return hostOf(source) || (q ? q.text.slice(0, 48) : '') || 'Untitled submission';
}
