import type { PageInfo } from './server/pageInfo';

export type { PageInfo };

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: res.status === 401 || res.redirected ? 'Your session ended. Sign in again.' : 'The server did not answer.' }));
  if (!res.ok || data.error) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data as T;
}

/** Asks the server to read a web page's title, favicon and images. */
export const fetchPageInfo = (url: string) => post<PageInfo>('/api/page-info', { url });

/** Asks the server to copy an image from another site into the user's media folder. */
export const importImage = (url: string, referer?: string) => post<{ path: string; url: string; mime: string }>('/api/import-image', { url, referer });
