import { createClient } from '@/lib/supabase/server';
import { loadSubmissions, mediaPaths, signPaths } from '@/lib/wall/data';
import { Wall } from './Wall';

export const metadata = { title: 'Wall · Resource Manager' };

export default async function WallPage() {
  const supabase = await createClient();
  const [{ data: { user } }, subs, boards] = await Promise.all([
    supabase.auth.getUser(),
    loadSubmissions(supabase),
    supabase.from('bm_boards').select('name'),
  ]);
  // Uploaded files are private; the page gets addresses that work for a day.
  const urls = await signPaths(supabase, subs.flatMap((x) => mediaPaths(x.blocks)));
  return <Wall initial={subs} initialUrls={urls} userId={user!.id} bookmarkBoards={(boards.data ?? []).map((b) => b.name)} />;
}
