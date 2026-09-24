import { createClient } from '@/lib/supabase/server';
import { SignOut } from './SignOut';
import s from './home.module.css';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main className={s.page}>
      <header className={s.top}>
        <span className={s.mark}>Resource Manager</span>
        <nav className={s.nav}><span aria-current="page">Wall</span><span>Bookmarks</span><a href="/design">Design</a></nav>
        <SignOut />
      </header>
      <section className={s.body}>
        <p>Signed in as <b>{user?.email}</b>.</p>
        <p className={s.muted}>Stage 1 is live. Bookmarks arrive in stage 2, the wall in stage 3.</p>
      </section>
    </main>
  );
}
