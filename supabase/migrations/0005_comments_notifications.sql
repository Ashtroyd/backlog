-- Phase 2: shared comment threads on reviews + notifications.
-- Run once in the Supabase SQL Editor, after 0004.

-- Helper: can `viewer` see `item`? (its owner, or a friend when not private.)
-- SECURITY DEFINER so comment policies don't recurse through items' own RLS.
create or replace function public.can_see_item(item uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.items i
    where i.id = item
      and (
        i.user_id = viewer
        or (not i.is_private and public.are_friends(viewer, i.user_id))
      )
  );
$$;

-- 1. comments ---------------------------------------------------------------
create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists review_comments_item_idx
  on public.review_comments (item_id, created_at);

alter table public.review_comments enable row level security;

-- Any mutual friend who can see the item can read its comments (shared thread).
create policy "comments readable by item viewers" on public.review_comments
  for select to authenticated
  using (public.can_see_item(item_id, (select auth.uid())));
create policy "comment as self on visible item" on public.review_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_see_item(item_id, (select auth.uid()))
  );
-- Authors delete their own; the review's owner can moderate any on their item.
create policy "delete own comment or as owner" on public.review_comments
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.items i
      where i.id = item_id and i.user_id = (select auth.uid())
    )
  );

-- 2. notifications ----------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  item_id uuid references public.items (id) on delete cascade,
  comment_id uuid references public.review_comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

-- Recipients manage only their own notifications. Inserts come from the
-- trigger below (SECURITY DEFINER), so there is no insert policy.
create policy "own notifications readable" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy "own notifications updatable" on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
create policy "own notifications deletable" on public.notifications
  for delete to authenticated using (recipient_id = (select auth.uid()));

-- Notify the review's author when someone else comments on it.
create or replace function public.notify_on_review_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select user_id into owner_id from public.items where id = new.item_id;
  if owner_id is not null and owner_id <> new.author_id then
    insert into public.notifications (recipient_id, actor_id, type, item_id, comment_id)
    values (owner_id, new.author_id, 'review_comment', new.item_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists review_comment_notify on public.review_comments;
create trigger review_comment_notify
  after insert on public.review_comments
  for each row execute function public.notify_on_review_comment();
