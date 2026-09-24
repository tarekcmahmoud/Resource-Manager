-- Resource Manager: initial schema
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Every row belongs to one user (owner). Row Level Security makes sure
-- a signed-in user can only ever read or write their own rows.

-- ---------- allowlist: only these emails can create an account ----------
create table if not exists public.allowed_emails (
  email text primary key
);
insert into public.allowed_emails (email) values ('tarekcmahmoud@gmail.com')
on conflict do nothing;
alter table public.allowed_emails enable row level security; -- no policies: not readable from the app

create or replace function public.enforce_allowlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.allowed_emails where lower(email) = lower(new.email)) then
    raise exception 'This email is not allowed to sign up.';
  end if;
  return new;
end $$;

drop trigger if exists enforce_allowlist on auth.users;
create trigger enforce_allowlist before insert on auth.users
for each row execute function public.enforce_allowlist();

-- ---------- bookmarks: board > group > sub-group (optional) > link ----------
create table public.bm_boards (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table public.bm_groups (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  board_id uuid not null references public.bm_boards on delete cascade,
  name text not null,
  pinned boolean not null default false,
  col int,                                  -- column on the grid, null = auto place
  position double precision not null default 0, -- order within the column
  created_at timestamptz not null default now()
);

create table public.bm_subgroups (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  group_id uuid not null references public.bm_groups on delete cascade,
  name text,                                -- null = the group's unnamed section
  position double precision not null default 0
);

create table public.bm_links (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  subgroup_id uuid not null references public.bm_subgroups on delete cascade,
  name text not null,
  url text not null,
  note text not null default '',
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- wall ----------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null default 'project' check (type in ('project','article','quote','person')),
  title text not null default '',
  source text not null default '',
  notes text not null default '',
  tags text[] not null default '{}',
  boards text[] not null default '{}',
  -- ordered content blocks: [{kind:'images'|'video'|'anim'|'text'|'quote', ...}]
  -- image entries point at files in the "media" storage bucket
  blocks jsonb not null default '[]',
  archived boolean not null default false,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.bm_groups (board_id);
create index on public.bm_subgroups (group_id);
create index on public.bm_links (subgroup_id);
create index on public.submissions (owner, saved_at desc);
create index on public.submissions using gin (tags);

-- ---------- row level security: owner only ----------
do $$
declare t text;
begin
  foreach t in array array['bm_boards','bm_groups','bm_subgroups','bm_links','submissions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner all" on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;

-- ---------- storage for uploaded images and animations ----------
insert into storage.buckets (id, name, public) values ('media', 'media', false)
on conflict do nothing;

-- files live under media/<user id>/...
create policy "media owner read" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media owner update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
