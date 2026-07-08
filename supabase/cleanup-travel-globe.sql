-- OPTIONAL cleanup: removes the old Travel Globe data from this Supabase
-- project, since Travel Globe is browser-only again.
--
-- ⚠️  DO NOT run this until you've rescued your trips:
--     1. Open the old cloud deployment:
--        https://travel-globe-bvqva3jnx-ashtroyds-projects.vercel.app
--     2. Sign in, open the ⋯ menu → "Export backup (JSON)"
--     3. On https://travel-globe-sigma.vercel.app → ⋯ menu → "Import backup…"
--
-- Once your trips are safely back in your browser, run this in the
-- Supabase SQL Editor:

drop table if exists public.trips;
drop table if exists public.profiles;

-- Empty and remove the photos storage bucket.
delete from storage.objects where bucket_id = 'photos';
delete from storage.buckets where id = 'photos';
