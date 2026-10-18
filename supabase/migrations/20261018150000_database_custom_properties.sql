-- Phase 2: additive property registry + typed custom scalar values.
-- DEVELOPMENT ONLY until separate production-schema approval. No existing records are rewritten.
-- Prerequisites: 20261015002528_action_relation_indexes.sql.
create table public.database_property_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  database_key text not null check (database_key in ('Characters','Events','Perspectives','Scenes','Projects')),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  type text not null check (type in ('text','long_text','number','date','checkbox','select','multi_select','relation','rollup')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config)='object'),
  position integer not null default 0 check (position>=0),
  visible boolean not null default true,
  is_system boolean not null default false check (is_system=false),
  archived_at timestamptz,
  version integer not null default 1 check (version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index database_property_active_label_uq
  on public.database_property_definitions(user_id,database_key,lower(btrim(label)))
  where archived_at is null;
create index database_property_owner_order_idx on public.database_property_definitions(user_id,database_key,position);
alter table public.database_property_definitions enable row level security;
revoke all on public.database_property_definitions from public, anon;
grant select,insert,update on public.database_property_definitions to authenticated;
create policy database_property_owner on public.database_property_definitions
  for all to authenticated using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));

create function public.validate_database_property_definition() returns trigger
language plpgsql security invoker set search_path='' as $$
declare opt jsonb; target jsonb; label_key text;
begin
  if new.user_id is distinct from auth.uid() then raise exception 'Invalid property owner'; end if;
  new.label := btrim(new.label);
  if lower(new.label) in ('name','id','record id','status','summary') then raise exception 'Protected built-in property name'; end if;
  if tg_op='UPDATE' then
    if (new.id,new.user_id,new.database_key,new.is_system) is distinct from
       (old.id,old.user_id,old.database_key,old.is_system) then raise exception 'Permanent property identity cannot change'; end if;
    if new.type is distinct from old.type and exists (
      select 1 from public.planning_records r
      where r.user_id=new.user_id and r.data->'databaseProperties' ? new.id::text
    ) then raise exception 'Existing property values must be cleared before changing type'; end if;
    new.version:=old.version+1;
  end if;
  if new.type in ('select','multi_select') then
    if jsonb_typeof(new.config->'options') is distinct from 'array' then raise exception 'Choice options must be an array'; end if;
    if jsonb_array_length(new.config->'options')>60 then raise exception 'Too many options'; end if;
    for opt in select value from jsonb_array_elements(new.config->'options') loop
      if jsonb_typeof(opt)<>'string' or length(btrim(opt #>> '{}')) not between 1 and 80 then raise exception 'Invalid choice';end if;
    end loop;
    if (select count(*) from jsonb_array_elements_text(new.config->'options')) <>
       (select count(distinct lower(btrim(value))) from jsonb_array_elements_text(new.config->'options')) then raise exception 'Duplicate choices'; end if;
  elsif new.type='relation' then
    if jsonb_typeof(new.config->'target_databases') is distinct from 'array' or
       jsonb_array_length(new.config->'target_databases')=0 or
       new.config->>'cardinality' not in ('one','many') then raise exception 'Invalid relation configuration'; end if;
    for target in select value from jsonb_array_elements(new.config->'target_databases') loop
      if jsonb_typeof(target)<>'string' or target #>> '{}' not in
         ('Characters','Events','Groups','Locations','Perspectives','Scenes','Chapters','Books','Projects','Themes','Factions','Items','Species','Magic','Concepts','Notes')
        then raise exception 'Invalid allowed relation category'; end if;
    end loop;
  elsif new.type='rollup' then
    if new.config ? 'relation_path' and
       (jsonb_typeof(new.config->'relation_path') is distinct from 'array' or jsonb_array_length(new.config->'relation_path')>3)
      then raise exception 'Invalid rollup relation path'; end if;
    if new.config ? 'calculation' and new.config->>'calculation' not in
       ('show_original','count_records','count_nonempty','count_unique','sum','average','min','max','earliest','latest')
      then raise exception 'Invalid rollup calculation'; end if;
  end if;
  new.updated_at:=now();
  return new;
end $$;
create trigger validate_database_property_definition
  before insert or update on public.database_property_definitions
  for each row execute function public.validate_database_property_definition();

-- Validate custom values without copying canonical records or modifying legacy fields.
create function public.validate_database_record_properties() returns trigger
language plpgsql security invoker set search_path='' as $$
declare entry record; definition record; category text; value jsonb; option_val jsonb; expected text;
begin
  if not (new.data ? 'databaseProperties') then return new; end if;
  if jsonb_typeof(new.data->'databaseProperties') is distinct from 'object' then
    raise exception 'Custom properties must be an object'; end if;
  category:=case new.kind
    when 'character' then 'Characters' when 'event' then 'Events'
    when 'perspective' then 'Perspectives' when 'scene' then 'Scenes'
    when 'project' then 'Projects' else null end;
  if category is null and new.data->'databaseProperties'<>'{}'::jsonb then
    raise exception 'Record type cannot have database custom properties'; end if;
  for entry in select key,value from jsonb_each(new.data->'databaseProperties') loop
    if entry.key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then raise exception 'Invalid custom property ID'; end if;
    select * into definition from public.database_property_definitions
      where id=entry.key::uuid and user_id=new.user_id and database_key=category;
    if not found then raise exception 'Property is missing or belongs to a different database'; end if;
    value:=entry.value;
    if value='null'::jsonb then continue; end if;
    if definition.type in ('relation','rollup') then raise exception 'Computed/link properties cannot be stored as scalar values'; end if;
    expected:=case when definition.type in ('text','long_text','date','select') then 'string'
      when definition.type='number' then 'number'
      when definition.type='checkbox' then 'boolean'
      when definition.type='multi_select' then 'array' else null end;
    if jsonb_typeof(value) is distinct from expected then raise exception 'Custom property type mismatch'; end if;
    if definition.type in ('text','long_text') and length(value #>> '{}')>10000 then raise exception 'Custom text too long'; end if;
    if definition.type='select' and not (definition.config->'options' @> jsonb_build_array(value))
      then raise exception 'Invalid select option'; end if;
    if definition.type='multi_select' then
      for option_val in select v from jsonb_array_elements(value) as v loop
        if jsonb_typeof(option_val)<>'string' or not(definition.config->'options' @> jsonb_build_array(option_val))
        then raise exception 'Invalid multi-select option'; end if;
      end loop;
    end if;
    if definition.type='date' then
      if value #>> '{}' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date'; end if;
      perform (value #>> '{}')::date;
    end if;
  end loop;
  return new;
end $$;
create trigger validate_database_record_properties
  before insert or update of data on public.planning_records
  for each row execute function public.validate_database_record_properties();

revoke all on function public.validate_database_property_definition(),
  public.validate_database_record_properties() from public,anon;
