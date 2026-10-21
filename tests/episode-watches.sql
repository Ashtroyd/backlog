-- Run against an isolated database with the items + episode_watches migrations.
-- Uses synthetic accounts only. All fixture changes are rolled back.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
insert into public.items(id,user_id,media_type,external_id,title,progress) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','series','1','Test series',3),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','series','1','Other user',0),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','game','1','Test game',0);
-- Even a friend who can see the library row must not see watch dates.
create policy "test friend reads items" on public.items for select to authenticated using (true);
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.log_episode_watch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',3,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',current_date,
 '[{"ordinal":4,"season":1,"number":4,"title":"Finale"},{"ordinal":5,"season":2,"number":1,"title":"Return"}]',false);
do $$ begin
 if (select progress from public.items where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 5 then raise exception 'Progress not updated'; end if;
 if (select status from public.items where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'in_progress' then raise exception 'Watching status not set'; end if;
 if (select count(*) from public.episode_watch_sessions) <> 1 then raise exception 'Missing session'; end if;
end $$;
-- A lost response followed by an identical retry must not duplicate history/progress.
select public.log_episode_watch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',3,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',current_date,
 '[{"ordinal":4,"season":1,"number":4,"title":"Finale"},{"ordinal":5,"season":2,"number":1,"title":"Return"}]',false);
do $$ begin
 if (select count(*) from public.episode_watch_sessions) <> 1 then raise exception 'Retry duplicated history'; end if;
 begin
  perform public.log_episode_watch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',3,gen_random_uuid(),current_date,'[{"ordinal":4,"number":4}]',false);
  raise exception 'FAILED: stale progress was accepted';
 exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
 begin
  perform public.log_episode_watch('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,gen_random_uuid(),current_date,'[{"ordinal":1,"number":1}]',false);
  raise exception 'FAILED: another owner was writable';
 exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
 begin
  perform public.log_episode_watch('cccccccc-cccc-4ccc-8ccc-cccccccccccc',0,gen_random_uuid(),current_date,'[{"ordinal":1,"number":1}]',false);
  raise exception 'FAILED: game episode logging was accepted';
 exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
 begin
  perform public.log_episode_watch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',5,gen_random_uuid(),current_date+2,'[{"ordinal":6,"number":6}]',false);
  raise exception 'FAILED: future watch date accepted';
 exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
 begin
  perform public.log_episode_watch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',5,gen_random_uuid(),current_date,'[{"ordinal":8,"number":8}]',false);
  raise exception 'FAILED: skipped episode accepted';
 exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
 begin
  perform public.log_episode_watch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',5,gen_random_uuid(),current_date,'[{"ordinal":6,"number":6}]',true);
  raise exception 'FAILED: unwatched rewatch accepted';
 exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
 if (select count(*) from public.episode_watch_sessions) <> 1 then raise exception 'Failure left a partial write'; end if;
end $$;
select public.log_episode_watch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',5,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',current_date-1,'[{"ordinal":1,"season":1,"number":1,"title":"Pilot"}]',true);
do $$ begin
 if (select progress from public.items where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 5 then raise exception 'Rewatch changed progress'; end if;
 begin
  perform public.undo_episode_watch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  raise exception 'FAILED: older session undo accepted';
 exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
end $$;
select public.undo_episode_watch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
select public.undo_episode_watch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
do $$ begin
 if (select progress from public.items where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 3 then raise exception 'Undo lost legacy progress'; end if;
 if (select count(*) from public.episode_watch_sessions) <> 0 then raise exception 'Undo left history'; end if;
end $$;
select public.log_episode_watch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',3,gen_random_uuid(),current_date,'[{"ordinal":4,"number":4}]',false);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if (select count(*) from public.items) <> 3 then raise exception 'Friend fixture not readable'; end if;
 if (select count(*) from public.episode_watch_sessions) <> 0 then raise exception 'Watch dates leaked to friend'; end if;
 begin
  insert into public.episode_watch_sessions(id,item_id,user_id,watched_on,episodes,progress_before,progress_after)
   values(gen_random_uuid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth.uid(),current_date,'[{"ordinal":5,"number":5}]',4,5);
  raise exception 'FAILED: friend history insert accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.log_episode_watch(uuid,integer,uuid,date,jsonb,boolean)','execute') then raise exception 'Anonymous logging allowed'; end if;
 if has_table_privilege('anon','public.episode_watch_sessions','select') then raise exception 'Anonymous history readable'; end if;
end $$;
rollback;
