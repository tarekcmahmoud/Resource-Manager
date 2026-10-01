import type { SupabaseClient } from '@supabase/supabase-js';
import { safeFetch } from './safeFetch';
import { BUCKET } from '@/lib/wall/data';

const MAX_BYTES = 20 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'video/mp4': 'mp4' };

/** Copies an image from another site into the user's media folder. Throws FetchError with a readable message. */
export async function importToStorage(db: SupabaseClient, userId: string, url: string, referer?: string) {
  const img = await safeFetch(url, { accept: 'image/avif,image/webp,image/*,video/mp4;q=0.8', maxBytes: MAX_BYTES, referer });
  const type = img.type.split(';')[0].trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) throw new Error('That address is not an image.');
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, img.body, { contentType: type, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return { path, mime: type };
}
