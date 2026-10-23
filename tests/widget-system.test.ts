import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync,readdirSync} from "node:fs";
import {groupPageWidgets,placementConfigAfterPublish,widgetConfig,widgetGridSize,widgetHeightPx,widgetIsSynced,widgetPlacementConfig,type PageWidget} from "../lib/widget-system";
import {placeWidget,resizeWidgetLane,widgetLayoutBands} from "../lib/widget-layout";

test("stable drop placements snap columns, stack widgets and conserve neighboring widths",()=>{
  const widget=(id:string,width:number,position:number,sectionId="history"):PageWidget=>({id,page_id:"world",definition_id:id,
    kind:"database",title:id,config:{sectionId},width,height:2,position});
  const sections=[{id:"history",page_id:"world",title:"History",position:0},{id:"characters",page_id:"world",title:"Characters",position:1}];
  const original=[widget("era",6,0),widget("event",6,1),widget("moment",12,2)];
  const stacked=placeWidget(original,sections,"moment",{sectionId:"history",targetId:"event",edge:"below"});
  const bands=widgetLayoutBands(stacked);
  assert.equal(bands.length,1);
  assert.deepEqual(bands[0].lanes.map(l=>l.widgets.map(w=>w.id)),[["era"],["event","moment"]]);
  assert.deepEqual(bands[0].lanes.map(l=>l.width),[6,6]);
  const middle=placeWidget(original,sections,"moment",{sectionId:"history",targetId:"event",edge:"left"});
  assert.deepEqual(widgetLayoutBands(middle)[0].lanes.map(l=>l.widgets[0].id),["era","moment","event"]);
  assert.deepEqual(widgetLayoutBands(middle)[0].lanes.map(l=>l.width),[4,4,4],"three columns automatically snap to thirds");
  const stretched=resizeWidgetLane(middle,sections,"era",2);
  assert.deepEqual(widgetLayoutBands(stretched)[0].lanes.map(l=>l.width),[6,2,4],"a divider expands the left lane as it contracts the neighbor");
  const thirds=resizeWidgetLane(resizeWidgetLane(middle,sections,"era",-1),sections,"moment",1);
  assert.deepEqual(widgetLayoutBands(thirds)[0].lanes.map(l=>l.width),[3,6,3],"custom 25/50/25 layout stays possible after snapping to thirds");
  const oneColumn=placeWidget(original.slice(0,2),sections,"event",{sectionId:"history",targetId:"era",edge:"below"});
  assert.deepEqual(widgetLayoutBands(oneColumn)[0].lanes.map(l=>l.width),[12],"stacking two half widgets restores a full-width column");
  const moved=placeWidget(stacked,sections,"moment",{sectionId:"characters",targetId:null,edge:"section-end"});
  assert.equal(moved.find(w=>w.id==="moment")?.config.sectionId,"characters");
  assert.equal(moved.find(w=>w.id==="event")?.config.sectionId,"history");
  assert.deepEqual(original.map(w=>w.config),[{sectionId:"history"},{sectionId:"history"},{sectionId:"history"}],"preview never mutates source placements");
});

test("widget views normalize rendering, filters, sort priority and edit controls",()=>{
  const parsed=widgetConfig({renderer:"cards",density:"compact",editable:false,
    filters:[{id:"f",field:"name",operator:"contains",value:"Michael"}],filterMode:"any",
    sorts:[{id:"s",field:"creation",direction:"desc"}],visibleProperties:["prop-a"],
    color:"not-a-color",allowCreate:true});
  assert.equal(parsed.renderer,"cards");
  assert.equal(parsed.color,"theme");
  assert.equal(parsed.density,"compact");
  assert.equal(parsed.editable,false);
  assert.equal(parsed.allowCreate,true);
  assert.equal(parsed.showDatabase,false,"database name is optional and hidden by default");
  assert.equal(parsed.showViewTag,false,"connected-view label is hidden by default");
  assert.equal(parsed.filterMode,"any");
  assert.deepEqual(parsed.sorts.map(s=>s.direction),["desc"]);
  assert.deepEqual(parsed.visibleProperties,["prop-a"]);
  assert.equal(widgetConfig({renderer:"unsafe",filters:"broken"}).filters.length,0);
});

test("page sections preserve widget identity and grid heights are bounded",()=>{
  const widget=(id:string,sectionId?:string):PageWidget=>({id,page_id:"world",definition_id:"master",kind:"database",title:null,
    config:sectionId?{sectionId}:{},width:6,height:2,position:id==="a"?0:id==="b"?1:2});
  const sections=[{id:"s2",page_id:"world",title:"Moments",position:1},{id:"s1",page_id:"world",title:"History",position:0}];
  const grouped=groupPageWidgets("world",sections,[widget("c"),widget("b","s2"),widget("a","s1")]);
  assert.deepEqual(grouped.map(group=>group.section.title),["Overview","History","Moments"]);
  assert.deepEqual(grouped.flatMap(group=>group.widgets.map(item=>item.id)),["c","a","b"]);
  assert.equal(grouped[1].widgets[0].id,"a","a section references a widget placement rather than duplicating it");
  assert.deepEqual(widgetGridSize({...widget("a"),width:12,height:4}),{width:12,height:4});
  assert.deepEqual(widgetGridSize({...widget("a"),width:100,height:50}),{width:12,height:12});
  assert.deepEqual(widgetGridSize({...widget("a"),width:1,height:0}),{width:2,height:2});
  assert.equal(widgetHeightPx(widget("a")),280);
  assert.equal(widgetHeightPx({...widget("a"),config:{heightPx:547}}),547,"heights are continuous pixels, not rows");
  assert.equal(widgetHeightPx({...widget("a"),config:{heightPx:7000}}),1200,"height is safely capped");
  assert.deepEqual(placementConfigAfterPublish({...widget("a","s1"),config:{sectionId:"s1",heightPx:416}}),{sectionId:"s1",heightPx:416});
  assert.deepEqual(placementConfigAfterPublish({...widget("a","s1"),config:{sectionId:"s1",filters:["temporary"]}}),{sectionId:"s1"},"publishing a view cannot remove its page section");
  assert.deepEqual(groupPageWidgets("empty",sections,[widget("a")]).map(group=>group.section.title),["Overview"]);
  const synced={...widget("a","s1"),config:{sectionId:"s1",syncMode:"synced",renderer:"cards",filters:["local"]}};
  assert.equal(widgetIsSynced(synced),true);
  assert.deepEqual(widgetPlacementConfig(synced,"s2"),{sectionId:"s2",syncMode:"synced"});
  assert.deepEqual(placementConfigAfterPublish(synced),{sectionId:"s1",syncMode:"synced"});
  assert.deepEqual(placementConfigAfterPublish({...synced,config:{...synced.config,layoutBand:"b3",layoutLane:"l1"}}),
    {sectionId:"s1",syncMode:"synced",layoutBand:"b3",layoutLane:"l1"},"publishing the view keeps its exact visual placement");
});

test("beta source deletion requires exact confirmation and never affects primary datasets",async()=>{
  const db=new PGlite();
  const owner="00000000-0000-0000-0000-000000000001";
  try{
    await db.exec("create role anon;create role authenticated;create schema auth;"+
      "create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);"+
      "create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;"+
      "grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
    await db.query("insert into auth.users(id) values($1)",[owner]);
    for(const file of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort())
      await db.exec(readFileSync("supabase/migrations/"+file,"utf8"));
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
    const id=crypto.randomUUID(),another=crypto.randomUUID();
    await db.query("select public.db_create_database($1,'Source of Truth','acceptance')",[id]);
    await db.query("select public.db_create_database($1,'Legacy Goals','primary')",[another]);
    const recordId=crypto.randomUUID();
    await db.query("select public.db_create_record($1,$2,'A record')",[recordId,id]);
    const page=await db.query<{id:string}>("insert into public.aaa_library_pages(area,title) values('library','Lab') returning id");
    const master=await db.query<{id:string}>("insert into public.aaa_widget_definitions(name,database_id) values('Source widget',$1) returning id",[id]);
    await db.query("insert into public.aaa_page_widgets(page_id,definition_id,width,height,config) values($1,$2,2,11,$3)",
      [page.rows[0].id,master.rows[0].id,JSON.stringify({syncMode:"synced"})]);
    await assert.rejects(db.query("select public.db_delete_database($1,'Wrong name')",[id]),/exact database name/i);
    await assert.rejects(db.query("select public.db_delete_database($1,'Legacy Goals')",[another]),/beta\/acceptance/i);
    assert.equal((await db.query("select * from public.db_records where database_id=$1",[id])).rows.length,1);
    await db.query("select public.db_delete_database($1,'Source of Truth')",[id]);
    assert.equal((await db.query("select * from public.db_databases where id=$1",[id])).rows.length,0);
    assert.equal((await db.query("select * from public.db_records where record_id=$1",[recordId])).rows.length,0);
    assert.equal((await db.query("select * from public.aaa_page_widgets where definition_id=$1",[master.rows[0].id])).rows.length,0);
    assert.equal((await db.query("select * from public.db_databases where id=$1",[another])).rows.length,1);
  }finally{await db.close()}
});

test("widget definitions and placements are owner isolated without cloning canonical records",async()=>{
  const db=new PGlite();
  const ownerA="00000000-0000-0000-0000-000000000001",ownerB="00000000-0000-0000-0000-000000000002";
  try{
    await db.exec("create role anon;create role authenticated;create schema auth;"+
      "create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);"+
      "create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;"+
      "grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;"+
      `insert into auth.users(id) values('${ownerA}'),('${ownerB}');`);
    for(const file of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort())
      await db.exec(readFileSync("supabase/migrations/"+file,"utf8"));
    await db.exec("set role authenticated;");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ownerA]);
    const id=crypto.randomUUID();
    await db.query("select public.db_create_database($1,'Characters','acceptance')",[id]);
    const definition=await db.query<{id:string}>(
      "insert into public.aaa_widget_definitions(name,database_id,config) values('Characters at a glance',$1,$2::jsonb) returning id",
      [id,JSON.stringify({renderer:"cards"})]);
    const page=await db.query<{id:string}>("insert into public.aaa_library_pages(area,title) values('library','World View') returning id");
    const section=await db.query<{id:string}>("insert into public.aaa_page_sections(page_id,title,position) values($1,'World History',0) returning id",[page.rows[0].id]);
    await db.query("insert into public.aaa_page_widgets(page_id,definition_id) values($1,$2)",[page.rows[0].id,definition.rows[0].id]);
    assert.equal((await db.query("select * from public.aaa_page_widgets")).rows.length,1);
    assert.equal((await db.query("select * from public.aaa_page_sections")).rows.length,1);
    assert.ok(section.rows[0].id);
    assert.equal((await db.query("select * from public.db_records")).rows.length,0);
    await assert.rejects(db.query("insert into public.aaa_page_widgets(page_id,kind) values($1,'goals')",[page.rows[0].id]),/Goals widget/i);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ownerB]);
    assert.equal((await db.query("select * from public.aaa_page_widgets")).rows.length,0);
    assert.equal((await db.query("select * from public.aaa_library_pages")).rows.length,0);
    assert.equal((await db.query("select * from public.aaa_page_sections")).rows.length,0);
    assert.equal((await db.query("select * from public.aaa_widget_definitions")).rows.length,0);
    await assert.rejects(db.query("insert into public.aaa_widget_definitions(name,database_id) values('Stolen',$1)",[id]),/unavailable|foreign key/i);
    await assert.rejects(db.query("insert into public.aaa_page_widgets(page_id,definition_id) values($1,$2)",[page.rows[0].id,definition.rows[0].id]),/foreign key|permission/i);
    await assert.rejects(db.query("insert into public.aaa_page_sections(page_id,title) values($1,'Cannot access')",[page.rows[0].id]),/foreign key|permission/i);
  }finally{await db.close()}
});
