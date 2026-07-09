-- Phase 1: profile customization (avatar, banner, bio) + one favourite per list.
-- Run once in the Supabase SQL Editor.

-- 1. profile fields ---------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists banner_url text,
  add column if not exists bio text;

-- 2. favourites: at most one favourite per media type per user ---------------
alter table public.items
  add column if not exists is_favorite boolean not null default false;

create unique index if not exists one_favorite_per_section
  on public.items (user_id, media_type)
  where is_favorite;

-- 3. public storage bucket for avatars + banners ----------------------------
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatar images publicly readable" on storage.objects;
create policy "avatar images publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "own avatar upload" on storage.objects;
create policy "own avatar upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "own avatar update" on storage.objects;
create policy "own avatar update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "own avatar delete" on storage.objects;
create policy "own avatar delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
