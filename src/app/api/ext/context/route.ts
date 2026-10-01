import { createClient } from '@/lib/supabase/server';
import { normUrl } from '@/lib/wall/data';

/**
 * For the Chrome extension's panel. POST { url } → the tags and boards to suggest, and
 * the submission already saved from this address, if any. Uses the app's sign-in cookie.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });

  const { url } = await request.json().catch(() => ({ url: '' }));
  const [subs, boards] = await Promise.all([
    supabase.from('submissions').select('id,title,source,tags,boards'),
    supabase.from('bm_boards').select('name'),
  ]);
  if (subs.error) return Response.json({ error: subs.error.message }, { status: 500 });
  const n = normUrl(String(url || ''));
  const existing = n ? subs.data.find((x) => normUrl(x.source) === n) : undefined;
  return Response.json({
    tags: [...new Set(subs.data.flatMap((x) => x.tags as string[]))].sort(),
    boards: [...new Set([...subs.data.flatMap((x) => x.boards as string[]), ...(boards.data ?? []).map((b) => b.name)])].sort((a, b) => a.localeCompare(b)),
    existing: existing ? { id: existing.id, title: existing.title } : null,
  });
}
