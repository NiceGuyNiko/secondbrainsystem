import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync,readdirSync} from "node:fs";
import {widgetConfig} from "../lib/widget-system";

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
  assert.equal(parsed.filterMode,"any");
  assert.deepEqual(parsed.sorts.map(s=>s.direction),["desc"]);
  assert.deepEqual(parsed.visibleProperties,["prop-a"]);
  assert.equal(widgetConfig({renderer:"unsafe",filters:"broken"}).filters.length,0);
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
    await db.query("insert into public.aaa_page_widgets(page_id,definition_id) values($1,$2)",[page.rows[0].id,definition.rows[0].id]);
    assert.equal((await db.query("select * from public.aaa_page_widgets")).rows.length,1);
    assert.equal((await db.query("select * from public.db_records")).rows.length,0);
    await assert.rejects(db.query("insert into public.aaa_page_widgets(page_id,kind) values($1,'goals')",[page.rows[0].id]),/Goals widget/i);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ownerB]);
    assert.equal((await db.query("select * from public.aaa_page_widgets")).rows.length,0);
    assert.equal((await db.query("select * from public.aaa_library_pages")).rows.length,0);
    assert.equal((await db.query("select * from public.aaa_widget_definitions")).rows.length,0);
    await assert.rejects(db.query("insert into public.aaa_widget_definitions(name,database_id) values('Stolen',$1)",[id]),/unavailable|foreign key/i);
    await assert.rejects(db.query("insert into public.aaa_page_widgets(page_id,definition_id) values($1,$2)",[page.rows[0].id,definition.rows[0].id]),/foreign key|permission/i);
  }finally{await db.close()}
});
