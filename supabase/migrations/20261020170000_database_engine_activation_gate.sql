-- Production activation marker. Apply ONLY after the entire ordered
-- 20261018–20261020 database-engine migration chain has passed verification.
-- A missing marker forces the UI to keep legacy data visible and prevents
-- partially migrated backends from exposing the new create/edit controls.
-- No rows are inserted, imported, changed or deleted by this migration.
create or replace function public.db_engine_ready()
returns boolean
language sql stable security invoker set search_path='' as $$
  select auth.uid() is not null
    and to_regclass('public.database_property_definitions') is not null
    and to_regclass('public.db_databases') is not null
    and to_regclass('public.db_properties') is not null
    and to_regclass('public.db_sequence_counters') is not null
    and to_regclass('public.db_records') is not null
    and to_regclass('public.db_relations') is not null
    and to_regclass('public.db_views') is not null
    and to_regclass('public.db_perspectives') is not null
    and to_regprocedure('public.db_create_database(uuid,text,text)') is not null
    and to_regprocedure('public.db_create_record(uuid,uuid,text)') is not null
    and to_regprocedure('public.db_set_value(uuid,integer,uuid,jsonb)') is not null
    and to_regprocedure('public.db_link(uuid,uuid,uuid)') is not null
    and to_regprocedure('public.db_create_perspective(uuid,uuid,uuid)') is not null;
$$;
revoke all on function public.db_engine_ready() from public,anon;
grant execute on function public.db_engine_ready() to authenticated;
