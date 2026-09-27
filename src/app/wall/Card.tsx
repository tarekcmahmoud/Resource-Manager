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

function mediaOf(sub: Submission, urls: Urls) {
  const out: ReactNode[] = [];
  sub.blocks.forEach((b, bi) => {
    if (b.kind === 'images') b.images.forEach((im, i) => out.push(<ImageBox key={`${bi}-${i}`} img={im} urls={urls} tone={i % 2 ? 2 : 1} />));
    if (b.kind === 'video') {
      const v = videoInfo(b.url);
      out.push(
        <Ratio key={bi} ratio={0.5625} tone={2}>
          {v?.thumb && <img src={v.thumb} alt="" loading="lazy" />}
          <span className={s.playdot}><Icon name="play" size={14} /></span>
        </Ratio>,
      );
    }
    if (b.kind === 'anim') out.push(<AnimBox key={bi} b={b} urls={urls} />);
  });
  return out;
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
  const media = mediaOf(sub, urls);
  const quote = sub.blocks.find((b) => b.kind === 'quote' && b.text) as { text: string; attr?: string } | undefined;
  const text = sub.blocks.find((b) => b.kind === 'text' && b.text) as { text: string } | undefined;
  const hasMedia = media.length > 0, isQuote = sub.type === 'quote', isPerson = sub.type === 'person';
  const title = sub.title || 'Untitled submission';
  const q = quote && (
    <div className={[s.cq, isQuote && s.lead].filter(Boolean).join(' ')}>
      “{quote.text}”{quote.attr && <span className={s.by}>{quote.attr}</span>}
    </div>
  );
  return (
    <Frame as="article" interactive tabIndex={0} className={[s.card, sub.archived && s.archived].filter(Boolean).join(' ')}
      aria-label={`${TYPE_LABEL[sub.type]}: ${title}`} onClick={onOpen}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(); }}>
      {isQuote && q}
      {hasMedia && (
        <div className={s.media}>
          {media}
          <div className={s.hov}>
            {!isPerson ? <div className={s.ttl}>{title}</div> : <span />}
            <Pills sub={sub} onTag={onTag} />
          </div>
        </div>
      )}
      {!isQuote && q}
      {!hasMedia && !quote && text && <div className={s.ctext}>{text.text}</div>}
      {(isPerson || (!hasMedia && !isQuote)) && (
        <div className={s.ctitle}>{title}{isPerson && <small>Person / Studio</small>}</div>
      )}
      {!hasMedia && <div className={s.cdots}><Pills sub={sub} onTag={onTag} /></div>}
      {sub.archived && <span className={s.archTag}>Archived</span>}
    </Frame>
  );
}
