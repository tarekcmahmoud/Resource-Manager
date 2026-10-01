-- Resource Manager: wall cards can span up to 3 columns.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
alter table public.submissions drop constraint if exists submissions_span_check;
alter table public.submissions add constraint submissions_span_check check (span between 1 and 3);
