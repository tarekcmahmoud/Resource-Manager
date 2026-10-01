'use client';
/* eslint-disable @next/next/no-img-element -- previews are local object URLs and signed storage URLs */
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import {
  BUCKET, fallbackTitle, mediaPaths, normUrl, TYPES, videoInfo,
  type Block, type SubType, type Submission,
} from '@/lib/wall/data';
import { srcOf, type Urls } from './Card';
import { fetchPageInfo, importImage } from '@/lib/pageInfo';
import s from './wall.module.css';

const MAX_MB = 20;
const uuid = () => crypto.randomUUID();

type DImg = { id: string; path?: string; url?: string; ratio: number; preview?: string; uploading?: boolean };
/** Images found on a pasted page link, to pick from. */
type PageFind = { status: 'loading' | 'done' | 'error'; url: string; site: string; found: { id: string; url: string }[]; error?: string };
type DBlock =
  | { id: string; kind: 'images'; images: DImg[]; page?: PageFind }
  | { id: string; kind: 'video'; url: string }
  | { id: string; kind: 'anim'; path?: string; url?: string; ratio?: number; mime?: string; preview?: string; uploading?: boolean }
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'quote'; text: string; attr: string };
type Kind = DBlock['kind'];
export type Draft = {
  variant: 'quick' | 'extended'; type: SubType; span: 1 | 2 | 3; title: string; source: string; notes: string;
  tags: string[]; boards: string[]; blocks: DBlock[];
};

const KIND_NAME: Record<Kind, string> = { images: 'Images', video: 'Video', anim: 'Animation', text: 'Text', quote: 'Quote' };
const blank = (kind: Kind): DBlock =>
  kind === 'images' ? { id: uuid(), kind, images: [] } : kind === 'quote' ? { id: uuid(), kind, text: '', attr: '' }
    : kind === 'text' ? { id: uuid(), kind, text: '' } : { id: uuid(), kind, url: '' } as DBlock;

export function draftFrom(sub: Submission | null): Draft {
  if (!sub) return { variant: 'quick', type: 'project', span: 1, title: '', source: '', notes: '', tags: [], boards: [], blocks: [blank('images')] };
  return {
    variant: 'extended', type: sub.type, span: sub.span ?? 1, title: sub.title, source: sub.source, notes: sub.notes,
    tags: [...sub.tags], boards: [...sub.boards],
    blocks: sub.blocks.map((b): DBlock => {
      if (b.kind === 'images') return { id: uuid(), kind: 'images', images: b.images.map((im) => ({ ...im, id: uuid() })) };
      if (b.kind === 'quote') return { id: uuid(), kind: 'quote', text: b.text, attr: b.attr ?? '' };
      return { ...b, id: uuid() } as DBlock;
    }),
  };
}

function toBlocks(d: Draft): Block[] {
  const out: Block[] = [];
  for (const b of d.blocks) {
    if (b.kind === 'images' && b.images.length) out.push({ kind: 'images', images: b.images.map(({ path, url, ratio }) => (path ? { path, ratio } : { url, ratio })) });
    if (b.kind === 'video' && b.url.trim()) out.push({ kind: 'video', url: b.url.trim() });
    if (b.kind === 'anim' && (b.path || b.url?.trim())) out.push(b.path ? { kind: 'anim', path: b.path, ratio: b.ratio, mime: b.mime } : { kind: 'anim', url: b.url!.trim(), ratio: b.ratio });
    if (b.kind === 'text' && b.text.trim()) out.push({ kind: 'text', text: b.text.trim() });
    if (b.kind === 'quote' && b.text.trim()) out.push({ kind: 'quote', text: b.text.trim(), ...(b.attr.trim() && { attr: b.attr.trim() }) });
  }
  return out;
}

/** Height ÷ width of an image or video file, read from the browser. */
function measure(src: string, video: boolean): Promise<number> {
  return new Promise((res) => {
    if (video) {
      const v = document.createElement('video');
      v.onloadedmetadata = () => res(v.videoWidth ? v.videoHeight / v.videoWidth : 0.75);
      v.onerror = () => res(0.75);
      v.src = src;
    } else {
      const i = new Image();
      i.onload = () => res(i.naturalWidth ? i.naturalHeight / i.naturalWidth : 0.75);
      i.onerror = () => res(0.75);
      i.src = src;
    }
  });
}

type Props = {
  db: SupabaseClient; userId: string; existing: Submission | null; initial: Draft; initialFiles?: File[]; initialUploads?: string[];
  /** From the Chrome extension: a page to read for images, and/or one image to copy in. */
  prefill?: { page?: string; image?: string };
  urls: Urls; all: Submission[]; tagOptions: string[]; boardOptions: string[];
  onSave: (sub: Submission, newUrls: Urls, removedPaths: string[]) => void;
  onCancel: (draft: Draft, uploaded: string[]) => void;
  onOpenExisting: (id: string) => void;
  toast: (msg: string) => void;
};

export function SubmissionForm(p: Props) {
  const [d, setD] = useState<Draft>(p.initial);
  const [err, setErr] = useState('');
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [boardIn, setBoardIn] = useState('');
  const [over, setOver] = useState<string | null>(null);
  const uploaded = useRef<string[]>(p.initialUploads ?? []);
  const [signed, setSigned] = useState<Urls>({});
  const fileFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const animFileFor = useRef<string | null>(null);
  const animInput = useRef<HTMLInputElement>(null);
  const dragBlk = useRef<string | null>(null);
  const dragTh = useRef<{ block: string; id: string } | null>(null);
  const ext = d.variant === 'extended';

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setBlock = (id: string, fn: (b: DBlock) => DBlock) => setD((x) => ({ ...x, blocks: x.blocks.map((b) => (b.id === id ? fn(b) : b)) }));
  /** Adds or removes an image in an images block by id. */
  const patchImg = (id: string, patch: Partial<DImg> | null) => setD((x) => ({
    ...x, blocks: x.blocks.map((b) => (b.kind === 'images' && b.images.some((i) => i.id === id)
      ? { ...b, images: patch ? b.images.map((i) => (i.id === id ? { ...i, ...patch } : i)) : b.images.filter((i) => i.id !== id) } : b)),
  }));


  /* ---------- uploads ---------- */
  async function upload(file: File) {
    const extn = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : file.type.split('/')[1] ?? 'bin';
    const path = `${p.userId}/${uuid()}.${extn}`;
    const { error } = await p.db.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    if (error) throw new Error(error.message);
    uploaded.current.push(path);
    const { data } = await p.db.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
    if (data?.signedUrl) setSigned((x) => ({ ...x, [path]: data.signedUrl }));
    return path;
  }

  function addFiles(files: File[], blockId?: string) {
    for (const f of files) {
      const anim = /image\/gif|video\//.test(f.type), img = f.type.startsWith('image/');
      if (!anim && !img) continue;
      if (f.size > MAX_MB * 1024 * 1024) { p.toast(`${f.name} is larger than ${MAX_MB} MB and was skipped.`); continue; }
      const preview = URL.createObjectURL(f), id = uuid();
      if (anim) {
        setD((x) => ({ ...x, blocks: [...x.blocks, { id, kind: 'anim', preview, uploading: true, mime: f.type }] }));
        measure(preview, f.type.startsWith('video/')).then((ratio) => setBlock(id, (b) => ({ ...b, ratio })));
        upload(f).then((path) => setBlock(id, (b) => ({ ...b, path, uploading: false })))
          .catch((e) => { p.toast(`Couldn't upload ${f.name}. ${e.message}`); setD((x) => ({ ...x, blocks: x.blocks.filter((b) => b.id !== id) })); });
        continue;
      }
      setD((x) => {
        let target = x.blocks.find((b) => b.id === blockId && b.kind === 'images') ?? x.blocks.find((b) => b.kind === 'images');
        const blocks = target ? x.blocks : [...x.blocks, (target = blank('images'))];
        return { ...x, blocks: blocks.map((b) => (b.id === target!.id && b.kind === 'images' ? { ...b, images: [...b.images, { id, ratio: 0.75, preview, uploading: true }] } : b)) };
      });
      measure(preview, false).then((ratio) => patchImg(id, { ratio }));
      upload(f).then((path) => patchImg(id, { path, uploading: false }))
        .catch((e) => { p.toast(`Couldn't upload ${f.name}. ${e.message}`); patchImg(id, null); });
    }
    setErr('');
  }

  // Files dropped on the wall open the form with them.
  const initialFiles = useRef(p.initialFiles);
  const prefill = useRef(p.prefill);
  useEffect(() => {
    if (initialFiles.current?.length) addFiles(initialFiles.current);
    initialFiles.current = undefined;
    const pre = prefill.current, block = p.initial.blocks.find((b) => b.kind === 'images')?.id;
    prefill.current = undefined;
    if (pre && block) {
      // An image the browser can't hand over (inline data, a blob) falls back to reading the page.
      if (pre.image && /^https?:/i.test(pre.image)) importInto(block, uuid(), pre.image, pre.page);
      else if (pre.page && /^https?:/i.test(pre.page)) addLink(block, pre.page);
      if (pre.image && !/^https?:/i.test(pre.image)) p.toast("That image can't be copied directly. Pick it from the page's images instead.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Copies an image from another site into storage, showing it straight away while it copies. */
  function importInto(blockId: string, id: string, url: string, referer?: string) {
    setBlock(blockId, (b) => (b.kind === 'images' ? { ...b, images: [...b.images, { id, ratio: 0.75, preview: url, uploading: true }] } : b));
    measure(url, false).then((ratio) => patchImg(id, { ratio }));
    importImage(url, referer).then((r) => {
      uploaded.current.push(r.path);
      setSigned((x) => ({ ...x, [r.path]: r.url }));
      patchImg(id, { path: r.path, uploading: false });
    }).catch((e) => { p.toast(`Couldn't copy that image. ${e.message}`); patchImg(id, null); });
  }

  /** A pasted or typed address: image and animation files are copied in; pages are read for their images. */
  function addLink(blockId: string, raw: string) {
    let url = raw.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (/\.(gif|mp4)(\?.*)?$/i.test(url)) {
      const id = uuid();
      setD((x) => ({ ...x, blocks: [...x.blocks, { id, kind: 'anim', preview: url, uploading: true }] }));
      measure(url, /\.mp4/i.test(url)).then((ratio) => setBlock(id, (b) => ({ ...b, ratio })));
      importImage(url).then((r) => {
        uploaded.current.push(r.path);
        setSigned((x) => ({ ...x, [r.path]: r.url }));
        setBlock(id, (b) => ({ ...b, path: r.path, mime: r.mime, uploading: false }));
      }).catch((e) => { p.toast(`Couldn't copy that animation. ${e.message}`); setD((x) => ({ ...x, blocks: x.blocks.filter((b) => b.id !== id) })); });
      return;
    }
    if (/\.(png|jpe?g|webp|avif)(\?.*)?$/i.test(url)) { importInto(blockId, uuid(), url); return; }

    if (!d.source) set({ source: url });
    const site = url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0];
    setBlock(blockId, (b) => (b.kind === 'images' ? { ...b, page: { status: 'loading', url, site, found: [] } } : b));
    fetchPageInfo(url).then((info) => {
      setD((x) => ({ ...x, title: x.title || info.title }));
      setBlock(blockId, (b) => (b.kind === 'images' ? {
        ...b, page: { status: 'done', url: info.url, site: info.siteName || site, found: info.images.map((u) => ({ id: uuid(), url: u })) },
      } : b));
    }).catch((e) => setBlock(blockId, (b) => (b.kind === 'images' ? { ...b, page: { status: 'error', url, site, found: [], error: e.message } } : b)));
  }

  /** Picking a found image copies it in; picking it again takes it out. */
  function togglePick(b: Extract<DBlock, { kind: 'images' }>, f: { id: string; url: string }) {
    if (b.images.some((i) => i.id === f.id)) patchImg(f.id, null);
    else importInto(b.id, f.id, f.url, b.page?.url);
  }

  function onPaste(e: ClipboardEvent, blockId: string) {
    const cd = e.clipboardData;
    if (cd.files.length) { e.preventDefault(); addFiles([...cd.files], blockId); return; }
    if ((e.target as HTMLElement).matches('input')) return;
    const t = cd.getData('text');
    if (/^\s*(https?:\/\/|www\.)/i.test(t)) { e.preventDefault(); addLink(blockId, t); }
  }

  /* ---------- drag: files anywhere, blocks by grip, thumbnails within a block ---------- */
  function onDragOver(e: DragEvent) {
    e.preventDefault();
    const t = e.target as HTMLElement;
    const key = dragBlk.current ? t.closest<HTMLElement>('[data-blk]')?.dataset.blk
      : dragTh.current ? t.closest<HTMLElement>('[data-th]')?.dataset.th
        : t.closest<HTMLElement>('[data-drop]')?.dataset.drop;
    setOver(key ?? null);
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(null);
    const t = e.target as HTMLElement;
    if (dragBlk.current) {
      const to = t.closest<HTMLElement>('[data-blk]')?.dataset.blk, from = dragBlk.current;
      dragBlk.current = null;
      if (to && to !== from) setD((x) => {
        const blocks = x.blocks.filter((b) => b.id !== from), moving = x.blocks.find((b) => b.id === from)!;
        blocks.splice(blocks.findIndex((b) => b.id === to) + (x.blocks.findIndex((b) => b.id === from) < x.blocks.findIndex((b) => b.id === to) ? 1 : 0), 0, moving);
        return { ...x, blocks };
      });
      return;
    }
    if (dragTh.current) {
      const to = t.closest<HTMLElement>('[data-th]')?.dataset.th, { block, id } = dragTh.current;
      dragTh.current = null;
      if (to && to !== id) setBlock(block, (b) => {
        if (b.kind !== 'images') return b;
        const imgs = b.images.filter((i) => i.id !== id), m = b.images.find((i) => i.id === id);
        const at = imgs.findIndex((i) => i.id === to);
        if (!m || at < 0) return b;
        imgs.splice(b.images.findIndex((i) => i.id === id) <= at ? at + 1 : at, 0, m);
        return { ...b, images: imgs };
      });
      return;
    }
    const drop = t.closest<HTMLElement>('[data-drop]')?.dataset.drop;
    if (e.dataTransfer.files.length) { addFiles([...e.dataTransfer.files], drop); return; }
    const u = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text')).trim();
    if (/^https?:\/\//.test(u)) {
      const target = drop ?? d.blocks.find((b) => b.kind === 'images')?.id;
      if (target) addLink(target, u);
      else { const b = blank('images'); setD((x) => ({ ...x, blocks: [...x.blocks, b] })); addLink(b.id, u); }
    }
  }
  function moveBlock(id: string, dir: -1 | 1) {
    setD((x) => {
      const i = x.blocks.findIndex((b) => b.id === id), j = i + dir;
      if (j < 0 || j >= x.blocks.length) return x;
      const blocks = [...x.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...x, blocks };
    });
  }

  /* ---------- tags and boards ---------- */
  const tags = useMemo(() => [...new Set([...p.tagOptions, ...d.tags])].sort(), [p.tagOptions, d.tags]);
  const toggleTag = (t: string) => set({ tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t] });
  function addTag() {
    const v = tagQuery.trim().toLowerCase();
    if (!v) return;
    if (!d.tags.includes(v)) set({ tags: [...d.tags, v] });
    setTagQuery('');
  }
  function addBoard() {
    const v = boardIn.trim();
    if (!v) return;
    if (!d.boards.some((b) => b.toLowerCase() === v.toLowerCase())) set({ boards: [...d.boards, v] });
    setBoardIn('');
  }

  /* ---------- save / cancel ---------- */
  const dupe = useMemo(() => {
    const n = normUrl(d.source);
    return n ? p.all.find((x) => x.id !== p.existing?.id && normUrl(x.source) === n) : undefined;
  }, [d.source, p.all, p.existing]);
  const busy = d.blocks.some((b) => (b.kind === 'images' ? b.images.some((i) => i.uploading) : b.kind === 'anim' && b.uploading));

  function save() {
    if (busy) return;
    const blocks = toBlocks(d);
    if (!blocks.length) { setErr('Add at least one image, video, animation, text or quote before saving.'); return; }
    const now = new Date().toISOString();
    const sub: Submission = {
      id: p.existing?.id ?? uuid(), type: d.type, title: d.title.trim() || fallbackTitle(d.source.trim(), blocks),
      source: d.source.trim(), notes: d.notes.trim(), tags: d.tags, boards: d.boards, blocks,
      archived: p.existing?.archived ?? false, span: d.span, saved_at: p.existing?.saved_at ?? now, updated_at: now,
    };
    const kept = new Set(mediaPaths(blocks));
    const removed = [...(p.existing ? mediaPaths(p.existing.blocks) : []), ...uploaded.current].filter((x) => !kept.has(x));
    p.onSave(sub, signed, removed);
  }
  const cancel = () => p.onCancel(d, uploaded.current);

  /* ---------- render ---------- */
  const preview = (x: { path?: string; url?: string; preview?: string }) => x.preview ?? srcOf(x, { ...p.urls, ...signed });

  function blockBody(b: DBlock) {
    if (b.kind === 'images') return (
      <>
        <div className={[s.drop, over === b.id && s.over].filter(Boolean).join(' ')} data-drop={b.id} tabIndex={0}
          aria-label="Image box. Drop images, paste them, or paste an image link" onPaste={(e) => onPaste(e, b.id)}>
          <div className={s.dropEmpty}>
            <Icon name="upload" size={22} />
            <b>Drop images here</b>
            <span>Paste an image with ⌘V, or paste a page link below to pick from its images.</span>
            <Button size="sm" onClick={() => { fileFor.current = b.id; fileInput.current?.click(); }}>Browse files</Button>
          </div>
          <label className={s.linkf}>
            <span className={s.linkRow}>
              <Icon name="link" />
              <input type="url" placeholder="Paste an image or page link, then press Enter" aria-label="Image or page link"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(b.id, e.currentTarget.value); e.currentTarget.value = ''; } }} />
            </span>
          </label>
        </div>
        {b.page && (
          <div className={s.found}>
            <div className={s.stripHead}>
              <span><b>{b.page.site}</b> {b.page.status === 'loading' ? 'Looking for images…' : b.page.status === 'error' ? b.page.error : `${b.page.found.length} image${b.page.found.length === 1 ? '' : 's'} found. Pick the ones to keep.`}</span>
              {b.page.status !== 'loading' && (
                <button type="button" className={s.clear} onClick={() => setBlock(b.id, (x) => (x.kind === 'images' ? { ...x, page: undefined } : x))}>Clear</button>
              )}
            </div>
            <div className={s.pgrid}>
              {b.page.status === 'loading' && Array.from({ length: 8 }, (_, k) => <span key={k} className={`${s.tile} ${s.skel}`} aria-hidden="true" />)}
              {b.page.found.map((f) => {
                const at = b.images.findIndex((i) => i.id === f.id);
                return (
                  <button key={f.id} type="button" className={s.tile} aria-pressed={at >= 0} onClick={() => togglePick(b, f)}
                    aria-label={`Image from the page${at >= 0 ? `, position ${at + 1}` : ''}`}>
                    <img src={f.url} alt="" loading="lazy" referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget.parentElement as HTMLElement).hidden = true; }} />
                    {at >= 0 ? <span className={s.num}>{at + 1}</span> : <span className={s.ring} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {b.images.length > 0 && (
          <div className={s.strip}>
            <div className={s.stripHead}><b>In wall order</b><span>Drag to reorder</span></div>
            <div className={s.thumbs}>
              {b.images.map((im, k) => (
                <div key={im.id} className={[s.th, over === im.id && s.over].filter(Boolean).join(' ')} draggable data-th={im.id}
                  onDragStart={(e) => { dragTh.current = { block: b.id, id: im.id }; e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { dragTh.current = null; setOver(null); }}>
                  {preview(im) && <img src={preview(im)} alt="" />}
                  <span className={s.num}>{k + 1}</span>
                  {im.uploading && <span className={s.uploading} aria-label="Uploading" />}
                  <button type="button" onClick={() => setBlock(b.id, (x) => (x.kind === 'images' ? { ...x, images: x.images.filter((i) => i.id !== im.id) } : x))}
                    aria-label={`Remove image ${k + 1}`}><Icon name="x" size={11} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
    if (b.kind === 'video') {
      const v = b.url ? videoInfo(b.url) : null;
      return (
        <>
          <input className={s.inp} value={b.url} placeholder="Paste a YouTube or Vimeo link" aria-label="Video link"
            onChange={(e) => setBlock(b.id, (x) => ({ ...x, url: e.target.value }))} />
          <p className={s.hint}>{!b.url ? 'The video plays in the focus view.' : v ? `${v.site} video` : 'Only YouTube and Vimeo links can be embedded. Others show as a link.'}</p>
        </>
      );
    }
    if (b.kind === 'anim') {
      const src = preview(b);
      return (
        <>
          {!b.path && !b.preview && (
            <div className={s.brow}>
              <input className={s.inp} value={b.url ?? ''} placeholder="Paste a GIF, WebP or MP4 address" aria-label="Animation address"
                onChange={(e) => setBlock(b.id, (x) => ({ ...x, url: e.target.value }))} />
              <Button onClick={() => { animFileFor.current = b.id; animInput.current?.click(); }}><Icon name="upload" size={14} />Upload</Button>
            </div>
          )}
          {src && (
            <div className={s.aprev}>
              {b.mime?.startsWith('video/') || /\.(mp4|webm)/i.test(src) ? <video src={src} autoPlay muted loop playsInline /> : <img src={src} alt="" />}
              {b.uploading && <span className={s.uploading} aria-label="Uploading" />}
            </div>
          )}
        </>
      );
    }
    if (b.kind === 'text') return (
      <textarea className={s.inp} rows={3} value={b.text} placeholder="Text or excerpt" aria-label="Text"
        onChange={(e) => setBlock(b.id, (x) => ({ ...x, text: e.target.value }))} />
    );
    return (
      <>
        <textarea className={s.inp} rows={3} value={b.text} placeholder="Paste the quote" aria-label="Quote"
          onChange={(e) => setBlock(b.id, (x) => ({ ...x, text: e.target.value }))} />
        <input className={s.inp} value={b.attr} placeholder="Who said it (optional)" aria-label="Who said it"
          onChange={(e) => setBlock(b.id, (x) => ({ ...x, attr: e.target.value }))} />
      </>
    );
  }

  const variant = (
    <div className={s.seg} role="group" aria-label="Form variant">
      <button type="button" aria-pressed={!ext} onClick={() => set({ variant: 'quick' })}>Quick</button>
      <button type="button" aria-pressed={ext} onClick={() => set({ variant: 'extended' })}>Extended</button>
    </div>
  );

  return (
    <Dialog title={p.existing ? 'Edit submission' : 'New submission'} onClose={cancel} wide actions={variant}>
      <div className={s.form} onDragOver={onDragOver} onDrop={onDrop} onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(null); }}>
        {ext && (
          <>
            <Sect n="1" title="Type">
              <div className={`${s.seg} ${s.segWide}`} role="group" aria-label="Submission type">
                {TYPES.map(([k, label]) => <button key={k} type="button" aria-pressed={d.type === k} onClick={() => set({ type: k })}>{label}</button>)}
              </div>
            </Sect>
            <Sect n="" title="Width on the wall">
              <div className={`${s.seg} ${s.segWide}`} role="group" aria-label="Width on the wall">
                {([1, 2, 3] as const).map((n) => (
                  <button key={n} type="button" aria-pressed={d.span === n} onClick={() => set({ span: n })}>{n} column{n > 1 ? 's' : ''}</button>
                ))}
              </div>
            </Sect>
            <Sect n="2" title="Title">
              <input className={s.inp} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Name this submission" aria-label="Title" autoFocus />
              <label className={s.field}>Source link
                <input className={s.inp} value={d.source} onChange={(e) => set({ source: e.target.value })} placeholder="Paste the page address" inputMode="url" />
              </label>
              {dupe && (
                <div className={s.dupe}>
                  <span>Already saved as {dupe.title || 'Untitled submission'}.</span>
                  <Button size="sm" onClick={() => { cancel(); p.onOpenExisting(dupe.id); }}>Open it</Button>
                </div>
              )}
            </Sect>
            <Sect n="3" title="Notes">
              <textarea className={s.inp} rows={3} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Why are you saving this?" aria-label="Notes" />
            </Sect>
            <Sect n="4" title="Tags">
              <div className={[s.tagBox, tagsOpen && s.open].filter(Boolean).join(' ')}>
                <button type="button" className={s.tagToggle} onClick={() => setTagsOpen(!tagsOpen)} aria-expanded={tagsOpen}>
                  <span className={s.chipRow}>{d.tags.length ? d.tags.map((t) => <span key={t} className={s.boardChip}>{t}</span>) : <span className={s.meta}>No tags yet</span>}</span>
                  <span className={s.tagCount}>{tagsOpen ? 'Hide' : 'All tags'} {tags.length}<Icon name="chev" size={14} /></span>
                </button>
                {tagsOpen && (
                  <div className={s.tagBody}>
                    <div className={s.chipRow}>
                      {tags.filter((t) => !tagQuery || t.includes(tagQuery.trim().toLowerCase())).map((t) => (
                        <Chip key={t} selected={d.tags.includes(t)} onClick={() => toggleTag(t)}>{t}</Chip>
                      ))}
                    </div>
                    <input className={s.inp} value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} placeholder="Search or add a tag, then press Enter"
                      aria-label="Search or add a tag" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                  </div>
                )}
              </div>
            </Sect>
            <Sect n="" title="Boards" hint="Any number">
              {d.boards.length > 0 && (
                <div className={s.chipRow}>
                  {d.boards.map((b) => (
                    <span key={b} className={s.boardChip}>{b}
                      <button type="button" onClick={() => set({ boards: d.boards.filter((x) => x !== b) })} aria-label={`Remove from ${b}`}><Icon name="x" size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className={s.brow}>
                <input className={s.inp} value={boardIn} onChange={(e) => setBoardIn(e.target.value)} list="wall-boards" placeholder="Add to a board"
                  aria-label="Add to a board" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBoard(); } }} />
                <Button onClick={addBoard}>Add</Button>
              </div>
              <datalist id="wall-boards">{p.boardOptions.filter((b) => !d.boards.includes(b)).map((b) => <option key={b} value={b} />)}</datalist>
            </Sect>
          </>
        )}

        <Sect n={ext ? '5' : ''} title="Content" hint="Drop files anywhere on the form">
          <div className={s.blocks}>
            {d.blocks.map((b, i) => (
              <div key={b.id} data-blk={b.id} className={[s.blk, over === b.id && s.over].filter(Boolean).join(' ')}>
                <button type="button" className={s.grip} draggable aria-label={`Move ${KIND_NAME[b.kind]} block. Use the up and down arrow keys`}
                  onDragStart={(e) => { dragBlk.current = b.id; e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { dragBlk.current = null; setOver(null); }}
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); moveBlock(b.id, e.key === 'ArrowUp' ? -1 : 1); } }}>
                  <Icon name="grip" />
                </button>
                <div className={s.bmain}><div className={s.bhead}>{i + 1}. {KIND_NAME[b.kind]}</div>{blockBody(b)}</div>
                <button type="button" className={s.brm} onClick={() => setD((x) => ({ ...x, blocks: x.blocks.filter((y) => y.id !== b.id) }))}
                  aria-label={`Remove ${KIND_NAME[b.kind]} block`}><Icon name="x" size={14} /></button>
              </div>
            ))}
            {!d.blocks.length && <p className={s.meta}>Add a block to start.</p>}
          </div>
          <div className={s.addRow}>
            {(Object.keys(KIND_NAME) as Kind[]).map((k) => (
              <Button key={k} size="sm" onClick={() => { setD((x) => ({ ...x, blocks: [...x.blocks, blank(k)] })); setErr(''); }}>
                <Icon name="add" size={13} />{KIND_NAME[k]}
              </Button>
            ))}
          </div>
          {err && <p className={s.err}>{err}</p>}
        </Sect>

        <div className={s.fmFoot}>
          <p className={s.hint}>{ext ? 'Anything left empty can be filled in later with Edit.' : 'Saves straight to the wall. Add a type, title, notes, tags and boards later with Edit, or switch to Extended now.'}</p>
          <div className={s.footR}>
            <Button onClick={cancel}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Uploading…' : 'Save'}</Button>
          </div>
        </div>

        <input ref={fileInput} type="file" accept="image/*,video/mp4" multiple hidden
          onChange={(e) => { addFiles([...(e.target.files ?? [])], fileFor.current ?? undefined); e.target.value = ''; }} />
        <input ref={animInput} type="file" accept="image/gif,image/webp,video/mp4" hidden onChange={(e) => {
          const f = e.target.files?.[0], id = animFileFor.current;
          e.target.value = '';
          if (!f || !id) return;
          if (f.size > MAX_MB * 1024 * 1024) { p.toast(`That file is larger than ${MAX_MB} MB. Link to it instead.`); return; }
          const pv = URL.createObjectURL(f);
          setBlock(id, (b) => (b.kind === 'anim' ? { ...b, preview: pv, uploading: true, mime: f.type, url: undefined } : b));
          measure(pv, f.type.startsWith('video/')).then((ratio) => setBlock(id, (b) => ({ ...b, ratio })));
          upload(f).then((path) => setBlock(id, (b) => ({ ...b, path, uploading: false })))
            .catch((er) => { p.toast(`Couldn't upload ${f.name}. ${er.message}`); setBlock(id, (b) => ({ ...b, preview: undefined, uploading: false })); });
        }} />
      </div>
    </Dialog>
  );
}

function Sect({ n, title, hint, children }: { n: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={s.sect}>
      <div className={s.sh}><div><span className={s.n}>{n}</span><b>{title}</b></div>{hint && <span className={s.hint}>{hint}</span>}</div>
      {children}
    </section>
  );
}
