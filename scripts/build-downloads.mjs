// Builds the files offered on the /dev page into public/downloads/ (not committed).
// Runs before `next dev` and `next build` (see package.json), so Vercel rebuilds them on every deploy.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'public', 'downloads');
mkdirSync(out, { recursive: true });

/** Every file under dir (skipping dotfiles), as paths relative to the repo root. */
function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    if (name.startsWith('.')) return [];
    const p = join(dir, name);
    return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
  });
}

/** A minimal zip writer (deflate, no dependencies). entries: [{ name, data: Buffer }] */
function zip(entries) {
  const files = [], central = [];
  let offset = 0;
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name.split(sep).join('/'), 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x0800, 8); head.writeUInt16LE(8, 10);
    head.writeUInt16LE(time, 12); head.writeUInt16LE(date, 14); head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(packed.length, 20); head.writeUInt32LE(data.length, 24); head.writeUInt16LE(nameBuf.length, 28);
    head.writeUInt32LE(offset, 42);
    files.push(local, nameBuf, packed);
    central.push(head, nameBuf);
    offset += 30 + nameBuf.length + packed.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, cd, end]);
}

const file = (p, as = p) => ({ name: as, data: readFileSync(join(root, p)) });

// 1. The Claude handoff.
copyFileSync(join(root, 'docs', 'HANDOFF.md'), join(out, 'resource-manager-handoff.md'));

// 2. Interface files: tokens, components, fonts and every stylesheet, in their repo paths.
const styles = walk('src/app').filter((p) => p.endsWith('.css'));
const iface = [...walk('src/styles'), ...walk('src/components'), ...walk('src/fonts'), ...styles];
const ifaceReadme = `# Resource Manager: interface files

These are copies of the app's visual layer, in the same folders as the repository:

- src/styles/tokens.css: the design tokens. Every colour, type size, space, shape and motion value is defined here, and components may only use these variables. To restyle the app, change the values here.
- src/components/: the shared components (Frame, Button, Chip, Pill, Field, Dialog, Toast, TopBar, Icon) and their CSS Modules.
- src/app/**/*.module.css and globals.css: page-level styles.
- src/fonts/: Archivo 400, 500 and 600, self-hosted.

The live style guide is at /design in the app. To change the real app, edit these files in the repository: github.com/tarekcmahmoud/Resource-Manager
`;
writeFileSync(join(out, 'resource-manager-interface.zip'), zip([
  { name: 'resource-manager-interface/README.md', data: Buffer.from(ifaceReadme) },
  ...iface.map((p) => file(p, join('resource-manager-interface', p))),
]));

// 3. The Chrome extension, as a folder ready for "Load unpacked", with INSTALL.md inside.
writeFileSync(join(out, 'resource-manager-extension.zip'), zip(
  walk('extension').map((p) => file(p, join('resource-manager-extension', relative('extension', p)))),
));

console.log(`downloads: ${readdirSync(out).join(', ')}`);
