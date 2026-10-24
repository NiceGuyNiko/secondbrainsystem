-- Development-stage database lifecycle and flexible dashboard sizing.
-- Synced groups share an existing aaa_widget_definitions ID; no copy of db_records is made.
alter table public.aaa_page_widgets drop constraint if exists aaa_page_widgets_width_check;
alter table public.aaa_page_widgets add constraint aaa_page_widgets_width_check check(width between 2 and 12);
alter table public.aaa_page_widgets drop constraint if exists aaa_page_widgets_height_check;
alter table public.aaa_page_widgets add constraint aaa_page_widgets_height_check check(height between 1 and 12);

-- Destructive source deletion is deliberately restricted to isolated acceptance datasets
-- while the new database engine is in beta. Primary/legacy records are never targeted.
-- The confirmation name is enforced again at the database boundary, not just by the UI.
grant delete on public.db_databases,public.db_properties,public.db_sequence_counters,
 public.db_records,public.db_views to authenticated;
create policy db_perspectives_owner_delete on public.db_perspectives for delete to authenticated
 using(user_id=(select auth.uid()));
grant delete on public.db_perspectives to authenticated;

create function public.db_delete_database(p_database_id uuid,p_confirm_name text)
returns void language plpgsql security invoker set search_path = '' as $$
declare db record; row_ids uuid[];
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select id,name,dataset into db from public.db_databases
   where id=p_database_id and user_id=auth.uid() and archived_at is null for update;
 if not found then raise exception 'Source database unavailable';end if;
 if p_confirm_name is distinct from db.name then raise exception 'Type the exact database name to confirm deletion';end if;
 if db.dataset <> 'acceptance' then
   raise exception 'Permanent deletion is available only for beta/acceptance databases';
 end if;
 select coalesce(array_agg(record_id),'{}'::uuid[]) into row_ids from public.db_records
   where database_id=p_database_id and user_id=auth.uid();
 if exists (select 1 from public.db_perspectives p
    where (p.character_id=any(row_ids) or p.event_id=any(row_ids))
    and p.record_id <> all(row_ids) and p.user_id=auth.uid()) then
   raise exception 'Delete or detach external character perspectives referencing these records first';
 end if;
 if exists(select 1 from public.db_properties p where p.database_id<>p_database_id
     and p.user_id=auth.uid() and p.config->>'target_database_id'=p_database_id::text) then
   raise exception 'Remove relation properties in other databases that depend on this source first';
 end if;
 -- Removes linked page views and synced placements wherever they appear.
 delete from public.aaa_page_widgets w where w.user_id=auth.uid() and (
   w.definition_id in (select id from public.aaa_widget_definitions where database_id=p_database_id and user_id=auth.uid())
   or w.config->>'databaseOverride'=p_database_id::text);
 delete from public.aaa_widget_definitions where database_id=p_database_id and user_id=auth.uid();
 delete from public.db_perspectives where user_id=auth.uid() and record_id=any(row_ids);
 delete from public.db_relations where user_id=auth.uid() and (
   source_record_id=any(row_ids) or target_record_id=any(row_ids)
   or property_id in (select id from public.db_properties where database_id=p_database_id and user_id=auth.uid()));
 delete from public.db_records where database_id=p_database_id and user_id=auth.uid();
 delete from public.db_views where database_id=p_database_id and user_id=auth.uid();
 delete from public.db_properties where database_id=p_database_id and user_id=auth.uid();
 delete from public.db_sequence_counters where database_id=p_database_id and user_id=auth.uid();
 delete from public.db_databases where id=p_database_id and user_id=auth.uid();
 -- A source database and its records are also standalone Thought pages. Clear those
 -- only after removing DB foreign keys. Any unexpected dependency aborts the transaction.
 delete from public.user_items where user_id=auth.uid() and id=any(row_ids);
 delete from public.user_items where user_id=auth.uid() and id=p_database_id;
end $$;
revoke all on function public.db_delete_database(uuid,text) from public,anon;
grant execute on function public.db_delete_database(uuid,text) to authenticated;
