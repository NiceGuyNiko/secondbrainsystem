-- REVIEW REQUIRED before live installation. Apply after thought_workspace.
-- Add capabilities to canonical thoughts; existing calendar payloads are preserved.
create table public.planning_counters (
 user_id uuid not null default auth.uid() references auth.users(id),
 kind text not null, value bigint not null check(value>0), primary key(user_id,kind)
);
create table public.planning_records (
 thought_id uuid primary key references public.thought_details(thought_id) on delete restrict,
 user_id uuid not null default auth.uid() references auth.users(id),
 kind text not null check(kind in ('workspace','event','character','perspective','goal','project','task','scene','activity')),
 sequence_no bigint not null,
 workspace_id uuid references public.planning_records(thought_id) on delete restrict,
 event_id uuid references public.planning_records(thought_id) on delete restrict,
 character_id uuid references public.planning_records(thought_id) on delete restrict,
 project_id uuid references public.planning_records(thought_id) on delete restrict,
 goal_id uuid references public.planning_records(thought_id) on delete restrict,
 working_id uuid references public.thought_details(thought_id) on delete restrict,
 data jsonb not null default '{}' check(jsonb_typeof(data)='object'),
 version integer not null default 1 check(version>0),
 unique(user_id,kind,sequence_no),
 check((kind='perspective')=(event_id is not null and character_id is not null))
);
create unique index planning_perspective_pair on public.planning_records(user_id,event_id,character_id) where kind='perspective';
create index planning_workspace_idx on public.planning_records(user_id,workspace_id,kind);
create index planning_project_idx on public.planning_records(user_id,project_id);
create index planning_goal_idx on public.planning_records(user_id,goal_id);
create index planning_character_idx on public.planning_records(user_id,character_id);
alter table public.planning_counters enable row level security;
alter table public.planning_records enable row level security;
create policy owner_counter on public.planning_counters for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy owner_planning on public.planning_records for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.planning_records,public.planning_counters from anon;
grant select,insert,update on public.planning_records,public.planning_counters to authenticated;
create function public.validate_planning_record() returns trigger language plpgsql security invoker set search_path='' as $$
declare r record; v jsonb;
begin
 if new.user_id is distinct from auth.uid() or not exists(select 1 from public.thought_details where thought_id=new.thought_id and user_id=auth.uid()) then raise exception 'Record unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,1));
 if tg_op='INSERT' then
  insert into public.planning_counters(user_id,kind,value) values(new.user_id,new.kind,1)
   on conflict(user_id,kind) do update set value=planning_counters.value+1 returning value into new.sequence_no;
 else
  if (new.thought_id,new.user_id,new.kind,new.sequence_no) is distinct from (old.thought_id,old.user_id,old.kind,old.sequence_no) then raise exception 'Permanent identity cannot change'; end if;
  if new.kind in ('event','character','perspective') and new.workspace_id is distinct from old.workspace_id then raise exception 'Writing workspace is permanent';end if;
  if new.kind='perspective' and (new.event_id,new.character_id) is distinct from (old.event_id,old.character_id) then raise exception 'Create a new perspective for a different moment'; end if;
  new.version:=old.version+1;
 end if;
 for r in select * from (values(new.workspace_id,'workspace'),(new.event_id,'event'),(new.character_id,'character'),(new.project_id,'project'),(new.goal_id,'goal')) as refs(id,kind) loop
  if r.id is not null and not exists(select 1 from public.planning_records where thought_id=r.id and user_id=auth.uid() and kind=r.kind and (new.kind not in ('event','character','perspective') or workspace_id is not distinct from new.workspace_id or r.kind='workspace')) then raise exception 'Invalid % relation',r.kind;end if;
 end loop;
 if new.kind in ('event','character','perspective') and new.workspace_id is null then raise exception 'Writing record needs workspace';end if;
 if new.working_id is not null and not exists(select 1 from public.thought_details where thought_id=new.working_id and user_id=auth.uid()) then raise exception 'Working page unavailable'; end if;
 if new.data ? 'done' and jsonb_typeof(new.data->'done')<>'boolean' then raise exception 'Invalid completion'; end if;
 if new.data ? 'target' and (jsonb_typeof(new.data->'target')<>'number' or (new.data->>'target')::numeric<=0) then raise exception 'Target must be positive';end if;
 if new.data ? 'amount' and jsonb_typeof(new.data->'amount')<>'number' then raise exception 'Invalid measurement';end if;
 if new.kind='activity' and (new.goal_id is null or not (new.data ? 'amount')) then raise exception 'Measurement needs goal and amount'; end if;
 if new.data ? 'chronology' and jsonb_typeof(new.data->'chronology')<>'number' then raise exception 'Invalid chronological order';end if;
 if new.data ? 'turning' and new.data->>'turning' not in ('ordinary','suggested','confirmed','dismissed') then raise exception 'Invalid turning point state';end if;
 if new.data ? 'status' and new.data->>'status' not in ('idea','developing','canon','superseded') then raise exception 'Invalid knowledge status';end if;
 return new;
end $$;
create trigger validate_planning_record before insert or update on public.planning_records for each row execute function public.validate_planning_record();
create function public.create_planning_record(p_id uuid,p_title text,p_kind text,p_workspace uuid default null,p_event uuid default null,p_character uuid default null,p_project uuid default null,p_goal uuid default null,p_working uuid default null,p_data jsonb default '{}') returns uuid language plpgsql security invoker set search_path='' as $$
declare existing uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if p_kind='perspective' then
  select thought_id into existing from public.planning_records where user_id=auth.uid() and kind='perspective' and event_id=p_event and character_id=p_character and workspace_id is not distinct from p_workspace;
  if existing is not null then return existing;end if;
 end if;
 if not exists(select 1 from public.thought_details where thought_id=p_id and user_id=auth.uid()) then
  perform public.create_thought(p_id,p_title,jsonb_build_object('blocks','[]'::jsonb));
 end if;
 insert into public.planning_records(thought_id,kind,sequence_no,workspace_id,event_id,character_id,project_id,goal_id,working_id,data) values(p_id,p_kind,0,p_workspace,p_event,p_character,p_project,p_goal,p_working,p_data);
 if p_kind='perspective' then update public.user_items set title=(select c.title||' during '||e.title from public.user_items c,public.user_items e where c.id=p_character and e.id=p_event) where id=p_id; end if;
 return p_id;
end $$;
create function public.save_planning_record(p_id uuid,p_version integer,p_data jsonb,p_workspace uuid default null,p_project uuid default null,p_goal uuid default null,p_working uuid default null) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.planning_records set data=p_data,workspace_id=p_workspace,project_id=p_project,goal_id=p_goal,working_id=p_working where thought_id=p_id and user_id=auth.uid() and version=p_version;
 if not found then raise exception 'Record changed elsewhere. Reload before saving.';end if;
end $$;
revoke all on function public.create_planning_record(uuid,text,text,uuid,uuid,uuid,uuid,uuid,uuid,jsonb),public.save_planning_record(uuid,integer,jsonb,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.create_planning_record(uuid,text,text,uuid,uuid,uuid,uuid,uuid,uuid,jsonb),public.save_planning_record(uuid,integer,jsonb,uuid,uuid,uuid,uuid) to authenticated;

-- Source renames update the generated title everywhere, while perspective IDs remain stable.
create function public.refresh_perspective_titles() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.title is distinct from old.title then
  update public.user_items u set title=c.title||' during '||e.title
   from public.planning_records p,public.user_items c,public.user_items e
   where p.kind='perspective' and u.id=p.thought_id and c.id=p.character_id and e.id=p.event_id
    and (p.character_id=new.id or p.event_id=new.id) and u.title is distinct from c.title||' during '||e.title;
 end if;
 return new;
end $$;
create trigger refresh_perspective_titles after update of title on public.user_items for each row execute function public.refresh_perspective_titles();

create function public.validate_block_task_links() returns trigger language plpgsql security invoker set search_path='' as $$
declare task jsonb;
begin
 if new.item_type='block' then
  for task in select value from jsonb_array_elements(coalesce(new.content->'tasks','[]')) loop
   if task ? 'taskId' and not exists(select 1 from public.planning_records where thought_id=(task->>'taskId')::uuid and kind='task' and user_id=auth.uid()) then raise exception 'Task unavailable';end if;
   if task ? 'workingId' and not exists(select 1 from public.thought_details where thought_id=(task->>'workingId')::uuid and user_id=auth.uid()) then raise exception 'Working page unavailable';end if;
  end loop;
 end if;
 return new;
end $$;
create trigger validate_block_task_links before insert or update on public.user_items for each row execute function public.validate_block_task_links();

create function public.set_planning_task_completion(p_id uuid,p_done boolean,p_version integer) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.planning_records set data=jsonb_set(data,'{done}',to_jsonb(p_done)) where thought_id=p_id and kind='task' and user_id=auth.uid() and version=p_version;
 if not found then raise exception 'Task changed elsewhere. Refresh and try again.';end if;
end $$;
revoke all on function public.set_planning_task_completion(uuid,boolean,integer) from public,anon;
grant execute on function public.set_planning_task_completion(uuid,boolean,integer) to authenticated;
create function public.canonical_perspective_title() returns trigger language plpgsql security invoker set search_path='' as $$
declare generated text;
begin
 select c.title||' during '||e.title into generated from public.planning_records p,public.user_items c,public.user_items e
  where p.thought_id=new.id and p.kind='perspective' and c.id=p.character_id and e.id=p.event_id;
 if generated is not null then new.title:=generated;end if;
 return new;
end $$;
create trigger canonical_perspective_title before update of title on public.user_items for each row execute function public.canonical_perspective_title();
