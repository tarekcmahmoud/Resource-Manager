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

## Where things are

| What | Where |
| --- | --- |
| Design tokens (all styling goes through these) | `src/styles/tokens.css`, style guide at `/design` |
| Shared components | `src/components/` |
| Bookmarks page | `src/app/bookmarks/` |
| Bookmark data, layout and starter seed | `src/lib/bookmarks/`, `src/data/bookmarks-seed.json` |
| Sign-in and session refresh | `src/app/login/`, `src/proxy.ts` |
