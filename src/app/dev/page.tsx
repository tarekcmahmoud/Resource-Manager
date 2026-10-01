import type { ReactNode } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/TopBar';
import { Frame } from '@/components/Frame';
import { ButtonLink } from '@/components/Button';
import { Icon } from '@/components/Icon';
import s from './dev.module.css';

export const metadata = { title: 'Dev · Resource Manager' };

const REPO = 'https://github.com/tarekcmahmoud/Resource-Manager';

/**
 * Downloads for collaborators: the Claude handoff, the interface files and the Chrome
 * extension. Files are built into /downloads by scripts/build-downloads.mjs on every deploy.
 * Open without signing in, so a co-worker can use it.
 */
export default async function DevPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main className={s.page}>
      <TopBar current="dev" signedIn={!!user} />
      <div className={s.body}>
        <header className={s.intro}>
          <h1>Dev</h1>
          <p>Everything you need to help with Resource Manager. The code is on GitHub at <a href={REPO}>tarekcmahmoud/Resource-Manager</a>; ask Tarek for access. Each download is rebuilt from the latest code on every deploy.</p>
        </header>

        <Section title="Claude handoff" summary="Brief Claude Code on the project in one file"
          download={{ href: '/downloads/resource-manager-handoff.md', label: 'Download HANDOFF.md' }}>
          <p>One file that brings Claude Code up to speed: what the app is, the stack, setup, what&apos;s built, the decisions already made, the open items and where everything lives.</p>
          <ol className={s.steps}>
            <li>Clone the repository and open it in Claude Code. The same file is already in it, at <code>docs/HANDOFF.md</code>.</li>
            <li>Start the session with <code>Read docs/HANDOFF.md, then …</code> and what you want to do. Outside the repo, paste the downloaded file into the chat instead.</li>
            <li>When something important changes, ask Claude to update <code>docs/HANDOFF.md</code> so the next session starts from the truth.</li>
          </ol>
        </Section>

        <Section title="Interface files" summary="Design tokens, components, stylesheets and fonts"
          download={{ href: '/downloads/resource-manager-interface.zip', label: 'Download interface files (.zip)' }}>
          <p>The app&apos;s visual layer, in the same folders as the repository:</p>
          <ul className={s.list}>
            <li><code>src/styles/tokens.css</code>: the design tokens. Every colour, size, space and motion value lives here. Components only use these variables, so restyling means changing values here.</li>
            <li><code>src/components/</code>: Frame (corner crosses), Button, Chip, Pill, Field, Dialog, Toast, TopBar and Icon, each with its CSS Module.</li>
            <li>Page stylesheets (<code>*.module.css</code>, <code>globals.css</code>) and the Archivo font files.</li>
          </ul>
          <p>See every token and component working together in the <Link href="/design">style guide</Link>.</p>
        </Section>

        <Section title="Chrome extension" summary="Save pages and images to the wall without leaving the page"
          download={{ href: '/downloads/resource-manager-extension.zip', label: 'Download the extension (.zip)' }}>
          <p>The extension isn&apos;t on the Chrome Web Store, so you load it yourself. It takes about two minutes. The same steps are in <code>INSTALL.md</code> inside the zip.</p>

          <h3>Before you start</h3>
          <ul className={s.list}>
            <li>Chrome, or another Chromium browser (Arc, Brave, Edge).</li>
            <li>An account on this app, and its address: <b>the address in your browser right now</b>, without <code>/dev</code>.</li>
            <li>Sign in to the app in that browser once. The extension saves using that sign-in.</li>
          </ul>

          <h3>Install</h3>
          <ol className={s.steps}>
            <li><b>Unzip</b> the download. You get a folder called <code>resource-manager-extension</code>. Keep it somewhere permanent, such as Documents: Chrome loads the extension from this folder every time.</li>
            <li>Open <code>chrome://extensions</code> in the address bar.</li>
            <li>Turn on <b>Developer mode</b> (the switch in the top-right corner).</li>
            <li>Click <b>Load unpacked</b> and choose the <code>resource-manager-extension</code> folder (the one that contains <code>manifest.json</code>).</li>
            <li>The extension&apos;s settings page opens. Paste the app&apos;s address, click <b>Save</b>, and choose <b>Allow</b> when Chrome asks for permission to reach it.</li>
            <li><b>Pin it:</b> click the puzzle-piece icon in Chrome&apos;s toolbar, then the pin next to &ldquo;Resource Manager: save to wall&rdquo;.</li>
          </ol>

          <h3>Use</h3>
          <ul className={s.list}>
            <li><b>Save the page you&apos;re on:</b> click the toolbar button, or press <kbd>⌥⇧S</kbd> (Alt+Shift+S on Windows). A panel opens under the button.</li>
            <li><b>Save an image or link:</b> right-click it and choose &ldquo;Save image to the wall&rdquo; or &ldquo;Save link to the wall&rdquo;.</li>
            <li><b>In the panel:</b> click images to pick them (numbered in the order you pick), add a title, note and tags, then click <b>Save to wall</b>. <b>Full form</b> opens the complete form for quotes, text, video, type, width and boards.</li>
          </ul>

          <h3>Update to a new version</h3>
          <p>Download and unzip the new version into the <b>same folder</b>, replacing the old files. Then click the reload icon (↻) on the extension&apos;s card in <code>chrome://extensions</code>.</p>

          <h3>If something goes wrong</h3>
          <ul className={s.list}>
            <li><b>&ldquo;Sign in first&rdquo; while you&apos;re signed in:</b> sign out of the app and back in, then try again. If it keeps happening, tell Tarek.</li>
            <li><b>&ldquo;One more permission&rdquo;:</b> click Allow. If you closed the prompt, open the extension&apos;s settings and click Save again.</li>
            <li><b>No images in the grid:</b> some pages load images only as you scroll. Scroll, then open the panel again. You can always save without images.</li>
            <li><b>The panel won&apos;t open:</b> Chrome blocks extensions on its own pages (<code>chrome://</code>, the Web Store). Use it on normal websites.</li>
          </ul>
        </Section>
      </div>
    </main>
  );
}

/** A collapsible window: the summary row toggles it, the body holds details and the download. */
function Section({ title, summary, download, children }: {
  title: string; summary: string; download: { href: string; label: string }; children: ReactNode;
}) {
  return (
    // The frame sits outside <details>: a closed <details> hides everything but its summary, crosses included.
    <Frame interactive>
      <details className={s.section}>
      <summary className={s.summary}>
        <span className={s.titles}><b>{title}</b><span>{summary}</span></span>
        <span className={s.chev}><Icon name="chev" size={18} /></span>
      </summary>
      <div className={s.content}>
        {children}
        <div className={s.actions}>
          <ButtonLink variant="primary" href={download.href} download><Icon name="download" size={16} />{download.label}</ButtonLink>
        </div>
      </div>
      </details>
    </Frame>
  );
}
