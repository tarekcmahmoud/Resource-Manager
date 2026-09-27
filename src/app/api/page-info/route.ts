import { createClient } from '@/lib/supabase/server';
import { FetchError, safeFetch } from '@/lib/server/safeFetch';
import { parsePage } from '@/lib/server/pageInfo';

/** POST { url } → the page's title, site name, favicon and images. Signed-in use only. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });

  const { url } = await request.json().catch(() => ({ url: '' }));
  try {
    const page = await safeFetch(String(url), { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', maxBytes: 3 * 1024 * 1024 });
    if (!/html|xml/i.test(page.type)) {
      // A direct link to an image is its own only image.
      if (page.type.startsWith('image/')) return Response.json({ url: page.url.href, title: '', siteName: page.url.hostname, favicon: '', images: [page.url.href] });
      return Response.json({ error: 'That address is not a web page.' }, { status: 422 });
    }
    const charset = page.type.match(/charset=([\w-]+)/i)?.[1] ?? 'utf-8';
    let html: string;
    try { html = new TextDecoder(charset).decode(page.body); } catch { html = new TextDecoder().decode(page.body); }
    return Response.json(parsePage(html, page.url));
  } catch (e) {
    const msg = e instanceof FetchError ? e.message : e instanceof Error && e.name === 'TimeoutError' ? 'The site took too long to answer.' : 'The page could not be read.';
    return Response.json({ error: msg }, { status: 422 });
  }
}
