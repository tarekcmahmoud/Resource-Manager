import { createClient } from '@/lib/supabase/server';
import { FetchError } from '@/lib/server/safeFetch';
import { importToStorage } from '@/lib/server/importImage';
import { BUCKET } from '@/lib/wall/data';

/**
 * POST { url, referer? } → copies an image from another site into the user's media folder,
 * so the wall keeps it even if the site removes it or blocks hotlinking.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });

  const { url, referer } = await request.json().catch(() => ({}));
  try {
    const { path, mime } = await importToStorage(supabase, user.id, String(url), referer ? String(referer) : undefined);
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
    return Response.json({ path, url: data?.signedUrl ?? '', mime });
  } catch (e) {
    return Response.json({ error: errorText(e, 'The image could not be copied.') }, { status: 422 });
  }
}

function errorText(e: unknown, fallback: string) {
  if (e instanceof FetchError) return e.message;
  if (e instanceof Error && e.name === 'TimeoutError') return 'The site took too long to answer.';
  if (e instanceof Error && e.message === 'That address is not an image.') return e.message;
  return fallback;
}
