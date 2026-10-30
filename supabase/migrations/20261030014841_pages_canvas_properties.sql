-- Add typed page properties and source-faithful view settings without touching legacy data.
alter table public.pd_databases add column description text not null default '',add column icon text not null default '▤';
alter table public.pd_pages add column description text not null default '',add column icon text not null default '◇';
alter table public.pd_records add column values_json jsonb not null default '{}' check(jsonb_typeof(values_json)='object');
alter table public.pd_link_details add column values_json jsonb not null default '{}' check(jsonb_typeof(values_json)='object');
alter table public.pd_relatabases add column description text not null default '',add column left_label text,add column right_label text;
alter table public.pd_saved_views add column config jsonb not null default '{}' check(jsonb_typeof(config)='object');
alter table public.pd_saved_views drop constraint pd_saved_views_mode_check;
alter table public.pd_saved_views add check(mode in ('nested','table','gallery','grouped'));
alter table public.pd_workspaces add column wizard jsonb;
create table public.pd_properties (
 id uuid primary key,workspace_id uuid not null references public.pd_workspaces(id),source_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 160),type text not null check(type in ('text','number','date','select','image','relation')),
 options jsonb not null default '[]' check(jsonb_typeof(options)='array'),target_database_id uuid,
 position bigint generated always as identity,
 foreign key(workspace_id,target_database_id) references public.pd_databases(workspace_id,id)
);
create unique index pd_property_names on public.pd_properties(workspace_id,source_id,lower(name));
create table public.pd_property_history (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.pd_workspaces(id),
 property_id uuid not null,snapshot jsonb not null,created_at timestamptz not null default now()
);
alter table public.pd_properties enable row level security;
alter table public.pd_property_history enable row level security;
revoke all on public.pd_properties,public.pd_property_history from anon,authenticated;
grant select on public.pd_properties,public.pd_property_history to authenticated;
create policy pd_owner_read on public.pd_properties for select to authenticated using(exists(select 1 from public.pd_workspaces w where w.id=pd_properties.workspace_id and w.owner_id=(select auth.uid())));
create policy pd_owner_read on public.pd_property_history for select to authenticated using(exists(select 1 from public.pd_workspaces w where w.id=pd_property_history.workspace_id and w.owner_id=(select auth.uid())));

alter function public.pd_load(uuid) rename to pd_load_v1;
create function public.pd_load(p_workspace uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare base jsonb;
begin
 base:=public.pd_load_v1(p_workspace);
 return base||jsonb_build_object(
 'properties',coalesce((select jsonb_agg(jsonb_build_object('id',id,'sourceId',source_id,'name',name,'type',type,'options',options,'targetDatabaseId',target_database_id) order by position) from public.pd_properties where workspace_id=p_workspace),'[]'::jsonb),
 'wizard',(select wizard from public.pd_workspaces where id=p_workspace),
 'databases',coalesce((select jsonb_agg(item||jsonb_build_object('description',d.description,'icon',d.icon)) from jsonb_array_elements(base->'databases') item join public.pd_databases d on d.id=(item->>'id')::uuid where d.workspace_id=p_workspace),'[]'::jsonb),
 'pages',coalesce((select jsonb_agg(item||jsonb_build_object('description',p.description,'icon',p.icon)) from jsonb_array_elements(base->'pages') item join public.pd_pages p on p.id=(item->>'id')::uuid where p.workspace_id=p_workspace),'[]'::jsonb),
 'records',coalesce((select jsonb_agg(item||jsonb_build_object('values',r.values_json) order by r.position,r.id) from jsonb_array_elements(base->'records') item join public.pd_records r on r.id=(item->>'id')::uuid where r.workspace_id=p_workspace),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(item||jsonb_build_object('values',r.values_json) order by r.sequence) from jsonb_array_elements(base->'links') item join public.pd_link_details r on r.id=(item->>'id')::uuid where r.workspace_id=p_workspace),'[]'::jsonb),
 'relatabases',coalesce((select jsonb_agg(item||jsonb_build_object('description',r.description,'leftLabel',r.left_label,'rightLabel',r.right_label)) from jsonb_array_elements(base->'relatabases') item join public.pd_relatabases r on r.id=(item->>'id')::uuid where r.workspace_id=p_workspace),'[]'::jsonb),
 'views',coalesce((select jsonb_agg(item||jsonb_build_object('config',v.config)) from jsonb_array_elements(base->'views') item join public.pd_saved_views v on v.id=(item->>'id')::uuid where v.workspace_id=p_workspace),'[]'::jsonb));
end $$;

-- Internal validator. Only the controlled command endpoint may call it.
create function public.pd_validate_values(p_workspace uuid,p_source uuid,p_values jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare entry record;p public.pd_properties;v jsonb;txt text;
begin
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Expected property values';end if;
 for entry in select * from jsonb_each(p_values) loop
  select * into p from public.pd_properties where id=entry.key::uuid and source_id=p_source and workspace_id=p_workspace;
  if not found then raise exception 'Unknown property';end if;
  v:=entry.value;if v='null'::jsonb or v='""'::jsonb then continue;end if;
  if p.type='number' then
   if jsonb_typeof(v)<>'number' then raise exception 'Expected a number';end if;
  elsif p.type='select' then
   if jsonb_typeof(v)<>'array' then raise exception 'Expected selections';end if;
   if exists(select 1 from jsonb_array_elements_text(v) choice where not exists(select 1 from jsonb_array_elements(p.options) o where o->>'id'=choice)) then raise exception 'Unknown selection';end if;
  elsif p.type='relation' then
   if not exists(select 1 from public.pd_records where workspace_id=p_workspace and database_id=p.target_database_id and id=(v#>>'{}')::uuid) then raise exception 'Invalid related record';end if;
  else
   if jsonb_typeof(v)<>'string' or length(v#>>'{}')>100000 then raise exception 'Expected text';end if;
   if p.type='date' then txt:=v#>>'{}';if txt!~'^\d{4}-\d{2}-\d{2}$' or to_char(txt::date,'YYYY-MM-DD')<>txt then raise exception 'Invalid date';end if;end if;
  end if;
 end loop;
end $$;
alter function public.pd_command(uuid,integer,uuid,jsonb) rename to pd_command_v1;
revoke all on function public.pd_command_v1(uuid,integer,uuid,jsonb) from authenticated,public,anon;
create function public.pd_command(p_workspace uuid,p_expected_revision integer,p_request_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 c jsonb:=p_command;op text:=c->>'type';target uuid:=(c->>'id')::uuid;rev integer;previous jsonb;result jsonb;
 source uuid;vals jsonb;old public.pd_properties;options jsonb;newtype text;rowdata record;currentval jsonb;txt text;converted jsonb;token text;optionid text;
 rel public.pd_relatabases;item jsonb;cfg jsonb;oldblock public.pd_page_blocks;beforepos bigint;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select revision into rev from public.pd_workspaces where id=p_workspace and owner_id=auth.uid() for update;
 if not found then raise exception 'Workspace unavailable';end if;
 select command into previous from public.pd_commands where workspace_id=p_workspace and id=p_request_id;
 if found then if previous<>c then raise exception 'Request ID reused for a different command';end if;return public.pd_load(p_workspace);end if;
 if p_expected_revision is null or rev<>p_expected_revision then raise exception 'Workspace changed. Reload before saving.';end if;
 if target is null then raise exception 'Target ID required';end if;
 if op='batch' then
  if jsonb_typeof(c->'commands') is distinct from 'array' or jsonb_array_length(c->'commands') not between 1 and 20 or exists(select 1 from jsonb_array_elements(c->'commands') x where x->>'type'='batch') then raise exception 'Invalid command batch';end if;
  for item in select * from jsonb_array_elements(c->'commands') loop
   perform public.pd_command(p_workspace,(select revision from public.pd_workspaces where id=p_workspace),gen_random_uuid(),item);
  end loop;
 elsif op='property' then
  source:=(c->>'sourceId')::uuid;newtype:=c->>'propertyType';options:=coalesce(c->'options','[]'::jsonb);
  if not(exists(select 1 from public.pd_databases where id=source and workspace_id=p_workspace) or exists(select 1 from public.pd_relatabases where id=source and workspace_id=p_workspace)) then raise exception 'Property source unavailable';end if;
  if lower(btrim(c->>'name')) in ('name','parent page') then raise exception 'Property is built in';end if;
  if jsonb_typeof(options)<>'array' or exists(select 1 from jsonb_array_elements(options) o where coalesce(length(btrim(o->>'label')),0) not between 1 and 160 or o->>'id' is null)
   or (select count(*)<>count(distinct lower(o->>'label')) or count(*)<>count(distinct o->>'id') from jsonb_array_elements(options) o) then raise exception 'Options must be valid and unique';end if;
  select * into old from public.pd_properties where id=target and workspace_id=p_workspace;
  if found and old.source_id<>source then raise exception 'Property source cannot change';end if;
  if old.id is not null then insert into public.pd_property_history(workspace_id,property_id,snapshot) values(p_workspace,target,jsonb_build_object('property',to_jsonb(old),'records',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'values',values_json)),'[]') from public.pd_records where database_id=source and workspace_id=p_workspace),'links',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'values',values_json)),'[]') from public.pd_link_details where relatabase_id=source and workspace_id=p_workspace)));end if;
  if old.id is not null and old.type<>newtype then
   for rowdata in select id,values_json,false islink from public.pd_records where workspace_id=p_workspace and database_id=source union all select id,values_json,true from public.pd_link_details where workspace_id=p_workspace and relatabase_id=source loop
    currentval:=rowdata.values_json->target::text;
    if currentval is null or currentval='null'::jsonb or currentval='""'::jsonb then continue;end if;
    if old.type='select' then
     select string_agg(coalesce(o->>'label',selected.value),', ' order by selected.n) into txt from jsonb_array_elements_text(currentval) with ordinality selected(value,n) left join jsonb_array_elements(old.options) o on o->>'id'=selected.value;
    elsif old.type='relation' then select title into txt from public.pd_pages where id=(currentval#>>'{}')::uuid and workspace_id=p_workspace;
    else txt:=currentval#>>'{}';end if;
    if newtype='select' then
     converted:='[]';for token in select btrim(x) from regexp_split_to_table(txt,',') x where btrim(x)<>'' loop
      select o->>'id' into optionid from jsonb_array_elements(options) o where lower(o->>'label')=lower(token);
      if not found then optionid:=gen_random_uuid()::text;options:=options||jsonb_build_array(jsonb_build_object('id',optionid,'label',token));end if;
      converted:=converted||jsonb_build_array(optionid);
     end loop;
    elsif newtype='number' then if txt!~'^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' then raise exception 'Some values are not valid numbers';end if;converted:=to_jsonb(txt::numeric);
    elsif newtype='date' then if txt!~'^\d{4}-\d{2}-\d{2}$' or to_char(txt::date,'YYYY-MM-DD')<>txt then raise exception 'Some values are not valid dates';end if;converted:=to_jsonb(txt);
    elsif newtype='relation' then
     select r.id::text into optionid from public.pd_records r join public.pd_pages p on p.id=r.id where r.workspace_id=p_workspace and r.database_id=(c->>'targetDatabaseId')::uuid and lower(p.title)=lower(txt) order by r.id limit 1;
     if not found then raise exception 'A value has no matching record in the target database';end if;converted:=to_jsonb(optionid);
    else converted:=to_jsonb(txt);end if;
    if rowdata.islink then update public.pd_link_details set values_json=jsonb_set(values_json,array[target::text],converted) where id=rowdata.id and workspace_id=p_workspace;
    else update public.pd_records set values_json=jsonb_set(values_json,array[target::text],converted) where id=rowdata.id and workspace_id=p_workspace;end if;
   end loop;
  end if;
  insert into public.pd_properties(id,workspace_id,source_id,name,type,options,target_database_id) values(target,p_workspace,source,btrim(c->>'name'),newtype,options,case when newtype='relation' then (c->>'targetDatabaseId')::uuid else null end)
  on conflict(id) do update set name=excluded.name,type=excluded.type,options=excluded.options,target_database_id=excluded.target_database_id where pd_properties.workspace_id=p_workspace;
  if not found then raise exception 'Property unavailable';end if;
  if newtype='relation' and not exists(select 1 from public.pd_databases where id=(c->>'targetDatabaseId')::uuid and workspace_id=p_workspace) then raise exception 'Relation target unavailable';end if;
  for rowdata in select values_json from public.pd_records where database_id=source and workspace_id=p_workspace union all select values_json from public.pd_link_details where relatabase_id=source and workspace_id=p_workspace loop perform public.pd_validate_values(p_workspace,source,rowdata.values_json);end loop;
 elsif op='record-values' then
  select database_id into source from public.pd_records where id=target and workspace_id=p_workspace;
  if not found then select relatabase_id into source from public.pd_link_details where id=target and workspace_id=p_workspace;end if;
  if source is null then raise exception 'Record unavailable';end if;
  perform public.pd_validate_values(p_workspace,source,c->'values');
  update public.pd_records set values_json=c->'values' where id=target and workspace_id=p_workspace;
  update public.pd_link_details set values_json=c->'values' where id=target and workspace_id=p_workspace;
 elsif op='link-endpoints' then
  select d.* into rel from public.pd_link_details l join public.pd_relatabases d on d.id=l.relatabase_id where l.id=target and l.workspace_id=p_workspace;
  if not found or not exists(select 1 from public.pd_records where id=(c->>'leftId')::uuid and database_id=rel.left_database_id and workspace_id=p_workspace) or not exists(select 1 from public.pd_records where id=(c->>'rightId')::uuid and database_id=rel.right_database_id and workspace_id=p_workspace) then raise exception 'Invalid endpoint database';end if;
  update public.pd_link_details set left_id=(c->>'leftId')::uuid,right_id=(c->>'rightId')::uuid where id=target and workspace_id=p_workspace;
 elsif op='remove-block' then delete from public.pd_page_blocks where id=target and workspace_id=p_workspace;if not found then raise exception 'Block unavailable';end if;
 elsif op='move-block' then
  select * into oldblock from public.pd_page_blocks where id=target and workspace_id=p_workspace;if not found then raise exception 'Block unavailable';end if;
  if c->>'beforeId' is null then select coalesce(max(position),0)+1 into beforepos from public.pd_page_blocks where page_id=oldblock.page_id and workspace_id=p_workspace;
  else select position into beforepos from public.pd_page_blocks where id=(c->>'beforeId')::uuid and id<>target and page_id=oldblock.page_id and workspace_id=p_workspace;if not found then raise exception 'Invalid block target';end if;end if;
  update public.pd_page_blocks set position=position+1 where workspace_id=p_workspace and page_id=oldblock.page_id and position>=beforepos and id<>target;
  update public.pd_page_blocks set position=beforepos where id=target and workspace_id=p_workspace;
 elsif op='wizard' then
  if jsonb_typeof(c->'wizard') is distinct from 'object' or c->'wizard'->>'step' is null or (c->'wizard'->>'step')::int not between 0 and 3 then raise exception 'Invalid builder stage';end if;
  if c->'wizard'->>'databaseId' is not null and not exists(select 1 from public.pd_databases where workspace_id=p_workspace and id=(c->'wizard'->>'databaseId')::uuid) then raise exception 'Builder database unavailable';end if;
  if c->'wizard'->>'viewId' is not null and not exists(select 1 from public.pd_saved_views where workspace_id=p_workspace and id=(c->'wizard'->>'viewId')::uuid) then raise exception 'Builder view unavailable';end if;
  if c->'wizard'->>'pageId' is not null and not exists(select 1 from public.pd_pages where workspace_id=p_workspace and id=(c->'wizard'->>'pageId')::uuid) then raise exception 'Builder page unavailable';end if;
  update public.pd_workspaces set wizard=c->'wizard' where id=p_workspace;
 elsif op='default-view' and c->>'viewId' is null then
  update public.pd_databases set default_view_id=null where id=target and workspace_id=p_workspace;if not found then raise exception 'Database unavailable';end if;
 else
  result:=public.pd_command_v1(p_workspace,rev,p_request_id,c);
  if op in ('record','move') and (
   (with recursive a as (select id,parent_id,1 depth from public.pd_records where id=target and workspace_id=p_workspace union all select r.id,r.parent_id,a.depth+1 from public.pd_records r join a on r.id=a.parent_id where r.workspace_id=p_workspace and a.depth<=100) select max(depth) from a)+
   (with recursive d as (select id,1 depth from public.pd_records where id=target and workspace_id=p_workspace union all select r.id,d.depth+1 from public.pd_records r join d on r.parent_id=d.id where r.workspace_id=p_workspace and d.depth<=100) select max(depth) from d)-1>100
  ) then raise exception 'Hierarchy is too deep';end if;
  if op='database' then update public.pd_databases set description=coalesce(c->>'description',''),icon=coalesce(c->>'icon','▤') where id=target and workspace_id=p_workspace;end if;
  if op in ('page','edit-page') then update public.pd_pages set description=coalesce(c->>'description',description),icon=coalesce(c->>'icon',icon) where id=target and workspace_id=p_workspace;end if;
  if op in ('record','link') and c?'values' then
   source:=case when op='record' then (c->>'databaseId')::uuid else (c->>'relatabaseId')::uuid end;
   perform public.pd_validate_values(p_workspace,source,c->'values');
   update public.pd_records set values_json=c->'values' where id=target and workspace_id=p_workspace;
   update public.pd_link_details set values_json=c->'values' where id=target and workspace_id=p_workspace;
  end if;
  if op='relatabase' then update public.pd_relatabases set description=coalesce(c->>'description',''),left_label=c->>'leftLabel',right_label=c->>'rightLabel' where id=target and workspace_id=p_workspace;end if;
  if op='clone-view' then update public.pd_saved_views set config=(select config from public.pd_saved_views where id=(c->>'viewId')::uuid and workspace_id=p_workspace) where id=target and workspace_id=p_workspace;end if;
  if op in ('view','edit-view') and c?'config' then
   cfg:=c->'config';select source_id into source from public.pd_saved_views where id=target and workspace_id=p_workspace;
   if jsonb_typeof(cfg)<>'object' then raise exception 'Invalid view settings';end if;
   for item in select to_jsonb(x) from (select cfg->>'summaryField' x union all select cfg->>'coverField' union all select jsonb_array_elements_text(coalesce(cfg->'shownFields','[]'))) fields where x is not null and x<>'' loop
    if not exists(select 1 from public.pd_properties where workspace_id=p_workspace and source_id=source and id=(item#>>'{}')::uuid) then raise exception 'View property unavailable';end if;
   end loop;
   if coalesce(cfg->>'relatedId','')<>'' and not exists(select 1 from public.pd_relatabases where id=(cfg->>'relatedId')::uuid and workspace_id=p_workspace and (left_database_id=source or right_database_id=source)) then raise exception 'Invalid related section';end if;
   update public.pd_saved_views set config=cfg where id=target and workspace_id=p_workspace;
  end if;
  return public.pd_load(p_workspace);
 end if;
 update public.pd_workspaces set revision=revision+1 where id=p_workspace returning revision into rev;
 insert into public.pd_commands(workspace_id,id,command,revision) values(p_workspace,p_request_id,c,rev);
 return public.pd_load(p_workspace);
end $$;
revoke all on function public.pd_load(uuid) from public,anon;
grant execute on function public.pd_load(uuid) to authenticated;
revoke all on function public.pd_validate_values(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.pd_command(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.pd_command(uuid,integer,uuid,jsonb) to authenticated;
