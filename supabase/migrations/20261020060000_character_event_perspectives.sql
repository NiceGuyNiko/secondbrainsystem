-- Event-scoped character snapshots: one canonical Perspective (Character × Event).
-- This is NOT a calculated record ID. db_records owns the permanent sequence and page ID.
-- No production changes; intended for isolated staging acceptance.
create table public.db_perspectives (
  record_id uuid primary key references public.db_records(record_id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users(id),
  character_id uuid not null references public.db_records(record_id) on delete restrict,
  event_id uuid not null references public.db_records(record_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(user_id,character_id,event_id)
);
create index db_perspectives_character_lookup on public.db_perspectives(user_id,character_id);
create index db_perspectives_event_lookup on public.db_perspectives(user_id,event_id);
alter table public.db_perspectives enable row level security;
create policy db_perspectives_owner on public.db_perspectives for select to authenticated
  using(user_id=(select auth.uid()));
revoke all on public.db_perspectives from public,anon;
grant select,insert on public.db_perspectives to authenticated;

create function public.db_validate_perspective()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.user_id is distinct from auth.uid() then raise exception 'Perspective owner unavailable';end if;
 if not exists(
   select 1 from public.db_records r join public.db_databases d
   on d.id=r.database_id where r.record_id=new.record_id and r.user_id=auth.uid()
   and d.user_id=auth.uid() and lower(btrim(d.name))='perspectives'
 ) or not exists(
   select 1 from public.db_records r join public.db_databases d
   on d.id=r.database_id where r.record_id=new.character_id and r.user_id=auth.uid()
   and d.user_id=auth.uid() and lower(btrim(d.name))='characters'
 ) or not exists(
   select 1 from public.db_records r join public.db_databases d
   on d.id=r.database_id where r.record_id=new.event_id and r.user_id=auth.uid()
   and d.user_id=auth.uid() and lower(btrim(d.name))='events'
 ) then raise exception 'Perspective links must use your Character, Event and Perspective records';end if;
 return new;
end $$;
create trigger db_validate_perspective before insert on public.db_perspectives
 for each row execute function public.db_validate_perspective();
revoke all on function public.db_validate_perspective() from public,anon;

-- A Perspective is always created through an authenticated transaction.
-- The linked character and event must be from the caller's own properly named databases.
-- Snapshot-specific group memberships and abilities are ordinary db_relations whose
-- SOURCE is this Perspective record, never a timeless Character relationship.
create function public.db_create_perspective(
  p_id uuid,p_character_id uuid,p_event_id uuid
) returns uuid
language plpgsql security invoker set search_path='' as $$
declare
  perspective_database uuid;
  character_name text; event_name text;
  character_property uuid; event_property uuid;
  existing uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required';end if;
  select p.record_id into existing from public.db_perspectives p
    where p.user_id=auth.uid() and p.character_id=p_character_id and p.event_id=p_event_id;
  if existing is not null then return existing;end if;
  select r.record_id, u.title into existing,character_name from public.db_records r
    join public.db_databases d on d.id=r.database_id and d.user_id=auth.uid()
    join public.user_items u on u.id=r.record_id and u.user_id=auth.uid()
    where r.record_id=p_character_id and r.user_id=auth.uid()
    and r.archived_at is null and d.archived_at is null and lower(btrim(d.name))='characters';
  if existing is null then raise exception 'Character unavailable';end if;
  select r.record_id,u.title into existing,event_name from public.db_records r
    join public.db_databases d on d.id=r.database_id and d.user_id=auth.uid()
    join public.user_items u on u.id=r.record_id and u.user_id=auth.uid()
    where r.record_id=p_event_id and r.user_id=auth.uid()
    and r.archived_at is null and d.archived_at is null and lower(btrim(d.name))='events';
  if existing is null then raise exception 'Event unavailable';end if;
  select id into perspective_database from public.db_databases
    where user_id=auth.uid() and archived_at is null and lower(btrim(name))='perspectives'
    order by created_at limit 1;
  if perspective_database is null then raise exception 'Set up the Perspectives database first';end if;
  select id into character_property from public.db_properties
    where user_id=auth.uid() and database_id=perspective_database
    and lower(btrim(name))='character' and type='relation' and archived_at is null;
  select id into event_property from public.db_properties
    where user_id=auth.uid() and database_id=perspective_database
    and lower(btrim(name))='event' and type='relation' and archived_at is null;
  if character_property is null or event_property is null then
    raise exception 'Perspectives needs Character and Event relation properties';
  end if;
  perform public.db_create_record(p_id,perspective_database,character_name || ' during ' || event_name);
  insert into public.db_perspectives(record_id,character_id,event_id)
    values(p_id,p_character_id,p_event_id);
  perform public.db_link(character_property,p_id,p_character_id);
  perform public.db_link(event_property,p_id,p_event_id);
  return p_id;
end $$;
revoke all on function public.db_create_perspective(uuid,uuid,uuid) from public,anon;
grant execute on function public.db_create_perspective(uuid,uuid,uuid) to authenticated;
