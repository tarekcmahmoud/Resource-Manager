// The toolbar panel: pick images from the page you're on, add a note and tags,
// and save to the wall, without leaving the page. Requests go to the app with your
// normal sign-in cookie; the extension stores only the app's address.

const root = document.getElementById('app');
const state = { app: '', source: '', title: '', favicon: '', images: [], picked: [], notes: '', tags: [], allTags: [], existing: null, busy: false, error: '' };

/* ---------- tiny DOM helper (text only, never HTML strings) ---------- */
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'text') n.textContent = v;
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c);
  return n;
}
const show = (...nodes) => root.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
const message = (title, text, ...actions) => show(el('div', { class: 'state' }, el('b', { text: title }), text), ...actions);

/* ---------- talking to the app ---------- */
async function api(path, body) {
  let res;
  try {
    res = await fetch(new URL(path, state.app), {
      method: 'POST', credentials: 'include', redirect: 'manual',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch { throw Object.assign(new Error('The app could not be reached.'), { code: 'offline' }); }
  // Signed out: the app redirects to its sign-in page (opaque redirect) or answers 401.
  if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 307) throw Object.assign(new Error('Sign in to the app first.'), { code: 'signin' });
  const data = await res.json().catch(() => ({ error: `The app answered ${res.status}.` }));
  if (!res.ok || data.error) throw new Error(data.error || `The app answered ${res.status}.`);
  return data;
}

/* ---------- reading the page you're on ---------- */
// Runs inside the page. Collects images as the page shows them now, including ones loaded by scripts.
function collectFromPage() {
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return ''; } };
  const seen = new Set(), images = [];
  const add = (u, w, h) => {
    u = abs(u);
    if (!/^https?:/.test(u)) return;
    const key = u.split('#')[0];
    if (seen.has(key)) return;
    seen.add(key); images.push({ url: u, w, h });
  };
  const meta = (sel) => document.querySelector(sel)?.getAttribute('content') || '';
  const og = meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]');
  if (og) add(og, 0, 0);
  for (const img of document.images) {
    if (img.naturalWidth >= 150 && img.naturalHeight >= 100) add(img.currentSrc || img.src, img.naturalWidth, img.naturalHeight);
  }
  const icon = document.querySelector('link[rel~="icon"]')?.getAttribute('href');
  return { title: meta('meta[property="og:title"]') || document.title, favicon: abs(icon || '/favicon.ico'), images: images.slice(0, 60) };
}

async function readPage(tabId, url) {
  if (tabId != null) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: collectFromPage });
      if (result) return result;
    } catch { /* restricted page or no access: ask the app to read it instead */ }
  }
  const info = await api('/api/page-info', { url });
  return { title: info.title, favicon: info.favicon, images: info.images.map((u) => ({ url: u, w: 0, h: 0 })) };
}

/* ---------- start ---------- */
async function init() {
  state.app = (await chrome.storage.sync.get('app')).app || '';
  if (!state.app) {
    return message('Set up the extension', 'Add the address of your Resource Manager first.',
      el('button', { class: 'btn primary', onclick: () => chrome.runtime.openOptionsPage(), text: 'Open settings' }));
  }
  const origin = new URL(state.app).origin + '/*';
  if (!(await chrome.permissions.contains({ origins: [origin] }))) {
    return message('One more permission', 'The extension needs permission to talk to your app.',
      el('button', { class: 'btn primary', text: 'Allow', onclick: async () => { if (await chrome.permissions.request({ origins: [origin] })) init(); } }));
  }

  // A right-click item may have left something for this panel (only trust it if it's fresh).
  const { pending } = await chrome.storage.session.get('pending');
  await chrome.storage.session.remove('pending');
  const fresh = pending && Date.now() - pending.at < 15000 ? pending : null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const fromLink = !!fresh?.link;
  state.source = fromLink ? fresh.link : (fresh?.page || tab?.url || '');
  if (!/^https?:/i.test(state.source)) return message("This page can't be saved", 'Only web pages (http and https) can be saved to the wall.');

  message('Reading the page…', '');
  try {
    const [ctx, page] = await Promise.all([
      api('/api/ext/context', { url: state.source }),
      readPage(fromLink ? null : tab?.id, state.source),
    ]);
    Object.assign(state, { allTags: ctx.tags, existing: ctx.existing });
    state.title = fresh?.title && !fromLink ? fresh.title : page.title || tab?.title || '';
    state.favicon = page.favicon;
    state.images = page.images;
    if (fresh?.image && /^https?:/i.test(fresh.image)) {
      // The right-clicked image goes first and is picked already.
      state.images = [{ url: fresh.image, w: 0, h: 0 }, ...state.images.filter((i) => i.url !== fresh.image)];
      state.picked = [fresh.image];
    }
    render();
  } catch (e) {
    if (e.code === 'signin') {
      return message('Sign in first', 'Sign in to Resource Manager in a tab, then open this again.',
        el('button', { class: 'btn primary', text: 'Open sign-in', onclick: () => chrome.tabs.create({ url: new URL('/login', state.app).href }) }));
    }
    message("Couldn't read the page", e.message, el('button', { class: 'btn', text: 'Use the full form', onclick: openFullForm }));
  }
}

/* ---------- the form ---------- */
function ratioOf(url) {
  const img = state.images.find((i) => i.url === url);
  if (img?.w && img?.h) return img.h / img.w;
  const shown = root.querySelector(`img[data-src="${CSS.escape(url)}"]`);
  return shown?.naturalWidth ? shown.naturalHeight / shown.naturalWidth : 0.75;
}

function togglePick(url) {
  const i = state.picked.indexOf(url);
  if (i >= 0) state.picked.splice(i, 1); else state.picked.push(url);
  render(`[data-tile="${CSS.escape(url)}"]`);
}

function addTag(input) {
  const v = input.value.trim().toLowerCase();
  if (v && !state.tags.includes(v)) state.tags.push(v);
  input.value = '';
  render('#tag');
}

function chip(label, on, onclick) {
  return el('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), onclick, text: label });
}

function render(focus) {
  // Re-rendering replaces the panel, so keep the scroll positions where they were.
  const gridTop = root.querySelector('.grid')?.scrollTop ?? 0, pageTop = document.scrollingElement.scrollTop;
  draw();
  const grid = root.querySelector('.grid');
  if (grid) grid.scrollTop = gridTop;
  document.scrollingElement.scrollTop = pageTop;
  if (focus) root.querySelector(focus)?.focus();
}

function draw() {
  let host = '';
  try { host = new URL(state.source).hostname.replace(/^www\./, ''); } catch { /* shown blank */ }

  show(
    el('div', { class: 'head' },
      state.favicon && el('img', { src: state.favicon, alt: '', onerror: (e) => e.target.remove() }),
      el('span', { text: host })),
    state.existing && el('div', { class: 'dupe' },
      el('span', { text: `Already on your wall as ${state.existing.title || 'Untitled'}.` }),
      el('button', { type: 'button', class: 'link', text: 'Open', onclick: () => chrome.tabs.create({ url: new URL(`/wall?open=${encodeURIComponent(state.existing.id)}`, state.app).href }) })),
    el('input', { class: 'inp', value: state.title, placeholder: 'Title', 'aria-label': 'Title', oninput: (e) => { state.title = e.target.value; } }),

    el('div', { class: 'label' }, el('span', { text: 'Images' }), el('span', { text: state.picked.length ? `${state.picked.length} picked, in this order` : 'Click to pick' })),
    state.images.length
      ? el('div', { class: 'grid' }, state.images.map((im) => {
        const at = state.picked.indexOf(im.url);
        return el('button', { type: 'button', class: 'tile', 'data-tile': im.url, 'aria-pressed': String(at >= 0), 'aria-label': at >= 0 ? `Picked, position ${at + 1}` : 'Pick image', onclick: () => togglePick(im.url) },
          el('img', { src: im.url, 'data-src': im.url, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: (e) => { if (!state.picked.includes(im.url)) e.target.closest('.tile').hidden = true; } }),
          at >= 0 ? el('span', { class: 'num', text: String(at + 1) }) : el('span', { class: 'ring' }));
      }))
      : el('p', { class: 'none', text: 'No images found on this page. You can still save it.' }),

    el('textarea', { class: 'inp', rows: '2', placeholder: 'Why are you saving this?', 'aria-label': 'Note', oninput: (e) => { state.notes = e.target.value; } }, state.notes),

    el('div', { class: 'label' }, el('span', { text: 'Tags' })),
    state.tags.length > 0 && el('div', { class: 'chips' }, state.tags.map((t) => chip(`${t} ×`, true, () => { state.tags = state.tags.filter((x) => x !== t); render(); }))),
    el('input', { id: 'tag', class: 'inp', list: 'tag-list', placeholder: 'Add a tag, then press Enter', 'aria-label': 'Add a tag', onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(e.target); } } }),
    el('datalist', { id: 'tag-list' }, state.allTags.filter((t) => !state.tags.includes(t)).map((t) => el('option', { value: t }))),

    state.error && el('p', { class: 'err', text: state.error }),
    el('div', { class: 'foot' },
      el('button', { type: 'button', class: 'link', text: 'Full form', onclick: openFullForm }),
      el('button', { type: 'button', class: 'btn primary', disabled: state.busy, onclick: save, text: state.busy ? (state.picked.length ? 'Copying images…' : 'Saving…') : 'Save to wall' })),
  );
}

async function save() {
  if (state.busy) return;
  state.busy = true; state.error = '';
  render();
  try {
    const r = await api('/api/ext/save', {
      url: state.source, title: state.title, notes: state.notes, tags: state.tags,
      images: state.picked.map((url) => ({ url, ratio: ratioOf(url) })),
    });
    message('Saved to the wall', r.failed ? `${r.failed} image${r.failed === 1 ? '' : 's'} couldn't be copied; the rest were saved.` : '',
      el('button', { class: 'btn', text: 'Open on the wall', onclick: () => chrome.tabs.create({ url: new URL(`/wall?open=${encodeURIComponent(r.id)}`, state.app).href }) }));
    if (!r.failed) setTimeout(() => window.close(), 1400);
  } catch (e) {
    state.busy = false;
    state.error = e.code === 'signin' ? 'Your sign-in ended. Sign in to the app in a tab, then try again.' : e.message;
    render();
  }
}

/** The app's complete form (blocks, quotes, text, type, width) in its own window. */
function openFullForm() {
  const url = new URL('/save', state.app);
  url.searchParams.set('url', state.source);
  if (state.title) url.searchParams.set('title', state.title);
  if (state.picked[0]) url.searchParams.set('image', state.picked[0]);
  chrome.windows.create({ url: url.href, type: 'popup', width: 680, height: 860, focused: true });
  window.close();
}

init();
