'use client';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Frame } from '@/components/Frame';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { BUCKET, type Submission } from '@/lib/wall/data';
import { draftFrom, SubmissionForm } from '../wall/SubmissionForm';
import s from './save.module.css';

/** The submission form on its own, for the extension's popup window. Closes itself when done. */
export function SaveToWall({ userId, all, bookmarkBoards, page, title, image }: {
  userId: string; all: Submission[]; bookmarkBoards: string[]; page: string; title: string; image: string;
}) {
  const db = useMemo(() => createClient(), []);
  const [done, setDone] = useState<'' | 'saved' | 'cancelled'>('');
  const { toast, toastNode } = useToast();
  const initial = useMemo(() => ({ ...draftFrom(null), source: /^https?:/i.test(page) ? page : '', title }), [page, title]);
  const tags = useMemo(() => [...new Set(all.flatMap((x) => x.tags))].sort(), [all]);
  const boards = useMemo(() => [...new Set([...all.flatMap((x) => x.boards), ...bookmarkBoards])].sort(), [all, bookmarkBoards]);
  const close = () => setTimeout(() => window.close(), 1200);

  if (done) {
    return (
      <main className={s.page}>
        <Frame className={s.panel}>
          <h1 className={s.title}>{done === 'saved' ? 'Saved to the wall.' : 'Not saved.'}</h1>
          <p className={s.note}>This window closes on its own. If it doesn&apos;t, close it.</p>
          <div className={s.row}>
            <Button onClick={() => window.close()}>Close</Button>
            {done === 'saved' && <Button variant="primary" onClick={() => window.open('/wall', '_blank')}>Open the wall</Button>}
          </div>
        </Frame>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <SubmissionForm db={db} userId={userId} existing={null} initial={initial} prefill={{ page, image }}
        urls={{}} all={all} tagOptions={tags} boardOptions={boards} toast={toast}
        onSave={async (sub, _urls, removed) => {
          const { error } = await db.from('submissions').insert(sub);
          if (error) { toast(`Couldn't save. ${error.message}`); return; }
          if (removed.length) await db.storage.from(BUCKET).remove(removed);
          setDone('saved'); close();
        }}
        onCancel={async (_draft, uploaded) => {
          if (uploaded.length) await db.storage.from(BUCKET).remove(uploaded);
          setDone('cancelled'); close();
        }}
        onOpenExisting={(id) => { window.open(`/wall?open=${encodeURIComponent(id)}`, '_blank'); setDone('cancelled'); close(); }} />
      {toastNode}
    </main>
  );
}
