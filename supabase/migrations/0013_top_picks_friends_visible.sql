-- Top picks become friend-visible: accepted friends can browse each other's
-- monthly shelf (still owner-only to add/edit/remove — see 0011_top_picks.sql).
-- Run once in the Supabase SQL Editor, after 0011_top_picks.sql.

create policy "friends top picks visible" on public.top_picks
  for select to authenticated
  using (private.are_friends((select auth.uid()), user_id));
