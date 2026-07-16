-- Tags a game as an ongoing live-service/multiplayer title that has no real
-- "completed" state, so it can show as such instead of being stuck at
-- "Playing" forever. Run once in the Supabase SQL Editor.

alter table public.items
  add column if not exists live_service boolean not null default false;
