-- Repair: profile photo and banner uploads were rejected with "new row
-- violates row-level security policy" — the storage part of 0004 wasn't in
-- effect on the live project. Safe to re-run: it recreates the bucket (if
-- missing) and the four policies exactly as 0004 defines them.
-- Run once in the Supabase SQL Editor.

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;

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
  )
  with check (
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

-- Check: should list the four policies above.
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like '%avatar%';
