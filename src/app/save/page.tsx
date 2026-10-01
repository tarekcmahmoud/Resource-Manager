import { createClient } from '@/lib/supabase/server';
import { loadSubmissions } from '@/lib/wall/data';
import { SaveToWall } from './SaveToWall';

export const metadata = { title: 'Save to the wall · Resource Manager' };

/** Opened by the Chrome extension: /save?url=<page>&title=<title>&image=<image address>. */
export default async function SavePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (k: string) => (typeof q[k] === 'string' ? q[k] as string : '');
  const supabase = await createClient();
  const [{ data: { user } }, subs, boards] = await Promise.all([
    supabase.auth.getUser(),
    loadSubmissions(supabase),
    supabase.from('bm_boards').select('name'),
  ]);
  return (
    <SaveToWall userId={user!.id} all={subs} bookmarkBoards={(boards.data ?? []).map((b) => b.name)}
      page={one('url')} title={one('title')} image={one('image')} />
  );
}
