# Resource Manager: handoff for Claude Code

Give this file to Claude Code at the start of a session (paste it, or keep it in the repo and say "read docs/HANDOFF.md"). It is the current state of the project and the decisions behind it. Keep it up to date when something important changes.

## What this is

Resource Manager is a personal tool owned by Tarek (a design engineer). It has two parts:

- **Bookmarks:** Board › Group › Sub-group › Link. Boards are tabs, and groups are cards laid out in columns that you can drag.
- **Wall:** an inspiration wall of submissions (projects, articles, quotes, people/studios) built from images, video, animations, text and quotes.

There is also a Chrome extension that saves the page you're on, or an image, to the wall.

It's used on several devices. Visuals will be restyled later, so **all styling goes through the design tokens** (see below).

## Stack

- **Next.js 16** with the App Router, TypeScript and CSS Modules. There's no Tailwind. Version 16 has breaking changes: read `AGENTS.md` and the guides in `node_modules/next/dist/docs/` before using a Next API. Request APIs (`params`, `searchParams`, `cookies()`) are async, and `src/proxy.ts` replaces middleware.
- **Supabase** provides Postgres, auth (email and password) and storage (the private bucket `media`).
- **Vercel** hosts the app and builds `main` on every push.
- **Archivo** is the font, self-hosted in `src/fonts`.

## Working with Tarek

- Keep replies short and batch changes. He reviews each stage on the live Vercel link.
- Commit and push only when he asks. Work goes straight to `main`, with no branches or pull requests unless he asks for them.
- He enters secrets himself (Supabase keys, passwords). Never ask for them in chat, and never type his password into a browser.
- He runs migrations himself in the Supabase SQL Editor. Remind him whenever there's a new file in `supabase/migrations/`.

## Setup

1. `.env.local` (gitignored):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://nocqkkfeldiwecppbjqt.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<the sb_publishable_… key>
   ```
   Use the publishable or anon key only. The secret and service_role keys must never be in a `NEXT_PUBLIC_` variable.
2. `npm install`, then `npm run dev`, then open http://localhost:3000.
3. **Database:** run every file in `supabase/migrations/` once, in order (0001 to 0004 so far), in the Supabase SQL Editor.
4. **Accounts:** sign-up is limited to the addresses in the `allowed_emails` table. Accounts are created in Supabase → Authentication → Users → Add user, with Auto Confirm ticked.
5. **Vercel:** set the same two variables in Vercel → Settings → Environment Variables, then redeploy. `NEXT_PUBLIC_` values are baked in at build time.

## Status

Every stage below is built and live.

| Stage | What |
| --- | --- |
| 1 | Schema with row-level security (every row has an `owner`), sign-in, tokens, components, the `/design` style guide |
| 2 | Bookmarks: board tabs plus a cross-board **Pinned** tab; groups drag between columns (floating card with lag and tilt, FLIP, edge auto-scroll, arrow keys); 8 rows then "+ N more"; Open all; link editor with board, group and sub-group pickers; duplicate warning; starter bookmarks loaded once per user by the `seed_bookmarks` database function |
| 3 | Wall: masonry layout; filters for Board (one), Tags (all must match), Type and Show archived; Randomise; focus view (← → to step); Quick and Extended submission form with reorderable blocks; uploads to `media/<user id>/` |
| 4 | `/api/page-info` reads a page's title, favicon and images; `/api/import-image` copies an image from another site into storage. Both refuse private network addresses (`src/lib/server/safeFetch.ts`). |
| 5 | Chrome extension (`extension/`): a panel under the toolbar button picks images from the page as it's shown, then saves via `/api/ext/context` and `/api/ext/save` using the app's sign-in cookie. "Full form" opens `/save`. |
| Extras | Wall cards span 1 to 3 columns; cards follow the form's block order; image previews show their pixel size; the `/dev` page for collaborators |

## Decisions already made (don't re-ask)

- **Pinned groups** are per board, plus a Pinned tab that collects pins from every board. The Pinned tab has its own arrangement (`pin_col` and `pin_position`).
- **Sub-groups** are real objects that can be renamed, reordered and collapsed. Removing one moves its links to the top of the group.
- **Starter boards** are Design, Making and Computational (the mapping is in `src/lib/bookmarks/seed.ts`).
- **Wall boards** are free-text labels (`submissions.boards text[]`), and a submission can be on any number of them. They're separate from bookmark boards, although the form suggests bookmark board names.
- **The extension** holds no keys. It knows only the app's address and relies on the browser's sign-in cookie. Its panel has no Boards field; boards are added from the full form or with Edit.
- **Sign-in** is email and password. Magic links were dropped because of Supabase's email rate limits.

## Open items

- **Image compression** is on hold while Tarek researches it. The proposal so far: compress on the server with `sharp`, save a WebP display copy (2400px) and a card copy (800px), and strip metadata. Don't build it unasked.
- Signed image URLs last 24 hours, so a tab left open for longer shows broken images until it's reloaded.
- YouTube thumbnails load straight from YouTube and aren't stored.
- Planned for v2: an Inbox, and sharing from a phone's share sheet (PWA).

## File map

| What | Where |
| --- | --- |
| Design tokens: the only place colours, sizes and motion are defined | `src/styles/tokens.css` (style guide at `/design`) |
| Shared components | `src/components/` |
| Bookmarks | `src/app/bookmarks/`, `src/lib/bookmarks/` |
| Wall, submission form, focus view | `src/app/wall/`, `src/lib/wall/` |
| Server routes | `src/app/api/` (page-info, import-image, ext/context, ext/save) |
| Sign-in and session refresh | `src/app/login/`, `src/proxy.ts` |
| Chrome extension, and its full-form page | `extension/`, `src/app/save/` |
| Database schema and row-level security | `supabase/migrations/` |
| Downloads on the `/dev` page (built by `scripts/build-downloads.mjs`) | `public/downloads/` (generated, not committed) |
