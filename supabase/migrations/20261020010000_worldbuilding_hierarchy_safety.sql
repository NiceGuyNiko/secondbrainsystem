-- Worldbuilding hierarchy enforcement on the generic db_relations table.
-- Only properties explicitly marked config.hierarchy=true use this check.
-- Parent event (Events→Events), Parent location (Locations→Locations).
-- A row is an independent relation, not a nested JSON copy of an event or place.
create function public.db_prevent_hierarchy_cycles()
returns trigger language plpgsql security invoker set search_path='' as $$
declare is_hierarchy boolean;
begin
  select p.type='relation' and p.config->>'hierarchy'='true'
    into is_hierarchy
    from public.db_properties p
    where p.id=new.property_id and p.user_id=auth.uid()
      and p.archived_at is null;
  if not coalesce(is_hierarchy,false) then return new; end if;
  -- Serialize hierarchy changes on this property across concurrent transactions.
  perform pg_advisory_xact_lock(hashtextextended(
    new.user_id::text || ':' || new.property_id::text || ':hierarchy',0
  ));
  -- Follow parent links upward from the requested parent. If we encounter the
  -- new child, we'd create a cycle (A→B→C→A).
  if exists(
    with recursive ancestors(id) as (
      select new.target_record_id
      union
      select e.target_record_id
      from public.db_relations e
      join ancestors a on a.id=e.source_record_id
      where e.property_id=new.property_id and e.user_id=auth.uid()
        and (tg_op='INSERT' or e.id<>new.id)
    )
    select 1 from ancestors where id=new.source_record_id
  ) then
    raise exception 'Hierarchy cycle: a record cannot be inside its own descendant';
  end if;
  return new;
end $$;
create trigger db_prevent_hierarchy_cycles
  before insert or update on public.db_relations
  for each row execute function public.db_prevent_hierarchy_cycles();
revoke all on function public.db_prevent_hierarchy_cycles() from public,anon;
