import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Fetches a public web address on the server. Refuses anything that resolves to a
 * private, loopback or link-local address (so the app can't be used to reach
 * internal services), re-checks every redirect, and stops reading past maxBytes.
 */
export async function safeFetch(raw: string, { accept, maxBytes, referer, timeoutMs = 10_000 }: {
  accept: string; maxBytes: number; referer?: string; timeoutMs?: number;
}) {
  let url = parseHttp(raw);
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url.hostname);
    const res = await fetch(url, {
      redirect: 'manual', signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
        accept, 'accept-language': 'en;q=0.9,*;q=0.5', ...(referer && { referer }),
      },
    });
    const next = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && next) { url = parseHttp(new URL(next, url).href); continue; }
    if (!res.ok) throw new FetchError(`The site answered ${res.status}.`);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > maxBytes) throw new FetchError('The file is too large.');
    return { url, type: res.headers.get('content-type') ?? '', body: await readCapped(res, maxBytes) };
  }
  throw new FetchError('Too many redirects.');
}

export class FetchError extends Error {}

function parseHttp(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { throw new FetchError('That is not a web address.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new FetchError('Only http and https addresses can be fetched.');
  if (u.username || u.password) throw new FetchError('Addresses with a login in them are not fetched.');
  return u;
}

async function assertPublic(host: string) {
  const h = host.replace(/^\[|\]$/g, '');
  const addrs = isIP(h) ? [{ address: h }] : await lookup(h, { all: true }).catch(() => { throw new FetchError('That site could not be found.'); });
  for (const { address } of addrs) if (isPrivate(address)) throw new FetchError('That address is on a private network.');
}

function isPrivate(ip: string) {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
  }
  const x = ip.toLowerCase();
  return x === '::' || x === '::1' || x.startsWith('fc') || x.startsWith('fd') || /^fe[89ab]/.test(x) || x.startsWith('ff');
}

async function readCapped(res: Response, max: number) {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new FetchError('The file is too large.'); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}
