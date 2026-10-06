-- Applied migration version matches Supabase's recorded history.
-- Keep sharing semantics, but evaluate the current user once per statement.
create index if not exists top_picks_item_id_idx on public.top_picks(item_id);
drop policy "own top picks" on public.top_picks;
drop policy "friends top picks visible" on public.top_picks;
create policy "top picks visible" on public.top_picks for select to authenticated
using (user_id = (select auth.uid()) or private.are_friends((select auth.uid()), user_id));
create policy "own top picks insert" on public.top_picks for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "own top picks update" on public.top_picks for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own top picks delete" on public.top_picks for delete to authenticated
using (user_id = (select auth.uid()));
