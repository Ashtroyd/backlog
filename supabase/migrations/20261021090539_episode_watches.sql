-- Dated logs are owner-only, even when the library title is shared with friends.
create table public.episode_watch_sessions (
  id uuid primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  watched_on date not null,
  episodes jsonb not null check (jsonb_typeof(episodes) = 'array' and jsonb_array_length(episodes) between 1 and 100),
  is_rewatch boolean not null default false,
  progress_before integer not null check (progress_before >= 0),
  progress_after integer not null check (progress_after >= progress_before),
  status_before public.item_status not null,
  started_at_before date,
  created_at timestamptz not null default clock_timestamp()
);
create index episode_watch_sessions_owner_item_idx on public.episode_watch_sessions(user_id, item_id, created_at desc);
alter table public.episode_watch_sessions enable row level security;
grant select, insert, delete on public.episode_watch_sessions to authenticated;
revoke all on public.episode_watch_sessions from anon;
create policy "read own episode sessions" on public.episode_watch_sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "insert own episode sessions" on public.episode_watch_sessions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.items where items.id = item_id and items.user_id = (select auth.uid()) and items.media_type in ('series', 'anime')
  ));
create policy "delete own episode sessions" on public.episode_watch_sessions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Row lock + expected count prevent two tabs from recording the same next episodes.
-- The request ID makes retrying a committed request harmless after a network failure.
create function public.log_episode_watch(
  p_item_id uuid, p_expected_progress integer, p_request_id uuid,
  p_watched_on date, p_episodes jsonb, p_rewatch boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_item public.items%rowtype;
  v_existing public.episode_watch_sessions%rowtype;
  v_count integer;
  v_episode jsonb;
  v_index integer := 0;
  v_next integer;
begin
  select * into v_item from public.items where id = p_item_id and user_id = auth.uid() for update;
  if not found or v_item.media_type not in ('series', 'anime') then
    raise exception 'Title unavailable.';
  end if;
  select * into v_existing from public.episode_watch_sessions where id = p_request_id;
  if found then
    if v_existing.item_id <> p_item_id or v_existing.watched_on <> p_watched_on
      or v_existing.episodes <> p_episodes or v_existing.is_rewatch <> p_rewatch then
      raise exception 'This request has already been used. Reopen the title and try again.';
    end if;
    return to_jsonb(v_item);
  end if;
  if p_expected_progress is null or coalesce(v_item.progress, 0) <> p_expected_progress then
    raise exception 'Progress changed on another screen. Reopen the title before logging.';
  end if;
  if p_request_id is null or p_watched_on is null or p_watched_on > (now() at time zone 'UTC')::date + 1
    or p_rewatch is null or p_episodes is null or jsonb_typeof(p_episodes) <> 'array' then
    raise exception 'Choose a valid watch date and episode list.';
  end if;
  v_count := jsonb_array_length(p_episodes);
  if v_count < 1 or v_count > 100 then raise exception 'Choose between 1 and 100 episodes.'; end if;
  for v_episode in select value from jsonb_array_elements(p_episodes) loop
    v_index := v_index + 1;
    if jsonb_typeof(v_episode) <> 'object'
      or coalesce(v_episode->>'ordinal', '') !~ '^[1-9][0-9]{0,6}$'
      or coalesce(v_episode->>'number', '') !~ '^[1-9][0-9]{0,6}$'
      or (v_episode->>'season' is not null and v_episode->>'season' !~ '^[1-9][0-9]{0,4}$')
      or length(coalesce(v_episode->>'title', '')) > 250 then
      raise exception 'Invalid episode details.';
    end if;
    if not p_rewatch and (v_episode->>'ordinal')::integer <> p_expected_progress + v_index then
      raise exception 'Log the next episodes in order, or choose Rewatch.';
    end if;
    if p_rewatch and (v_episode->>'ordinal')::integer > p_expected_progress then
      raise exception 'Choose an episode you have already watched.';
    end if;
  end loop;
  v_next := p_expected_progress + case when p_rewatch then 0 else v_count end;
  insert into public.episode_watch_sessions(id, item_id, user_id, watched_on, episodes, is_rewatch, progress_before, progress_after, status_before, started_at_before)
    values (p_request_id, p_item_id, auth.uid(), p_watched_on, p_episodes, p_rewatch, p_expected_progress, v_next, v_item.status, v_item.started_at);
  update public.items set progress = v_next, updated_at = now(),
    status = case when not p_rewatch and status in ('backlog', 'on_hold', 'dropped') then 'in_progress'::public.item_status else status end,
    started_at = case when not p_rewatch then coalesce(started_at, p_watched_on) else started_at end
    where id = p_item_id and user_id = auth.uid() returning * into v_item;
  return to_jsonb(v_item);
end;
$$;

-- Undo only the latest log, and only while its progress still matches.
create function public.undo_episode_watch(p_item_id uuid, p_session_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_item public.items%rowtype; v_session public.episode_watch_sessions%rowtype;
begin
  select * into v_item from public.items where id = p_item_id and user_id = auth.uid() for update;
  if not found then raise exception 'Title unavailable.'; end if;
  select * into v_session from public.episode_watch_sessions where id = p_session_id and item_id = p_item_id and user_id = auth.uid();
  if not found then raise exception 'This watch log is no longer available. Reopen the title.'; end if;
  if coalesce(v_item.progress, 0) <> v_session.progress_after or exists (
    select 1 from public.episode_watch_sessions where item_id = p_item_id and user_id = auth.uid()
      and created_at > v_session.created_at
  ) then raise exception 'Progress changed since this log. Undo the latest log before correcting earlier entries.'; end if;
  delete from public.episode_watch_sessions where id = p_session_id and user_id = auth.uid();
  update public.items set progress = v_session.progress_before, updated_at = now(),
    status = case when not v_session.is_rewatch and status = 'in_progress' and v_session.status_before in ('backlog', 'on_hold', 'dropped') then v_session.status_before else status end,
    started_at = case when not v_session.is_rewatch and started_at = v_session.watched_on then v_session.started_at_before else started_at end
    where id = p_item_id and user_id = auth.uid() returning * into v_item;
  return to_jsonb(v_item);
end;
$$;
revoke all on function public.log_episode_watch(uuid, integer, uuid, date, jsonb, boolean) from public, anon;
revoke all on function public.undo_episode_watch(uuid, uuid) from public, anon;
grant execute on function public.log_episode_watch(uuid, integer, uuid, date, jsonb, boolean) to authenticated;
grant execute on function public.undo_episode_watch(uuid, uuid) to authenticated;
