'use client';
import { useState } from 'react';
import { Overlay } from '@/components/Dialog';
import { Frame } from '@/components/Frame';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Pill } from '@/components/Pill';
import { hostOf, TYPE_LABEL, videoInfo, type Submission } from '@/lib/wall/data';
import { AnimBox, ImageBox, Ratio, type Urls } from './Card';
import s from './wall.module.css';

type Props = {
  sub: Submission; urls: Urls; hasPrev: boolean; hasNext: boolean;
  onPrev: () => void; onNext: () => void; onClose: () => void;
  onEdit: () => void; onArchive: () => void; onDelete: () => void; onTag: (t: string) => void; onSpan: (span: 1 | 2 | 3) => void;
};

/** One submission, full size, with its details beside it. Left and right arrows step through the wall. */
export function FocusView(p: Props) {
  const { sub } = p;
  const [armed, setArmed] = useState(false);
  const saved = new Date(sub.saved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const content = sub.blocks.map((b, i) => {
    if (b.kind === 'images') return b.images.map((im, k) => <ImageBox key={`${i}-${k}`} img={im} urls={p.urls} tone={k % 2 ? 2 : 1} />);
    if (b.kind === 'quote') return (
      <figure key={i} className={s.fq}><blockquote>“{b.text}”</blockquote>{b.attr && <figcaption>{b.attr}</figcaption>}</figure>
    );
    if (b.kind === 'text') return <p key={i} className={s.ftext}>{b.text}</p>;
    if (b.kind === 'anim') return <AnimBox key={i} b={b} urls={p.urls} />;
    if (b.kind === 'video') {
      const v = videoInfo(b.url);
      return v ? (
        <Ratio key={i} ratio={0.5625} tone={2}>
          <iframe src={v.embed} title={`${v.site} video`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </Ratio>
      ) : <a key={i} className={s.srcl} href={b.url} target="_blank" rel="noopener noreferrer">{b.url}</a>;
    }
    return null;
  });

  return (
    <Overlay label={sub.title || 'Submission'} onClose={p.onClose} onKeyDown={(e) => {
      if ((e.target as HTMLElement).matches('input, textarea')) return;
      if (e.key === 'ArrowLeft' && p.hasPrev) { setArmed(false); p.onPrev(); }
      if (e.key === 'ArrowRight' && p.hasNext) { setArmed(false); p.onNext(); }
    }}>
      <Frame className={s.fpanel}>
        <div className={s.fgrid}>
          <div className={s.fcontent}>{sub.blocks.length ? content : <p className={s.meta}>This submission has no content yet. Use Edit to add some.</p>}</div>
          <aside className={s.fside}>
            <div className={s.fhead}>
              <div>
                <span className={s.typeTag}>{TYPE_LABEL[sub.type]}</span>
                <h2>{sub.title || 'Untitled submission'}</h2>
                <div className={s.meta}>Saved {saved}{sub.archived && '. Archived'}</div>
              </div>
              <button type="button" className={s.xbtn} onClick={p.onClose} aria-label="Close"><Icon name="x" size={20} /></button>
            </div>
            {sub.source && (
              <Section label="Source">
                <a className={s.srcl} href={sub.source} target="_blank" rel="noopener noreferrer">
                  <Icon name="ext" size={14} /><span>{hostOf(sub.source) || sub.source}</span>
                </a>
              </Section>
            )}
            {sub.notes && <Section label="Notes"><p className={s.fnotes}>{sub.notes}</p></Section>}
            {sub.tags.length > 0 && (
              <Section label="Tags">
                <div className={s.chipRow}>{sub.tags.map((t) => <Pill key={t} icon={t.charAt(0).toUpperCase()} label={t} expanded onClick={() => p.onTag(t)} />)}</div>
              </Section>
            )}
            {sub.boards.length > 0 && (
              <Section label="Boards">
                <div className={s.chipRow}>{sub.boards.map((b) => <span key={b} className={s.boardChip}>{b}</span>)}</div>
              </Section>
            )}
            <Section label="Width on the wall">
              <div className={s.seg} role="group" aria-label="Width on the wall">
                {([1, 2, 3] as const).map((n) => (
                  <button key={n} type="button" aria-pressed={(sub.span ?? 1) === n} onClick={() => p.onSpan(n)}>{n} column{n > 1 ? 's' : ''}</button>
                ))}
              </div>
            </Section>
            <div className={s.factions}>
              <Button variant="primary" onClick={p.onEdit}>Edit</Button>
              <Button onClick={p.onArchive}>{sub.archived ? 'Unarchive' : 'Archive'}</Button>
              <Button variant={armed ? 'danger' : 'default'} onClick={() => (armed ? p.onDelete() : setArmed(true))}>
                {armed ? 'Confirm delete' : 'Delete'}
              </Button>
            </div>
          </aside>
        </div>
      </Frame>
      <button type="button" className={`${s.fnav} ${s.prev}`} onClick={() => { setArmed(false); p.onPrev(); }} disabled={!p.hasPrev} aria-label="Previous submission"><Icon name="left" size={20} /></button>
      <button type="button" className={`${s.fnav} ${s.next}`} onClick={() => { setArmed(false); p.onNext(); }} disabled={!p.hasNext} aria-label="Next submission"><Icon name="right" size={20} /></button>
    </Overlay>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className={s.fsec}><span className={s.k}>{label}</span>{children}</div>;
}
