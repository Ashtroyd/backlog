-- One bundled migration for the next feature batch:
--   • progress tracking  (items.progress, items.hours_played)
--   • private notes      (items.notes)
--   • "Up next" pinning  (items.pinned_at)
--   • web push           (push_subscriptions table)
--   • data pruning       (monthly pg_cron job, skipped if unavailable)
-- Run once in the Supabase SQL Editor.

alter table public.items
  add column if not exists progress integer check (progress >= 0),
  add column if not exists hours_played numeric(6,1) check (hours_played >= 0),
  add column if not exists notes text,
  add column if not exists pinned_at timestamptz;

-- Web push subscriptions: one row per browser/device that opted in.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Monthly prune of stale, already-read notifications. Wrapped so the whole
-- migration still succeeds if pg_cron isn't available on this project.
do $mig$
begin
  create extension if not exists pg_cron;
  begin
    perform cron.unschedule('backlog-prune-notifications');
  exception when others then
    null; -- job didn't exist yet
  end;
  perform cron.schedule(
    'backlog-prune-notifications',
    '17 4 1 * *',
    $job$
      delete from public.notifications
      where read_at is not null
        and created_at < now() - interval '90 days'
    $job$
  );
exception when others then
  raise notice 'pg_cron unavailable — pruning not scheduled (everything else applied)';
end $mig$;
