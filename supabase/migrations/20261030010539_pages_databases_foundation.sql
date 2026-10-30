-- Additive module: deliberately independent of user_items, db_* and aaa_widget_*.
create table public.pd_workspaces (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 profile_id text not null check(length(profile_id) between 1 and 160), revision integer not null default 0,
 unique(owner_id,profile_id)
);
create table public.pd_databases (
 id uuid primary key, workspace_id uuid not null references public.pd_workspaces(id),
 name text not null check(length(btrim(name)) between 1 and 160), default_view_id uuid,
 unique(workspace_id,id)
);
create unique index pd_database_names on public.pd_databases(workspace_id,lower(name));
create table public.pd_pages (
 id uuid primary key, workspace_id uuid not null references public.pd_workspaces(id),
 title text not null check(length(btrim(title)) between 1 and 160),
 content text not null default '' check(length(content)<=100000), unique(workspace_id,id)
);
create table public.pd_records (
 id uuid primary key, workspace_id uuid not null, database_id uuid not null,
 parent_id uuid, position integer not null, summary text not null default '',
 unique(workspace_id,id),unique(workspace_id,database_id,id),
 foreign key(workspace_id,id) references public.pd_pages(workspace_id,id),
 foreign key(workspace_id,database_id) references public.pd_databases(workspace_id,id),
 foreign key(workspace_id,database_id,parent_id) references public.pd_records(workspace_id,database_id,id)
);
create index pd_siblings on public.pd_records(workspace_id,database_id,parent_id,position);
create table public.pd_relatabases (
 id uuid primary key, workspace_id uuid not null, name text not null check(length(btrim(name)) between 1 and 160),
 left_database_id uuid not null, right_database_id uuid not null, unique(workspace_id,id),
 foreign key(workspace_id,left_database_id) references public.pd_databases(workspace_id,id),
 foreign key(workspace_id,right_database_id) references public.pd_databases(workspace_id,id)
);
create table public.pd_link_details (
 id uuid primary key, workspace_id uuid not null, relatabase_id uuid not null,
 left_id uuid not null,right_id uuid not null,sequence integer not null,
 unique(workspace_id,relatabase_id,sequence),
 foreign key(workspace_id,id) references public.pd_pages(workspace_id,id),
 foreign key(workspace_id,relatabase_id) references public.pd_relatabases(workspace_id,id),
 foreign key(workspace_id,left_id) references public.pd_records(workspace_id,id),
 foreign key(workspace_id,right_id) references public.pd_records(workspace_id,id)
);
create index pd_links_left on public.pd_link_details(workspace_id,left_id);
create index pd_links_right on public.pd_link_details(workspace_id,right_id);
create table public.pd_saved_views (
 id uuid primary key, workspace_id uuid not null references public.pd_workspaces(id),
 source_id uuid not null,source_kind text not null check(source_kind in ('database','relatabase')),
 name text not null check(length(btrim(name)) between 1 and 180),mode text not null check(mode in ('nested','table','gallery')),
 unique(workspace_id,id)
);
alter table public.pd_databases add foreign key(workspace_id,default_view_id) references public.pd_saved_views(workspace_id,id);
create table public.pd_page_blocks (
 id uuid primary key,workspace_id uuid not null,page_id uuid not null,view_id uuid not null,
 position bigint generated always as identity,
 foreign key(workspace_id,page_id) references public.pd_pages(workspace_id,id),
 foreign key(workspace_id,view_id) references public.pd_saved_views(workspace_id,id)
);
create table public.pd_commands (
 workspace_id uuid not null references public.pd_workspaces(id),id uuid not null,command jsonb not null,
 revision integer not null,created_at timestamptz not null default now(),primary key(workspace_id,id)
);
alter table public.pd_workspaces enable row level security;
revoke all on public.pd_workspaces from anon, authenticated;
grant select on public.pd_workspaces to authenticated;
create policy pd_owner_read on public.pd_workspaces for select to authenticated using (owner_id=(select auth.uid()));
alter table public.pd_databases enable row level security;
revoke all on public.pd_databases from anon, authenticated;
grant select on public.pd_databases to authenticated;
create policy pd_owner_read on public.pd_databases for select to authenticated using (exists(select 1 from public.pd_workspaces w where w.id=pd_databases.workspace_id and w.owner_id=(select auth.uid())));
alter table public.pd_pages enable row level security;
revoke all on public.pd_pages from anon, authenticated;
grant select on public.pd_pages to authenticated;
create policy pd_owner_read on public.pd_pages for select to authenticated using (exists(select 1 from public.pd_workspaces w where w.id=pd_pages.workspace_id and w.owner_id=(select auth.uid())));
alter table public.pd_records enable row level security;
revoke all on public.pd_records from anon, authenticated;
grant select on public.pd_records to authenticated;
create policy pd_owner_read on public.pd_records for select to authenticated using (exists(select 1 from public.pd_workspaces w where w.id=pd_records.workspace_id and w.owner_id=(select auth.uid())));
alter table public.pd_relatabases enable row level security;
revoke all on public.pd_relatabases from anon, authenticated;
grant select on public.pd_relatabases to authenticated;
create policy pd_owner_read on public.pd_relatabases for select to authenticated using (exists(select 1 from public.pd_workspaces w where w.id=pd_relatabases.workspace_id and w.owner_id=(select auth.uid())));
alter table public.pd_link_details enable row level security;
revoke all on public.pd_link_details from anon, authenticated;
grant select on public.pd_link_details to authenticated;
create policy pd_owner_read on public.pd_link_details for select to authenticated using (exists(select 1 from public.pd_workspaces w where w.id=pd_link_details.workspace_id and w.owner_id=(select auth.uid())));
alter table public.pd_saved_views enable row level security;
revoke all on public.pd_saved_views from anon, authenticated;
grant select on public.pd_saved_views to authenticated;
create policy pd_owner_read on public.pd_saved_views for select to authenticated using (exists(select 1 from public.pd_workspaces w where w.id=pd_saved_views.workspace_id and w.owner_id=(select auth.uid())));
alter table public.pd_page_blocks enable row level security;
revoke all on public.pd_page_blocks from anon, authenticated;
grant select on public.pd_page_blocks to authenticated;
create policy pd_owner_read on public.pd_page_blocks for select to authenticated using (exists(select 1 from public.pd_workspaces w where w.id=pd_page_blocks.workspace_id and w.owner_id=(select auth.uid())));
alter table public.pd_commands enable row level security;
revoke all on public.pd_commands from anon, authenticated;
grant select on public.pd_commands to authenticated;
create policy pd_owner_read on public.pd_commands for select to authenticated using (exists(select 1 from public.pd_workspaces w where w.id=pd_commands.workspace_id and w.owner_id=(select auth.uid())));

-- SECURITY INVOKER reads use the same RLS as direct queries.
create function public.pd_load(p_workspace uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.pd_workspaces where id=p_workspace and owner_id=auth.uid()) then raise exception 'Workspace unavailable';end if;
 return jsonb_build_object('version',1,'revision',(select revision from public.pd_workspaces where id=p_workspace),
 'databases',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'defaultViewId',default_view_id) order by name) from public.pd_databases where workspace_id=p_workspace),'[]'::jsonb),
 'pages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'content',content) order by id) from public.pd_pages where workspace_id=p_workspace),'[]'::jsonb),
 'records',coalesce((select jsonb_agg(jsonb_build_object('id',id,'pageId',id,'databaseId',database_id,'parentId',parent_id,'order',position,'summary',summary) order by position,id) from public.pd_records where workspace_id=p_workspace),'[]'::jsonb),
 'relatabases',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'leftDatabaseId',left_database_id,'rightDatabaseId',right_database_id) order by name) from public.pd_relatabases where workspace_id=p_workspace),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('id',id,'pageId',id,'relatabaseId',relatabase_id,'leftId',left_id,'rightId',right_id,'sequence',sequence) order by sequence) from public.pd_link_details where workspace_id=p_workspace),'[]'::jsonb),
 'views',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'sourceId',source_id,'sourceKind',source_kind,'mode',mode) order by name) from public.pd_saved_views where workspace_id=p_workspace),'[]'::jsonb),
 'blocks',coalesce((select jsonb_agg(jsonb_build_object('id',id,'pageId',page_id,'viewId',view_id) order by position) from public.pd_page_blocks where workspace_id=p_workspace),'[]'::jsonb));
end $$;

-- Controlled write endpoints. Direct writes are revoked, so clients cannot bypass
-- validation/locking. Definer privilege is scoped by an explicit auth.uid check,
-- empty search_path, owner-only workspace lock, and no dynamic SQL.
create function public.pd_open_workspace(p_profile text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 insert into public.pd_workspaces(owner_id,profile_id) values(auth.uid(),p_profile)
 on conflict(owner_id,profile_id) do update set profile_id=excluded.profile_id returning id into result;
 return result;
end $$;
create function public.pd_command(p_workspace uuid,p_expected_revision integer,p_request_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 c jsonb:=p_command; op text:=c->>'type'; target uuid:=(c->>'id')::uuid;
 dbid uuid; oldparent uuid; parent uuid; beforeid uuid; pos integer; current_revision integer;
 previous jsonb; rel public.pd_relatabases; v public.pd_saved_views; seq integer;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select revision into current_revision from public.pd_workspaces where id=p_workspace and owner_id=auth.uid() for update;
 if not found then raise exception 'Workspace unavailable';end if;
 select command into previous from public.pd_commands where workspace_id=p_workspace and id=p_request_id;
 if found then
  if previous<>c then raise exception 'Request ID reused for a different command';end if;
  return public.pd_load(p_workspace);
 end if;
 if p_expected_revision is null or current_revision<>p_expected_revision then raise exception 'Workspace changed. Reload before saving.';end if;
 if target is null then raise exception 'Creation or target ID required';end if;
 if op='database' then
  insert into public.pd_databases(id,workspace_id,name) values(target,p_workspace,btrim(c->>'name'));
 elsif op='page' then
  insert into public.pd_pages(id,workspace_id,title) values(target,p_workspace,btrim(c->>'title'));
 elsif op='record' then
  dbid:=(c->>'databaseId')::uuid;parent:=(c->>'parentId')::uuid;
  insert into public.pd_pages(id,workspace_id,title) values(target,p_workspace,btrim(c->>'title'));
  select coalesce(max(position)+1,0) into pos from public.pd_records where workspace_id=p_workspace and database_id=dbid and parent_id is not distinct from parent;
  insert into public.pd_records(id,workspace_id,database_id,parent_id,position) values(target,p_workspace,dbid,parent,pos);
 elsif op='edit-page' then
  update public.pd_pages set title=btrim(c->>'title'),content=c->>'content' where id=target and workspace_id=p_workspace;
  if not found then raise exception 'Page unavailable';end if;
 elsif op='move' then
  select database_id,parent_id into dbid,oldparent from public.pd_records where id=target and workspace_id=p_workspace;
  if not found then raise exception 'Record unavailable';end if;
  parent:=(c->>'parentId')::uuid;beforeid:=(c->>'beforeId')::uuid;
  if parent is not null and not exists(select 1 from public.pd_records where id=parent and workspace_id=p_workspace and database_id=dbid) then raise exception 'Parent must be in the same database';end if;
  if exists(with recursive ancestors as (
   select id,parent_id,1 as depth from public.pd_records where id=parent and workspace_id=p_workspace
   union all select r.id,r.parent_id,a.depth+1 from public.pd_records r join ancestors a on r.id=a.parent_id where r.workspace_id=p_workspace and a.depth<=100
  ) select 1 from ancestors where id=target or depth>100) then raise exception 'Invalid move: cycle or excessive depth';end if;
  if beforeid is not null then
   select position into pos from public.pd_records where id=beforeid and id<>target and workspace_id=p_workspace and database_id=dbid and parent_id is not distinct from parent;
   if not found then raise exception 'Move target must be a sibling';end if;
  else select coalesce(max(position)+1,0) into pos from public.pd_records where workspace_id=p_workspace and database_id=dbid and parent_id is not distinct from parent;end if;
  update public.pd_records set position=position+1 where workspace_id=p_workspace and database_id=dbid and parent_id is not distinct from parent and position>=pos and id<>target;
  update public.pd_records set parent_id=parent,position=pos where id=target and workspace_id=p_workspace;
  -- Renumber both sibling lists in this transaction, with deterministic tie breaking.
  with ranked as (select id,(row_number() over(partition by parent_id order by position,id)-1)::integer n from public.pd_records where workspace_id=p_workspace and database_id=dbid and (parent_id is not distinct from parent or parent_id is not distinct from oldparent))
  update public.pd_records r set position=ranked.n from ranked where r.id=ranked.id;
 elsif op='relatabase' then
  insert into public.pd_relatabases(id,workspace_id,name,left_database_id,right_database_id) values(target,p_workspace,btrim(c->>'name'),(c->>'leftDatabaseId')::uuid,(c->>'rightDatabaseId')::uuid);
 elsif op='link' then
  select * into rel from public.pd_relatabases where id=(c->>'relatabaseId')::uuid and workspace_id=p_workspace;
  if not found then raise exception 'Relatabase unavailable';end if;
  if not exists(select 1 from public.pd_records where id=(c->>'leftId')::uuid and workspace_id=p_workspace and database_id=rel.left_database_id)
  or not exists(select 1 from public.pd_records where id=(c->>'rightId')::uuid and workspace_id=p_workspace and database_id=rel.right_database_id) then raise exception 'Invalid endpoint database';end if;
  select coalesce(max(sequence),0)+1 into seq from public.pd_link_details where workspace_id=p_workspace and relatabase_id=rel.id;
  insert into public.pd_pages(id,workspace_id,title) values(target,p_workspace,btrim(c->>'title'));
  insert into public.pd_link_details(id,workspace_id,relatabase_id,left_id,right_id,sequence) values(target,p_workspace,rel.id,(c->>'leftId')::uuid,(c->>'rightId')::uuid,seq);
 elsif op='view' then
  if not ((c->>'sourceKind'='database' and exists(select 1 from public.pd_databases where workspace_id=p_workspace and id=(c->>'sourceId')::uuid)) or (c->>'sourceKind'='relatabase' and exists(select 1 from public.pd_relatabases where workspace_id=p_workspace and id=(c->>'sourceId')::uuid))) then raise exception 'View source unavailable';end if;
  insert into public.pd_saved_views(id,workspace_id,source_id,source_kind,name,mode) values(target,p_workspace,(c->>'sourceId')::uuid,c->>'sourceKind',btrim(c->>'name'),c->>'mode');
 elsif op='edit-view' then
  update public.pd_saved_views set name=btrim(c->>'name'),mode=c->>'mode' where id=target and workspace_id=p_workspace;
  if not found then raise exception 'View unavailable';end if;
 elsif op='default-view' then
  if not exists(select 1 from public.pd_saved_views where id=(c->>'viewId')::uuid and workspace_id=p_workspace and source_kind='database' and source_id=target) then raise exception 'Default view must use this database';end if;
  update public.pd_databases set default_view_id=(c->>'viewId')::uuid where id=target and workspace_id=p_workspace;
 elsif op='block' then
  insert into public.pd_page_blocks(id,workspace_id,page_id,view_id) values(target,p_workspace,(c->>'pageId')::uuid,(c->>'viewId')::uuid);
 elsif op='clone-view' then
  select * into v from public.pd_saved_views where id=(c->>'viewId')::uuid and workspace_id=p_workspace;
  if not found then raise exception 'View unavailable';end if;
  insert into public.pd_saved_views(id,workspace_id,source_id,source_kind,name,mode) values(target,p_workspace,v.source_id,v.source_kind,v.name||' (independent)',v.mode);
  update public.pd_page_blocks set view_id=target where id=(c->>'blockId')::uuid and workspace_id=p_workspace and view_id=v.id;
  if not found then raise exception 'Block changed. Reload first.';end if;
 else raise exception 'Unknown command';end if;
 update public.pd_workspaces set revision=revision+1 where id=p_workspace;
 insert into public.pd_commands(workspace_id,id,command,revision) values(p_workspace,p_request_id,c,current_revision+1);
 return public.pd_load(p_workspace);
end $$;
revoke all on function public.pd_load(uuid) from public,anon;
revoke all on function public.pd_open_workspace(text) from public,anon;
revoke all on function public.pd_command(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.pd_load(uuid) to authenticated;
grant execute on function public.pd_open_workspace(text) to authenticated;
grant execute on function public.pd_command(uuid,integer,uuid,jsonb) to authenticated;
