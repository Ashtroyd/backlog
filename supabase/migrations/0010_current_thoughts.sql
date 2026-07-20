-- A running, shareable "current thoughts" field for games that are still
-- being played — most useful for live-service/multiplayer titles that never
-- reach "completed", so they'd otherwise never get a review at all. Unlike
-- the private notes field, this respects is_private and is visible to
-- friends, same as a finished review. Run once in the Supabase SQL Editor.

alter table public.items
  add column if not exists current_thoughts text;
