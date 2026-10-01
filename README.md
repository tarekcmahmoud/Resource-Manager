# Resource Manager

A personal tool for bookmarks (Board › Group › Sub-group › Link) and an inspiration wall. It's built with Next.js 16, Supabase and Vercel.

## Run locally

1. Create `.env.local`, which is gitignored:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://nocqkkfeldiwecppbjqt.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key, sb_publishable_…>
   ```
2. `npm install`, then `npm run dev`, then open http://localhost:3000.

Never use the secret or service_role key here: variables that start with `NEXT_PUBLIC_` end up in the browser.

## Database

Run each file in `supabase/migrations/` once, in order, in the Supabase SQL Editor. Sign-in uses email and password. Create the account in Supabase → Authentication → Users, and only emails listed in `allowed_emails` can sign up.

## Deploy

Vercel builds `main` on every push. Set both variables in Vercel → Settings → Environment Variables, then redeploy.

## Chrome extension

The `extension/` folder is a Chrome extension that saves the page you're on, a link or an image to the wall without leaving the page.

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `extension` folder.
2. The settings page opens. Paste the app's address (the stable Vercel one), click Save, and choose **Allow** when Chrome asks.
3. To save, use the toolbar button or ⌥⇧S for the page you're on, or right-click an image or link. A panel opens under the toolbar: pick images, then add a note and tags. Boards are added later from the full form or Edit on the wall.

The panel reads images from the page as it's shown, and saves through `/api/ext/*` using your normal sign-in cookie, so the extension holds no keys. "Full form" opens the app's `/save` page for quotes, text and other blocks. After you change files in `extension/`, click the reload icon on its card in `chrome://extensions`.

## Where things are

| What | Where |
| --- | --- |
| Design tokens (all styling goes through these) | `src/styles/tokens.css`, style guide at `/design` |
| Shared components | `src/components/` |
| Bookmarks page | `src/app/bookmarks/` |
| Bookmark data, layout and starter seed | `src/lib/bookmarks/`, `src/data/bookmarks-seed.json` |
| Sign-in and session refresh | `src/app/login/`, `src/proxy.ts` |
| Wall, submission form, page reading | `src/app/wall/`, `src/app/api/`, `src/lib/wall/`, `src/lib/server/` |
| Chrome extension and its save page | `extension/`, `src/app/save/` |
