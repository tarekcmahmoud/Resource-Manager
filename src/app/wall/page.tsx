import { createClient } from '@/lib/supabase/server';
import { loadSubmissions, mediaPaths, signPaths } from '@/lib/wall/data';
import { Wall } from './Wall';
import s from './wall.module.css';

export const metadata = { title: 'Wall · Resource Manager' };

export default async function WallPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  const supabase = await createClient();
  const [{ data: { user } }, subs, boards] = await Promise.all([
    supabase.auth.getUser(),
    loadSubmissions(supabase).catch((e: Error) => e),
    supabase.from('bm_boards').select('name'),
  ]);
  if (subs instanceof Error && !/span/.test(subs.message)) throw subs;
  if (subs instanceof Error) {
    return (
      <main className={s.setup}>
        <h1>One more database step</h1>
        <p>Run <code>supabase/migrations/0003_wall_span.sql</code> in the Supabase SQL Editor, then reload this page.</p>
        <p className={s.meta}>{subs.message}</p>
      </main>
    );
  }
  // Uploaded files are private; the page gets addresses that work for a day.
  const urls = await signPaths(supabase, subs.flatMap((x) => mediaPaths(x.blocks)));
  return <Wall initial={subs} initialUrls={urls} userId={user!.id} bookmarkBoards={(boards.data ?? []).map((b) => b.name)} initialFocus={open} />;
}
