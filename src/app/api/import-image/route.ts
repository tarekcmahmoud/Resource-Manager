import { createClient } from '@/lib/supabase/server';
import { FetchError, safeFetch } from '@/lib/server/safeFetch';
import { BUCKET } from '@/lib/wall/data';

const MAX_BYTES = 20 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'video/mp4': 'mp4' };

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
    const img = await safeFetch(String(url), { accept: 'image/avif,image/webp,image/*,video/mp4;q=0.8', maxBytes: MAX_BYTES, referer: referer ? String(referer) : undefined });
    const type = img.type.split(';')[0].trim().toLowerCase();
    const ext = EXT[type];
    if (!ext) return Response.json({ error: 'That address is not an image.' }, { status: 422 });
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, img.body, { contentType: type, cacheControl: '31536000' });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
    return Response.json({ path, url: data?.signedUrl ?? '', mime: type });
  } catch (e) {
    const msg = e instanceof FetchError ? e.message : e instanceof Error && e.name === 'TimeoutError' ? 'The site took too long to answer.' : 'The image could not be copied.';
    return Response.json({ error: msg }, { status: 422 });
  }
}
