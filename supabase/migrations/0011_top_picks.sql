-- A user's own curated "top picks" shelf for a given calendar month, shown
-- on the homescreen. Up to 5 items, any mix of media types, kept private to
-- the owner (unlike reviews/favourites, this isn't gated by friendship).

create table public.top_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  item_id uuid not null references public.items(id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, month, position),
  unique (user_id, month, item_id)
);

alter table public.top_picks enable row level security;

create policy "own top picks" on public.top_picks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
