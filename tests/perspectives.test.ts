import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import {WORLD_DATABASE_TEMPLATES} from "../lib/db-engine/worldbuilding-templates";

const owner="00000000-0000-0000-0000-000000000001";
const other="00000000-0000-0000-0000-000000000002";
test("Perspective templates represent event-scoped membership, abilities and knowledge",()=>{
 const perspectives=WORLD_DATABASE_TEMPLATES.find(x=>x.name==="Perspectives");
 const char=WORLD_DATABASE_TEMPLATES.find(x=>x.name==="Characters");
 assert.ok(perspectives);
 assert.equal(perspectives.properties.find(x=>x.name==="Character")?.target,"Characters");
 assert.equal(perspectives.properties.find(x=>x.name==="Event")?.target,"Events");
 assert.equal(perspectives.properties.find(x=>x.name==="Groups at event")?.target,"Groups");
 assert.equal(perspectives.properties.find(x=>x.name==="Abilities at event")?.target,"Abilities");
 assert.ok(!char?.properties.some(x=>x.name==="Groups"),"Flat Character affiliations cannot be assumed timeless");
});
test("Perspective pairing gets an independent ID, unique per Character and Event, with owner isolation",async()=>{
 const db=new PGlite();
 try {
  await db.exec("create role anon;create role authenticated;create schema auth;"+
    "create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);"+
    "create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;"+
    "grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;"+
    "insert into auth.users(id) values('"+owner+"'),('"+other+"');");
  for(const file of readdirSync("supabase/migrations").filter(x=>x.endsWith(".sql")).sort()){
    await db.exec(readFileSync("supabase/migrations/"+file,"utf8"));
  }
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  const cdb=crypto.randomUUID(),edb=crypto.randomUUID(),pdb=crypto.randomUUID();
  for(const [id,title] of [[cdb,"Characters"],[edb,"Events"],[pdb,"Perspectives"]]){
    await db.query("select public.db_create_database($1,$2,'acceptance')",[id,title]);
  }
  const char=crypto.randomUUID(),event=crypto.randomUUID(),otherEvent=crypto.randomUUID();
  await db.query("select public.db_create_record($1,$2,'Michael Thade')",[char,cdb]);
  await db.query("select public.db_create_record($1,$2,'The Blackout')",[event,edb]);
  await db.query("select public.db_create_record($1,$2,'The Aftermath')",[otherEvent,edb]);
  for(const [title,target] of [["Character",cdb],["Event",edb]]){
    await db.query("insert into public.db_properties(database_id,name,type,config) values($1,$2,'relation',$3::jsonb)",
      [pdb,title,JSON.stringify({target_database_id:target,multi:false})]);
  }
  const first=crypto.randomUUID(),second=crypto.randomUUID();
  const result=await db.query<{db_create_perspective:string}>("select public.db_create_perspective($1,$2,$3)",[first,char,event]);
  assert.equal(result.rows[0].db_create_perspective,first);
  const repeated=await db.query<{db_create_perspective:string}>("select public.db_create_perspective($1,$2,$3)",[crypto.randomUUID(),char,event]);
  assert.equal(repeated.rows[0].db_create_perspective,first,"repeated lookup reuses permanent record");
  await db.query("select public.db_create_perspective($1,$2,$3)",[second,char,otherEvent]);
  const records=await db.query<{record_id:string;sequence_no:number}>(
    "select r.record_id,r.sequence_no from public.db_records r join public.db_perspectives p on p.record_id=r.record_id order by r.sequence_no");
  assert.deepEqual(records.rows.map(x=>Number(x.sequence_no)),[1,2]);
  const title=await db.query<{title:string}>("select title from public.user_items where id=$1",[first]);
  assert.equal(title.rows[0].title,"Michael Thade during The Blackout");
  const count=await db.query<{n:number}>("select count(*)::int as n from public.db_relations where source_record_id=$1",[first]);
  assert.equal(count.rows[0].n,2);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  const hidden=await db.query("select * from public.db_perspectives");
  assert.equal(hidden.rows.length,0);
  await assert.rejects(db.query("select public.db_create_perspective($1,$2,$3)",[crypto.randomUUID(),char,event]),/Character unavailable/);
 } finally {await db.close();}
});
