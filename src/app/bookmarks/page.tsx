import { createClient } from '@/lib/supabase/server';
import { loadAll } from '@/lib/bookmarks/data';
import { starterBoards } from '@/lib/bookmarks/seed';
import { Bookmarks } from './Bookmarks';
import s from './bookmarks.module.css';

export const metadata = { title: 'Bookmarks · Resource Manager' };

export default async function BookmarksPage() {
  const supabase = await createClient();
  // First visit: load the starter boards. The database function makes this happen once per user.
  const { data: state, error } = await supabase.from('user_state').select('bm_seeded').maybeSingle();
  if (error) {
    return (
      <main className={s.setup}>
        <h1>One more database step</h1>
        <p>Run <code>supabase/migrations/0002_bookmarks.sql</code> in the Supabase SQL Editor, then reload this page.</p>
        <p className={s.note}>{error.message}</p>
      </main>
    );
  }
  if (!state?.bm_seeded) {
    const { error: seedError } = await supabase.rpc('seed_bookmarks', { data: starterBoards() });
    if (seedError) throw new Error(`Couldn't load the starter bookmarks: ${seedError.message}`);
  }
  return <Bookmarks initial={await loadAll(supabase)} />;
}
