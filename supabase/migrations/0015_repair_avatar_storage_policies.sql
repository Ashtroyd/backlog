-- Repair: profile photo and banner uploads were all rejected with "new row
-- violates row-level security policy". The avatars bucket had insert/update/
-- delete policies but no SELECT policy (0004's broad "publicly readable" one
-- was gone — Supabase's advisor flags it for letting anyone list the bucket).
-- Uploads use upsert, which reads the row back, so they need SELECT too.
--
-- Rather than restore bucket-wide listing, let each user read only their own
-- folder. The bucket is public, so images still display for everyone through
-- their public URLs, which don't go through these policies.

create policy "own avatar read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Also pin the update policy's WITH CHECK, so a file can't be moved into
-- someone else's folder by an update.
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
