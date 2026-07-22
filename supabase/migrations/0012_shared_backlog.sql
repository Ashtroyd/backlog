-- Shared backlog: titles two friends plan to play/watch together.
-- Run once in the Supabase SQL Editor, after 0002_friends.sql.

create table public.shared_items (
  id uuid primary key default gen_random_uuid(),
  media_type public.media_type not null,
  external_id text not null,
  title text not null,
  cover_url text,
  release_year integer,
  genres text[] not null default '{}',
  meta jsonb not null default '{}',
  status text not null default 'planned' check (status in ('planned', 'completed')),
  added_by uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint no_self_share check (added_by <> friend_id),
  unique (added_by, friend_id, media_type, external_id)
);

create index shared_items_added_by_idx on public.shared_items (added_by);
create index shared_items_friend_idx on public.shared_items (friend_id);

alter table public.shared_items enable row level security;

-- Both participants can see the entry.
create policy "shared items visible to both" on public.shared_items
  for select to authenticated
  using ((select auth.uid()) in (added_by, friend_id));

-- You can only add as yourself, and only with an accepted friend.
create policy "shared items insertable by adder" on public.shared_items
  for insert to authenticated
  with check (
    added_by = (select auth.uid())
    and private.are_friends((select auth.uid()), friend_id)
  );

-- Either participant can update status (marking watched/played together).
create policy "shared items updatable by either" on public.shared_items
  for update to authenticated
  using ((select auth.uid()) in (added_by, friend_id))
  with check ((select auth.uid()) in (added_by, friend_id));

-- Either participant can remove it from the shared list.
create policy "shared items deletable by either" on public.shared_items
  for delete to authenticated
  using ((select auth.uid()) in (added_by, friend_id));
