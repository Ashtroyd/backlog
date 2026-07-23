-- Lets a user reorder their homescreen shelves; the app remembers it across
-- devices. Null means "use the default order". No RLS changes needed — the
-- existing per-row policies on public.profiles already cover this column.
-- Run once in the Supabase SQL Editor.

alter table public.profiles add column home_layout jsonb;
