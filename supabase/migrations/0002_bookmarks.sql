-- Resource Manager: stage 2 (bookmarks)
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Sub-groups can be collapsed on the group card.
alter table public.bm_subgroups add column if not exists collapsed boolean not null default false;

-- Pinned groups also appear together on the Pinned tab, with their own arrangement there.
alter table public.bm_groups add column if not exists pin_col int;
alter table public.bm_groups add column if not exists pin_position double precision not null default 0;

create index if not exists bm_boards_owner on public.bm_boards (owner, position);

-- One row per user for app state that isn't content.
create table if not exists public.user_state (
  owner uuid primary key default auth.uid() references auth.users on delete cascade,
  bm_seeded boolean not null default false
);
alter table public.user_state enable row level security;
drop policy if exists "owner all" on public.user_state;
create policy "owner all" on public.user_state for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- Loads the starter bookmarks once per user, the first time the bookmarks page opens.
-- data: [{name, groups: [{name, pinned, subs: [{name, items: [{n, u, note}]}]}]}]
-- Returns true if it seeded, false if this user was already seeded.
create or replace function public.seed_bookmarks(data jsonb)
returns boolean language plpgsql security invoker set search_path = public as $$
declare
  b jsonb; g jsonb; s jsonb; i jsonb;
  bi int := 0; gi int; si int; ii int;
  bid uuid; gid uuid; sid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  -- Two tabs opening at once must not seed twice.
  perform pg_advisory_xact_lock(hashtext('seed_bookmarks:' || auth.uid()::text));
  if exists (select 1 from user_state where owner = auth.uid() and bm_seeded) then return false; end if;

  for b in select * from jsonb_array_elements(data) loop
    insert into bm_boards (name, position) values (b->>'name', bi) returning id into bid;
    bi := bi + 1; gi := 0;
    for g in select * from jsonb_array_elements(b->'groups') loop
      insert into bm_groups (board_id, name, pinned, position, pin_position)
        values (bid, g->>'name', coalesce((g->>'pinned')::boolean, false), gi, gi)
        returning id into gid;
      gi := gi + 1; si := 0;
      for s in select * from jsonb_array_elements(g->'subs') loop
        insert into bm_subgroups (group_id, name, position) values (gid, s->>'name', si) returning id into sid;
        si := si + 1; ii := 0;
        for i in select * from jsonb_array_elements(s->'items') loop
          insert into bm_links (subgroup_id, name, url, note, position)
            values (sid, i->>'n', i->>'u', coalesce(i->>'note', ''), ii);
          ii := ii + 1;
        end loop;
      end loop;
    end loop;
  end loop;

  insert into user_state (owner, bm_seeded) values (auth.uid(), true)
    on conflict (owner) do update set bm_seeded = true;
  return true;
end $$;
