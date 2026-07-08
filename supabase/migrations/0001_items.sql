-- Backlog — items table.
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → paste → Run).

create type public.media_type as enum ('game', 'movie', 'series', 'anime');
create type public.item_status as enum ('backlog', 'in_progress', 'completed', 'dropped');

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  media_type public.media_type not null,
  external_id text not null,          -- Steam / IMDb / TVMaze / MyAnimeList id
  title text not null,
  cover_url text,
  release_year integer,
  genres text[] not null default '{}',
  meta jsonb not null default '{}',   -- platforms, episodes, scores, studios…
  status public.item_status not null default 'backlog',
  rating numeric(2,1) check (rating >= 0.5 and rating <= 5),
  review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, media_type, external_id)
);

create index items_user_section_idx on public.items (user_id, media_type, status);

alter table public.items enable row level security;

create policy "items selectable by owner" on public.items
  for select using ((select auth.uid()) = user_id);
create policy "items insertable by owner" on public.items
  for insert with check ((select auth.uid()) = user_id);
create policy "items updatable by owner" on public.items
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "items deletable by owner" on public.items
  for delete using ((select auth.uid()) = user_id);
