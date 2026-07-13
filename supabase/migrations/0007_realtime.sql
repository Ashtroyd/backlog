-- Enable Supabase Realtime for messages and notifications, so new DMs and
-- comment alerts arrive instantly instead of by polling. Free tier includes
-- Realtime; RLS still applies (subscribers only receive rows they can SELECT).
-- Run once in the Supabase SQL Editor.

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
