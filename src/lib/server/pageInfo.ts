/** What we can learn about a web page from its HTML, without running its scripts. */
export type PageInfo = { url: string; title: string; siteName: string; favicon: string; images: string[] };

const MAX_IMAGES = 40;

export function parsePage(html: string, pageUrl: URL): PageInfo {
  const head = html.slice(0, 400_000);
  const baseHref = attr(head.match(/<base\b[^>]*>/i)?.[0] ?? '', 'href');
  const base = safeUrl(baseHref, pageUrl) ?? pageUrl;
  const abs = (u: string) => safeUrl(decode(u.trim()), base)?.href ?? '';

  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const meta = (...keys: string[]) => metas.filter((m) => keys.includes((attr(m, 'property') || attr(m, 'name')).toLowerCase()))
    .map((m) => attr(m, 'content')).filter(Boolean);

  const title = clean(meta('og:title', 'twitter:title')[0] ?? head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const siteName = clean(meta('og:site_name', 'application-name')[0] ?? '') || pageUrl.hostname.replace(/^www\./, '');

  const icons = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0])
    .filter((l) => /\bicon\b/i.test(attr(l, 'rel')))
    .sort((a, b) => iconScore(b) - iconScore(a));
  const favicon = icons.length ? abs(attr(icons[0], 'href')) : new URL('/favicon.ico', pageUrl).href;

  // The page's chosen share image first, then images in the order they appear.
  const found: string[] = [...meta('og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src')];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const w = Number(attr(tag, 'width')), h = Number(attr(tag, 'height'));
    if ((w && w < 80) || (h && h < 80)) continue; // icons, spacers, tracking pixels
    const src = attr(tag, 'data-src') || attr(tag, 'data-lazy-src') || largestFromSrcset(attr(tag, 'srcset') || attr(tag, 'data-srcset')) || attr(tag, 'src');
    if (src) found.push(src);
  }
  for (const m of html.matchAll(/<source\b[^>]*srcset=["']([^"']+)["'][^>]*>/gi)) {
    const src = largestFromSrcset(m[1]);
    if (src) found.push(src);
  }

  const seen = new Set<string>(), images: string[] = [];
  for (const raw of found) {
    const u = abs(raw);
    if (!u || !/^https?:/.test(u) || /\.svg(\?|$)/i.test(u) || /(pixel|spacer|blank|tracking|1x1)\.(gif|png)/i.test(u)) continue;
    const key = u.replace(/[?#].*$/, '');
    if (seen.has(key)) continue;
    seen.add(key); images.push(u);
    if (images.length >= MAX_IMAGES) break;
  }
  return { url: pageUrl.href, title, siteName, favicon, images };
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decode(m ? (m[1] ?? m[2] ?? m[3] ?? '') : '');
}

function largestFromSrcset(srcset: string) {
  if (!srcset) return '';
  let best = '', bestW = -1;
  for (const part of srcset.split(/,\s+(?=\S)/)) {
    const [u, d] = part.trim().split(/\s+/);
    const w = d ? parseFloat(d) * (d.endsWith('x') ? 1000 : 1) : 0;
    if (u && w > bestW) { best = u; bestW = w; }
  }
  return best;
}

function iconScore(link: string) {
  const rel = attr(link, 'rel').toLowerCase(), size = parseInt(attr(link, 'sizes')) || 16;
  return (rel.includes('apple-touch') ? 1000 : 0) + Math.min(size, 256) - (/\.svg/i.test(attr(link, 'href')) ? 50 : 0);
}

function safeUrl(u: string, base: URL) {
  if (!u || u.startsWith('data:') || u.startsWith('javascript:')) return null;
  try { return new URL(u, base); } catch { return null; }
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
function decode(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}
const clean = (s: string) => decode(s).replace(/\s+/g, ' ').trim().slice(0, 200);
