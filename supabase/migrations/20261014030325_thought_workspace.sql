-- Additive: existing user_items, profiles and calendar payloads remain intact.
create table public.thought_details (
 thought_id uuid primary key references public.user_items(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id),
 parent_id uuid references public.thought_details(thought_id) on delete restrict,
 position numeric not null default 0,
 archived_at timestamptz,
 version integer not null default 1 check(version > 0),
 collection boolean not null default false,
 properties jsonb not null default '[]',
 views jsonb not null default '[{"id":"list","name":"List","layout":"list"},{"id":"table","name":"Table","layout":"table"},{"id":"board","name":"Board","layout":"board"}]',
 check(jsonb_typeof(properties)='array'), check(jsonb_typeof(views)='array')
);
create table public.thought_memberships (
 collection_id uuid not null references public.thought_details(thought_id) on delete cascade,
 thought_id uuid not null references public.thought_details(thought_id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id),
 position numeric not null default 0,
 values_json jsonb not null default '{}',
 primary key(collection_id,thought_id), check(collection_id<>thought_id), check(jsonb_typeof(values_json)='object')
);
create table public.thought_connections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 source_id uuid not null references public.thought_details(thought_id) on delete cascade,
 target_id uuid not null references public.thought_details(thought_id) on delete cascade,
 type text not null check(type in ('relates_to','supports','contradicts','depends_on','inspired_by','references')),
 check(source_id<>target_id), unique(source_id,target_id,type)
);
create index thought_parent_idx on public.thought_details(user_id,parent_id,position);
create index thought_members_idx on public.thought_memberships(user_id,thought_id);
create index thought_backlinks_idx on public.thought_connections(user_id,target_id);
create index thought_search_idx on public.user_items using gin(to_tsvector('simple', title)) where item_type='thought';
alter table public.user_items add column thought_id uuid references public.thought_details(thought_id) on delete restrict;
create index thought_schedule_idx on public.user_items(user_id,thought_id) where thought_id is not null;

-- All validation executes as the caller and retains existing RLS.
create function public.validate_thought_relation() returns trigger language plpgsql security invoker set search_path='' as $$
declare ref uuid; props jsonb; p jsonb; v jsonb; ids text[] := '{}';
begin
 if new.user_id is distinct from auth.uid() then raise exception 'Invalid owner'; end if;
 if tg_table_name='thought_details' then
  if not exists(select 1 from public.user_items where id=new.thought_id and user_id=auth.uid() and item_type='thought') then raise exception 'Thought unavailable'; end if;
  -- Serialize hierarchy changes per user to prevent concurrent cycle creation.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  ref:=new.parent_id;
  while ref is not null loop
   if ref=new.thought_id then raise exception 'A thought cannot contain itself'; end if;
   if not exists(select 1 from public.thought_details where thought_id=ref and user_id=auth.uid()) then raise exception 'Parent unavailable'; end if;
   select parent_id into ref from public.thought_details where thought_id=ref;
  end loop;
  for p in select value from jsonb_array_elements(new.properties) loop
   if coalesce(p->>'id','')='' or coalesce(p->>'name','')='' or p->>'type' not in ('text','number','select','multi-select','date','checkbox') or p->>'type' is null or p->>'id'=any(ids) then raise exception 'Invalid property definition'; end if;
   ids:=array_append(ids,p->>'id');
   if p->>'type' in ('select','multi-select') and jsonb_typeof(p->'options') is distinct from 'array' then raise exception 'Options required'; end if;
  end loop;
 elsif tg_table_name='thought_memberships' then
  select properties into props from public.thought_details where thought_id=new.collection_id and user_id=auth.uid() and collection;
  if props is null or not exists(select 1 from public.thought_details where thought_id=new.thought_id and user_id=auth.uid()) then raise exception 'Collection or member unavailable'; end if;
  for p in select value from jsonb_array_elements(props) loop
   v:=new.values_json->(p->>'id');
   if v is null or v='null'::jsonb then continue; end if;
   if (p->>'type'='number' and jsonb_typeof(v)<>'number') or (p->>'type'='checkbox' and jsonb_typeof(v)<>'boolean') or (p->>'type' in ('text','date','select') and jsonb_typeof(v)<>'string') or (p->>'type'='multi-select' and jsonb_typeof(v)<>'array') then raise exception 'Property type mismatch'; end if;
   if p->>'type'='select' and not (p->'options' @> jsonb_build_array(v)) then raise exception 'Unknown option'; end if;
   if p->>'type'='multi-select' and not (p->'options' @> v) then raise exception 'Unknown options'; end if;
   if p->>'type'='date' then if (v#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date';end if;perform (v#>>'{}')::date; end if;
  end loop;
  if exists(select 1 from jsonb_object_keys(new.values_json) k where not exists(select 1 from jsonb_array_elements(props) prop where prop->>'id'=k)) then raise exception 'Unknown property'; end if;
 else
  if not exists(select 1 from public.thought_details where thought_id=new.source_id and user_id=auth.uid()) or not exists(select 1 from public.thought_details where thought_id=new.target_id and user_id=auth.uid()) then raise exception 'Connection endpoint unavailable'; end if;
  if new.type in ('relates_to','contradicts') and new.source_id>new.target_id then ref:=new.source_id;new.source_id:=new.target_id;new.target_id:=ref;end if;
 end if;
 return new;
end $$;
create trigger validate_thought_details before insert or update on public.thought_details for each row execute function public.validate_thought_relation();
create trigger validate_thought_memberships before insert or update on public.thought_memberships for each row execute function public.validate_thought_relation();
create trigger validate_thought_connections before insert or update on public.thought_connections for each row execute function public.validate_thought_relation();

create function public.validate_thought_schedule() returns trigger language plpgsql security invoker set search_path='' as $$
declare start_instant timestamptz;end_instant timestamptz;zone text;
begin
 if new.thought_id is not null and (new.item_type<>'block' or not exists(select 1 from public.thought_details where thought_id=new.thought_id and user_id=new.user_id and user_id=auth.uid())) then raise exception 'Scheduled thought unavailable';end if;
 if new.thought_id is not null then
  if tg_op='UPDATE' and (new.content->>'date',new.content->>'start',new.content->>'endDate',new.content->>'end',new.content->>'timeZone',new.content->>'allDay') is not distinct from (old.content->>'date',old.content->>'start',old.content->>'endDate',old.content->>'end',old.content->>'timeZone',old.content->>'allDay') then return new;end if;
  if coalesce(new.content->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(new.content->>'endDate','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Start and end dates required';end if;
  if not coalesce((new.content->>'allDay')::boolean,false) and (coalesce(new.content->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(new.content->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Start and end times required';end if;
  zone:=coalesce(new.content->>'timeZone','UTC');
  if not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'Invalid time zone';end if;
  if coalesce((new.content->>'allDay')::boolean,false) then
   if (new.content->>'endDate')::date<(new.content->>'date')::date then raise exception 'Invalid all-day range';end if;
   new.content:=new.content-'starts_at'-'ends_at';
  else
   start_instant:=((new.content->>'date')||' '||(new.content->>'start'))::timestamp at time zone zone;
   end_instant:=((new.content->>'endDate')||' '||(new.content->>'end'))::timestamp at time zone zone;
   if end_instant<=start_instant then raise exception 'End must follow start';end if;
   if to_char(start_instant at time zone zone,'YYYY-MM-DD HH24:MI')<>(new.content->>'date')||' '||(new.content->>'start') or to_char(end_instant at time zone zone,'YYYY-MM-DD HH24:MI')<>(new.content->>'endDate')||' '||(new.content->>'end') then raise exception 'This local time does not exist due to daylight saving time';end if;
   new.content:=new.content||jsonb_build_object('starts_at',start_instant,'ends_at',end_instant);
  end if;
 end if;
 return new;
end $$;
create trigger validate_thought_schedule before insert or update on public.user_items for each row execute function public.validate_thought_schedule();

alter table public.thought_details enable row level security;
alter table public.thought_memberships enable row level security;
alter table public.thought_connections enable row level security;
create policy thought_owner on public.thought_details for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy membership_owner on public.thought_memberships for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy connection_owner on public.thought_connections for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update,delete on public.thought_details,public.thought_memberships,public.thought_connections to authenticated;

create function public.create_thought(p_id uuid,p_title text,p_content jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 insert into public.user_items(id,user_id,item_type,title,content) values(p_id,auth.uid(),'thought',p_title,p_content);
 insert into public.thought_details(thought_id) values(p_id);
 return p_id;
end $$;
create function public.save_thought(p_id uuid,p_title text,p_content jsonb,p_version integer,p_parent uuid,p_position numeric,p_archive timestamptz) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.thought_details set version=version+1,parent_id=p_parent,position=p_position,archived_at=p_archive where thought_id=p_id and version=p_version;
 if not found then raise exception 'Thought changed elsewhere. Reload before saving.';end if;
 update public.user_items set title=p_title,content=p_content,updated_at=now() where id=p_id;
 update public.user_items set title=coalesce(nullif(p_title,''),'Untitled'),content=jsonb_set(content,'{title}',to_jsonb(coalesce(nullif(p_title,''),'Untitled'))),updated_at=now() where thought_id=p_id;
end $$;
create function public.create_thought_collection(p_id uuid,p_title text,p_members uuid[]) returns uuid language plpgsql security invoker set search_path='' as $$
declare member uuid;begin
 perform public.create_thought(p_id,p_title,'{"blocks":[]}');
 update public.thought_details set collection=true where thought_id=p_id;
 foreach member in array p_members loop insert into public.thought_memberships(collection_id,thought_id) values(p_id,member);end loop;
 return p_id;
end $$;
-- Backfill only metadata for existing thoughts; never alter their content.
alter table public.thought_details disable trigger validate_thought_details;
insert into public.thought_details(thought_id,user_id) select id,user_id from public.user_items where item_type='thought' on conflict do nothing;
alter table public.thought_details enable trigger validate_thought_details;
revoke all on function public.create_thought(uuid,text,jsonb), public.save_thought(uuid,text,jsonb,integer,uuid,numeric,timestamptz), public.create_thought_collection(uuid,text,uuid[]) from public,anon;
grant execute on function public.create_thought(uuid,text,jsonb), public.save_thought(uuid,text,jsonb,integer,uuid,numeric,timestamptz), public.create_thought_collection(uuid,text,uuid[]) to authenticated;
