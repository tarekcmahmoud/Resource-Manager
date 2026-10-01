'use client';
/* eslint-disable @next/next/no-img-element -- images come from signed storage URLs and arbitrary sites */
import type { ReactNode } from 'react';
import { Frame } from '@/components/Frame';
import { Icon } from '@/components/Icon';
import { Pill } from '@/components/Pill';
import { hostOf, isVideoFile, TYPE_LABEL, videoInfo, type Img, type Submission } from '@/lib/wall/data';
import s from './wall.module.css';

export type Urls = Record<string, string>;
export const srcOf = (x: { path?: string; url?: string }, urls: Urls) => (x.path ? urls[x.path] : x.url);

/** A box that keeps the media's aspect ratio while it loads. */
export function Ratio({ ratio, tone = 1, children }: { ratio: number; tone?: 1 | 2; children?: ReactNode }) {
  return <div className={[s.ph, tone === 2 && s.t2].filter(Boolean).join(' ')} style={{ paddingTop: `${(ratio * 100).toFixed(1)}%` }}>{children}</div>;
}

export function ImageBox({ img, urls, tone }: { img: Img; urls: Urls; tone?: 1 | 2 }) {
  const src = srcOf(img, urls);
  return <Ratio ratio={img.ratio} tone={tone}>{src && <img src={src} alt="" loading="lazy" />}</Ratio>;
}

export function AnimBox({ b, urls }: { b: { path?: string; url?: string; ratio?: number; mime?: string }; urls: Urls }) {
  const src = srcOf(b, urls), video = isVideoFile(b);
  return (
    <Ratio ratio={b.ratio ?? 0.75}>
      {src && (video ? <video src={src} autoPlay muted loop playsInline /> : <img src={src} alt="" loading="lazy" />)}
      <span className={s.badge}>{video ? 'MP4' : 'GIF'}</span>
    </Ratio>
  );
}

/**
 * The card's content in the same order as the submission's blocks. Images, videos and
 * animations that sit next to each other form one media group; quotes and text break it up.
 */
function segmentsOf(sub: Submission, urls: Urls) {
  const segs: ({ kind: 'media'; items: ReactNode[] } | { kind: 'quote'; text: string; attr?: string } | { kind: 'text'; text: string })[] = [];
  const media = (node: ReactNode) => {
    const last = segs[segs.length - 1];
    if (last?.kind === 'media') last.items.push(node); else segs.push({ kind: 'media', items: [node] });
  };
  sub.blocks.forEach((b, bi) => {
    if (b.kind === 'images') b.images.forEach((im, i) => media(<ImageBox key={`${bi}-${i}`} img={im} urls={urls} tone={i % 2 ? 2 : 1} />));
    if (b.kind === 'video') {
      const v = videoInfo(b.url);
      media(
        <Ratio key={bi} ratio={0.5625} tone={2}>
          {v?.thumb && <img src={v.thumb} alt="" loading="lazy" />}
          <span className={s.playdot}><Icon name="play" size={14} /></span>
        </Ratio>,
      );
    }
    if (b.kind === 'anim') media(<AnimBox key={bi} b={b} urls={urls} />);
    if (b.kind === 'quote' && b.text) segs.push({ kind: 'quote', text: b.text, attr: b.attr });
    if (b.kind === 'text' && b.text) segs.push({ kind: 'text', text: b.text });
  });
  return segs;
}

function Pills({ sub, onTag }: { sub: Submission; onTag: (t: string) => void }) {
  if (!sub.source && !sub.tags.length) return null;
  return (
    <div className={s.dots} onClick={(e) => e.stopPropagation()}>
      {sub.source && <Pill href={sub.source} icon={<Icon name="ext" size={13} />} label={hostOf(sub.source) || 'Source'} />}
      {sub.tags.map((t) => <Pill key={t} icon={t.charAt(0).toUpperCase()} label={t} onClick={() => onTag(t)} />)}
    </div>
  );
}

export function Card({ sub, urls, onOpen, onTag }: { sub: Submission; urls: Urls; onOpen: () => void; onTag: (t: string) => void }) {
  const segs = segmentsOf(sub, urls);
  const firstMedia = segs.findIndex((x) => x.kind === 'media');
  const hasMedia = firstMedia >= 0, isQuote = sub.type === 'quote', isPerson = sub.type === 'person';
  const title = sub.title || 'Untitled submission';
  return (
    <Frame as="article" interactive tabIndex={0} className={[s.card, sub.archived && s.archived].filter(Boolean).join(' ')}
      aria-label={`${TYPE_LABEL[sub.type]}: ${title}`} onClick={onOpen}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(); }}>
      {segs.map((seg, i) => {
        if (seg.kind === 'media') return (
          <div key={i} className={s.media}>
            {seg.items}
            {/* Title and pills show on hover over the first media group. */}
            {i === firstMedia && (
              <div className={s.hov}>
                {!isPerson ? <div className={s.ttl}>{title}</div> : <span />}
                <Pills sub={sub} onTag={onTag} />
              </div>
            )}
          </div>
        );
        if (seg.kind === 'quote') return (
          <div key={i} className={[s.cq, isQuote && s.lead].filter(Boolean).join(' ')}>
            “{seg.text}”{seg.attr && <span className={s.by}>{seg.attr}</span>}
          </div>
        );
        return <div key={i} className={s.ctext}>{seg.text}</div>;
      })}
      {(isPerson || (!hasMedia && !isQuote)) && (
        <div className={s.ctitle}>{title}{isPerson && <small>Person / Studio</small>}</div>
      )}
      {!hasMedia && <div className={s.cdots}><Pills sub={sub} onTag={onTag} /></div>}
      {sub.archived && <span className={s.archTag}>Archived</span>}
    </Frame>
  );
}
