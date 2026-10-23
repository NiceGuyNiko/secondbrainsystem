-- User-owned widget definitions, page layouts and local view overrides.
-- Canonical records remain in db_records, properties in db_properties, views in db_views.
create table public.aaa_widget_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  database_id uuid references public.db_databases(id) on delete restrict,
  view_id uuid references public.db_views(id) on delete set null,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,id)
);

create table public.aaa_library_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  area text not null check (area in ('library','goals')),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  position numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,id)
);
create index aaa_library_pages_owner_area on public.aaa_library_pages(user_id,area,position);

create table public.aaa_page_widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  page_id uuid not null,
  definition_id uuid,
  kind text not null default 'database' check (kind in ('database','goals')),
  title text,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  width integer not null default 6 check (width between 3 and 12),
  height integer not null default 2 check (height between 1 and 6),
  position numeric not null default 0,
  created_at timestamptz not null default now(),
  foreign key(user_id,page_id) references public.aaa_library_pages(user_id,id) on delete cascade,
  foreign key(user_id,definition_id) references public.aaa_widget_definitions(user_id,id) on delete restrict
);
create index aaa_page_widgets_by_page on public.aaa_page_widgets(user_id,page_id,position);

create function public.aaa_validate_widget_reference() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'Widget owner does not match the signed-in user';
  end if;
  if tg_table_name = 'aaa_widget_definitions' then
    if new.database_id is not null and not exists (
      select 1 from public.db_databases d where d.id=new.database_id and d.user_id=new.user_id and d.archived_at is null
    ) then raise exception 'Source database unavailable'; end if;
    if new.view_id is not null and not exists (
      select 1 from public.db_views v where v.id=new.view_id and v.database_id=new.database_id and v.user_id=new.user_id
    ) then raise exception 'Source view unavailable'; end if;
  elsif tg_table_name = 'aaa_page_widgets' then
    if new.kind='goals' and not exists (
      select 1 from public.aaa_library_pages p where p.id=new.page_id and p.user_id=new.user_id and p.area='goals'
    ) then raise exception 'Goals widget must be on a Goals page'; end if;
    if new.kind='database' and new.definition_id is null then
      raise exception 'Database widget requires a definition';
    end if;
  end if;
  if tg_op='UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'Widget ownership cannot change';
  end if;
  return new;
end $$;
create trigger aaa_widget_definitions_validate before insert or update on public.aaa_widget_definitions
  for each row execute function public.aaa_validate_widget_reference();
create trigger aaa_page_widgets_validate before insert or update on public.aaa_page_widgets
  for each row execute function public.aaa_validate_widget_reference();

alter table public.aaa_widget_definitions enable row level security;
alter table public.aaa_library_pages enable row level security;
alter table public.aaa_page_widgets enable row level security;
create policy aaa_widget_definitions_owner on public.aaa_widget_definitions for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy aaa_library_pages_owner on public.aaa_library_pages for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy aaa_page_widgets_owner on public.aaa_page_widgets for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.aaa_widget_definitions,public.aaa_library_pages,public.aaa_page_widgets from public,anon;
grant select,insert,update,delete on public.aaa_widget_definitions,public.aaa_library_pages,public.aaa_page_widgets to authenticated;
