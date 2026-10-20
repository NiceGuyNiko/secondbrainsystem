-- Atomic user-owned reorder operations. Existing record IDs and sequential
-- creation numbers remain permanent; position alone changes.
create or replace function public.db_reorder_records(p_database_id uuid,p_record_ids uuid[])
returns void language plpgsql security invoker set search_path='' as $$
declare expected_count integer;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if not exists(select 1 from public.db_databases where id=p_database_id and user_id=auth.uid() and archived_at is null)
 then raise exception 'Database unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('db-record-order:'||p_database_id::text,0));
 select count(*) into expected_count from public.db_records where database_id=p_database_id and user_id=auth.uid() and archived_at is null;
 if coalesce(cardinality(p_record_ids),0)<>expected_count
   or (select count(distinct id) from unnest(p_record_ids) id)<>expected_count
   or exists(select 1 from unnest(p_record_ids) id
      where not exists(select 1 from public.db_records r where r.record_id=id and r.database_id=p_database_id and r.user_id=auth.uid() and r.archived_at is null))
 then raise exception 'Record order changed. Reload and try again';end if;
 update public.db_records r set position=o.ordinality
 from unnest(p_record_ids) with ordinality as o(id,ordinality)
 where r.record_id=o.id and r.database_id=p_database_id and r.user_id=auth.uid() and r.position is distinct from o.ordinality;
end $$;

create or replace function public.db_reorder_properties(p_database_id uuid,p_property_ids uuid[])
returns void language plpgsql security invoker set search_path='' as $$
declare expected_count integer;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if not exists(select 1 from public.db_databases where id=p_database_id and user_id=auth.uid() and archived_at is null)
 then raise exception 'Database unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('db-property-order:'||p_database_id::text,0));
 select count(*) into expected_count from public.db_properties where database_id=p_database_id and user_id=auth.uid() and archived_at is null;
 if coalesce(cardinality(p_property_ids),0)<>expected_count
   or (select count(distinct id) from unnest(p_property_ids) id)<>expected_count
   or exists(select 1 from unnest(p_property_ids) id
      where not exists(select 1 from public.db_properties p where p.id=id and p.database_id=p_database_id and p.user_id=auth.uid() and p.archived_at is null))
 then raise exception 'Property order changed. Reload and try again';end if;
 update public.db_properties p set position=o.ordinality
 from unnest(p_property_ids) with ordinality as o(id,ordinality)
 where p.id=o.id and p.database_id=p_database_id and p.user_id=auth.uid() and p.position is distinct from o.ordinality;
end $$;

revoke all on function public.db_reorder_records(uuid,uuid[]),public.db_reorder_properties(uuid,uuid[]) from public,anon;
grant execute on function public.db_reorder_records(uuid,uuid[]),public.db_reorder_properties(uuid,uuid[]) to authenticated;
