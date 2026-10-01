import { createClient } from '@/lib/supabase/server';
import { importToStorage } from '@/lib/server/importImage';
import { fallbackTitle, hostOf, type Block, type Img } from '@/lib/wall/data';

type Body = { url?: string; title?: string; notes?: string; tags?: string[]; boards?: string[]; images?: { url: string; ratio?: number }[] };
const strings = (x: unknown, max: number) => (Array.isArray(x) ? x : []).filter((v): v is string => typeof v === 'string' && !!v.trim()).map((v) => v.trim().slice(0, 80)).slice(0, max);

/**
 * For the Chrome extension's panel. Saves a submission from the page you're on: copies the
 * picked images into storage (in the order picked) and adds it to the wall.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });

  const b: Body = await request.json().catch(() => ({}));
  const source = typeof b.url === 'string' && /^https?:\/\//i.test(b.url) ? b.url.slice(0, 2000) : '';
  const picks = (Array.isArray(b.images) ? b.images : []).filter((i) => typeof i?.url === 'string').slice(0, 24);

  const results = await Promise.allSettled(picks.map((i) => importToStorage(supabase, user.id, i.url, source || undefined)));
  const images: Img[] = [];
  results.forEach((r, k) => {
    const ratio = Number(picks[k].ratio);
    if (r.status === 'fulfilled') images.push({ path: r.value.path, ratio: ratio > 0.05 && ratio < 20 ? ratio : 0.75 });
  });
  const failed = results.length - images.length;
  if (picks.length && !images.length) return Response.json({ error: "None of the picked images could be copied. The site may block downloads." }, { status: 422 });

  const blocks: Block[] = images.length ? [{ kind: 'images', images }] : [];
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(), type: 'project', source, blocks, span: 1, archived: false, saved_at: now, updated_at: now,
    title: (typeof b.title === 'string' ? b.title.trim().slice(0, 200) : '') || fallbackTitle(source, blocks) || hostOf(source),
    notes: typeof b.notes === 'string' ? b.notes.trim().slice(0, 5000) : '',
    tags: [...new Set(strings(b.tags, 30).map((t) => t.toLowerCase()))],
    boards: [...new Set(strings(b.boards, 20))],
  };
  const { error } = await supabase.from('submissions').insert(row);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id: row.id, saved: images.length, failed });
}
