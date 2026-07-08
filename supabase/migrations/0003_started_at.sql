-- When a title was first started (played / watched). Nullable calendar date;
-- auto-filled to "today" the first time an item moves out of the backlog, and
-- editable in the item view.
alter table public.items
  add column if not exists started_at date;
