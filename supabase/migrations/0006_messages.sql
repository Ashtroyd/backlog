-- Phase 3: direct messages between friends (text + shared recommendation cards).
-- Run once in the Supabase SQL Editor, after 0005.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text,
  shared_item jsonb,               -- snapshot of a recommended title, or null
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint has_content check (body is not null or shared_item is not null),
  constraint no_self_message check (sender_id <> recipient_id)
);

create index if not exists messages_pair_idx
  on public.messages (sender_id, recipient_id, created_at);
create index if not exists messages_recipient_unread_idx
  on public.messages (recipient_id) where read_at is null;

alter table public.messages enable row level security;

-- Both participants can read the thread.
create policy "messages visible to participants" on public.messages
  for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));
-- You can only send as yourself, and only to an accepted friend.
create policy "send message to a friend" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.are_friends((select auth.uid()), recipient_id)
  );
-- The recipient can mark messages read.
create policy "recipient marks read" on public.messages
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
-- Senders can unsend their own messages.
create policy "sender deletes own message" on public.messages
  for delete to authenticated
  using (sender_id = (select auth.uid()));
