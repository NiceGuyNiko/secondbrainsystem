-- Additive, independent database-engine foundation. STAGING/LOCAL ONLY until separately approved.
-- Does not alter or migrate existing user_items, thought_details or planning_records rows.
-- Databases and records refer to thought pages, while structured metadata lives independently.
-- Apply after the existing 20261018 database property migration (which remains unused by this engine).
create table public.db_databases (
  id uuid primary key references public.thought_details(thought_id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  icon text not null default '🗃️',
  dataset text not null default 'primary' check (char_length(dataset) between 1 and 64),
  version integer not null default 1 check(version>0),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.db_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  database_id uuid not null references public.db_databases(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  type text not null check (type in ('text','long_text','number','checkbox','select','date','relation')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config)='object'),
  position numeric not null default 0,
  version integer not null default 1 check(version>0),
  archived_at timestamptz
);
create unique index db_properties_active_name_unique on public.db_properties(user_id,database_id,lower(btrim(name))) where archived_at is null;
create index db_properties_by_database on public.db_properties(user_id,database_id,position);
create table public.db_sequence_counters (
  user_id uuid not null default auth.uid() references auth.users(id),
  database_id uuid not null references public.db_databases(id) on delete restrict,
  value bigint not null default 0 check(value>=0),
  primary key(user_id,database_id)
);
create table public.db_records (
  record_id uuid primary key references public.thought_details(thought_id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users(id),
  database_id uuid not null references public.db_databases(id) on delete restrict,
  sequence_no bigint not null default 0 check(sequence_no>=0),
  values_json jsonb not null default '{}'::jsonb check(jsonb_typeof(values_json)='object'),
  position numeric not null default 0,
  version integer not null default 1 check(version>0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,database_id,sequence_no)
);
create index db_records_database_order on public.db_records(user_id,database_id,position,sequence_no);
create table public.db_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  property_id uuid not null references public.db_properties(id) on delete restrict,
  source_record_id uuid not null references public.db_records(record_id) on delete restrict,
  target_record_id uuid not null references public.db_records(record_id) on delete restrict,
  position numeric not null default 0,
  attributes jsonb not null default '{}'::jsonb check(jsonb_typeof(attributes)='object'),
  created_at timestamptz not null default now(),
  check(source_record_id<>target_record_id),
  unique(property_id,source_record_id,target_record_id)
);
create index db_relations_source_idx on public.db_relations(user_id,source_record_id,property_id);
create index db_relations_target_idx on public.db_relations(user_id,target_record_id,property_id);
create table public.db_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  database_id uuid not null references public.db_databases(id) on delete restrict,
  name text not null check(char_length(btrim(name)) between 1 and 80),
  layout text not null default 'table' check(layout in ('table','gallery','board')),
  config jsonb not null default '{}'::jsonb check(jsonb_typeof(config)='object'),
  position numeric not null default 0,
  version integer not null default 1 check(version>0)
);
create index db_views_by_database on public.db_views(user_id,database_id,position);

alter table public.db_databases enable row level security;
alter table public.db_properties enable row level security;
alter table public.db_sequence_counters enable row level security;
alter table public.db_records enable row level security;
alter table public.db_relations enable row level security;
alter table public.db_views enable row level security;
create policy db_databases_owner on public.db_databases for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy db_properties_owner on public.db_properties for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy db_counters_owner on public.db_sequence_counters for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy db_records_owner on public.db_records for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy db_relations_owner on public.db_relations for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy db_views_owner on public.db_views for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.db_databases,public.db_properties,public.db_sequence_counters,public.db_records,public.db_relations,public.db_views from public,anon;
grant select,insert,update on public.db_databases,public.db_properties,public.db_sequence_counters,public.db_records,public.db_views to authenticated;
grant select,insert,delete on public.db_relations to authenticated;

create function public.db_validate_database() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.user_id is distinct from auth.uid()
    or not exists(select 1 from public.thought_details where thought_id=new.id and user_id=auth.uid())
  then raise exception 'Database page unavailable'; end if;
  if tg_op='UPDATE' then
    if (new.id,new.user_id,new.dataset) is distinct from (old.id,old.user_id,old.dataset) then
      raise exception 'Database identity and dataset are permanent'; end if;
    new.version:=old.version+1;
  end if;
  new.name:=btrim(new.name);
  return new;
end $$;
create trigger db_validate_database before insert or update on public.db_databases
  for each row execute function public.db_validate_database();

create function public.db_validate_property() returns trigger
language plpgsql security invoker set search_path='' as $$
declare o jsonb; option_names text[]; target uuid;
begin
  if new.user_id is distinct from auth.uid() or not exists(
    select 1 from public.db_databases where id=new.database_id and user_id=auth.uid() and archived_at is null
  ) then raise exception 'Property database unavailable';end if;
  if lower(btrim(new.name)) in ('name','id','record id') then raise exception 'Name/ID are protected system properties';end if;
  new.name:=btrim(new.name);
  if tg_op='UPDATE' then
    if (new.id,new.user_id,new.database_id) is distinct from (old.id,old.user_id,old.database_id) then
      raise exception 'Property identity is permanent';end if;
    if new.type is distinct from old.type and exists(
      select 1 from public.db_records where database_id=new.database_id and values_json ? new.id::text
    ) then raise exception 'Clear property values before changing type';end if;
    new.version:=old.version+1;
  end if;
  if new.type='select' then
    if jsonb_typeof(new.config->'options') is distinct from 'array'
      or jsonb_array_length(new.config->'options') not between 1 and 60
    then raise exception 'Select requires 1–60 options';end if;
    option_names:=array(select lower(btrim(value #>> '{}')) from jsonb_array_elements(new.config->'options') as value);
    if cardinality(option_names)<>cardinality(array(select distinct unnest(option_names)))
      or exists(select 1 from jsonb_array_elements(new.config->'options') as e(value)
        where jsonb_typeof(e.value)<>'string' or length(btrim(e.value #>> '{}')) not between 1 and 80)
    then raise exception 'Invalid or duplicate select options';end if;
  elsif new.type='relation' then
    if coalesce(new.config->>'target_database_id','') !~* '^[0-9a-f-]{36}$' then
      raise exception 'Relation needs a valid target database ID';end if;
    target:=(new.config->>'target_database_id')::uuid;
    if not exists(select 1 from public.db_databases where id=target and user_id=auth.uid() and archived_at is null)
    then raise exception 'Relation target database unavailable';end if;
  end if;
  return new;
end $$;
create trigger db_validate_property before insert or update on public.db_properties
  for each row execute function public.db_validate_property();

create function public.db_validate_record() returns trigger
language plpgsql security invoker set search_path='' as $$
declare item record; definition record; v jsonb;
begin
  if new.user_id is distinct from auth.uid() or not exists (
    select 1 from public.db_databases where id=new.database_id and user_id=auth.uid() and archived_at is null
  ) or not exists (
    select 1 from public.thought_details where thought_id=new.record_id and user_id=auth.uid()
  ) then raise exception 'Record page or database unavailable';end if;
  if tg_op='INSERT' then
    insert into public.db_sequence_counters(user_id,database_id,value) values(auth.uid(),new.database_id,1)
      on conflict(user_id,database_id) do update set value=public.db_sequence_counters.value+1 returning value into new.sequence_no;
  else
    if (new.record_id,new.user_id,new.database_id,new.sequence_no) is distinct from
       (old.record_id,old.user_id,old.database_id,old.sequence_no)
    then raise exception 'Permanent record identity cannot change';end if;
    new.version:=old.version+1;
  end if;
  for item in select key,value from jsonb_each(new.values_json) loop
    select * into definition from public.db_properties
      where id=item.key::uuid and user_id=auth.uid() and database_id=new.database_id;
    if not found then raise exception 'Custom property is not in this database';end if;
    v:=item.value;
    if v='null'::jsonb then continue;end if;
    if definition.type='relation' then raise exception 'Links must be stored in db_relations';end if;
    if definition.type in ('text','long_text','date','select') and jsonb_typeof(v)<>'string'
      then raise exception 'Expected string for %',definition.name;end if;
    if definition.type='number' and jsonb_typeof(v)<>'number' then raise exception 'Expected number';end if;
    if definition.type='checkbox' and jsonb_typeof(v)<>'boolean' then raise exception 'Expected boolean';end if;
    if definition.type in ('text','long_text') and length(v #>> '{}')>10000 then raise exception 'Value too long';end if;
    if definition.type='select' and not (definition.config->'options' @> jsonb_build_array(v))
      then raise exception 'Value is not a permitted choice';end if;
    if definition.type='date' then
      if v #>> '{}' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date format';end if;
      perform (v #>> '{}')::date;
    end if;
  end loop;
  new.updated_at:=now();
  return new;
end $$;
create trigger db_validate_record before insert or update on public.db_records
  for each row execute function public.db_validate_record();

create function public.db_validate_relation() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p record; source_db uuid; target_db uuid;
begin
  if new.user_id is distinct from auth.uid() then raise exception 'Invalid relation owner';end if;
  select * into p from public.db_properties where id=new.property_id and user_id=auth.uid() and type='relation' and archived_at is null;
  if not found then raise exception 'Relation property unavailable';end if;
  select database_id into source_db from public.db_records where record_id=new.source_record_id and user_id=auth.uid() and archived_at is null;
  select database_id into target_db from public.db_records where record_id=new.target_record_id and user_id=auth.uid() and archived_at is null;
  if source_db is distinct from p.database_id or target_db::text is distinct from p.config->>'target_database_id'
    then raise exception 'Invalid source or target database';end if;
  perform pg_advisory_xact_lock(hashtextextended(new.source_record_id::text||new.property_id::text,0));
  if p.config->>'multi'='false' and exists(
    select 1 from public.db_relations where property_id=p.id and source_record_id=new.source_record_id
      and target_record_id<>new.target_record_id and (tg_op='INSERT' or id<>new.id)
  ) then raise exception 'Relation allows only one target';end if;
  return new;
end $$;
create trigger db_validate_relation before insert or update on public.db_relations
  for each row execute function public.db_validate_relation();

create function public.db_validate_view() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.user_id is distinct from auth.uid() or not exists(
    select 1 from public.db_databases where id=new.database_id and user_id=auth.uid() and archived_at is null
  ) then raise exception 'View database unavailable';end if;
  if tg_op='UPDATE' then
    if (new.id,new.user_id,new.database_id) is distinct from (old.id,old.user_id,old.database_id)
      then raise exception 'View identity cannot change';end if;
    new.version:=old.version+1;
  end if;
  return new;
end $$;
create trigger db_validate_view before insert or update on public.db_views
  for each row execute function public.db_validate_view();

-- Atomic creation: matching Thought page + independent database entry.
create function public.db_create_database(p_id uuid,p_name text,p_dataset text default 'primary')
returns uuid language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required';end if;
  if nullif(btrim(p_name),'') is null then raise exception 'Name required';end if;
  perform public.create_thought(p_id,p_name,jsonb_build_object('blocks','[]'::jsonb));
  insert into public.db_databases(id,name,dataset) values(p_id,p_name,p_dataset);
  insert into public.db_views(database_id,name,layout) values(p_id,'All records','table');
  return p_id;
end $$;
create function public.db_create_record(p_id uuid,p_database_id uuid,p_name text)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.db_databases where id=p_database_id and user_id=auth.uid() and archived_at is null)
    then raise exception 'Database unavailable';end if;
  if nullif(btrim(p_name),'') is null then raise exception 'Record name required';end if;
  perform public.create_thought(p_id,p_name,jsonb_build_object('blocks','[]'::jsonb));
  insert into public.db_records(record_id,database_id) values(p_id,p_database_id);
  return p_id;
end $$;
create function public.db_set_value(p_record_id uuid,p_version integer,p_property_id uuid,p_value jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare next_version integer;
begin
  if not exists(select 1 from public.db_properties p join public.db_records r on r.database_id=p.database_id
    where p.id=p_property_id and r.record_id=p_record_id and r.user_id=auth.uid() and p.user_id=auth.uid()
      and p.archived_at is null and p.type<>'relation')
  then raise exception 'Editable property unavailable';end if;
  update public.db_records
    set values_json=case when p_value is null or p_value='null'::jsonb
      then values_json - p_property_id::text
      else jsonb_set(values_json,array[p_property_id::text],p_value,true) end
    where record_id=p_record_id and user_id=auth.uid() and archived_at is null and version=p_version
    returning version into next_version;
  if next_version is null then raise exception 'Record changed elsewhere; reload';end if;
  return next_version;
end $$;
create function public.db_link(p_property_id uuid,p_source uuid,p_target uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare link_id uuid;
begin
  insert into public.db_relations(property_id,source_record_id,target_record_id)
    values(p_property_id,p_source,p_target)
    on conflict(property_id,source_record_id,target_record_id) do nothing
    returning id into link_id;
  if link_id is null then
    select id into link_id from public.db_relations
      where property_id=p_property_id and source_record_id=p_source and target_record_id=p_target and user_id=auth.uid();
  end if;
  if link_id is null then raise exception 'Relation unavailable';end if;
  return link_id;
end $$;

revoke all on function public.db_validate_database(),public.db_validate_property(),
  public.db_validate_record(),public.db_validate_relation(),public.db_validate_view(),
  public.db_create_database(uuid,text,text),public.db_create_record(uuid,uuid,text),
  public.db_set_value(uuid,integer,uuid,jsonb),public.db_link(uuid,uuid,uuid) from public,anon;
grant execute on function public.db_create_database(uuid,text,text),public.db_create_record(uuid,uuid,text),
  public.db_set_value(uuid,integer,uuid,jsonb),public.db_link(uuid,uuid,uuid) to authenticated;
