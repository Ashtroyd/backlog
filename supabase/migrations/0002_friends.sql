-- Friends system: profiles (@handles), mutual friendships, per-item privacy.
-- Run once in the Supabase SQL Editor, after 0001_items.sql.

create extension if not exists citext;

-- 1. profiles ---------------------------------------------------------------
-- One row per user: a unique @handle plus a display name. Created during
-- onboarding (the app gates the UI until a profile exists).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

alter table public.profiles enable row level security;

-- Any signed-in user can read profiles (needed to search for and display
-- people). Only non-sensitive columns live here.
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);
create policy "own profile insertable" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "own profile updatable" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 2. friendships ------------------------------------------------------------
-- One row per relationship: requester -> addressee, pending until accepted.
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  constraint no_self_friend check (requester_id <> addressee_id)
);

create index if not exists friendships_addressee_idx
  on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx
  on public.friendships (requester_id, status);

alter table public.friendships enable row level security;

create policy "friendships visible to participants" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy "send friend request" on public.friendships
  for insert to authenticated
  with check ((select auth.uid()) = requester_id);
create policy "respond to friend request" on public.friendships
  for update to authenticated
  using ((select auth.uid()) = addressee_id)
  with check ((select auth.uid()) = addressee_id);
create policy "remove friendship" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Helper used inside the items policy. SECURITY DEFINER so it reads
-- friendships without triggering that table's RLS (avoids recursion).
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;

-- 3. per-item privacy + friend read access ----------------------------------
alter table public.items
  add column if not exists is_private boolean not null default false;

-- Friends may read each other's non-private items. This is additive to the
-- existing owner-only select policy (Postgres ORs permissive policies).
drop policy if exists "items selectable by friends" on public.items;
create policy "items selectable by friends" on public.items
  for select to authenticated
  using (not is_private and public.are_friends((select auth.uid()), user_id));
